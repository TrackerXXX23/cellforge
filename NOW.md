# CellForge handoff

<!-- codex-handoff:start -->
## CONTEXT FOR /work

**Last handoff**: 2026-07-22 11:48:01 CST
**Branch**: `codex/cnc-vmc-asset`
**Active ticket**: `None found`
**Summary**: Published the CNC-only VMC asset slice at commit f2a2f61 on draft PR https://github.com/TrackerXXX23/cellforge/pull/5, then integrated the latest develop robot-motion milestone without changing its implementation. The CNC slice replaces the procedural placeholder with a CellForge-authored GLB and editable Blender source, including the visible spindle, T-slot table, vise, safety-glass door, controls, stack light, work light, CNC-selected cutaway, provenance, tests, and refreshed preview. Post-merge npm run check passes with 29 tests.
**Next exact action**: Watch CI on draft PR #5, review the ready/open-door/selected-cutaway visuals, then mark ready and merge into develop when approved.
**Blocker**: None

**Git status at handoff**:

```text
clean
```

---
<!-- codex-handoff:end -->
## Current state

- Branch: `codex/commissioning-recovery`, created from `develop` at `3ba0a0d`.
- Product slice: the fixture-change commissioning recovery workflow is implemented from validated baseline through released revision.
- Repository: `https://github.com/TrackerXXX23/cellforge` (private).
- Draft pull request: `https://github.com/TrackerXXX23/cellforge/pull/1` targeting `develop`.

## Changed

- Added a deterministic commissioning model for fixture shifts, clearance gates, repair proposals, causal evidence, and revision deltas.
- Replaced boolean fault injection with a Revision 07 → Revision 08 change workflow.
- Added constraint-derived lifted-approach and side-entry repairs with preview-before-apply behavior.
- Connected applied repair targets to the existing robot motion state machine.
- Added baseline ghost geometry, fixture-delta markers, blocked P02 evidence, and preview/repaired paths in R3F.
- Redesigned the product shell around Configure → Validate → Run → Release progression.
- Added a linked physical object → path → sequence → release causal trace.
- Added release artifact generation with revision, motion, validation, and change evidence.
- Added commissioning-domain and revised-motion tests; the full suite now has 14 passing tests.
- Replaced the README preview and demo description with the recovery workflow.
- Installed the shared repo-local `./handoff` helper and documented the `./continue` / `./handoff` resume standard in `AGENTS.md`.

## Verification

- `npm run check` passes: typecheck, 14 tests, and production build.
- `npm run test:skill` passes the R3F guardrails.
- Playwright completed baseline → fixture change → repair preview → repair apply → repaired cycle → Revision 08 release.
- Desktop and 390 px mobile layouts were inspected; the mobile workflow header no longer overlaps.
- The generated `cellforge-op-1042-r08.json` artifact downloaded successfully.
- The existing large scene-chunk warning remains; no browser errors were observed.

## Blocked

- None.

## Next exact action

Review CI on PR #1, merge it into `develop` when green, then branch from updated `develop` to replace `prototype-clearance-heuristic/v1` with geometry-derived P02 keep-out and swept-path clearance.
