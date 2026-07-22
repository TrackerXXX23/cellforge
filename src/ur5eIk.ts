import * as THREE from 'three'
import type { URDFJoint, URDFRobot } from 'urdf-loader'
import type { Vec3 } from './simulation'
import {
  clampUr5eJoint,
  UR5E_IK_JOINT_NAMES,
} from './ur5e'

export const UR5E_TCP_TOLERANCE = 0.018
export const UR5E_TOOL_DIRECTION_TOLERANCE = THREE.MathUtils.degToRad(15)

const IK_PASSES_PER_FRAME = 6
const MAX_JOINT_VELOCITY = 3
const POSITION_WEIGHT = 1
const DIRECTION_WEIGHT = 0.02
const DAMPING_SQUARED = 0.0025
const SOLVER_GAIN = 0.8
const JOINT_COUNT = UR5E_IK_JOINT_NAMES.length

export interface Ur5eIkWorkspace {
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
  directionError: number
}

function createVectorArray() {
  return Array.from({ length: JOINT_COUNT }, () => new THREE.Vector3())
}

function createNormalMatrix() {
  return Array.from({ length: JOINT_COUNT }, () => Array(JOINT_COUNT).fill(0) as number[])
}

export function createUr5eIkWorkspace(): Ur5eIkWorkspace {
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
    directionError: Number.POSITIVE_INFINITY,
  }
}

function updateToolDirectionError(
  tcp: THREE.Object3D,
  workspace: Ur5eIkWorkspace,
) {
  tcp.getWorldQuaternion(workspace.jointQuaternion)
  workspace.toolAxis.set(0, 0, 1).applyQuaternion(workspace.jointQuaternion).normalize()
  workspace.directionError = Math.acos(THREE.MathUtils.clamp(
    workspace.toolAxis.dot(workspace.targetDirection),
    -1,
    1,
  ))
}

export function isUr5eTcpPoseAccepted(tcpError: number, directionError: number) {
  return tcpError <= UR5E_TCP_TOLERANCE
    && directionError <= UR5E_TOOL_DIRECTION_TOLERANCE
}

function solveNormalEquations(workspace: Ur5eIkWorkspace) {
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

function stepDampedLeastSquares(
  robot: URDFRobot,
  tcp: THREE.Object3D,
  maxStep: number,
  workspace: Ur5eIkWorkspace,
) {
  tcp.getWorldPosition(workspace.toolPosition)
  updateToolDirectionError(tcp, workspace)
  workspace.positionError.subVectors(workspace.target, workspace.toolPosition)
  workspace.directionDelta.subVectors(workspace.targetDirection, workspace.toolAxis)

  for (let index = 0; index < JOINT_COUNT; index += 1) {
    const name = UR5E_IK_JOINT_NAMES[index]
    const joint = robot.joints[name] as URDFJoint | undefined
    if (!joint) return
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
    for (let column = 0; column < JOINT_COUNT; column += 1) {
      workspace.normalMatrix[row][column] = POSITION_WEIGHT
        * workspace.positionJacobians[row].dot(workspace.positionJacobians[column])
        + DIRECTION_WEIGHT
        * workspace.directionJacobians[row].dot(workspace.directionJacobians[column])
        + (row === column ? DAMPING_SQUARED : 0)
    }
  }

  if (!solveNormalEquations(workspace)) return
  for (let index = 0; index < JOINT_COUNT; index += 1) {
    const name = UR5E_IK_JOINT_NAMES[index]
    const joint = robot.joints[name] as URDFJoint
    const step = THREE.MathUtils.clamp(workspace.jointSteps[index] * SOLVER_GAIN, -maxStep, maxStep)
    robot.setJointValue(name, clampUr5eJoint(name, joint.angle + step))
  }
  robot.updateMatrixWorld(true)
}

export function stepUr5eIk(
  robot: URDFRobot,
  tcp: THREE.Object3D | null,
  target: Vec3,
  toolDirection: Vec3,
  delta: number,
  workspace: Ur5eIkWorkspace,
) {
  if (!tcp) return Number.POSITIVE_INFINITY

  workspace.target.set(target[0], target[1], target[2])
  workspace.targetDirection.set(toolDirection[0], toolDirection[1], toolDirection[2]).normalize()
  const maxStep = MAX_JOINT_VELOCITY * Math.min(delta, 0.05) / IK_PASSES_PER_FRAME

  for (let pass = 0; pass < IK_PASSES_PER_FRAME; pass += 1) {
    robot.updateMatrixWorld(true)
    tcp.getWorldPosition(workspace.toolPosition)
    updateToolDirectionError(tcp, workspace)
    if (isUr5eTcpPoseAccepted(
      workspace.toolPosition.distanceTo(workspace.target),
      workspace.directionError,
    )) break

    stepDampedLeastSquares(robot, tcp, maxStep, workspace)
  }

  tcp.getWorldPosition(workspace.toolPosition)
  updateToolDirectionError(tcp, workspace)
  return workspace.toolPosition.distanceTo(workspace.target)
}
