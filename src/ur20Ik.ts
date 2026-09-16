import * as THREE from 'three'
import type { URDFJoint, URDFRobot } from 'urdf-loader'
import type { Vec3 } from './simulation'
import {
  clampUr20Joint,
  UR20_CNC_APPROACH_SEED_JOINTS,
  UR20_IK_JOINT_NAMES,
  UR20_MAX_JOINT_VELOCITIES,
  UR20_READY_JOINTS,
} from './ur20'

export const UR20_TCP_TOLERANCE = 0.018
export const UR20_TOOL_DIRECTION_TOLERANCE = THREE.MathUtils.degToRad(15)

export const MAX_JOINT_ACCELERATION = 4
export const MAX_JOINT_JERK = 120
const POSITION_WEIGHT = 1
const DIRECTION_WEIGHT = 0.15
const POSTURE_WEIGHT = 0.00001
const DAMPING_SQUARED = 0.0025
const SOLVER_RESPONSE = 14
const VELOCITY_RESPONSE = 32
const JOINT_COUNT = UR20_IK_JOINT_NAMES.length
const PLANNER_ITERATIONS = 160
const MAX_PLANNER_STEP = 0.18

export interface Ur20IkWorkspace {
  target: THREE.Vector3
  toolPosition: THREE.Vector3
  jointQuaternion: THREE.Quaternion
  toTool: THREE.Vector3
  toolAxis: THREE.Vector3
  targetDirection: THREE.Vector3
  positionError: THREE.Vector3
  directionDelta: THREE.Vector3
  jointPositions: THREE.Vector3[]
  jointAxes: THREE.Vector3[]
  positionJacobians: THREE.Vector3[]
  directionJacobians: THREE.Vector3[]
  normalMatrix: number[][]
  normalRhs: number[]
  jointSteps: number[]
  jointVelocities: number[]
  jointAccelerations: number[]
  bestJoints: number[]
  directionError: number
}

function createVectorArray() {
  return Array.from({ length: JOINT_COUNT }, () => new THREE.Vector3())
}

function createNormalMatrix() {
  return Array.from({ length: JOINT_COUNT }, () => Array(JOINT_COUNT).fill(0) as number[])
}

export function createUr20IkWorkspace(): Ur20IkWorkspace {
  return {
    target: new THREE.Vector3(),
    toolPosition: new THREE.Vector3(),
    jointQuaternion: new THREE.Quaternion(),
    toTool: new THREE.Vector3(),
    toolAxis: new THREE.Vector3(),
    targetDirection: new THREE.Vector3(),
    positionError: new THREE.Vector3(),
    directionDelta: new THREE.Vector3(),
    jointPositions: createVectorArray(),
    jointAxes: createVectorArray(),
    positionJacobians: createVectorArray(),
    directionJacobians: createVectorArray(),
    normalMatrix: createNormalMatrix(),
    normalRhs: Array(JOINT_COUNT).fill(0) as number[],
    jointSteps: Array(JOINT_COUNT).fill(0) as number[],
    jointVelocities: Array(JOINT_COUNT).fill(0) as number[],
    jointAccelerations: Array(JOINT_COUNT).fill(0) as number[],
    bestJoints: Array(JOINT_COUNT).fill(0) as number[],
    directionError: Number.POSITIVE_INFINITY,
  }
}

function updateToolDirectionError(
  tcp: THREE.Object3D,
  workspace: Ur20IkWorkspace,
) {
  tcp.getWorldQuaternion(workspace.jointQuaternion)
  workspace.toolAxis.set(0, 0, 1).applyQuaternion(workspace.jointQuaternion).normalize()
  workspace.directionError = Math.acos(THREE.MathUtils.clamp(
    workspace.toolAxis.dot(workspace.targetDirection),
    -1,
    1,
  ))
}

export function isUr20TcpPoseAccepted(tcpError: number, directionError: number) {
  return tcpError <= UR20_TCP_TOLERANCE
    && directionError <= UR20_TOOL_DIRECTION_TOLERANCE
}

