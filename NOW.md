# CellForge handoff

<!-- codex-handoff:start -->
## CONTEXT FOR /work

**Last handoff**: 2026-09-10 00:08:37 CST
**Branch**: `codex/parameterized-collision-planning`
**Active ticket**: `None found`
**Summary**: Implemented shared table layout presets and derived targets, complete pre-execution asset rehearsal, runtime table collision guards, evidence invalidation/export gates, and reusable six-scenario benchmarks. Closer baseline live run: 44.77 s versus reference 49.83 s; both closer repairs passed 1441 poses. Planning faults/cancellation and blocked export verified; 61 tests pass. PR #13 remains OPEN at d25ad93 and recovery branch remains a6db462. Publishing on separate codex/parameterized-collision-planning branch targeting develop; no merge/deploy authorization. Evidence: docs/collision-layout-verification.md and docs/layout-benchmark.json.
**Next exact action**: Review the dependent collision/layout draft PR; after authorized integration, add bounded layout/waypoint search, jerk-limited timing, and self/remaining-cell collision coverage.
**Blocker**: None

**Git status at handoff**:

```text
 M src/App.tsx
 M src/CncMachine.tsx
 M src/Scene.tsx
 M src/ThreeJawGripper.tsx
 M src/Ur20Robot.tsx
 M src/cncContact.test.ts
 M src/cncContact.ts
 M src/commissioning.ts
 M src/simulation.ts
 M src/styles.css
?? docs/closer-layout-verified.png
?? docs/collision-layout-verification.md
?? docs/layout-benchmark.json
?? scripts/benchmark-layouts-browser.js
?? scripts/verify-planning-failures-browser.js
?? src/cellLayout.test.ts
?? src/cellLayout.ts
?? src/pathPlanning.ts
```

---
<!-- codex-handoff:end -->
## Current state

- Active branch: `codex/parameterized-collision-planning`, based on continuation checkpoint `793cc2b` and explicitly dependent on open [PR #13](https://github.com/TrackerXXX23/cellforge/pull/13). A separate draft PR targets `develop`; no merge/deploy authorization.
- New slice: shared table presets/slots/targets; full candidate rehearsal before motion; CNC plus table runtime guards; revision-bound planning and measured execution evidence; layout exports; six repeatable benchmark scenarios.
- Verification: `npm run check` passes 61 tests, TypeScript, and production build. All six rehearsals passed 1441 poses. Reference live run 49.83 s; closer baseline 44.77 s; closer lifted repair 44.48 s; closer side-entry repair 44.25 s. No contact/continuity failures. Faults, cancellation, stationary planning, blocked exports, pause/resume, rendered stock, artifact fields, and 390 px width verified.
- Detailed proof and limitations: [collision/layout verification](docs/collision-layout-verification.md); [benchmark data](docs/layout-benchmark.json). Raw evidence is preserved at `/Users/chetpaslawski/.codex/artifacts/cellforge/collision-layout-2026-09-10/`.
- Prior PR #13 remains OPEN at `d25ad933f7b7345ebd119a2bf6d17da508c9e6f8`; its published branch was not changed. Recovery branch `codex/recovery-before-trustworthy-cycle` remains untouched at `a6db4621056b9bea01ff7b15815493488395b642`. Continuation branch `codex/collision-layout-continuation` remains untouched.

## Next product milestone

Review this dependent draft PR and integrate only with authorization. Then implement bounded automatic layout/waypoint search and jerk-limited timing, add self-collision and remaining cell bodies, and retain the candidate rejection/live acceptance/export gates. Current planning is a bounded fixed-rate rehearsal using approximate swept boxes, not a general path-search planner or safety certificate. Loose stock, scanner/fences, grasp forces, and hardware acknowledgements remain outside scope.
