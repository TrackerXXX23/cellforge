# CellForge handoff

<!-- codex-handoff:start -->
## CONTEXT FOR /work

**Last handoff**: 2026-09-16 16:36:46 CST
**Branch**: `codex/play-first-demo`
**Active ticket**: `None found`
**Summary**: All five play-first demo improvements are implemented in local commit 23cf327. Browser acceptance passed normal completion with 1,441 measured poses, machining pause/reset, repeat run, moved-fixture 9 mm block and bounded recovery, reference-layout pose-1150 self-contact and recovery, machine interior, desktop, and 390 px mobile. npm run check passes 81 tests and build. Proof is recorded below and in output/playwright/demo-polish-*.png. Free-text instructions remain deferred in docs/demo-polish-plan.md. No push/deploy/merge/promotion performed.
**Next exact action**: Keep commit 23cf327 and this branch local. Wait for explicit user approval before any push, deployment, merge, promotion, or release because Vercel auto-deploys pushes.
**Blocker**: None

**Git status at handoff**:

```text
(clean after the handoff documentation commit)
```

---
<!-- codex-handoff:end -->
Updated September 16, 2026.

## Current work

Branch `codex/play-first-demo` contains the complete local-only demo polish.
The app opens on the passing closer-table layout with a prominent Run cell
action, direct Pause/Resume and Reset controls, and Normal run, Moved fixture,
and Blocked layout scenarios. Commissioning evidence and export controls are
collapsed under Technical details.

The operator flow uses Picking stock, Loading CNC, Machining, Unloading, and
Complete. The CNC spindle visibly feeds, sweeps, and rotates only while the
door is closed; pause and reset stop or home it. Machine interior view exposes
the animated spindle and finished stock remains visually distinct. Recovery
uses the existing bounded layout/path search.

Local browser acceptance at `http://127.0.0.1:5173` verified:

- normal closer-table completion with all 1,441 measured poses accepted;
- pause during Machining, resume/reset, and a repeat run;
- Moved fixture blocked at 9 mm against the 50 mm P02 requirement, then
  recovered by bounded search;
- Blocked layout rejected at pose 1150 for robot upper-arm/base self-contact,
  then recovered to the passing closer-table candidate;
- evidence invalidation on reset and scenario changes;
- optional machine-interior view plus desktop and 390 px mobile layouts;
- zero console errors after fresh reload (existing Three.js warnings remain).

Screenshots are local in `output/playwright/demo-polish-desktop.png`,
`demo-polish-machining-paused.png`, `demo-polish-machine-interior.png`,
`demo-polish-complete.png`, and `demo-polish-mobile.png`. `npm run check`
passes typecheck, all 81 tests, and the production build. Free-text job
instructions remain a documented future idea in `docs/demo-polish-plan.md`.

## Next exact action

Keep this branch local and wait for explicit user approval before any push,
deployment, merge, promotion, or release. Vercel auto-deploys pushes.

## Next product milestone

After user approval, publish the verified play-first slice. A later product
milestone can add free-text job instructions without weakening the existing
collision, measured-motion, or release gates. Exact stock removal, protective
field logic, grasp forces, and hardware acknowledgement remain out of scope.
