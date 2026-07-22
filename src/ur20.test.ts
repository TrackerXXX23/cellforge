import { describe, expect, it } from 'vitest'
import {
  clampUr20Joint,
  UR20_CNC_APPROACH_SEED_JOINTS,
  UR20_COMMISSIONING_LIMITS,
  UR20_IK_JOINT_NAMES,
  UR20_JOINT_LIMITS,
  UR20_JOINT_NAMES,
  UR20_MAX_JOINT_VELOCITIES,
  UR20_OUTFEED_SEED_JOINTS,
  UR20_READY_JOINTS,
} from './ur20'
import {
  isUr20TcpPoseAccepted,
  UR20_TCP_TOLERANCE,
  UR20_TOOL_DIRECTION_TOLERANCE,
} from './ur20Ik'

describe('UR20 target-driven motion', () => {
  it('defines all six actuated UR20 joints with finite limits', () => {
    expect(UR20_JOINT_NAMES).toHaveLength(6)

    for (const name of UR20_JOINT_NAMES) {
      const [lower, upper] = UR20_JOINT_LIMITS[name]
      expect(Number.isFinite(lower)).toBe(true)
      expect(Number.isFinite(upper)).toBe(true)
      expect(lower).toBeLessThan(upper)
    }
  })

  it('keeps the ready seed inside every URDF joint limit', () => {
    for (const name of UR20_JOINT_NAMES) {
      const [lower, upper] = UR20_JOINT_LIMITS[name]
      expect(UR20_READY_JOINTS[name]).toBeGreaterThanOrEqual(lower)
      expect(UR20_READY_JOINTS[name]).toBeLessThanOrEqual(upper)
    }
  })

  it('keeps the CNC approach seed inside commissioning limits', () => {
    for (const name of UR20_JOINT_NAMES) {
      const [lower, upper] = UR20_COMMISSIONING_LIMITS[name]
      expect(UR20_CNC_APPROACH_SEED_JOINTS[name]).toBeGreaterThanOrEqual(lower)
      expect(UR20_CNC_APPROACH_SEED_JOINTS[name]).toBeLessThanOrEqual(upper)
    }
  })

  it('keeps the outfeed branch seed inside commissioning limits', () => {
    for (const name of UR20_JOINT_NAMES) {
      const [lower, upper] = UR20_COMMISSIONING_LIMITS[name]
      expect(UR20_OUTFEED_SEED_JOINTS[name]).toBeGreaterThanOrEqual(lower)
      expect(UR20_OUTFEED_SEED_JOINTS[name]).toBeLessThanOrEqual(upper)
    }
  })

  it('uses a stable non-flipping commissioning range inside the URDF limits', () => {
    for (const name of UR20_JOINT_NAMES) {
      const [softLower, softUpper] = UR20_COMMISSIONING_LIMITS[name]
      const [hardLower, hardUpper] = UR20_JOINT_LIMITS[name]
      expect(softLower).toBeGreaterThanOrEqual(hardLower)
      expect(softUpper).toBeLessThanOrEqual(hardUpper)
    }

    expect(UR20_COMMISSIONING_LIMITS.elbow_joint).toEqual([-2.9, 2.9])
  })

  it('uses the five position-and-direction-relevant joints for DLS IK', () => {
    expect(UR20_IK_JOINT_NAMES).toEqual(UR20_JOINT_NAMES.slice(0, 5))
  })

  it('uses the UR20 controller velocity ratings for each joint group', () => {
    expect(UR20_MAX_JOINT_VELOCITIES.shoulder_pan_joint).toBeCloseTo(2.0944, 4)
    expect(UR20_MAX_JOINT_VELOCITIES.shoulder_lift_joint).toBeCloseTo(2.0944, 4)
    expect(UR20_MAX_JOINT_VELOCITIES.elbow_joint).toBeCloseTo(2.618, 4)
    expect(UR20_MAX_JOINT_VELOCITIES.wrist_1_joint).toBeCloseTo(3.6652, 4)
  })

  it('accepts only TCP poses inside both runtime tolerances', () => {
    expect(isUr20TcpPoseAccepted(UR20_TCP_TOLERANCE, UR20_TOOL_DIRECTION_TOLERANCE)).toBe(true)
    expect(isUr20TcpPoseAccepted(UR20_TCP_TOLERANCE + 0.001, 0)).toBe(false)
    expect(isUr20TcpPoseAccepted(0, UR20_TOOL_DIRECTION_TOLERANCE + 0.01)).toBe(false)
  })

  it('clamps solver values at the commissioning boundary', () => {
    expect(clampUr20Joint('elbow_joint', -10)).toBe(-2.9)
    expect(clampUr20Joint('elbow_joint', 10)).toBe(2.9)
  })
})
