// Run through Playwright CLI with the dev app idle. Uses only geometry copies.
async (page) => {
  await page.reload() // Fresh modules after source edits; run only while idle.
  await page.waitForFunction(() => window.__CELLFORGE_GEOMETRY__?.().tables.length === 2)
  const results = await page.evaluate(async () => {
    const { rehearsePlan } = await import('/src/pathPlanning.ts')
    const { evaluateCommissioning } = await import('/src/commissioning.ts')
    const { layoutTarget, REFERENCE_LAYOUT } = await import('/src/cellLayout.ts')
    const source = window.__CELLFORGE_GEOMETRY__()
    const evaluation = evaluateCommissioning({fixtureShiftMm:0,repairId:null})
    const plan = {infeedApproachTarget:evaluation.approachTarget,infeedPickTarget:evaluation.pickTarget,outfeedPlaceTarget:layoutTarget(REFERENCE_LAYOUT,'outfeed')}
    const cloneWorld = root => {
      root.updateWorldMatrix(true,true)
      const copy = root.clone(true)
      root.matrixWorld.decompose(copy.position,copy.quaternion,copy.scale)
      copy.updateMatrixWorld(true)
      return copy
    }
    const machine = cloneWorld(source.machine)
    machine.getObjectByName('DoorGlass').scale.setScalar(100)
    const tables = source.tables.map(cloneWorld)
    tables[0].position.set(0.55,0.6,0.25)
    tables[0].updateMatrixWorld(true)
    const results = {
      missing:await rehearsePlan({...source,tables:[]},plan),
      cncBlocked:await rehearsePlan({...source,machine},plan),
      tableBlocked:await rehearsePlan({...source,tables},plan),
      unreachable:await rehearsePlan(source,{...plan,infeedApproachTarget:[-5,1,1]}),
      cancelled:await rehearsePlan(source,plan,()=>true),
    }
    window.__CELLFORGE_PLANNING_FAILURES__ = results
    return results
  })
  for (const [name, evidence] of Object.entries(results)) {
    if (!evidence.failure || evidence.acceptedSamples >= 1441) throw new Error(`${name} did not block`)
  }
  return results
}
