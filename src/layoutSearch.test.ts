import { describe, expect, it } from 'vitest'
import { layoutCandidates, searchLayouts } from './layoutSearch'
import type { PlanningEvidence } from './pathPlanning'
const pass = (seconds = 50): PlanningEvidence => ({ method:'asset-rehearsal/v3-cell-contact', failure:null, acceptedSamples:1441,
  frames:3000, simulatedSeconds:seconds, maxJointVelocity:1, maxJointAcceleration:4, maxJointJerk:120, tcpTravelMeters:14, coverage:'test' })

describe('bounded automatic layout and path search', () => {
  it('has a deterministic bounded family and includes raised transfers', () => {
    expect(layoutCandidates(0)).toHaveLength(4)
    expect(layoutCandidates(180)).toHaveLength(12)
    expect(layoutCandidates(NaN)).toEqual([])
    expect(layoutCandidates(0).map(value=>value.id)).toEqual(layoutCandidates(0).map(value=>value.id))
    expect(new Set(layoutCandidates(180).map(value=>value.id)).size).toBe(12)
  })
  it('selects the fastest passing layout and path, not the fastest failed one', async () => {
    const result = await searchLayouts(0, async candidate => candidate.id === 'reference/baseline/standard'
      ? {...pass(1),failure:'CNC collision'} : pass(candidate.motionPlan.transferLift && candidate.layout.id==='compact' ? 40 : 50))
    expect(result.best?.candidate.id).toBe('compact/baseline/raised-transfer')
    expect(result.candidates).toHaveLength(4)
  })
  it('breaks ties deterministically by travel and candidate identity', async () => {
    const result = await searchLayouts(0,async candidate=>({...pass(),tcpTravelMeters:candidate.layout.id==='compact' ? 12 : 14}))
    expect(result.best?.candidate.id).toBe('compact/baseline/raised-transfer')
  })
  it('skips blocked fixture preflights and searches both repairs', async () => {
    const seen: string[] = []
    const result = await searchLayouts(180,async candidate=>{seen.push(candidate.id); return pass()})
    expect(seen).toHaveLength(8)
    expect(seen.every(id=>!id.includes('/baseline/'))).toBe(true)
    expect(result.candidates.filter(value=>value.failure==='P02 preflight blocked')).toHaveLength(4)
  })
  it('rejects partial, nonfinite, implausible and over-limit evidence', async () => {
    const evidence = [{...pass(),acceptedSamples:1400}, {...pass(),simulatedSeconds:NaN}, {...pass(),maxJointJerk:121}, {...pass(),maxJointAcceleration:5}]
    const result = await searchLayouts(0,async()=>evidence.shift()!)
    expect(result.best).toBeNull()
    expect(result.candidates.every(value=>value.failure)).toBe(true)
  })
  it('rejects nonfinite frame counts', async () => {
    const result = await searchLayouts(0, async () => ({...pass(), frames: NaN}))
    expect(result.best).toBeNull()
    expect(result.candidates.every(value => value.failure)).toBe(true)
  })
  it('returns no partial winner after cancellation, including during the last candidate', async () => {
    for (const cancelAt of [1,4]) {
      let evaluated=0
      const result = await searchLayouts(0,async()=>{evaluated++;return pass()},()=>evaluated>=cancelAt)
      expect(result.cancelled).toBe(true)
      expect(result.best).toBeNull()
      expect(evaluated).toBe(cancelAt)
    }
  })
  it('records candidate errors and fails closed when every rehearsal fails', async () => {
    const result = await searchLayouts(0,async()=>{throw new Error('geometry unavailable')})
    expect(result.best).toBeNull()
    expect(result.candidates.every(value=>value.failure==='geometry unavailable')).toBe(true)
  })
})
