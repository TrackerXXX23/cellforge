import type { RunState } from './types'
import { THREE_JAW_TCP_OFFSET } from './eoat'
import { layoutTarget, REFERENCE_LAYOUT } from './cellLayout'

export type Vec3 = readonly [number, number, number]
export type PayloadState = 'raw' | 'finished' | null

export interface MotionState {
  target: Vec3
  toolDirection: Vec3
  action: string
  gripperClosed: boolean
  carrying: PayloadState
  doorOpen: boolean
  machineRunning: boolean
  machiningProgress: number
  rawRemoved: boolean
  graspContact: 'source' | 'placed' | 'chuck' | null
  partAtMachine: boolean
  partFinished: boolean
  finishedPlaced: boolean
}

export interface JointSolution {
  base: number
  shoulder: number
  elbow: number
  wrist: number
  reachable: boolean
  withinBoundaries: boolean
}

interface MotionKeyframe {
  at: number
  target?: Vec3
  targetKey?: 'infeed-approach' | 'infeed-pick' | 'outfeed-approach' | 'outfeed-place'
  toolDirection: Vec3
  action: string
}

export interface MotionPlan {
  infeedApproachTarget: Vec3
  infeedPickTarget: Vec3
  outfeedPlaceTarget?: Vec3
  transferLift?: number
}

export const CYCLE_DURATION_SECONDS = 24
export const SHOULDER_HEIGHT = 0.2363
export const UPPER_ARM_LENGTH = 0.862
export const FOREARM_LENGTH = 0.888
export const TOOL_TIP_OFFSET = THREE_JAW_TCP_OFFSET

export const sequenceBoundaries = [
  2.8 / CYCLE_DURATION_SECONDS,
  (2.8 + 3.8) / CYCLE_DURATION_SECONDS,
  (2.8 + 3.8 + 6.8) / CYCLE_DURATION_SECONDS,
  (2.8 + 3.8 + 6.8 + 6.4) / CYCLE_DURATION_SECONDS,
  1,
] as const

export const HOME_TARGET: Vec3 = [0.55, 1.15, 0.25]
export const INFEED_PICK_TARGET: Vec3 = layoutTarget(REFERENCE_LAYOUT, 'infeed')
export const INFEED_APPROACH_TARGET: Vec3 = [INFEED_PICK_TARGET[0], INFEED_PICK_TARGET[1] + 0.3, INFEED_PICK_TARGET[2]]
export const CNC_CHUCK_TARGET: Vec3 = [1.34, 1.06, -0.25]
export const OUTFEED_PLACE_TARGET: Vec3 = layoutTarget(REFERENCE_LAYOUT, 'outfeed')

export const BASELINE_MOTION_PLAN: MotionPlan = {
  infeedApproachTarget: INFEED_APPROACH_TARGET,
  infeedPickTarget: INFEED_PICK_TARGET,
}

