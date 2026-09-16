// Run on an idle dev app. All injected geometry belongs to clones.
async page => {
  await page.reload()
  await page.waitForFunction(() => window.__CELLFORGE_GEOMETRY__?.().cellBodies.length === 5)
  return page.evaluate(async () => {
    const {rehearsePlan, geometryForLayout} = await import('/src/pathPlanning.ts')
    const {COMPACT_LAYOUT, layoutTarget} = await import('/src/cellLayout.ts')
    const {evaluateCommissioning} = await import('/src/commissioning.ts')
    const source = window.__CELLFORGE_GEOMETRY__()
    const evaluation = evaluateCommissioning({layout:COMPACT_LAYOUT,fixtureShiftMm:0,repairId:null})
    const plan = {infeedApproachTarget:evaluation.approachTarget,infeedPickTarget:evaluation.pickTarget,outfeedPlaceTarget:layoutTarget(COMPACT_LAYOUT,'outfeed')}
    const clone = root => {
      root.updateWorldMatrix(true,true)
      const copy = root.clone(true)
      root.matrixWorld.decompose(copy.position,copy.quaternion,copy.scale)
      copy.updateMatrixWorld(true)
      return copy
    }
    const geometry = () => ({...geometryForLayout(source,COMPACT_LAYOUT,0),robot:clone(source.robot),cellBodies:source.cellBodies.map(({id,root})=>({id,root:clone(root)}))})
    const results = {}
    const expectBlocked = async (label, candidate, expected) => {
      const evidence = await rehearsePlan(candidate,plan)
      if (!evidence.failure?.includes(expected) || evidence.acceptedSamples===1441) throw Error(`${label}: ${JSON.stringify(evidence)}`)
      results[label]=evidence
    }
    for (const id of ['floor','scanner','fence-back','fence-right','chuck-stock']) {
      const missing=geometry();missing.cellBodies=missing.cellBodies.filter(body=>body.id!==id)
      await expectBlocked(`missing-${id}`,missing,'geometry unavailable')
    }
    for (const id of ['floor','scanner','fence-back','fence-right']) {
      const blocked=geometry();const root=blocked.cellBodies.find(body=>body.id===id).root
      root.position.set(0,0.05,0);root.updateMatrixWorld(true)
      await expectBlocked(id,blocked,id==='scanner'?'ScannerHousing':id)
    }
    const stock=geometry();stock.tables[0].getObjectByName('infeed-stock-0').position.set(-stock.tables[0].position.x,.05,-stock.tables[0].position.z)
    stock.tables[0].updateMatrixWorld(true)
    await expectBlocked('loose-stock',stock,'infeed-stock-0')
    const self=geometry();self.robot.getObjectByName('shoulder-mesh_001').scale.multiplyScalar(20);self.robot.updateMatrixWorld(true)
    await expectBlocked('self-contact',self,'Self swept contact')
    return results
  })
}
