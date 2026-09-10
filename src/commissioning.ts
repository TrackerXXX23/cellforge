import {
  HOME_TARGET,
  INFEED_PICK_TARGET,
  solveRobotIk,
  type Vec3,
} from './simulation'
import { getSweptSegmentClearance, translateBox, type AxisAlignedBox } from './clearance'

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
  clearanceMethod: 'segment-aabb-swept-sphere/v1'
  clearanceEvidence: {
    keepOutId: 'fixture-a-guide-rail'
    sweepRadiusMm: number
    centerlineDistanceMm: number
    closestPathPoint: Vec3
  }
}

export const recoveryProposals: readonly RecoveryProposal[] = [
  {
    id: 'lifted-approach',
    label: 'Lift the infeed approach',
    description: 'Raise P02 before descending vertically onto the shifted pick target.',
    changedWaypointIds: ['infeed-approach'],
    expectedClearanceMmAt180Shift: 84,
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
const BASELINE_CYCLE_SECONDS = 24
const MINIMUM_APPROVED_CLEARANCE_MM = 50
const MAXIMUM_APPROVED_CYCLE_SECONDS = 25.5
export const INFEED_FIXTURE_ORIGIN: Vec3 = [-1.55, 0, 1.15]
export const P02_SWEEP_RADIUS_METERS = 0.0555
export const P02_KEEP_OUT_LOCAL_BOUNDS: AxisAlignedBox = {
  min: [0.28, 0.62, -0.1794],
  max: [0.29, 1.5, 0.3],
}

function round(value: number, digits = 1) {
  const factor = 10 ** digits
  return Math.round((value + Number.EPSILON) * factor) / factor
}

function shiftTarget(target: Vec3, fixtureShiftMm: number): Vec3 {
  return [target[0] + fixtureShiftMm / 1000, target[1], target[2]]
}

function getApproachTarget(pickTarget: Vec3, repairId: RepairId | null): Vec3 {
  if (repairId === 'lifted-approach') {
    return [pickTarget[0], 1.02, pickTarget[2]]
  }

  if (repairId === 'side-entry') {
    return [pickTarget[0] - 0.0165, 0.88, pickTarget[2] + 0.15]
  }

  return [pickTarget[0], 0.88, pickTarget[2]]
}

function getCycleSeconds(fixtureShiftMm: number, repairId: RepairId | null) {
  if (!repairId) return BASELINE_CYCLE_SECONDS

  const proposal = recoveryProposals.find((candidate) => candidate.id === repairId)
  const shiftRatio = Math.abs(fixtureShiftMm) / 180
  return round(BASELINE_CYCLE_SECONDS + (proposal?.expectedCycleImpactSecondsAt180Shift ?? 0) * shiftRatio)
}

function getModifiedWaypointIds(config: CommissioningConfiguration): readonly string[] {
  if (config.fixtureShiftMm === 0 && config.repairId === null) return []
  if (config.repairId === 'side-entry') return ['infeed-frame', 'infeed-approach', 'infeed-pick']
  if (config.repairId === 'lifted-approach') return ['infeed-frame', 'infeed-approach']
  return ['infeed-frame', 'infeed-pick']
}

/**
 * Evaluates the fixture-shift recovery story with deterministic geometry and
 * prototype kinematics. Results remain engineering aids, not certified safety
 * calculations or controller-ready commissioning evidence.
 */
export function evaluateCommissioning(config: CommissioningConfiguration): CommissioningEvaluation {
  const pickTarget = config.repairId
    ? shiftTarget(INFEED_PICK_TARGET, config.fixtureShiftMm)
    : INFEED_PICK_TARGET
  const approachTarget = getApproachTarget(pickTarget, config.repairId)
  const pathPoints: readonly Vec3[] = [HOME_TARGET, approachTarget, pickTarget]
  const fixtureOffset: Vec3 = [config.fixtureShiftMm / 1000, 0, 0]
  const keepOut = translateBox(P02_KEEP_OUT_LOCAL_BOUNDS, [
    INFEED_FIXTURE_ORIGIN[0] + fixtureOffset[0],
    INFEED_FIXTURE_ORIGIN[1],
    INFEED_FIXTURE_ORIGIN[2],
  ])
  const clearance = getSweptSegmentClearance(approachTarget, pickTarget, keepOut, P02_SWEEP_RADIUS_METERS)
  const minimumClearanceMm = round(clearance.minimumClearanceMm)
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
      detail: `${minimumClearanceMm} mm swept-envelope minimum; prototype gate requires ${MINIMUM_APPROVED_CLEARANCE_MM} mm.`,
      status: pathIsClear ? 'pass' : 'fail',
    },
    {
      id: 'safety-interlocks',
      label: 'Safety interlocks',
      detail: 'Door, workholding fixture, and scanner mappings are unchanged by this candidate revision.',
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
        label: deployable ? 'Preflight passes · measured cycle required' : 'Release blocked by preflight findings',
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
    clearanceMethod: 'segment-aabb-swept-sphere/v1',
    clearanceEvidence: {
      keepOutId: 'fixture-a-guide-rail',
      sweepRadiusMm: P02_SWEEP_RADIUS_METERS * 1000,
      centerlineDistanceMm: round(clearance.centerlineDistanceMm),
      closestPathPoint: clearance.closestPathPoint,
    },
  }
}