const keyframes: MotionKeyframe[] = [
  { at: 0, target: HOME_TARGET, toolDirection: [0, -1, 0], action: 'Moving to infeed approach' },
  { at: 0.07, targetKey: 'infeed-approach', toolDirection: [0, -1, 0], action: 'Moving to infeed approach' },
  { at: 0.115, targetKey: 'infeed-approach', toolDirection: [0, -1, 0], action: 'Aligning above raw part' },
  { at: 0.15, targetKey: 'infeed-pick', toolDirection: [0, -1, 0], action: 'Descending vertically to raw part' },
  { at: 0.17, targetKey: 'infeed-pick', toolDirection: [0, -1, 0], action: 'Settling at raw-part grip pose' },
  { at: 0.19, targetKey: 'infeed-pick', toolDirection: [0, -1, 0], action: 'Twisting three jaws down onto raw part' },
  { at: 0.21, targetKey: 'infeed-pick', toolDirection: [0, -1, 0], action: 'Verifying raw-part grip' },
  { at: 0.27, targetKey: 'infeed-approach', toolDirection: [0, -1, 0], action: 'Lifting raw part vertically' },
  { at: 0.305, target: [0.4, 1.2, 0.8], toolDirection: [0, -1, 0], action: 'Routing around robot base to CNC' },
  { at: 0.345, target: [0.4, 1.2, -0.25], toolDirection: [0, -1, 0], action: 'Aligning outside CNC door' },
  { at: 0.405, target: [0.72, 1.06, -0.25], toolDirection: [1, 0, 0], action: 'Reorienting for CNC approach' },
  { at: 0.455, target: CNC_CHUCK_TARGET, toolDirection: [1, 0, 0], action: 'Loading CNC chuck' },
  { at: 0.47, target: CNC_CHUCK_TARGET, toolDirection: [1, 0, 0], action: 'Releasing raw part' },
  { at: 0.51, target: [0.65, 1.06, -0.25], toolDirection: [1, 0, 0], action: 'Clearing CNC door' },
  { at: 0.57, target: [0.65, 1.06, -0.25], toolDirection: [1, 0, 0], action: 'Running machine handshake' },
  { at: 0.61, target: [0.65, 1.06, -0.25], toolDirection: [1, 0, 0], action: 'Returning to CNC approach' },
  { at: 0.65, target: CNC_CHUCK_TARGET, toolDirection: [1, 0, 0], action: 'Twisting three jaws onto finished part' },
  { at: 0.68, target: CNC_CHUCK_TARGET, toolDirection: [1, 0, 0], action: 'Confirming finished-part grip' },
  { at: 0.7, target: [0.65, 1.06, -0.25], toolDirection: [1, 0, 0], action: 'Unloading CNC' },
  { at: 0.73, target: [0.4, 1.2, -0.25], toolDirection: [0, -1, 0], action: 'Reorienting outside CNC door' },
  { at: 0.76, target: [0.4, 1.2, -0.9], toolDirection: [0, -1, 0], action: 'Routing clear of wrist to outfeed' },
  { at: 0.8, targetKey: 'outfeed-approach', toolDirection: [0, -1, 0], action: 'Moving to outfeed approach' },
  { at: 0.84, targetKey: 'outfeed-place', toolDirection: [0, -1, 0], action: 'Descending to outfeed slot' },
  { at: 0.86, targetKey: 'outfeed-place', toolDirection: [0, -1, 0], action: 'Releasing finished part' },
  { at: 0.92, target: [-0.3, 1.15, -0.9], toolDirection: [0, -1, 0], action: 'Returning around robot base' },
  { at: 0.96, target: [0.55, 1.15, -0.7], toolDirection: [0, -1, 0], action: 'Returning around robot base' },
  { at: 1, target: HOME_TARGET, toolDirection: [0, -1, 0], action: 'Returning home' },
]

function resolveTarget(frame: MotionKeyframe, plan: MotionPlan): Vec3 {
  if (frame.targetKey === 'infeed-approach') return plan.infeedApproachTarget
  if (frame.targetKey === 'infeed-pick') return plan.infeedPickTarget
  const outfeed = plan.outfeedPlaceTarget ?? OUTFEED_PLACE_TARGET
  if (frame.targetKey === 'outfeed-place') return outfeed
  if (frame.targetKey === 'outfeed-approach') return [outfeed[0], outfeed[1] + 0.205, outfeed[2]]
  if (frame.target && frame.at >= 0.305 && frame.at <= 0.345) {
    return [frame.target[0], frame.target[1] + (plan.transferLift ?? 0), frame.target[2]]
  }
  return frame.target ?? HOME_TARGET
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value))
}

function smoothstep(value: number) {
  const t = clamp01(value)
  return t * t * t * (t * (t * 6 - 15) + 10)
}

function interpolateTarget(from: Vec3, to: Vec3, amount: number): Vec3 {
  return [
    from[0] + (to[0] - from[0]) * amount,
    from[1] + (to[1] - from[1]) * amount,
    from[2] + (to[2] - from[2]) * amount,
  ]
}

function interpolateDirection(from: Vec3, to: Vec3, amount: number): Vec3 {
  const x = from[0] + (to[0] - from[0]) * amount
  const y = from[1] + (to[1] - from[1]) * amount
  const z = from[2] + (to[2] - from[2]) * amount
  const length = Math.hypot(x, y, z) || 1
  return [x / length, y / length, z / length]
}

export function getActiveSequenceIndex(progress: number) {
  const normalized = clamp01(progress)
  const index = sequenceBoundaries.findIndex((boundary) => normalized < boundary)
  return index === -1 ? sequenceBoundaries.length - 1 : index
}

