# CellForge handoff

<!-- codex-handoff:start -->
## CONTEXT FOR /work

**Last handoff**: 2026-09-09 22:26:10 CST
**Branch**: `codex/trustworthy-cycle-verification`
**Active ticket**: `None found`
**Summary**: User explicitly replaced waiting for visual approval with autonomous browser verification and iteration. PR #11 is merged into develop at f4cd6cd. Overall goal: a credible virtual commissioning workflow whose verified result is backed by actual simulated robot motion and scoped clearance evidence. First milestone: actual-chain TCP position/direction and joint acceptance across the complete cycle; tracking/solver failures and incomplete runs block release; pause/resume remains correct; exported evidence is revision-bound; local export must not claim runtime deployment acknowledgement. Exercise baseline, both repairs, blocked clearance, tracking failure, interrupted run, and release in browser plus meaningful automated tests. Inspect and improve scene framing where needed to verify motion. Remain explicit about collision coverage and prototype limitations; no hardware integration or certification is implied. No routine user visual approval is required. Follow AGENTS.md publish workflow; no merge authorization granted for the new PR. Previous npm run check passed 38 tests and build; browser recovery and local release flow passed, but existing timer-only verification is insufficient. Existing unrelated duplicate files are preserved separately on local recovery branch codex/recovery-before-trustworthy-cycle; exclude them from feature work. Policy and handoff changes are on codex/trustworthy-cycle-verification.
**Next exact action**: Run ./continue, establish the trustworthy-cycle goal, and implement actual UR20 motion acceptance as the cycle completion and release gate; autonomously browser-test and iterate through success and failure paths, then publish a verified draft PR to develop.
**Blocker**: None

**Git status at handoff**:

```text
 M AGENTS.md
 M NOW.md
?? "AGENTS 2.md"
?? "NOW 2.md"
?? "continue 2"
?? "handoff 2"
?? "src/commissioning 2.ts"
?? "src/commissioning.test 2.ts"
?? "tests/r3f-skill-guardrails.test 2.ts"
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
