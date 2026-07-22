import { describe, expect, it } from 'vitest'
import {
  clampUr5eJoint,
  UR5E_COMMISSIONING_LIMITS,
  UR5E_IK_JOINT_NAMES,
  UR5E_JOINT_LIMITS,
  UR5E_JOINT_NAMES,
  UR5E_READY_JOINTS,
} from './ur5e'
import {
  isUr5eTcpPoseAccepted,
  UR5E_TCP_TOLERANCE,
  UR5E_TOOL_DIRECTION_TOLERANCE,
} from './ur5eIk'

describe('UR5e target-driven motion', () => {
  it('defines all six actuated UR5e joints with finite limits', () => {
    expect(UR5E_JOINT_NAMES).toHaveLength(6)

    for (const name of UR5E_JOINT_NAMES) {
      const [lower, upper] = UR5E_JOINT_LIMITS[name]
      expect(Number.isFinite(lower)).toBe(true)
      expect(Number.isFinite(upper)).toBe(true)
      expect(lower).toBeLessThan(upper)
    }
  })

  it('keeps the ready seed inside every URDF joint limit', () => {
    for (const name of UR5E_JOINT_NAMES) {
      const [lower, upper] = UR5E_JOINT_LIMITS[name]
      expect(UR5E_READY_JOINTS[name]).toBeGreaterThanOrEqual(lower)
      expect(UR5E_READY_JOINTS[name]).toBeLessThanOrEqual(upper)
    }
  })

  it('uses a stable non-flipping commissioning range inside the URDF limits', () => {
    for (const name of UR5E_JOINT_NAMES) {
      const [softLower, softUpper] = UR5E_COMMISSIONING_LIMITS[name]
      const [hardLower, hardUpper] = UR5E_JOINT_LIMITS[name]
      expect(softLower).toBeGreaterThanOrEqual(hardLower)
      expect(softUpper).toBeLessThanOrEqual(hardUpper)
    }

    expect(UR5E_COMMISSIONING_LIMITS.elbow_joint).toEqual([0, Math.PI])
  })

  it('uses the five position-and-direction-relevant joints for DLS IK', () => {
    expect(UR5E_IK_JOINT_NAMES).toEqual(UR5E_JOINT_NAMES.slice(0, 5))
  })

  it('accepts only TCP poses inside both runtime tolerances', () => {
    expect(isUr5eTcpPoseAccepted(UR5E_TCP_TOLERANCE, UR5E_TOOL_DIRECTION_TOLERANCE)).toBe(true)
    expect(isUr5eTcpPoseAccepted(UR5E_TCP_TOLERANCE + 0.001, 0)).toBe(false)
    expect(isUr5eTcpPoseAccepted(0, UR5E_TOOL_DIRECTION_TOLERANCE + 0.01)).toBe(false)
  })

  it('clamps solver values at the commissioning boundary', () => {
    expect(clampUr5eJoint('elbow_joint', -10)).toBe(0)
    expect(clampUr5eJoint('elbow_joint', 10)).toBe(Math.PI)
  })
})
