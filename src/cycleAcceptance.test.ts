import { describe, expect, it } from 'vitest'
import { acceptsTelemetry, createCycleEvidence, CYCLE_SAMPLES, isCycleVerified, recordAcceptedSample, type MotionTelemetry } from './cycleAcceptance'
import { UR20_JOINT_NAMES, UR20_READY_JOINTS } from './ur20'
const sample = (): MotionTelemetry => ({ token: 'run1', contactFailure: null, continuityFailure: null, maxJointVelocity: 0, currentJointSpeed: 0, maxJointAcceleration: 0, maxJointJerk: 0, currentJointAcceleration: 0, sweptFrames: 1, progress: 0, timestamp: 100, tcpError: 0.01, directionError: 0.1, plannedTcpError: 0.01, plannedDirectionError: 0.1, joints: UR20_JOINT_NAMES.map((name) => UR20_READY_JOINTS[name]) })
describe('actual chain cycle acceptance', () => {
  it('rejects missing, stale, mismatched, invalid and failed measurements', () => {
    expect(acceptsTelemetry(sample(), 'run1', 0, 110)).toBe(true)
    for (const value of [null, { ...sample(), contactFailure: 'door hit' }, { ...sample(), sweptFrames: 0 }, { ...sample(), maxJointJerk: NaN }, { ...sample(), maxJointJerk: 121 }, { ...sample(), continuityFailure: 'joint jump' }, { ...sample(), timestamp: NaN }, { ...sample(), timestamp: -200 }, { ...sample(), token: 'old' }, { ...sample(), progress: 0.5 }, { ...sample(), tcpError: 0.019 }, { ...sample(), directionError: 0.3 }, { ...sample(), plannedTcpError: Infinity }, { ...sample(), plannedDirectionError: NaN }, { ...sample(), joints: [0] }, { ...sample(), joints: Array(6).fill(20) }]) {
      expect(acceptsTelemetry(value, 'run1', 0, 110)).toBe(false)
    }
  })
  it('requires final home to settle before marking completion', () => {
    expect(acceptsTelemetry({ ...sample(), progress: 1, currentJointSpeed: 0.1 }, 'run1', 1, 110)).toBe(false)
    expect(acceptsTelemetry({ ...sample(), progress: 1, currentJointSpeed: 0.005, currentJointAcceleration: 0.2 }, 'run1', 1, 110)).toBe(false)
    expect(acceptsTelemetry({ ...sample(), progress: 1, currentJointSpeed: 0.005 }, 'run1', 1, 110)).toBe(true)
  })
  it('requires every ordered sample, including final home, for the same revision', () => {
    const evidence = createCycleEvidence('revision1')
    expect(recordAcceptedSample(evidence, { ...sample(), progress: 1 })).toBe(false)
    for (let index = 0; index <= CYCLE_SAMPLES; index += 1) {
      expect(isCycleVerified(evidence, 'revision1')).toBe(false)
      expect(recordAcceptedSample(evidence, { ...sample(), progress: index / CYCLE_SAMPLES })).toBe(true)
    }
    expect(evidence.samples).toHaveLength(CYCLE_SAMPLES + 1)
    expect(evidence.samples[CYCLE_SAMPLES].progress).toBe(1)
    expect(isCycleVerified(evidence, 'revision1')).toBe(true)
    expect(isCycleVerified(evidence, 'revision2')).toBe(false)
    evidence.failure = 'tracking failed'
    expect(isCycleVerified(evidence, 'revision1')).toBe(false)
  })
})
