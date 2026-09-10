import { describe, expect, it } from 'vitest'
import type { URDFRobot } from 'urdf-loader'
import { createMotionContinuityMonitor } from './motionContinuity'
import { createUr20IkWorkspace, stepUr20JointMotion } from './ur20Ik'
import { UR20_IK_JOINT_NAMES, UR20_JOINT_NAMES, UR20_READY_JOINTS } from './ur20'

function chain() {
  const joints = Object.fromEntries(UR20_JOINT_NAMES.map(name => [name, {angle: UR20_READY_JOINTS[name]}]))
  return {joints, setJointValue(name: string, value: number) { joints[name].angle = value }, updateMatrixWorld() {}} as unknown as URDFRobot
}
describe('joint motion continuity', () => {
  it('keeps actual motion acceleration bounded through small targets and reversals', () => {
    const robot = chain()
    const ws = createUr20IkWorkspace()
    const monitor = createMotionContinuityMonitor()
    for (let frame = 0; frame < 1000; frame++) {
      const delta = [0.0101, 0.016, 0.021, 0.049, 0.0335][frame % 5]
      const targets = UR20_IK_JOINT_NAMES.map(name => UR20_READY_JOINTS[name] + Math.sin(frame / 80) * 0.2)
      stepUr20JointMotion(robot, targets, delta, ws)
      expect(monitor.measure(UR20_JOINT_NAMES.map(name => robot.joints[name].angle), delta, false, 'run')).toBeNull()
    }
    expect(monitor.maxAcceleration).toBeLessThanOrEqual(4.1)
  })
  it('uses elapsed time consistently at 30, 60 and 120 Hz', () => {
    const outcomes = [30, 60, 120].map(fps => {
      const robot = chain()
      const ws = createUr20IkWorkspace()
      const targets = UR20_IK_JOINT_NAMES.map(name => UR20_READY_JOINTS[name] + 0.3)
      for (let frame = 0; frame < fps; frame++) stepUr20JointMotion(robot, targets, 1/fps, ws)
      return robot.joints.shoulder_pan_joint.angle
    })
    expect(Math.max(...outcomes) - Math.min(...outcomes)).toBeLessThan(1e-9)
  })
  it('latches a discontinuity until a new run and preserves pause state', () => {
    const monitor = createMotionContinuityMonitor()
    const angles = UR20_JOINT_NAMES.map(name => UR20_READY_JOINTS[name])
    monitor.measure(angles, 1/60, false, 'run')
    expect(monitor.measure(angles, 1/60, true, 'run')).toBeNull()
    angles[0] += 1
    expect(monitor.measure(angles, 1/60, false, 'run')).toContain('shoulder_pan')
    expect(monitor.measure(angles, 1/60, false, 'run')).toContain('shoulder_pan')
    expect(monitor.measure(angles, 1/60, false, 'new')).toBeNull()
  })
})