// Leave tracking margin for the velocity-limited rendered chain.
function isPlannerPoseAccepted(positionError: number, directionError: number) {
  return positionError <= 0.0005
    && directionError <= 0.005
}

function solveNormalEquations(workspace: Ur20IkWorkspace) {
  const matrix = workspace.normalMatrix
  const rhs = workspace.normalRhs
  const solution = workspace.jointSteps

  for (let pivot = 0; pivot < JOINT_COUNT; pivot += 1) {
    let pivotRow = pivot
    for (let row = pivot + 1; row < JOINT_COUNT; row += 1) {
      if (Math.abs(matrix[row][pivot]) > Math.abs(matrix[pivotRow][pivot])) pivotRow = row
    }

    if (pivotRow !== pivot) {
      const row = matrix[pivot]
      matrix[pivot] = matrix[pivotRow]
      matrix[pivotRow] = row
      const value = rhs[pivot]
      rhs[pivot] = rhs[pivotRow]
      rhs[pivotRow] = value
    }

    const diagonal = matrix[pivot][pivot]
    if (Math.abs(diagonal) < 1e-9) return false
    for (let row = pivot + 1; row < JOINT_COUNT; row += 1) {
      const factor = matrix[row][pivot] / diagonal
      for (let column = pivot; column < JOINT_COUNT; column += 1) {
        matrix[row][column] -= factor * matrix[pivot][column]
      }
      rhs[row] -= factor * rhs[pivot]
    }
  }

  for (let row = JOINT_COUNT - 1; row >= 0; row -= 1) {
    let value = rhs[row]
    for (let column = row + 1; column < JOINT_COUNT; column += 1) {
      value -= matrix[row][column] * solution[column]
    }
    solution[row] = value / matrix[row][row]
  }
  return true
}

function calculateDampedLeastSquaresStep(
  robot: URDFRobot,
  tcp: THREE.Object3D,
  workspace: Ur20IkWorkspace,
) {
  tcp.getWorldPosition(workspace.toolPosition)
  updateToolDirectionError(tcp, workspace)
  workspace.positionError.subVectors(workspace.target, workspace.toolPosition)
  workspace.directionDelta.subVectors(workspace.targetDirection, workspace.toolAxis)

  for (let index = 0; index < JOINT_COUNT; index += 1) {
    const name = UR20_IK_JOINT_NAMES[index]
    const joint = robot.joints[name] as URDFJoint | undefined
    if (!joint) return false
    joint.getWorldPosition(workspace.jointPositions[index])
    joint.getWorldQuaternion(workspace.jointQuaternion)
    workspace.jointAxes[index].copy(joint.axis).applyQuaternion(workspace.jointQuaternion).normalize()
    workspace.toTool.subVectors(workspace.toolPosition, workspace.jointPositions[index])
    workspace.positionJacobians[index].crossVectors(workspace.jointAxes[index], workspace.toTool)
    workspace.directionJacobians[index].crossVectors(workspace.jointAxes[index], workspace.toolAxis)
  }

  for (let row = 0; row < JOINT_COUNT; row += 1) {
    workspace.normalRhs[row] = POSITION_WEIGHT
      * workspace.positionJacobians[row].dot(workspace.positionError)
      + DIRECTION_WEIGHT
      * workspace.directionJacobians[row].dot(workspace.directionDelta)
      + POSTURE_WEIGHT
      * THREE.MathUtils.euclideanModulo(
        UR20_READY_JOINTS[UR20_IK_JOINT_NAMES[row]] - robot.joints[UR20_IK_JOINT_NAMES[row]].angle + Math.PI,
        Math.PI * 2,
      ) - POSTURE_WEIGHT * Math.PI
    for (let column = 0; column < JOINT_COUNT; column += 1) {
      workspace.normalMatrix[row][column] = POSITION_WEIGHT
        * workspace.positionJacobians[row].dot(workspace.positionJacobians[column])
        + DIRECTION_WEIGHT
        * workspace.directionJacobians[row].dot(workspace.directionJacobians[column])
        + (row === column ? DAMPING_SQUARED + POSTURE_WEIGHT : 0)
    }
  }

  return solveNormalEquations(workspace)
}

