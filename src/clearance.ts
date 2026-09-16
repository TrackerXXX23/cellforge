import type { Vec3 } from './simulation'

export interface AxisAlignedBox {
  min: Vec3
  max: Vec3
}

export interface SweptSegmentClearance {
  centerlineDistanceMm: number
  minimumClearanceMm: number
  closestPathPoint: Vec3
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}

function pointToBoxDistanceSquared(point: Vec3, box: AxisAlignedBox) {
  return point.reduce((total, coordinate, axis) => {
    const nearest = clamp(coordinate, box.min[axis], box.max[axis])
    return total + (coordinate - nearest) ** 2
  }, 0)
}

function pointOnSegment(start: Vec3, end: Vec3, amount: number): Vec3 {
  return [
    start[0] + (end[0] - start[0]) * amount,
    start[1] + (end[1] - start[1]) * amount,
    start[2] + (end[2] - start[2]) * amount,
  ]
}

/**
 * Returns the exact minimum distance between a line segment and an axis-aligned
 * box. Each interval between slab crossings is a convex quadratic, so checking
 * its stationary point and endpoints covers the complete segment.
 */
export function getSweptSegmentClearance(
  start: Vec3,
  end: Vec3,
  box: AxisAlignedBox,
  sweepRadiusMeters: number,
): SweptSegmentClearance {
  const direction: Vec3 = [end[0] - start[0], end[1] - start[1], end[2] - start[2]]
  const breakpoints = new Set([0, 1])

  for (let axis = 0; axis < 3; axis += 1) {
    if (direction[axis] === 0) continue

    for (const boundary of [box.min[axis], box.max[axis]]) {
      const amount = (boundary - start[axis]) / direction[axis]
      if (amount > 0 && amount < 1) breakpoints.add(amount)
    }
  }

  const sortedBreakpoints = [...breakpoints].sort((left, right) => left - right)
  const candidates = new Set(sortedBreakpoints)

  for (let index = 0; index < sortedBreakpoints.length - 1; index += 1) {
    const intervalStart = sortedBreakpoints[index]
    const intervalEnd = sortedBreakpoints[index + 1]
    const midpoint = (intervalStart + intervalEnd) / 2
    let quadratic = 0
    let linear = 0

    for (let axis = 0; axis < 3; axis += 1) {
      const midpointCoordinate = start[axis] + direction[axis] * midpoint
      const boundary = midpointCoordinate < box.min[axis]
        ? box.min[axis]
        : midpointCoordinate > box.max[axis]
          ? box.max[axis]
          : null

      if (boundary === null) continue
      quadratic += direction[axis] ** 2
      linear += direction[axis] * (start[axis] - boundary)
    }

    if (quadratic > 0) {
      candidates.add(clamp(-linear / quadratic, intervalStart, intervalEnd))
    }
  }

  let closestAmount = 0
  let distanceSquared = Number.POSITIVE_INFINITY

  for (const amount of candidates) {
    const candidateDistanceSquared = pointToBoxDistanceSquared(pointOnSegment(start, end, amount), box)
    if (candidateDistanceSquared < distanceSquared) {
      closestAmount = amount
      distanceSquared = candidateDistanceSquared
    }
  }

  const centerlineDistanceMm = Math.sqrt(distanceSquared) * 1000
  return {
    centerlineDistanceMm,
    minimumClearanceMm: Math.max(0, centerlineDistanceMm - sweepRadiusMeters * 1000),
    closestPathPoint: pointOnSegment(start, end, closestAmount),
  }
}

export function translateBox(box: AxisAlignedBox, offset: Vec3): AxisAlignedBox {
  return {
    min: [box.min[0] + offset[0], box.min[1] + offset[1], box.min[2] + offset[2]],
    max: [box.max[0] + offset[0], box.max[1] + offset[1], box.max[2] + offset[2]],
  }
}
