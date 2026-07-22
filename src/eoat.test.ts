import { describe, expect, it } from 'vitest'
import {
  getRobotiqPadCenterOffset,
  getRobotiqPadOpening,
  ROBOTIQ_2F85_BASE_OFFSET,
  ROBOTIQ_2F85_FINGER_ADVANCE,
  ROBOTIQ_2F85_FINGER_TRAVEL,
  ROBOTIQ_2F85_GRASP_ANGLE,
  ROBOTIQ_2F85_PINCH_OFFSET,
  ROBOTIQ_2F85_TCP_OFFSET,
} from './eoat'
import { WORKPIECE_RADIUS } from './workpiece'

describe('Robotiq 2F-85 grasp geometry', () => {
  it('places the TCP at the sourced pinch site beyond the mounting flange', () => {
    expect(ROBOTIQ_2F85_TCP_OFFSET).toBeCloseTo(
      ROBOTIQ_2F85_BASE_OFFSET + ROBOTIQ_2F85_PINCH_OFFSET,
      8,
    )
  })

  it('closes both pad faces evenly around the 60 mm blank', () => {
    const padOpening = getRobotiqPadOpening(ROBOTIQ_2F85_GRASP_ANGLE)
      - ROBOTIQ_2F85_FINGER_TRAVEL * 2
    const padCenter = getRobotiqPadCenterOffset(ROBOTIQ_2F85_GRASP_ANGLE)
      + ROBOTIQ_2F85_FINGER_ADVANCE

    expect(padOpening).toBeCloseTo(WORKPIECE_RADIUS * 2, 8)
    expect(padCenter).toBeCloseTo(ROBOTIQ_2F85_PINCH_OFFSET, 3)
  })
})