function runPlannerIterations(
  robot: URDFRobot,
  tcp: THREE.Object3D,
  workspace: Ur20IkWorkspace,
) {
  for (let iteration = 0; iteration < PLANNER_ITERATIONS; iteration += 1) {
    robot.updateMatrixWorld(true)
    tcp.getWorldPosition(workspace.toolPosition)
    updateToolDirectionError(tcp, workspace)
    const tcpError = workspace.toolPosition.distanceTo(workspace.target)
    if (isPlannerPoseAccepted(tcpError, workspace.directionError)) return tcpError
    if (!calculateDampedLeastSquaresStep(robot, tcp, workspace)) break

    for (let index = 0; index < JOINT_COUNT; index += 1) {
      const name = UR20_IK_JOINT_NAMES[index]
      const joint = robot.joints[name] as URDFJoint
      const step = THREE.MathUtils.clamp(
        workspace.jointSteps[index],
        -MAX_PLANNER_STEP,
        MAX_PLANNER_STEP,
      )
      robot.setJointValue(name, clampUr20Joint(name, joint.angle + step))
    }
  }

  robot.updateMatrixWorld(true)
  tcp.getWorldPosition(workspace.toolPosition)
  updateToolDirectionError(tcp, workspace)
  return workspace.toolPosition.distanceTo(workspace.target)
}

export function solveUr20IkTarget(
  robot: URDFRobot,
  tcp: THREE.Object3D,
  target: Vec3,
  toolDirection: Vec3,
  workspace: Ur20IkWorkspace,
) {
  workspace.target.set(target[0], target[1], target[2])
  workspace.targetDirection.set(toolDirection[0], toolDirection[1], toolDirection[2]).normalize()

  const firstError = runPlannerIterations(robot, tcp, workspace)
  if (isPlannerPoseAccepted(firstError, workspace.directionError)) return firstError
  let bestScore = firstError + workspace.directionError * 0.1
  for (let index = 0; index < JOINT_COUNT; index += 1) {
    workspace.bestJoints[index] = robot.joints[UR20_IK_JOINT_NAMES[index]].angle
  }

  robot.setJointValues(UR20_READY_JOINTS)
  robot.updateMatrixWorld(true)
  const secondError = runPlannerIterations(robot, tcp, workspace)
  const secondScore = secondError + workspace.directionError * 0.1
  if (isPlannerPoseAccepted(secondError, workspace.directionError)) return secondError
  if (secondScore < bestScore) {
    bestScore = secondScore
    for (let index = 0; index < JOINT_COUNT; index += 1) {
      workspace.bestJoints[index] = robot.joints[UR20_IK_JOINT_NAMES[index]].angle
    }
  }

  if (workspace.targetDirection.x > 0.7) {
    robot.setJointValues(UR20_CNC_APPROACH_SEED_JOINTS)
    robot.updateMatrixWorld(true)
    const cncError = runPlannerIterations(robot, tcp, workspace)
    const cncScore = cncError + workspace.directionError * 0.1
    if (isPlannerPoseAccepted(cncError, workspace.directionError)) return cncError
    if (cncScore < bestScore) {
      bestScore = cncScore
      for (let index = 0; index < JOINT_COUNT; index += 1) {
        workspace.bestJoints[index] = robot.joints[UR20_IK_JOINT_NAMES[index]].angle
      }
    }
  }

  const panSeed = Math.atan2(-workspace.target.z, workspace.target.x)
  const liftSeeds = [-2.6, -1.6, -0.6]
  const elbowSeeds = [-2.4, -0.8, 0.8, 2.4]
  const wristSeeds = [-3, -1.5, 0]
  for (const liftSeed of liftSeeds) {
    for (const elbowSeed of elbowSeeds) {
      for (const wristSeed of wristSeeds) {
        robot.setJointValues({
          shoulder_pan_joint: panSeed,
          shoulder_lift_joint: liftSeed,
          elbow_joint: elbowSeed,
          wrist_1_joint: wristSeed,
          wrist_2_joint: -Math.PI / 2,
          wrist_3_joint: 0,
        })
        robot.updateMatrixWorld(true)
        const candidateError = runPlannerIterations(robot, tcp, workspace)
        const candidateScore = candidateError + workspace.directionError * 0.1
        if (isPlannerPoseAccepted(candidateError, workspace.directionError)) return candidateError
        if (candidateScore < bestScore) {
          bestScore = candidateScore
          for (let index = 0; index < JOINT_COUNT; index += 1) {
            workspace.bestJoints[index] = robot.joints[UR20_IK_JOINT_NAMES[index]].angle
          }
        }
      }
    }
  }

  for (let index = 0; index < JOINT_COUNT; index += 1) {
    robot.setJointValue(UR20_IK_JOINT_NAMES[index], workspace.bestJoints[index])
  }
  robot.updateMatrixWorld(true)
  tcp.getWorldPosition(workspace.toolPosition)
  updateToolDirectionError(tcp, workspace)
  return workspace.toolPosition.distanceTo(workspace.target)
}

