import {
  HOME_TARGET,
  INFEED_PICK_TARGET,
  solveRobotIk,
  type Vec3,
} from './simulation'

export type RepairId = 'lifted-approach' | 'side-entry'

export interface CommissioningConfiguration {
  fixtureShiftMm: number
  repairId: RepairId | null
}

export interface RecoveryProposal {
  id: RepairId
  label: string
  description: string
  changedWaypointIds: readonly string[]
  expectedClearanceMmAt180Shift: number
  expectedCycleImpactSecondsAt180Shift: number
}

export type CommissioningCheckId =
  | 'target-reachability'
  | 'path-clearance'
  | 'safety-interlocks'
  | 'cycle-time'

export interface CommissioningCheckResult {
  id: CommissioningCheckId
  label: string
  detail: string
  status: 'pass' | 'fail'
}

export interface AffectedSegment {
  id: 'P02'
  fromWaypointId: 'infeed-approach'
  toWaypointId: 'infeed-pick'
  minimumClearanceMm: number
  status: 'clear' | 'blocked'
}

export interface CausalTraceEntry {
  layer: 'physical-object' | 'motion-segment' | 'sequence-step' | 'deployment-gate'
  id: string
  label: string
  status: 'affected' | 'blocked' | 'clear'
}

export interface RevisionDelta {
  fromRevision: 7
  toRevision: 7 | 8
  fixtureShiftMm: number
  repairId: RepairId | null
  modifiedWaypointIds: readonly string[]
  cycleDeltaSeconds: number
  clearanceDeltaMm: number
}

export interface CommissioningEvaluation {
  checks: readonly CommissioningCheckResult[]
  deployable: boolean
  cycleSeconds: number
  minimumClearanceMm: number
  pickTarget: Vec3
  approachTarget: Vec3
  pathPoints: readonly Vec3[]
  affectedSegment: AffectedSegment
  causalTrace: readonly CausalTraceEntry[]
  revisionDelta: RevisionDelta
  clearanceMethod: 'prototype-clearance-heuristic/v1'
}

export const recoveryProposals: readonly RecoveryProposal[] = [
  {
    id: 'lifted-approach',
    label: 'Lift the infeed approach',
    description: 'Raise P02 before descending vertically onto the shifted pick target.',
    changedWaypointIds: ['infeed-approach'],
    expectedClearanceMmAt180Shift: 72,
    expectedCycleImpactSecondsAt180Shift: 0.4,
  },
  {
    id: 'side-entry',
    label: 'Enter from the aisle side',
    description: 'Offset P02 laterally and approach the shifted pick target from clear space.',
    changedWaypointIds: ['infeed-approach', 'infeed-pick'],
    expectedClearanceMmAt180Shift: 58,
    expectedCycleImpactSecondsAt180Shift: 0.1,
  },
] as const

const BASELINE_CLEARANCE_MM = 84
const BASELINE_CYCLE_SECONDS = 14.8
const MINIMUM_APPROVED_CLEARANCE_MM = 50
const MAXIMUM_APPROVED_CYCLE_SECONDS = 16
const REFERENCE_SHIFT_MM = 180
const CLEARANCE_LOSS_AT_REFERENCE_SHIFT_MM = 75

function round(value: number, digits = 1) {
  const factor = 10 ** digits
  return Math.round((value + Number.EPSILON) * factor) / factor
}

function shiftTarget(target: Vec3, fixtureShiftMm: number): Vec3 {
  return [target[0] + fixtureShiftMm / 1000, target[1], target[2]]
}

function getApproachTarget(pickTarget: Vec3, repairId: RepairId | null): Vec3 {
  if (repairId === 'lifted-approach') {
    return [pickTarget[0], 1.74, pickTarget[2]]
  }

  if (repairId === 'side-entry') {
    return [pickTarget[0] - 0.18, 1.24, pickTarget[2] + 0.42]
  }

  return [pickTarget[0], 1.42, pickTarget[2]]
}

function getClearanceMm(fixtureShiftMm: number, repairId: RepairId | null) {
  const shiftRatio = Math.abs(fixtureShiftMm) / REFERENCE_SHIFT_MM
  const clearanceLoss = CLEARANCE_LOSS_AT_REFERENCE_SHIFT_MM * shiftRatio
  const strategyBaseline = repairId === 'lifted-approach'
    ? 147
    : repairId === 'side-entry'
      ? 133
      : BASELINE_CLEARANCE_MM

  return round(Math.max(0, strategyBaseline - clearanceLoss))
}

function getCycleSeconds(fixtureShiftMm: number, repairId: RepairId | null) {
  if (!repairId) return BASELINE_CYCLE_SECONDS

  const proposal = recoveryProposals.find((candidate) => candidate.id === repairId)
  const shiftRatio = Math.abs(fixtureShiftMm) / REFERENCE_SHIFT_MM
  return round(BASELINE_CYCLE_SECONDS + (proposal?.expectedCycleImpactSecondsAt180Shift ?? 0) * shiftRatio)
}

