import { describe, expect, it } from 'vitest'
import { evaluateCommissioning, recoveryProposals, type RepairId } from './commissioning'

describe('fixture-shift commissioning evaluation', () => {
  it('preserves the commissioned baseline', () => {
    const result = evaluateCommissioning({ fixtureShiftMm: 0, repairId: null })

    expect(result.deployable).toBe(true)
    expect(result.minimumClearanceMm).toBe(84)
    expect(result.cycleSeconds).toBe(14.8)
    expect(result.checks.every((check) => check.status === 'pass')).toBe(true)
    expect(result.revisionDelta).toMatchObject({ fromRevision: 7, toRevision: 7 })
  })

  it('blocks the unchanged path after the fixture moves 180 mm', () => {
    const result = evaluateCommissioning({ fixtureShiftMm: 180, repairId: null })

    expect(result.deployable).toBe(false)
    expect(result.minimumClearanceMm).toBe(9)
    expect(result.affectedSegment).toMatchObject({ id: 'P02', status: 'blocked' })
    expect(result.checks.find((check) => check.id === 'path-clearance')?.status).toBe('fail')
    expect(result.causalTrace.at(-1)).toMatchObject({ layer: 'deployment-gate', status: 'blocked' })
  })

  it('offers two valid repairs with distinct paths and tradeoffs', () => {
    const results = Object.fromEntries(
      recoveryProposals.map((proposal) => [
        proposal.id,
        evaluateCommissioning({ fixtureShiftMm: 180, repairId: proposal.id }),
      ]),
    ) as Record<RepairId, ReturnType<typeof evaluateCommissioning>>

    expect(results['lifted-approach']).toMatchObject({
      deployable: true,
      minimumClearanceMm: 72,
      cycleSeconds: 15.2,
    })
    expect(results['side-entry']).toMatchObject({
      deployable: true,
      minimumClearanceMm: 58,
      cycleSeconds: 14.9,
    })
    expect(results['lifted-approach'].approachTarget).not.toEqual(results['side-entry'].approachTarget)
    expect(results['lifted-approach'].pathPoints).not.toEqual(results['side-entry'].pathPoints)
  })

  it('moves the pick target by the configured fixture delta', () => {
    const baseline = evaluateCommissioning({ fixtureShiftMm: 0, repairId: null })
    const shifted = evaluateCommissioning({ fixtureShiftMm: 180, repairId: null })

    expect(shifted.pickTarget[0] - baseline.pickTarget[0]).toBeCloseTo(0.18, 8)
    expect(shifted.pickTarget[1]).toBe(baseline.pickTarget[1])
    expect(shifted.pickTarget[2]).toBe(baseline.pickTarget[2])
  })

  it('returns identical evidence for identical inputs', () => {
    const config = { fixtureShiftMm: 180, repairId: 'lifted-approach' } as const

    expect(evaluateCommissioning(config)).toStrictEqual(evaluateCommissioning(config))
    expect(evaluateCommissioning(config).clearanceMethod).toBe('prototype-clearance-heuristic/v1')
  })
})