export function stepUr20JointMotion(
  robot: URDFRobot,
  targetJoints: readonly number[],
  delta: number,
  workspace: Ur20IkWorkspace,
) {
  const duration = Math.max(0, Math.min(delta, 1 / 15))
  const steps = Math.max(1, Math.ceil(duration * 120))
  const frameDelta = duration / steps

  for (let step = 0; step < steps; step += 1) {
    for (let index = 0; index < JOINT_COUNT; index += 1) {
      const name = UR20_IK_JOINT_NAMES[index]
      const joint = robot.joints[name] as URDFJoint
      const jointError = targetJoints[index] - joint.angle
      // Reserve velocity headroom to ramp maximum acceleration back to zero.
      const velocityHeadroom = MAX_JOINT_ACCELERATION ** 2 / (2 * MAX_JOINT_JERK)
      const desiredVelocity = Math.sign(jointError) * Math.min(
        Math.abs(jointError) * SOLVER_RESPONSE,
        Math.sqrt(2 * MAX_JOINT_ACCELERATION * Math.abs(jointError)),
        UR20_MAX_JOINT_VELOCITIES[name] - velocityHeadroom,
      )
      const velocity = workspace.jointVelocities[index]
      const acceleration = workspace.jointAccelerations[index]
      const desiredAcceleration = THREE.MathUtils.clamp(
        (desiredVelocity - velocity) * VELOCITY_RESPONSE,
        -MAX_JOINT_ACCELERATION, MAX_JOINT_ACCELERATION,
      )
      const nextAcceleration = THREE.MathUtils.clamp(desiredAcceleration,
        acceleration - MAX_JOINT_JERK * frameDelta,
        acceleration + MAX_JOINT_JERK * frameDelta)
      const jerk = frameDelta > 0 ? (nextAcceleration - acceleration) / frameDelta : 0
      const next = clampUr20Joint(name, joint.angle + velocity * frameDelta
        + acceleration * frameDelta ** 2 / 2 + jerk * frameDelta ** 3 / 6)
      workspace.jointVelocities[index] = velocity + (acceleration + nextAcceleration) * frameDelta / 2
      workspace.jointAccelerations[index] = nextAcceleration
      // Integrate the constant-jerk substep exactly; never snap or zero velocity
      // at a target crossing. Boundary clamps remain subject to runtime guards.
      robot.setJointValue(name, next)
    }
  }
  robot.updateMatrixWorld(true)
}

export function measureUr20TcpPose(
  tcp: THREE.Object3D | null,
  target: Vec3,
  toolDirection: Vec3,
  workspace: Ur20IkWorkspace,
) {
  if (!tcp) return Number.POSITIVE_INFINITY
  workspace.target.set(target[0], target[1], target[2])
  workspace.targetDirection.set(toolDirection[0], toolDirection[1], toolDirection[2]).normalize()
  tcp.getWorldPosition(workspace.toolPosition)
  updateToolDirectionError(tcp, workspace)
  return workspace.toolPosition.distanceTo(workspace.target)
}