export function sampleMotion(
  progress: number,
  runState: RunState,
  plan: MotionPlan = BASELINE_MOTION_PLAN,
): MotionState {
  const normalized = runState === 'ready' ? 0 : clamp01(progress)
  const endIndex = Math.max(1, keyframes.findIndex((frame) => frame.at >= normalized))
  const from = keyframes[endIndex - 1]
  const to = keyframes[endIndex]
  const segmentProgress = from.at === to.at ? 1 : smoothstep((normalized - from.at) / (to.at - from.at))

  const carryingRaw = normalized >= 0.19 && normalized < 0.47
  const carryingFinished = normalized >= 0.68 && normalized < 0.86
  const doorOpen = normalized < 0.52 || (normalized >= 0.61 && normalized < 0.78)
  const machiningProgress = clamp01((normalized - 0.52) / 0.09)

  return {
    target: interpolateTarget(resolveTarget(from, plan), resolveTarget(to, plan), segmentProgress),
    toolDirection: interpolateDirection(from.toolDirection, to.toolDirection, segmentProgress),
    action: runState === 'complete' ? 'Cycle complete · robot home' : to.action,
    gripperClosed: carryingRaw
      || carryingFinished
      || (normalized >= 0.17 && normalized < 0.19)
      || (normalized >= 0.65 && normalized < 0.68),
    carrying: carryingRaw ? 'raw' : carryingFinished ? 'finished' : null,
    doorOpen,
    machineRunning: normalized >= 0.52 && normalized < 0.61,
    machiningProgress,
    rawRemoved: normalized >= 0.19,
    graspContact: normalized >= 0.115 && normalized < 0.21 ? 'source' : normalized >= 0.84 && normalized < 0.92 ? 'placed' : (normalized >= 0.455 && normalized < 0.52) || (normalized >= 0.61 && normalized < 0.7) ? 'chuck' : null,
    partAtMachine: normalized >= 0.47 && normalized < 0.68,
    partFinished: normalized >= 0.56,
    finishedPlaced: normalized >= 0.86,
  }
}

export function solveRobotIk(target: Vec3, toolDirection: Vec3 = [0, -1, 0]): JointSolution {
  const wristX = target[0] - toolDirection[0] * TOOL_TIP_OFFSET
  const wristY = target[1] - toolDirection[1] * TOOL_TIP_OFFSET
  const wristZ = target[2] - toolDirection[2] * TOOL_TIP_OFFSET
  const radial = Math.hypot(wristX, wristZ)
  const vertical = wristY - SHOULDER_HEIGHT
  const distanceSquared = radial * radial + vertical * vertical
  const maximumReach = UPPER_ARM_LENGTH + FOREARM_LENGTH
  const minimumReach = Math.abs(UPPER_ARM_LENGTH - FOREARM_LENGTH)
  const distance = Math.sqrt(distanceSquared)
  const reachable = distance <= maximumReach + 1e-6 && distance >= minimumReach - 1e-6
  const cosine = Math.min(1, Math.max(-1,
    (distanceSquared - UPPER_ARM_LENGTH ** 2 - FOREARM_LENGTH ** 2)
      / (2 * UPPER_ARM_LENGTH * FOREARM_LENGTH),
  ))
  const elbow = -Math.acos(cosine)
  const linkAngle = Math.atan2(vertical, Math.max(radial, 1e-6))
    - Math.atan2(
      FOREARM_LENGTH * Math.sin(elbow),
      UPPER_ARM_LENGTH + FOREARM_LENGTH * Math.cos(elbow),
    )
  const shoulder = linkAngle - Math.PI / 2
  const base = Math.atan2(-wristZ, wristX)
  const wrist = Math.PI - shoulder - elbow
  const insideJointLimits = base >= -Math.PI && base <= Math.PI
    && shoulder >= -2.6 && shoulder <= 1
    && elbow >= -2.75 && elbow <= 0
  const withinBoundaries = reachable && insideJointLimits && isToolTargetPermitted(target)

  return { base, shoulder, elbow, wrist, reachable, withinBoundaries }
}

export function isToolTargetPermitted([x, y, z]: Vec3) {
  if (y < 0.64) return false

  const insideMachineBody = x >= 1.125 && x <= 3.375
    && y >= 0 && y <= 2.26
    && z >= -1.11 && z <= 0.61

  if (!insideMachineBody) return true

  const insideDoorAperture = x <= 1.55
    && y >= 0.44 && y <= 1.8
    && z >= -0.87 && z <= 0.37

  return insideDoorAperture
}

export function forwardWristPosition(solution: JointSolution): Vec3 {
  const planar = -Math.sin(solution.shoulder) * UPPER_ARM_LENGTH
    - Math.sin(solution.shoulder + solution.elbow) * FOREARM_LENGTH
  const vertical = Math.cos(solution.shoulder) * UPPER_ARM_LENGTH
    + Math.cos(solution.shoulder + solution.elbow) * FOREARM_LENGTH

  return [
    Math.cos(solution.base) * planar,
    SHOULDER_HEIGHT + vertical,
    -Math.sin(solution.base) * planar,
  ]
}
