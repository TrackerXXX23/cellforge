import { CELL_BODY_IDS, COLLISION_COVERAGE } from './cellBodies'
import type { CellLayout } from './cellLayout'
import * as THREE from 'three'
import type { URDFRobot } from 'urdf-loader'
import { createCncContactMonitor } from './cncContact'
import { createMotionContinuityMonitor } from './motionContinuity'
import { CYCLE_SAMPLES } from './cycleAcceptance'
import { sampleMotion, type MotionPlan } from './simulation'
import { createUr20IkWorkspace, isUr20TcpPoseAccepted, measureUr20TcpPose, solveUr20IkTarget, stepUr20JointMotion } from './ur20Ik'
import { UR20_IK_JOINT_NAMES, UR20_JOINT_NAMES, UR20_READY_JOINTS, UR20_RENDER_SCALE, UR20_COMMISSIONING_LIMITS } from './ur20'
import { CNC_DOOR_OPEN_OFFSET } from './cnc'
import { THREE_JAW_TCP_OFFSET, THREE_JAW_CLOSED_RADIUS, THREE_JAW_OPEN_RADIUS, THREE_JAW_AXIAL_TRAVEL, THREE_JAW_TWIST_ANGLE } from './eoat'

export interface PlanningEvidence {
  method: 'asset-rehearsal/v3-cell-contact'
  failure: string | null
  acceptedSamples: number
  frames: number
  simulatedSeconds: number
  maxJointVelocity: number
  maxJointAcceleration: number
  maxJointJerk: number
  tcpTravelMeters: number
  coverage: string
  failurePose?: { sample: number; joints: number[] }
}
export type PlanningRequest = (plan: MotionPlan, cancelled: () => boolean) => Promise<PlanningEvidence>
export interface PlanningGeometry { robot: THREE.Object3D | null; machine: THREE.Object3D | null; tables: THREE.Object3D[]; cellBodies: { id: string; root: THREE.Object3D }[] }

function worldClone<T extends THREE.Object3D>(source: T): T {
  source.updateWorldMatrix(true, true)
  const copy = source.clone(true)
  source.matrixWorld.decompose(copy.position, copy.quaternion, copy.scale)
  copy.updateMatrixWorld(true)
  return copy
}

/** A bounded candidate rehearsal, not a general search or a safety certificate.
 * Never mutates live assets. Uses the same IK, jerk-limited integrator,
 * pose gates, and approximate swept boxes as execution, at a fixed 60 Hz.
 */
