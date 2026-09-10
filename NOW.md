# CellForge handoff

<!-- codex-handoff:start -->
## CONTEXT FOR /work

**Last handoff**: 2026-09-09 23:53:19 CST
**Branch**: `codex/collision-layout-continuation`
**Active ticket**: `None found`
**Summary**: Fresh-task rollover requested for collision detection/planning, better infeed/outfeed table placement, and making CellForge repeatable, improvable, and scalable. Preserved verified PR #13 checkpoint d25ad93; PR #13 is still OPEN and must not be merged without authorization. Current motion/CNC slice passed 51 tests and CI; baseline and both repairs passed 1441 poses with approximate CNC swept bounds and continuity gates, taking about 49 seconds. See docs/motion-cnc-verification.md; raw evidence copied to /Users/chetpaslawski/.codex/artifacts/cellforge/pr13-d25ad93/. New work should derive geometry, targets, collision bodies, and validation from shared layout parameters, evaluate table placements with reach/clearance/motion evidence, and move collision checking into planning before execution while retaining runtime guards. Use bounded verified feature slices and reusable regression scenarios rather than one-off hand-adjusted paths. Read PR #13 status first; if merged, base new implementation on updated develop while preserving this checkpoint; if open, preserve its dependency explicitly on a separate work branch. Recovery branch a6db462 stays untouched. No merge/deploy authorization.
**Next exact action**: Build the next collision-aware planning and table-layout slice: inspect current geometry and coordinate frames, benchmark safer table placements and trajectories, implement a repeatable parameterized workflow, and own browser/regression verification through a draft PR.
**Blocker**: None

**Git status at handoff**:

```text
clean
```

---
<!-- codex-handoff:end -->
## Current state

- Continuation branch: `codex/collision-layout-continuation`, preserving verified PR #13 at `d25ad93`. This local rollover branch is separate from the published PR.
- [Draft PR #13](https://github.com/TrackerXXX23/cellforge/pull/13) targets `develop`; implementation commit `e90deda`. No merge or deployment authorization.
- Evidence and limitations: [motion/CNC verification](docs/motion-cnc-verification.md).
- Recovery branch `codex/recovery-before-trustworthy-cycle` remains untouched at `a6db4621056b9bea01ff7b15815493488395b642`.

## Next product milestone

User requested collision detection/planning plus better table placement, with a repeatable, improvable, scalable workflow. Treat this as implementation work in bounded verified slices. Make layout/targets/collision geometry share parameters; compare candidate infeed/outfeed positions using reach, clearance, continuity, and cycle evidence; retain reusable regression scenarios and runtime guards. Raw prior evidence is preserved outside disposable worktrees at `/Users/chetpaslawski/.codex/artifacts/cellforge/pr13-d25ad93/`.


Plan collision-free trajectories before execution, with velocity/acceleration/jerk limits and the runtime contact guard as a second check. Current swept bounds are approximate and cover CNC meshes only; self-collision, other cell obstacles, grasp stability, and hardware acknowledgement remain out of scope. Verified runs take approximately 49 seconds versus the prior 37-second endpoint-only baseline.
