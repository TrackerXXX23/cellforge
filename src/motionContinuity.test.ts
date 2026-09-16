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

it('measures signed cubic jerk correctly with uneven frame intervals', () => {
  const monitor = createMotionContinuityMonitor()
  let time = 0
  for (const dt of [0.011,0.025,0.017,0.039,0.01,0.023]) {
    time += dt
    const joints = UR20_JOINT_NAMES.map(name => UR20_READY_JOINTS[name] + 8 * time ** 3 / 6)
    expect(monitor.measure(joints,dt,false,'cubic')).toBeNull()
  }
  expect(monitor.maxJerk).toBeCloseTo(8,7)
})

it('rejects excessive jerk even while speed and acceleration are within limits', () => {
  const monitor = createMotionContinuityMonitor()
  let time = 0
  for (let frame=0;frame<5;frame++) {
    time += 0.001
    const joints = UR20_JOINT_NAMES.map(name => UR20_READY_JOINTS[name] + 200 * time ** 3 / 6)
    monitor.measure(joints,0.001,false,'jerk')
  }
  expect(monitor.maxVelocity).toBeLessThan(1)
  expect(monitor.maxAcceleration).toBeLessThan(4)
  expect(monitor.maxJerk).toBeGreaterThan(120)
  expect(monitor.measure(UR20_JOINT_NAMES.map(name=>UR20_READY_JOINTS[name]),0.001,true,'jerk')).toContain('continuity')
})

it('bounds controller jerk and speed through abrupt reversals and settles acceleration at rest', () => {
  const robot=chain(), ws=createUr20IkWorkspace(), monitor=createMotionContinuityMonitor()
  let priorAcceleration = [...ws.jointAccelerations]
  for (let frame=0;frame<2400;frame++) {
    const offset=frame<240 ? 0.6 : frame<480 ? -0.6 : 0
    const targets=UR20_IK_JOINT_NAMES.map(name=>UR20_READY_JOINTS[name]+offset)
    stepUr20JointMotion(robot,targets,1/240,ws)
    for(let axis=0;axis<5;axis++) expect(Math.abs(ws.jointAccelerations[axis]-priorAcceleration[axis])*240).toBeLessThanOrEqual(120.00001)
    priorAcceleration=[...ws.jointAccelerations]
    expect(monitor.measure(UR20_JOINT_NAMES.map(name=>robot.joints[name].angle),1/240,false,'reversal')).toBeNull()
  }
  expect(Math.max(...ws.jointVelocities.map(Math.abs))).toBeLessThan(0.01)
  expect(Math.max(...ws.jointAccelerations.map(Math.abs))).toBeLessThan(0.05)
})

it('keeps velocity headroom through a long saturated move and reversal', () => {
  const robot=chain(),ws=createUr20IkWorkspace(),monitor=createMotionContinuityMonitor()
  for(let frame=0;frame<1200;frame++) {
    const targets=UR20_IK_JOINT_NAMES.map(name=>UR20_READY_JOINTS[name])
    targets[0]=frame<480 ? 2.3 : -2.3
    stepUr20JointMotion(robot,targets,1/120,ws)
    expect(monitor.measure(UR20_JOINT_NAMES.map(name=>robot.joints[name].angle),1/120,false,'long')).toBeNull()
  }
  expect(monitor.maxVelocity).toBeLessThan(2.0944)
  expect(Math.abs(robot.joints.shoulder_pan_joint.angle+2.3)).toBeLessThan(0.001)
})
