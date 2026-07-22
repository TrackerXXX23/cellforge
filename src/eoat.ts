// The sourced model places the base frame 10.8 mm beyond the mounting flange,
// then defines its pinch site another 145 mm along the local tool axis.
export const ROBOTIQ_2F85_BASE_OFFSET = 0.0108
export const ROBOTIQ_2F85_PINCH_OFFSET = 0.145
export const ROBOTIQ_2F85_TCP_OFFSET = ROBOTIQ_2F85_BASE_OFFSET + ROBOTIQ_2F85_PINCH_OFFSET

// Closes both mirrored linkages until their silicone faces span the 60 mm blank.
export const ROBOTIQ_2F85_GRASP_ANGLE = 0.2837941092083278

const SPRING_PIVOT_Y = 0.0132
const FOLLOWER_ORIGIN_Y = 0.055
const FOLLOWER_ORIGIN_Z = 0.0375
const PAD_ORIGIN_Y = -0.0189
const SILICONE_INNER_FACE_Y = -0.0066
const SPRING_PIVOT_Z = 0.0609
const PAD_ORIGIN_Z = 0.01352
const SILICONE_CENTER_Z = 0.01875

export function getRobotiqPadOpening(angle: number) {
  const innerFaceFromCenter = SPRING_PIVOT_Y
    + FOLLOWER_ORIGIN_Y * Math.cos(angle)
    - FOLLOWER_ORIGIN_Z * Math.sin(angle)
    + PAD_ORIGIN_Y
    + SILICONE_INNER_FACE_Y
  return innerFaceFromCenter * 2
}

export function getRobotiqPadCenterOffset(angle: number) {
  return SPRING_PIVOT_Z
    + FOLLOWER_ORIGIN_Y * Math.sin(angle)
    + FOLLOWER_ORIGIN_Z * Math.cos(angle)
    + PAD_ORIGIN_Z
    + SILICONE_CENTER_Z
}
