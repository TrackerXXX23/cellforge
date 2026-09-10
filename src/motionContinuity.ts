import { UR20_JOINT_NAMES, UR20_MAX_JOINT_VELOCITIES } from './ur20'

export const MAX_OBSERVED_ACCELERATION = 4.1
export function createMotionContinuityMonitor() {
  const angles = Array(6).fill(0) as number[]
  const velocities = Array(6).fill(0) as number[]
  let token = ''
  let previousDelta = 0
  let initialized = false
  let velocityInitialized = false
  let failure: string | null = null
  let maxVelocity = 0
  let maxAcceleration = 0
  return {
    measure(joints: readonly number[], delta: number, paused: boolean, nextToken: string) {
      if (token !== nextToken) {
        token = nextToken
        initialized = false
        velocityInitialized = false
        failure = null
        maxVelocity = 0
        maxAcceleration = 0
      }
      if (paused || failure) return failure
      const dt = Math.min(delta, 1 / 15)
      if (!(dt > 0) || !Number.isFinite(dt)) return failure
      for (let index = 0; index < joints.length; index += 1) {
        const velocity = initialized ? (joints[index] - angles[index]) / dt : 0
        const acceleration = velocityInitialized ? Math.abs(velocity - velocities[index]) / ((dt + previousDelta) / 2) : 0
        maxVelocity = Math.max(maxVelocity, Math.abs(velocity))
        maxAcceleration = Math.max(maxAcceleration, acceleration)
        if (!Number.isFinite(velocity) || Math.abs(velocity) > UR20_MAX_JOINT_VELOCITIES[UR20_JOINT_NAMES[index]] + 0.001
            || acceleration > MAX_OBSERVED_ACCELERATION) failure = `Motion continuity limit: ${UR20_JOINT_NAMES[index]}`
        angles[index] = joints[index]
        velocities[index] = velocity
      }
      velocityInitialized = initialized
      initialized = true
      previousDelta = dt
      return failure
    },
    get maxVelocity() { return maxVelocity },
    get maxAcceleration() { return maxAcceleration },
  }
}
