# CellForge handoff

## Current state

- Branch: `codex/commissioning-recovery`, created from `develop` at `3ba0a0d`.
- Product slice: the fixture-change commissioning recovery workflow is implemented from validated baseline through released revision.
- Repository: `https://github.com/TrackerXXX23/cellforge` (private).
- Pull request: none yet; the branch remains local for product review.

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

Review the hero workflow on `codex/commissioning-recovery`; if the product direction is approved, push the branch and open a pull request to `develop` before beginning the geometry/asset upgrade.
