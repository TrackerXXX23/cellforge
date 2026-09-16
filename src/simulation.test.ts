import { describe, expect, it } from 'vitest'
import {
  BASELINE_MOTION_PLAN,
  TOOL_TIP_OFFSET,
  forwardWristPosition,
  getActiveSequenceIndex,
  sampleMotion,
  sequenceBoundaries,
  solveRobotIk,
} from './simulation'

describe('machine-tending motion plan', () => {
  it('keeps every sampled tool target inside the arm workspace', () => {
    for (let index = 0; index <= 200; index += 1) {
      const progress = index / 200
      const motion = sampleMotion(progress, progress === 1 ? 'complete' : 'running')
      const joints = solveRobotIk(motion.target, motion.toolDirection)
      expect(joints.reachable, `target at progress ${progress}`).toBe(true)
      expect(joints.withinBoundaries, `boundary at progress ${progress}`).toBe(true)

      const wrist = forwardWristPosition(joints)
      expect(wrist[0]).toBeCloseTo(motion.target[0] - motion.toolDirection[0] * TOOL_TIP_OFFSET, 6)
      expect(wrist[1]).toBeCloseTo(motion.target[1] - motion.toolDirection[1] * TOOL_TIP_OFFSET, 6)
      expect(wrist[2]).toBeCloseTo(motion.target[2] - motion.toolDirection[2] * TOOL_TIP_OFFSET, 6)
    }
  })

  it('transfers one part through pick, machine, unload, and place states', () => {
    const beforePick = sampleMotion(0.12, 'running')
    const carryingRaw = sampleMotion(0.2, 'running')
    const machining = sampleMotion(0.56, 'running')
    const carryingFinished = sampleMotion(0.72, 'running')
    const placed = sampleMotion(0.98, 'running')

    expect(beforePick.rawRemoved).toBe(false)
    expect(carryingRaw).toMatchObject({ carrying: 'raw', gripperClosed: true, rawRemoved: true })
    expect(machining).toMatchObject({ carrying: null, partAtMachine: true, machineRunning: true, doorOpen: false })
    expect(machining.machiningProgress).toBeGreaterThan(0)
    expect(carryingFinished).toMatchObject({ carrying: 'finished', gripperClosed: true, partFinished: true })
    expect(placed).toMatchObject({ carrying: null, gripperClosed: false, finishedPlaced: true })
  })

  it('settles, closes, verifies, and lifts without moving the blank at transfer', () => {
    const settled = sampleMotion(0.16, 'running')
    const closing = sampleMotion(0.18, 'running')
    const verified = sampleMotion(0.2, 'running')
    const lifting = sampleMotion(0.24, 'running')

    expect(settled).toMatchObject({
      target: BASELINE_MOTION_PLAN.infeedPickTarget,
      gripperClosed: false,
      carrying: null,
      rawRemoved: false,
    })
    expect(closing).toMatchObject({
      target: BASELINE_MOTION_PLAN.infeedPickTarget,
      gripperClosed: true,
      carrying: null,
      rawRemoved: false,
    })
    expect(verified).toMatchObject({
      target: BASELINE_MOTION_PLAN.infeedPickTarget,
      gripperClosed: true,
      carrying: 'raw',
      rawRemoved: true,
    })
    expect(lifting.target[0]).toBe(BASELINE_MOTION_PLAN.infeedPickTarget[0])
    expect(lifting.target[1]).toBeGreaterThan(BASELINE_MOTION_PLAN.infeedPickTarget[1])
    expect(lifting.target[2]).toBe(BASELINE_MOTION_PLAN.infeedPickTarget[2])
  })

  it('opens the CNC door only for load and unload access', () => {
    expect(sampleMotion(0.44, 'running').doorOpen).toBe(true)
    expect(sampleMotion(0.56, 'running').doorOpen).toBe(false)
    expect(sampleMotion(0.62, 'running').doorOpen).toBe(true)
    expect(sampleMotion(0.82, 'running').doorOpen).toBe(false)
  })

  it('orients the tool down at fixtures and into the CNC chuck', () => {
    expect(sampleMotion(0.16, 'running').toolDirection).toEqual([0, -1, 0])
    expect(sampleMotion(0.44, 'running').toolDirection).toEqual([1, 0, 0])
    expect(sampleMotion(0.94, 'running').toolDirection).toEqual([0, -1, 0])
  })

  it('uses duration-weighted sequence boundaries', () => {
    expect(getActiveSequenceIndex(0)).toBe(0)
    expect(getActiveSequenceIndex(sequenceBoundaries[0] + 0.001)).toBe(1)
    expect(getActiveSequenceIndex(sequenceBoundaries[1] + 0.001)).toBe(2)
    expect(getActiveSequenceIndex(sequenceBoundaries[2] + 0.001)).toBe(3)
    expect(getActiveSequenceIndex(sequenceBoundaries[3] + 0.001)).toBe(4)
    expect(getActiveSequenceIndex(1)).toBe(4)
  })

  it('executes a validated revision against its configured infeed targets', () => {
    const revisedPlan = {
      ...BASELINE_MOTION_PLAN,
      infeedApproachTarget: [-0.95, 1.02, 1.05] as const,
      infeedPickTarget: [-0.95, 0.78, 0.92] as const,
    }

    expect(sampleMotion(0.07, 'running', revisedPlan).target).toEqual(revisedPlan.infeedApproachTarget)
    expect(sampleMotion(0.15, 'running', revisedPlan).target).toEqual(revisedPlan.infeedPickTarget)
  })
})
