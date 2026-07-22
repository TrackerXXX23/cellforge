import { describe, expect, it } from 'vitest'
import {
  getThreeJawContactPoints,
  getThreeJawContactRadius,
  THREE_JAW_CLOSED_RADIUS,
  THREE_JAW_OPEN_RADIUS,
  THREE_JAW_TCP_OFFSET,
  THREE_JAW_TWIST_ANGLE,
} from './eoat'
import { WORKPIECE_RADIUS } from './workpiece'

describe('three-jaw centric grasp geometry', () => {
  it('places the TCP at the center of the jaw contact length', () => {
    expect(THREE_JAW_TCP_OFFSET).toBe(0.14)
  })

  it('lands all three contact faces on the 60 mm blank radius', () => {
    expect(getThreeJawContactRadius(THREE_JAW_CLOSED_RADIUS)).toBeCloseTo(WORKPIECE_RADIUS, 8)
    expect(getThreeJawContactRadius(THREE_JAW_OPEN_RADIUS)).toBeGreaterThan(WORKPIECE_RADIUS)
  })

  it('keeps the three twisted contact points centered around the tool axis', () => {
    const contacts = getThreeJawContactPoints(WORKPIECE_RADIUS, THREE_JAW_TWIST_ANGLE)
    const center = contacts.reduce(
      (sum, point) => [sum[0] + point[0], sum[1] + point[1]] as const,
      [0, 0] as const,
    )

    expect(center[0] / contacts.length).toBeCloseTo(0, 8)
    expect(center[1] / contacts.length).toBeCloseTo(0, 8)
    expect(Math.atan2(contacts[0][1], contacts[0][0])).toBeCloseTo(THREE_JAW_TWIST_ANGLE, 8)
    expect(THREE_JAW_TWIST_ANGLE).toBeCloseTo(Math.PI / 12, 8)
  })
})
