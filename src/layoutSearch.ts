import { LAYOUT_PRESETS, type CellLayout, layoutTarget } from './cellLayout'
import { evaluateCommissioning, type RepairId } from './commissioning'
import { CYCLE_SAMPLES } from './cycleAcceptance'
import { MAX_OBSERVED_ACCELERATION, MAX_OBSERVED_JERK } from './motionContinuity'
import type { PlanningEvidence } from './pathPlanning'
import type { MotionPlan } from './simulation'

export interface LayoutCandidate {
  id: string
  layout: CellLayout
  fixtureShiftMm: number
  repairId: RepairId | null
  motionPlan: MotionPlan
}
export interface CandidateResult {
  candidate: LayoutCandidate
  failure: string | null
  evidence: PlanningEvidence | null
}
export interface LayoutSearchResult {
  method: 'bounded-layout-path-search/v1'
  cancelled: boolean
  candidates: CandidateResult[]
  best: CandidateResult | null
}
export type SearchRequest = (fixtureShiftMm: number, cancelled: () => boolean, onProgress: (done: number, total: number) => void) => Promise<LayoutSearchResult>

export function layoutCandidates(fixtureShiftMm: number): LayoutCandidate[] {
  if (!Number.isFinite(fixtureShiftMm)) return []
  const repairs: (RepairId | null)[] = fixtureShiftMm === 0 ? [null] : [null, 'lifted-approach', 'side-entry']
  return LAYOUT_PRESETS.flatMap(layout => repairs.flatMap(repairId => [0, 0.1].map(transferLift => {
    const evaluation = evaluateCommissioning({layout, fixtureShiftMm, repairId})
    return {
      id: `${layout.id}/${repairId ?? 'baseline'}/${transferLift === 0 ? 'standard' : 'raised-transfer'}`,
      layout, fixtureShiftMm, repairId,
      motionPlan: {infeedApproachTarget:evaluation.approachTarget, infeedPickTarget:evaluation.pickTarget,
        outfeedPlaceTarget:layoutTarget(layout, 'outfeed'), transferLift},
    }
  })))
}

function evidenceFailure(evidence: PlanningEvidence): string | null {
  if (evidence.failure) return evidence.failure
  if (evidence.acceptedSamples !== CYCLE_SAMPLES + 1) return 'Incomplete rehearsal coverage'
  if (![evidence.frames, evidence.simulatedSeconds, evidence.tcpTravelMeters, evidence.maxJointVelocity, evidence.maxJointAcceleration, evidence.maxJointJerk].every(value => Number.isFinite(value) && value >= 0)
      || evidence.simulatedSeconds <= 0 || evidence.frames < CYCLE_SAMPLES + 1) return 'Invalid rehearsal metrics'
  if (evidence.maxJointAcceleration > MAX_OBSERVED_ACCELERATION || evidence.maxJointJerk > MAX_OBSERVED_JERK) return 'Motion limits exceeded'
  return null
}

/** Exhaust a small documented candidate family. Never rank blocked or partial
 * evidence, never return a partial winner after cancellation, and use stable
 * tie-breaking so repeating a search has the same result.
 */
export async function searchLayouts(
  fixtureShiftMm: number,
  evaluate: (candidate: LayoutCandidate) => Promise<PlanningEvidence>,
  cancelled = () => false,
  onProgress = (_done: number, _total: number) => {},
): Promise<LayoutSearchResult> {
  const candidates = layoutCandidates(fixtureShiftMm)
  const result: LayoutSearchResult = {method:'bounded-layout-path-search/v1', cancelled:false, candidates:[], best:null}
  onProgress(0, candidates.length)
  for (const candidate of candidates) {
    if (cancelled()) return {...result, cancelled:true, best:null}
    const preflight = evaluateCommissioning(candidate)
    let evidence: PlanningEvidence | null = null
    let failure: string | null = null
    if (!preflight.deployable) failure = 'P02 preflight blocked'
    else {
      try { evidence = await evaluate(candidate); failure = evidenceFailure(evidence) }
      catch (error) { failure = error instanceof Error ? error.message : String(error) }
    }
    result.candidates.push({candidate, failure, evidence})
    onProgress(result.candidates.length, candidates.length)
  }
  if (cancelled()) return {...result, cancelled:true, best:null}
  const feasible = result.candidates.filter(value => value.failure === null && value.evidence)
  feasible.sort((a,b) => a.evidence!.simulatedSeconds - b.evidence!.simulatedSeconds
    || a.evidence!.tcpTravelMeters - b.evidence!.tcpTravelMeters
    || (a.candidate.id < b.candidate.id ? -1 : a.candidate.id > b.candidate.id ? 1 : 0))
  result.best = feasible[0] ?? null
  return result
}
