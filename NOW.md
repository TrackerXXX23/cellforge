# CellForge handoff

<!-- codex-handoff:start -->
## CONTEXT FOR /work

**Last handoff**: 2026-09-10 00:55:16 CST
**Branch**: `codex/self-cell-collision`
**Active ticket**: `None found`
**Summary**: Published draft PR #16 targeting develop: https://github.com/TrackerXXX23/cellforge/pull/16 (implementation 4d66838). Implemented self and remaining-cell collision checks on codex/self-cell-collision, based on open PR #15 head 44a8e49. Fixed inherited offset OBB center transforms, added relative sectioned self checks, scanner/floor/panels/stock coverage, explicit grasp phases, and missing-body rejection. Corrected gripper carrier geometry and unloaded via a clear reorientation route. Closer-table baseline and shifted runs accepted 1441 poses in 53.86 s and 53.68 s; reference layout is now correctly blocked under the approximate model near sample 1150. Eleven asset fault injections, live scanner stop/blocked export/retry, pause and mobile checks passed. npm run check passed 81 tests, typecheck and build. See docs/self-cell-collision-verification.md. Prior PRs untouched; no merge/deploy.
**Next exact action**: Review this dependent draft PR; next improve the rejected reference outfeed route with collision-aware configuration selection. Merge only with authorization.
**Blocker**: None

**Git status at handoff**:

```text
 M scripts/benchmark-layouts-browser.js
 M src/App.tsx
 M src/CncMachine.tsx
 M src/Scene.tsx
 M src/ThreeJawGripper.tsx
 M src/Ur20Robot.tsx
 M src/cellLayout.test.ts
 M src/cncContact.test.ts
 M src/cncContact.ts
 M src/layoutSearch.test.ts
 M src/pathPlanning.ts
 M src/simulation.ts
?? docs/self-cell-collision-verification.md
?? docs/self-cell-failure-benchmark.json
?? docs/self-cell-search-benchmark.json
?? docs/self-cell-verified.png
?? scripts/verify-cell-collision-failures-browser.js
?? src/cellBodies.ts
```

---
<!-- codex-handoff:end -->
## Current state

- [Draft PR #16](https://github.com/TrackerXXX23/cellforge/pull/16) targets `develop`; implementation `4d66838`. Active branch: `codex/self-cell-collision`, based on open [PR #15](https://github.com/TrackerXXX23/cellforge/pull/15) head `44a8e49`; depends transitively on PR #14 and #13. Parent branches remain unchanged. No merge/deploy authorization.
- Same guard in rehearsal and execution: non-adjacent robot links/tool/payload, CNC, tables, loose/source/chuck/placed stock, scanner housing, floor and two boundary panels. Missing required bodies fail closed; connected/internal-gripper pairs and named grasp/support contact are narrowly excluded.
- Fixed inherited offset OBB center transforms. Self checks use relative-frame sectioned bounds. Corrected jaw carrier/finger geometry and routed unloading through a clear reorientation point.
- Important changed result: reference layout now fails the approximate self-contact guard near outfeed sample 1150 (base/upper arm). It is marked for recheck and excluded from search. Prior pass claims must not authorize release under this collision version.
- Verified closer-table baseline: 53.86 s; shifted side entry: 53.68 s. Both accepted all 1,441 poses with bounded jerk and settled home, and exported matching revision evidence with hardware acknowledgement false. Search passes 2/4 baseline candidates and 4/12 shifted candidates.
- Eleven loaded-asset failure injections, live scanner stop/blocked export/retry, held pause, and 390 px layout passed. `npm run check` passes 81 tests, TypeScript and production build; existing bundle-size warning remains.
- Evidence: [verification](docs/self-cell-collision-verification.md), [search comparisons](docs/self-cell-search-benchmark.json), [fault injections](docs/self-cell-failure-benchmark.json), and `/Users/chetpaslawski/.codex/artifacts/cellforge/self-cell-collision-2026-09-10/`.

## Next product milestone

Review the dependent draft PR and integrate only with authorization. Next improve the rejected reference outfeed route with collision-aware configuration selection while retaining measured execution and truthful export gates. Current geometry remains approximate; adjacent/internal-gripper contact, grasp physics, scanner protective-field logic, obstacle-obstacle layout collision, and hardware certification remain outside scope.