function getModifiedWaypointIds(config: CommissioningConfiguration): readonly string[] {
  if (config.fixtureShiftMm === 0 && config.repairId === null) return []
  if (config.repairId === 'side-entry') return ['infeed-frame', 'infeed-approach', 'infeed-pick']
  if (config.repairId === 'lifted-approach') return ['infeed-frame', 'infeed-approach']
  return ['infeed-frame', 'infeed-pick']
}

/**
 * Evaluates the fixture-shift recovery story with deterministic prototype rules.
 * Clearance values are product-design heuristics for this demonstrator, not a
 * collision engine, safety calculation, or certified commissioning result.
 */
export function evaluateCommissioning(config: CommissioningConfiguration): CommissioningEvaluation {
  const pickTarget = shiftTarget(INFEED_PICK_TARGET, config.fixtureShiftMm)
  const approachTarget = getApproachTarget(pickTarget, config.repairId)
  const pathPoints: readonly Vec3[] = [HOME_TARGET, approachTarget, pickTarget]
  const minimumClearanceMm = getClearanceMm(config.fixtureShiftMm, config.repairId)
  const cycleSeconds = getCycleSeconds(config.fixtureShiftMm, config.repairId)
  const pathIsClear = minimumClearanceMm >= MINIMUM_APPROVED_CLEARANCE_MM
  const targetsAreReachable = pathPoints.every((target) => solveRobotIk(target).withinBoundaries)
  const cycleIsApproved = cycleSeconds <= MAXIMUM_APPROVED_CYCLE_SECONDS

  const checks: readonly CommissioningCheckResult[] = [
    {
      id: 'target-reachability',
      label: 'Target reachability',
      detail: targetsAreReachable
        ? 'All candidate waypoints pass the prototype workspace and joint-limit model.'
        : 'At least one candidate waypoint is outside the prototype workspace or joint limits.',
      status: targetsAreReachable ? 'pass' : 'fail',
    },
    {
      id: 'path-clearance',
      label: 'Path clearance',
      detail: `${minimumClearanceMm} mm estimated minimum; prototype gate requires ${MINIMUM_APPROVED_CLEARANCE_MM} mm.`,
      status: pathIsClear ? 'pass' : 'fail',
    },
    {
      id: 'safety-interlocks',
      label: 'Safety interlocks',
      detail: 'Door, chuck, and scanner mappings are unchanged by this candidate revision.',
      status: 'pass',
    },
    {
      id: 'cycle-time',
      label: 'Estimated cycle',
      detail: `${cycleSeconds} s estimated; target is at most ${MAXIMUM_APPROVED_CYCLE_SECONDS} s.`,
      status: cycleIsApproved ? 'pass' : 'fail',
    },
  ]
  const deployable = checks.every((check) => check.status === 'pass')
  const segmentStatus = pathIsClear ? 'clear' : 'blocked'
  const traceStatus = pathIsClear ? 'clear' : 'blocked'

  return {
    checks,
    deployable,
    cycleSeconds,
    minimumClearanceMm,
    pickTarget,
    approachTarget,
    pathPoints,
    affectedSegment: {
      id: 'P02',
      fromWaypointId: 'infeed-approach',
      toWaypointId: 'infeed-pick',
      minimumClearanceMm,
      status: segmentStatus,
    },
    causalTrace: [
      {
        layer: 'physical-object',
        id: 'infeed-a',
        label: `Raw-part fixture A shifted ${config.fixtureShiftMm >= 0 ? '+' : ''}${config.fixtureShiftMm} mm`,
        status: config.fixtureShiftMm === 0 ? 'clear' : 'affected',
      },
      {
        layer: 'motion-segment',
        id: 'P02',
        label: `Infeed approach → pick · ${minimumClearanceMm} mm clearance`,
        status: traceStatus,
      },
      {
        layer: 'sequence-step',
        id: 'pick',
        label: 'Pick raw part',
        status: traceStatus,
      },
      {
        layer: 'deployment-gate',
        id: 'preflight',
        label: deployable ? 'Candidate revision is deployable' : 'Release blocked by preflight findings',
        status: deployable ? 'clear' : 'blocked',
      },
    ],
    revisionDelta: {
      fromRevision: 7,
      toRevision: config.fixtureShiftMm === 0 && config.repairId === null ? 7 : 8,
      fixtureShiftMm: config.fixtureShiftMm,
      repairId: config.repairId,
      modifiedWaypointIds: getModifiedWaypointIds(config),
      cycleDeltaSeconds: round(cycleSeconds - BASELINE_CYCLE_SECONDS),
      clearanceDeltaMm: round(minimumClearanceMm - BASELINE_CLEARANCE_MM),
    },
    clearanceMethod: 'prototype-clearance-heuristic/v1',
  }
}
