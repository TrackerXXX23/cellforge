// Run with Playwright CLI run-code after loading the dev app. No live geometry is mutated.
async (page) => {
  await page.waitForFunction(() => window.__CELLFORGE_GEOMETRY__?.().tables.length === 2)
  const results = await page.evaluate(async () => {
    const { rehearsePlan } = await import('/src/pathPlanning.ts')
    const { LAYOUT_PRESETS, layoutTarget } = await import('/src/cellLayout.ts')
    const { evaluateCommissioning } = await import('/src/commissioning.ts')
    const source = window.__CELLFORGE_GEOMETRY__()
    const results = []
    for (const layout of LAYOUT_PRESETS) {
      for (const repairId of [null, 'lifted-approach', 'side-entry']) {
        const fixtureShiftMm = repairId ? 180 : 0
        const tables = source.tables.map(root => {
          const copy = root.clone(true)
          const kind = root.name === 'infeed-table' ? 'infeed' : 'outfeed'
          copy.position.fromArray(layout[kind])
          if (kind === 'infeed') copy.position.x += fixtureShiftMm / 1000
          copy.updateMatrixWorld(true)
          return copy
        })
        const evaluation = evaluateCommissioning({layout, fixtureShiftMm, repairId})
        const plan = {infeedApproachTarget:evaluation.approachTarget,infeedPickTarget:evaluation.pickTarget,outfeedPlaceTarget:layoutTarget(layout,'outfeed')}
        const evidence = await rehearsePlan({...source,tables}, plan)
        results.push({layout:layout.id,repairId,p02ClearanceMm:evaluation.minimumClearanceMm,...evidence})
      }
    }
    window.__CELLFORGE_LAYOUT_BENCHMARK__ = results
    return results
  })
  if (results.some(result => result.failure || result.acceptedSamples !== 1441)) throw new Error(JSON.stringify(results))
  return results
}
