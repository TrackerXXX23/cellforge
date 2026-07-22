import type { RunState } from './types'

export type Vec3 = readonly [number, number, number]
export type PayloadState = 'raw' | 'finished' | null

export interface MotionState {
  target: Vec3
  action: string
  gripperClosed: boolean
  carrying: PayloadState
  doorOpen: boolean
  machineRunning: boolean
  rawRemoved: boolean
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
  targetKey?: 'infeed-approach' | 'infeed-pick'
  action: string
}

export interface MotionPlan {
  infeedApproachTarget: Vec3
  infeedPickTarget: Vec3
}

export const CYCLE_DURATION_SECONDS = 14.8
export const SHOULDER_HEIGHT = 0.64
export const UPPER_ARM_LENGTH = 1.3
export const FOREARM_LENGTH = 1.1
export const TOOL_TIP_OFFSET = 0.58

export const sequenceBoundaries = [
  1.8 / CYCLE_DURATION_SECONDS,
  (1.8 + 2.4) / CYCLE_DURATION_SECONDS,
  (1.8 + 2.4 + 4.2) / CYCLE_DURATION_SECONDS,
  (1.8 + 2.4 + 4.2 + 4.0) / CYCLE_DURATION_SECONDS,
  1,
] as const

export const HOME_TARGET: Vec3 = [0.75, 1.65, 0.3]
export const INFEED_PICK_TARGET: Vec3 = [-1.13, 0.78, 0.92]
export const INFEED_APPROACH_TARGET: Vec3 = [-1.13, 1.42, 0.92]
export const CNC_CHUCK_TARGET: Vec3 = [1.34, 1.06, -0.25]
export const OUTFEED_PLACE_TARGET: Vec3 = [-1.13, 0.78, -0.92]

export const BASELINE_MOTION_PLAN: MotionPlan = {
  infeedApproachTarget: INFEED_APPROACH_TARGET,
  infeedPickTarget: INFEED_PICK_TARGET,
}

const keyframes: MotionKeyframe[] = [
  { at: 0, target: HOME_TARGET, action: 'Moving to infeed approach' },
  { at: 0.1, targetKey: 'infeed-approach', action: 'Moving to infeed approach' },
  { at: 0.15, targetKey: 'infeed-pick', action: 'Descending to raw part' },
  { at: 0.18, targetKey: 'infeed-pick', action: 'Gripping raw part' },
  { at: 0.24, targetKey: 'infeed-approach', action: 'Lifting raw part' },
  { at: 0.34, target: [0.72, 1.55, -0.25], action: 'Moving to CNC approach' },
  { at: 0.42, target: CNC_CHUCK_TARGET, action: 'Loading CNC chuck' },
  { at: 0.46, target: CNC_CHUCK_TARGET, action: 'Releasing raw part' },
  { at: 0.51, target: [0.72, 1.62, -0.25], action: 'Clearing CNC door' },
  { at: 0.57, target: [0.72, 1.62, -0.25], action: 'Running machine handshake' },
  { at: 0.61, target: [0.72, 1.55, -0.25], action: 'Returning to CNC approach' },
  { at: 0.65, target: CNC_CHUCK_TARGET, action: 'Gripping finished part' },
  { at: 0.68, target: CNC_CHUCK_TARGET, action: 'Confirming finished-part grip' },
  { at: 0.74, target: [0.72, 1.55, -0.25], action: 'Unloading CNC' },
  { at: 0.86, target: [-1.13, 1.42, -0.92], action: 'Moving to outfeed approach' },
  { at: 0.93, target: OUTFEED_PLACE_TARGET, action: 'Descending to outfeed slot' },
  { at: 0.96, target: OUTFEED_PLACE_TARGET, action: 'Releasing finished part' },
  { at: 1, target: HOME_TARGET, action: 'Returning home' },
]

function resolveTarget(frame: MotionKeyframe, plan: MotionPlan): Vec3 {
  if (frame.targetKey === 'infeed-approach') return plan.infeedApproachTarget
  if (frame.targetKey === 'infeed-pick') return plan.infeedPickTarget
  return frame.target ?? HOME_TARGET
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value))
}

function smoothstep(value: number) {
  const t = clamp01(value)
  return t * t * (3 - 2 * t)
}

function interpolateTarget(from: Vec3, to: Vec3, amount: number): Vec3 {
  return [
    from[0] + (to[0] - from[0]) * amount,
    from[1] + (to[1] - from[1]) * amount,
    from[2] + (to[2] - from[2]) * amount,
  ]
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

  const carryingRaw = normalized >= 0.18 && normalized < 0.46
  const carryingFinished = normalized >= 0.68 && normalized < 0.96
  const doorOpen = normalized < 0.49 || (normalized >= 0.575 && normalized < 0.78)

  return {
    target: interpolateTarget(resolveTarget(from, plan), resolveTarget(to, plan), segmentProgress),
    action: runState === 'complete' ? 'Cycle complete · robot home' : to.action,
    gripperClosed: carryingRaw || carryingFinished || (normalized >= 0.15 && normalized < 0.18) || (normalized >= 0.65 && normalized < 0.68),
    carrying: carryingRaw ? 'raw' : carryingFinished ? 'finished' : null,
    doorOpen,
    machineRunning: normalized >= 0.51 && normalized < 0.575,
    rawRemoved: normalized >= 0.18,
    partAtMachine: normalized >= 0.46 && normalized < 0.68,
    partFinished: normalized >= 0.56,
    finishedPlaced: normalized >= 0.96,
  }
}

export function solveRobotIk(target: Vec3): JointSolution {
  const [x, toolY, z] = target
  const radial = Math.hypot(x, z)
  const wristY = toolY + TOOL_TIP_OFFSET
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
  const base = Math.atan2(-z, x)
  const wrist = Math.PI - shoulder - elbow
  const insideJointLimits = base >= -Math.PI && base <= Math.PI
    && shoulder >= -2.6 && shoulder <= 0.8
    && elbow >= -2.75 && elbow <= 0
  const withinBoundaries = reachable && insideJointLimits && isToolTargetPermitted(target)

  return { base, shoulder, elbow, wrist, reachable, withinBoundaries }
}

export function isToolTargetPermitted([x, y, z]: Vec3) {
  if (y < 0.72) return false

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
