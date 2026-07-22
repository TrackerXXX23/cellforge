import { describe, expect, it } from 'vitest'
import { getSweptSegmentClearance, translateBox, type AxisAlignedBox } from './clearance'

const unitBox: AxisAlignedBox = { min: [0, 0, 0], max: [1, 1, 1] }

describe('swept segment clearance', () => {
  it('finds the exact closest point in the interior of a segment', () => {
    const result = getSweptSegmentClearance([-1, 0.5, -1], [2, 0.5, -1], unitBox, 0.25)

    expect(result.centerlineDistanceMm).toBeCloseTo(1000, 8)
    expect(result.minimumClearanceMm).toBeCloseTo(750, 8)
    expect(result.closestPathPoint[2]).toBe(-1)
    expect(result.closestPathPoint[0]).toBeGreaterThanOrEqual(0)
    expect(result.closestPathPoint[0]).toBeLessThanOrEqual(1)
  })

  it('returns zero when the swept envelope intersects the box', () => {
    const result = getSweptSegmentClearance([-1, 0.5, 0.5], [2, 0.5, 0.5], unitBox, 0.1)

    expect(result.centerlineDistanceMm).toBe(0)
    expect(result.minimumClearanceMm).toBe(0)
  })

  it('translates all box bounds without mutating the source', () => {
    expect(translateBox(unitBox, [2, -1, 0.5])).toEqual({
      min: [2, -1, 0.5],
      max: [3, 0, 1.5],
    })
    expect(unitBox).toEqual({ min: [0, 0, 0], max: [1, 1, 1] })
  })
})
