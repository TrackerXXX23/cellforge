// Run with the dev app idle. Reload prevents stale dynamic-import caches after source edits.
async (page) => {
  await page.reload()
  await page.waitForFunction(() => window.__CELLFORGE_GEOMETRY__?.().tables.length === 2)
  const results = await page.evaluate(async () => {
    const { searchLayouts } = await import('/src/layoutSearch.ts')
    const { rehearsePlan, geometryForLayout } = await import('/src/pathPlanning.ts')
    const source = window.__CELLFORGE_GEOMETRY__()
    const state = () => JSON.stringify({joints:Object.values(source.robot.joints).map(j=>j.angle),tables:source.tables.map(t=>t.position.toArray())})
    const before = state()
    const search = shift => searchLayouts(shift, candidate => rehearsePlan(geometryForLayout(source,candidate.layout,shift),candidate.motionPlan))
    const baseline = await search(0)
    const shifted = await search(180)
    const repeated = await search(0)
    if (before!==state()) throw new Error('Search mutated live geometry')
    if (!baseline.best || !shifted.best || baseline.best.candidate.id!==repeated.best?.candidate.id
        || baseline.best.evidence.simulatedSeconds!==repeated.best.evidence.simulatedSeconds) throw new Error('Missing or nondeterministic winner')
    let cancelled=false
    const cancellation=await searchLayouts(0,async candidate=>{const evidence=await rehearsePlan(geometryForLayout(source,candidate.layout,0),candidate.motionPlan);cancelled=true;return evidence},()=>cancelled)
    if (!cancellation.cancelled || cancellation.best) throw new Error('Cancellation retained a partial winner')
    source.machine.updateWorldMatrix(true,true)
    const obstructed=source.machine.clone(true)
    source.machine.matrixWorld.decompose(obstructed.position,obstructed.quaternion,obstructed.scale)
    obstructed.getObjectByName('DoorGlass').scale.setScalar(100)
    const blocked=await searchLayouts(0,candidate=>rehearsePlan(geometryForLayout({...source,machine:obstructed},candidate.layout,0),candidate.motionPlan))
    if (blocked.best || blocked.candidates.some(result=>!result.failure)) throw new Error('Blocked geometry won search')
    const results={baseline,shifted,repeatedWinner:repeated.best.candidate.id,cancelled:cancellation.cancelled,blocked}
    window.__CELLFORGE_SEARCH_BENCHMARK__=results
    return results
  })
  return results
}