export async function rehearsePlan(geometry: PlanningGeometry, plan: MotionPlan, cancelled = () => false): Promise<PlanningEvidence> {
  const result: PlanningEvidence = { method: 'asset-rehearsal/v3-cell-contact', failure: null, acceptedSamples: 0, frames: 0, simulatedSeconds: 0,
    maxJointVelocity: 0, maxJointAcceleration: 0, maxJointJerk: 0, tcpTravelMeters: 0,
    coverage: COLLISION_COVERAGE }
  if (!geometry.robot || !geometry.machine || geometry.tables.length !== 2 || !geometry.cellBodies || CELL_BODY_IDS.some(id => !geometry.cellBodies.some(body => body.id === id))) {
    return { ...result, failure: 'Planning geometry unavailable: robot, CNC, both tables and all cell bodies are required' }
  }
  const robot = worldClone(geometry.robot) as URDFRobot
  const machine = worldClone(geometry.machine)
  const tables = geometry.tables.map(worldClone)
  const door = machine.getObjectByName('Door')
  const spindle = machine.getObjectByName('Spindle')
  const rotor = robot.getObjectByName('GripperRotor')
  const jaws = robot.getObjectsByProperty('name', 'GripperJaw')
  const payload = robot.getObjectByName('CarriedWorkpiece')
  if (!robot.setJointValues || !robot.frames.tool0 || !door || !spindle || !rotor || jaws.length !== 3 || !payload) {
    return { ...result, failure: 'Planning asset is missing required motion geometry' }
  }
  robot.setJointValues(UR20_READY_JOINTS)
  const planner = robot.clone(true)
  const tcp = new THREE.Object3D()
  tcp.position.z = THREE_JAW_TCP_OFFSET / UR20_RENDER_SCALE
  robot.frames.tool0.add(tcp)
  const plannedTcp = tcp.clone()
  planner.frames.tool0.add(plannedTcp)
  const workspace = createUr20IkWorkspace()
  const solver = createUr20IkWorkspace()
  const continuity = createMotionContinuityMonitor()
  const monitor = createCncContactMonitor(2, CELL_BODY_IDS)
  monitor.registerRobot(robot)
  monitor.registerMachine(machine)
  tables.forEach((table, index) => monitor.registerTable(String(index), table))
  geometry.cellBodies.forEach(({id, root}) => monitor.registerCellBody(id, worldClone(root)))
  door.position.x = CNC_DOOR_OPEN_OFFSET
  spindle.position.y = 1.89
  rotor.rotation.z = 0
  for (const jaw of jaws) { jaw.position.x = THREE_JAW_OPEN_RADIUS; jaw.position.z = -THREE_JAW_AXIAL_TRAVEL }
  const previousTcp = new THREE.Vector3()
  let hasPrevious = false
  const delta = 1 / 60
  for (let index = 0; index <= CYCLE_SAMPLES; index++) {
    // Yield for input/cancellation; all state belongs to this one rehearsal.
    if (index % 24 === 0) {
      await new Promise<void>(resolve => setTimeout(resolve, 0))
      if (cancelled()) return { ...result, failure: 'Planning cancelled by a revision change' }
    }
    const motion = sampleMotion(index / CYCLE_SAMPLES, 'running', plan)
    const error = solveUr20IkTarget(planner, plannedTcp, motion.target, motion.toolDirection, solver)
    if (!isUr20TcpPoseAccepted(error, solver.directionError)) {
      result.failure = `Unreachable planned pose at sample ${index}`
      break
    }
    const targets = UR20_IK_JOINT_NAMES.map(name => planner.joints[name].angle)
    payload.visible = motion.carrying !== null
    let accepted = false
    for (let frame = 0; frame < 480; frame++) {
      rotor.rotation.z = THREE.MathUtils.damp(rotor.rotation.z, motion.gripperClosed ? THREE_JAW_TWIST_ANGLE : 0, 7, delta)
      for (const jaw of jaws) {
        jaw.position.x = THREE.MathUtils.damp(jaw.position.x, motion.gripperClosed ? THREE_JAW_CLOSED_RADIUS : THREE_JAW_OPEN_RADIUS, 7, delta)
        jaw.position.z = THREE.MathUtils.damp(jaw.position.z, motion.gripperClosed ? 0 : -THREE_JAW_AXIAL_TRAVEL, 7, delta)
      }
      stepUr20JointMotion(robot, targets, delta, workspace)
      door.position.x = THREE.MathUtils.damp(door.position.x, motion.doorOpen ? CNC_DOOR_OPEN_OFFSET : 0, 8, delta)
      spindle.position.y = THREE.MathUtils.damp(spindle.position.y, motion.machineRunning ? 1.59 : 1.89, 8, delta)
      machine.updateMatrixWorld(true)
      const joints = UR20_JOINT_NAMES.map(name => robot.joints[name].angle)
      const invalidJoint = joints.some((angle, axis) => {
        const limits = UR20_COMMISSIONING_LIMITS[UR20_JOINT_NAMES[axis]]
        return !Number.isFinite(angle) || angle < limits[0] || angle > limits[1]
      })
      const failure = monitor.measure('planning', false, motion) || continuity.measure(joints, delta, false, 'planning') || (invalidJoint ? 'Joint boundary exceeded' : null)
      result.frames++
      if (failure) { result.failure = `Planning blocked at sample ${index}: ${failure}`; result.failurePose = {sample:index, joints}; break }
      const actualError = measureUr20TcpPose(tcp, motion.target, motion.toolDirection, workspace)
      if (hasPrevious) result.tcpTravelMeters += previousTcp.distanceTo(workspace.toolPosition)
      previousTcp.copy(workspace.toolPosition)
      hasPrevious = true
      const settled = index < CYCLE_SAMPLES || (workspace.jointVelocities.every(v => Math.abs(v) <= 0.01) && workspace.jointAccelerations.every(a => Math.abs(a) <= 0.05))
      if (settled && isUr20TcpPoseAccepted(actualError, workspace.directionError)) { accepted = true; break }
    }
    if (result.failure) break
    if (!accepted) { result.failure = `Planning tracking timeout at sample ${index}`; break }
    result.acceptedSamples++
  }
  result.simulatedSeconds = result.frames / 60
  result.maxJointVelocity = continuity.maxVelocity
  result.maxJointAcceleration = continuity.maxAcceleration
  result.maxJointJerk = continuity.maxJerk
  return result
}

/** Reposition cloned table frames for a candidate without touching the live cell. */
export function geometryForLayout(geometry: PlanningGeometry, layout: CellLayout, fixtureShiftMm: number): PlanningGeometry {
  const names = geometry.tables.map(table => table.name)
  if (names.length !== 2 || !names.includes('infeed-table') || !names.includes('outfeed-table')) return {...geometry, tables:[]}
  const tables = geometry.tables.map(source => {
    const table = worldClone(source)
    const kind = table.name === 'infeed-table' ? 'infeed' : 'outfeed'
    table.position.fromArray(layout[kind])
    if (kind === 'infeed') table.position.x += fixtureShiftMm / 1000
    table.updateMatrixWorld(true)
    return table
  })
  return {...geometry, tables}
}
