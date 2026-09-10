import { MAX_JOINT_ACCELERATION, MAX_JOINT_JERK } from './ur20Ik'
import { UR20_JOINT_NAMES, UR20_MAX_JOINT_VELOCITIES } from './ur20'

export const MAX_OBSERVED_ACCELERATION = MAX_JOINT_ACCELERATION + 0.1
export const MAX_OBSERVED_JERK = MAX_JOINT_JERK + 0.1
export function createMotionContinuityMonitor() {
  const angles = Array(6).fill(0) as number[]
  const velocities = Array(6).fill(0) as number[]
  const accelerations = Array(6).fill(0) as number[]
  let token = ''
  let olderDelta = 0
  let accelerationInitialized = false
  let previousDelta = 0
  let initialized = false
  let velocityInitialized = false
  let failure: string | null = null
  let maxVelocity = 0
  let maxAcceleration = 0
  let maxJerk = 0
  return {
    measure(joints: readonly number[], delta: number, paused: boolean, nextToken: string) {
      if (token !== nextToken) {
        token = nextToken
        initialized = false
        velocityInitialized = false
        accelerationInitialized = false
        maxJerk = 0
        failure = null
        maxVelocity = 0
        maxAcceleration = 0
      }
      if (paused || failure) return failure
      const dt = Math.min(delta, 1 / 15)
      if (!(dt > 0) || !Number.isFinite(dt)) return failure
      for (let index = 0; index < joints.length; index += 1) {
        const velocity = initialized ? (joints[index] - angles[index]) / dt : 0
        const acceleration = velocityInitialized ? (velocity - velocities[index]) / ((dt + previousDelta) / 2) : 0
        // Third divided differences recover bounded jerk even at uneven frame
        // intervals; differentiating absolute acceleration invents sign spikes.
        const jerk = accelerationInitialized ? 3 * (acceleration - accelerations[index]) / (dt + previousDelta + olderDelta) : 0
        maxJerk = Math.max(maxJerk, Math.abs(jerk))
        maxVelocity = Math.max(maxVelocity, Math.abs(velocity))
        maxAcceleration = Math.max(maxAcceleration, Math.abs(acceleration))
        if (!Number.isFinite(velocity) || Math.abs(velocity) > UR20_MAX_JOINT_VELOCITIES[UR20_JOINT_NAMES[index]] + 0.001
            || Math.abs(acceleration) > MAX_OBSERVED_ACCELERATION || !Number.isFinite(jerk) || Math.abs(jerk) > MAX_OBSERVED_JERK) failure = `Motion continuity limit: ${UR20_JOINT_NAMES[index]}`
        accelerations[index] = acceleration
        angles[index] = joints[index]
        velocities[index] = velocity
      }
      accelerationInitialized = velocityInitialized
      velocityInitialized = initialized
      initialized = true
      olderDelta = previousDelta
      previousDelta = dt
      return failure
    },
    get maxJerk() { return maxJerk },
    get maxVelocity() { return maxVelocity },
    get maxAcceleration() { return maxAcceleration },
  }
}
