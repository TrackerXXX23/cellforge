# CellForge handoff

<!-- codex-handoff:start -->
## CONTEXT FOR /work

**Last handoff**: 2026-09-16 16:23:00 CST
**Branch**: `codex/demo-polish-handoff`
**Active ticket**: `None found`
**Summary**: Fresh task requested on Sol medium. Approved play-first UI and visible CNC machining scope is in docs/demo-polish-plan.md; free-text job instructions saved as a future idea. Preserve real collision and measured-run gates. Current production is already live; Vercel auto-deploys pushes, so this slice is LOCAL ONLY. This scope supersedes the older hosting integration next step below. Baseline is de44b3f including main 69e1f22; prior 81 tests/build and hosted 1441-pose acceptance passed. No implementation of this new scope yet.
**Next exact action**: Implement all five approved changes in docs/demo-polish-plan.md, verify complete local workflows and failure cases, and save local commits and proof. Do not push, deploy, merge or promote.
**Blocker**: None

**Git status at handoff**:

```text
?? docs/demo-polish-plan.md
```

---
<!-- codex-handoff:end -->
Updated September 16, 2026.

## Current work

Branch `codex/hosted-demo` fast-forwarded the merged release from `main` onto
the `develop` lineage. CellForge is deployed at
https://cellforge-orcin.vercel.app and the public GitHub repository homepage
points to that URL. The Vercel project is connected to the GitHub repository
for future deployments.

The hosted production build loaded the VMC GLB and UR20 URDF assets, rejected
the unsafe reference layout at sample 1150, selected the closer-table layout,
accepted all 1,441 measured poses in 51.8 seconds, and downloaded the Revision
08 evidence artifact. Desktop and 390 px mobile layouts were inspected. The
browser reported no console errors; the existing Three.js deprecation and
Collada Z-up warnings remain.

## Next exact action

Review the hosted-demo documentation PR and merge it into `develop` when CI is
green, then promote it to `main`. No application has been submitted.

## Next product milestone

Improve the rejected reference outfeed route and expand collision-aware
candidate selection. Approximate geometry and absent hardware integration
remain explicit limitations.
