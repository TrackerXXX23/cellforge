export const THREE_JAW_TCP_OFFSET = 0.14
export const THREE_JAW_OPEN_RADIUS = 0.058
export const THREE_JAW_CONTACT_DEPTH = 0.006
export const THREE_JAW_CLOSED_RADIUS = 0.036
export const THREE_JAW_TWIST_ANGLE = Math.PI / 12

export function getThreeJawContactRadius(jawCenterRadius: number) {
  return jawCenterRadius - THREE_JAW_CONTACT_DEPTH
}

export function getThreeJawContactPoints(radius: number, rotation = 0) {
  return [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3].map((angle) => [
    Math.cos(angle + rotation) * radius,
    Math.sin(angle + rotation) * radius,
  ] as const)
}
