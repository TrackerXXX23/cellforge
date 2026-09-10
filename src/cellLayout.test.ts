import { describe, expect, it } from 'vitest'
import { COMPACT_LAYOUT, LAYOUT_PRESETS, layoutTarget, tableSlot } from './cellLayout'
import { evaluateCommissioning } from './commissioning'
import { sampleMotion } from './simulation'
import { rehearsePlan } from './pathPlanning'
import * as THREE from 'three'

describe('parameterized layout and path contracts', () => {
  it.each(LAYOUT_PRESETS)('aligns pick and placement with rendered slots for $id', layout => {
    const evaluation = evaluateCommissioning({ layout, fixtureShiftMm: 0, repairId: null })
    const plan = {infeedApproachTarget:evaluation.approachTarget,infeedPickTarget:evaluation.pickTarget,outfeedPlaceTarget:layoutTarget(layout,'outfeed')}
    expect(sampleMotion(0.17,'running',plan).target).toEqual(layoutTarget(layout,'infeed'))
    expect(sampleMotion(0.84,'running',plan).target).toEqual(layoutTarget(layout,'outfeed'))
    expect(evaluation.minimumClearanceMm).toBe(84)
    for (const kind of ['infeed','outfeed'] as const) {
      layoutTarget(layout,kind).forEach((value, axis) => expect(value-layout[kind][axis]).toBeCloseTo(tableSlot(kind === 'infeed' ? 2 : 5)[axis]))
    }
  })
  it('moves the fixture obstruction and repair targets in the same layout frame', () => {
    for (const layout of LAYOUT_PRESETS) {
      expect(evaluateCommissioning({layout,fixtureShiftMm:180,repairId:null}).deployable).toBe(false)
      const repaired = evaluateCommissioning({layout,fixtureShiftMm:180,repairId:'side-entry'})
      expect(repaired.deployable).toBe(true)
      expect(repaired.minimumClearanceMm).toBe(58)
      expect(repaired.pickTarget[0]).toBeCloseTo(layoutTarget(layout,'infeed')[0]+0.18)
    }
  })
  it('records both table frames and derived waypoints as a new revision', () => {
    const evaluation = evaluateCommissioning({layout:COMPACT_LAYOUT,fixtureShiftMm:0,repairId:null})
    expect(evaluation.revisionDelta.toRevision).toBe(8)
    expect(evaluation.revisionDelta.modifiedWaypointIds).toEqual(['infeed-frame','infeed-approach','infeed-pick','outfeed-frame','outfeed-approach','outfeed-place'])
    const sameId = evaluateCommissioning({layout:{...COMPACT_LAYOUT,id:'reference'},fixtureShiftMm:0,repairId:null})
    expect(sameId.revisionDelta.toRevision).toBe(8)
  })
  it('blocks unreachable table placements', () => {
    expect(evaluateCommissioning({layout:{...COMPACT_LAYOUT,infeed:[-5,0,1]},fixtureShiftMm:0,repairId:null}).deployable).toBe(false)
  })
  it('fails closed before any accepted samples when geometry is missing', async () => {
    const evaluation = evaluateCommissioning({fixtureShiftMm:0,repairId:null})
    const plan = {infeedApproachTarget:evaluation.approachTarget,infeedPickTarget:evaluation.pickTarget}
    const absent = await rehearsePlan({robot:null,machine:null,tables:[]},plan)
    expect(absent.failure).toContain('unavailable')
    expect(absent.acceptedSamples).toBe(0)
    const incomplete = await rehearsePlan({robot:new THREE.Group(),machine:new THREE.Group(),tables:[new THREE.Group(),new THREE.Group()]},plan)
    expect(incomplete.failure).toContain('missing required')
    expect(incomplete.frames).toBe(0)
  })
})

it('records a raised transfer even when the table layout is unchanged', () => {
  const evaluation=evaluateCommissioning({fixtureShiftMm:0,repairId:null,transferLift:0.1})
  expect(evaluation.revisionDelta.toRevision).toBe(8)
  expect(evaluation.revisionDelta.modifiedWaypointIds).toEqual(['transfer-around-base','cnc-door-align'])
  const standard={infeedApproachTarget:evaluation.approachTarget,infeedPickTarget:evaluation.pickTarget}
  const raised={...standard,transferLift:0.1}
  expect(sampleMotion(0.305,'running',raised).target[1]-sampleMotion(0.305,'running',standard).target[1]).toBeCloseTo(0.1)
  expect(sampleMotion(0.4,'running',raised).target).toEqual(sampleMotion(0.4,'running',standard).target)
})
