import { MAX_OBSERVED_JERK } from './motionContinuity'
import { UR20_COMMISSIONING_LIMITS, UR20_JOINT_NAMES } from './ur20'
import { UR20_TCP_TOLERANCE, UR20_TOOL_DIRECTION_TOLERANCE } from './ur20Ik'

export const CYCLE_SAMPLES = 1440
export interface MotionTelemetry {
  token: string
  progress: number
  timestamp: number
  tcpError: number
  directionError: number
  plannedTcpError: number
  plannedDirectionError: number
  continuityFailure: string | null
  currentJointSpeed: number
  currentJointAcceleration: number
  maxJointJerk: number
  maxJointVelocity: number
  maxJointAcceleration: number
  contactFailure: string | null
  sweptFrames: number
  joints: number[]
}
export interface CycleEvidence {
  revisionKey: string
  acceptedSamples: number
  lastProgress: number
  maxAcceptedTcpError: number
  maxAcceptedDirectionError: number
  elapsedSeconds: number
  failure: string | null
  samples: MotionTelemetry[]
}
export function createCycleEvidence(revisionKey: string): CycleEvidence {
  return { revisionKey, acceptedSamples: 0, lastProgress: -1, maxAcceptedTcpError: 0, maxAcceptedDirectionError: 0, elapsedSeconds: 0, failure: null, samples: [] }
}
export function acceptsTelemetry(sample: MotionTelemetry | null, token: string, progress: number, now: number) {
  if (!Number.isFinite(now) || !sample || !Number.isFinite(sample.timestamp) || sample.token !== token || sample.progress !== progress || now < sample.timestamp || now - sample.timestamp > 250) return false
  const errors = [sample.tcpError, sample.directionError, sample.plannedTcpError, sample.plannedDirectionError]
  return sample.contactFailure === null && sample.continuityFailure === null && sample.sweptFrames > 0 && errors.every((value) => Number.isFinite(value) && value >= 0)
    && (progress < 1 || (sample.currentJointSpeed <= 0.01 && sample.currentJointAcceleration <= 0.05))
    && Number.isFinite(sample.maxJointJerk) && sample.maxJointJerk >= 0 && sample.maxJointJerk <= MAX_OBSERVED_JERK
    && sample.tcpError <= UR20_TCP_TOLERANCE
    && sample.plannedTcpError <= UR20_TCP_TOLERANCE
    && sample.directionError <= UR20_TOOL_DIRECTION_TOLERANCE
    && sample.plannedDirectionError <= UR20_TOOL_DIRECTION_TOLERANCE
    && sample.joints.length === UR20_JOINT_NAMES.length
    && sample.joints.every((angle, index) => {
      const [lower, upper] = UR20_COMMISSIONING_LIMITS[UR20_JOINT_NAMES[index]]
      return Number.isFinite(angle) && angle >= lower && angle <= upper
    })
}
export function recordAcceptedSample(evidence: CycleEvidence, sample: MotionTelemetry) {
  const expected = evidence.acceptedSamples / CYCLE_SAMPLES
  if (sample.progress !== expected || evidence.failure) return false
  evidence.samples.push({ ...sample, joints: [...sample.joints] })
  evidence.acceptedSamples += 1
  evidence.lastProgress = sample.progress
  evidence.maxAcceptedTcpError = Math.max(evidence.maxAcceptedTcpError, sample.tcpError)
  evidence.maxAcceptedDirectionError = Math.max(evidence.maxAcceptedDirectionError, sample.directionError)
  return true
}
export function isCycleVerified(evidence: CycleEvidence | null, revisionKey: string) {
  return evidence?.revisionKey === revisionKey && evidence.failure === null
    && evidence.acceptedSamples === CYCLE_SAMPLES + 1 && evidence.lastProgress === 1
}
