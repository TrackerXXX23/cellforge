import { describe, expect, it } from 'vitest'
import {
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
      const joints = solveRobotIk(motion.target)
      expect(joints.reachable, `target at progress ${progress}`).toBe(true)
      expect(joints.withinBoundaries, `boundary at progress ${progress}`).toBe(true)

      const wrist = forwardWristPosition(joints)
      expect(wrist[0]).toBeCloseTo(motion.target[0], 6)
      expect(wrist[1]).toBeCloseTo(motion.target[1] + TOOL_TIP_OFFSET, 6)
      expect(wrist[2]).toBeCloseTo(motion.target[2], 6)
    }
  })

  it('transfers one part through pick, machine, unload, and place states', () => {
    const beforePick = sampleMotion(0.12, 'running')
    const carryingRaw = sampleMotion(0.2, 'running')
    const machining = sampleMotion(0.54, 'running')
    const carryingFinished = sampleMotion(0.72, 'running')
    const placed = sampleMotion(0.98, 'running')

    expect(beforePick.rawRemoved).toBe(false)
    expect(carryingRaw).toMatchObject({ carrying: 'raw', gripperClosed: true, rawRemoved: true })
    expect(machining).toMatchObject({ carrying: null, partAtMachine: true, machineRunning: true, doorOpen: false })
    expect(carryingFinished).toMatchObject({ carrying: 'finished', gripperClosed: true, partFinished: true })
    expect(placed).toMatchObject({ carrying: null, gripperClosed: false, finishedPlaced: true })
  })

  it('opens the CNC door only for load and unload access', () => {
    expect(sampleMotion(0.44, 'running').doorOpen).toBe(true)
    expect(sampleMotion(0.54, 'running').doorOpen).toBe(false)
    expect(sampleMotion(0.62, 'running').doorOpen).toBe(true)
    expect(sampleMotion(0.82, 'running').doorOpen).toBe(false)
  })

  it('uses duration-weighted sequence boundaries', () => {
    expect(getActiveSequenceIndex(0)).toBe(0)
    expect(getActiveSequenceIndex(sequenceBoundaries[0] + 0.001)).toBe(1)
    expect(getActiveSequenceIndex(sequenceBoundaries[1] + 0.001)).toBe(2)
    expect(getActiveSequenceIndex(sequenceBoundaries[2] + 0.001)).toBe(3)
    expect(getActiveSequenceIndex(sequenceBoundaries[3] + 0.001)).toBe(4)
    expect(getActiveSequenceIndex(1)).toBe(4)
  })
})
