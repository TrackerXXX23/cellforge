import { describe, expect, it } from 'vitest'
import { solveRobotIk } from './simulation'
import {
  clampUr5eJoint,
  prototypeJointTarget,
  UR5E_JOINT_LIMITS,
  UR5E_JOINT_NAMES,
} from './ur5e'

describe('UR5e render adapter', () => {
  it('defines all six actuated UR5e joints with finite limits', () => {
    expect(UR5E_JOINT_NAMES).toHaveLength(6)

    for (const name of UR5E_JOINT_NAMES) {
      const [lower, upper] = UR5E_JOINT_LIMITS[name]
      expect(Number.isFinite(lower)).toBe(true)
      expect(Number.isFinite(upper)).toBe(true)
      expect(lower).toBeLessThan(upper)
    }
  })

  it('maps a commissioned prototype solution into every URDF joint limit', () => {
    const solution = solveRobotIk([-1.13, 1.42, 0.92])
    expect(solution.withinBoundaries).toBe(true)

    for (const name of UR5E_JOINT_NAMES) {
      const target = prototypeJointTarget(name, solution)
      const [lower, upper] = UR5E_JOINT_LIMITS[name]
      expect(target).toBeGreaterThanOrEqual(lower)
      expect(target).toBeLessThanOrEqual(upper)
    }
  })

  it('clamps adapter values at the URDF boundary', () => {
    expect(clampUr5eJoint('elbow_joint', -10)).toBe(-Math.PI)
    expect(clampUr5eJoint('elbow_joint', 10)).toBe(Math.PI)
  })
})
