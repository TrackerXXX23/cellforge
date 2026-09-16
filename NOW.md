# CellForge handoff

<!-- codex-handoff:start -->
## CONTEXT FOR /work

**Last handoff**: 2026-09-16 17:02:00 CST
**Branch**: `codex/play-first-demo`
**Active ticket**: `None found`
**Summary**: Published the accepted play-first demo and compact CNC-loading correction. Commit 0c5641c restores the robot-side transfer, keeps the tool vertical through clearance, performs the wrist reorientation outside the CNC door over a longer eased segment, and enters the chuck axially. `npm run check`, GitHub CI, the full 1,441-pose planner, blocked-layout rejection, and moved-fixture recovery pass. Draft PR #20 targets `develop`. Vercel production deployment dpl_FRTRAMNoViPyUfwesUkSN5eXaACz is Ready at https://cellforge-orcin.vercel.app; public browser verification loaded the new demo with zero console errors and started the normal robot cycle.
**Next exact action**: Review draft PR #20. Do not mark ready or merge without explicit approval.
**Blocker**: None

**Git status at handoff**:

```text
clean
```

---
<!-- codex-handoff:end -->
Updated September 16, 2026.

## Current work

Branch `codex/play-first-demo` contains the published demo polish and is open as
draft PR #20 against `develop`.
The app opens on the passing closer-table layout with a prominent Run cell
action, direct Pause/Resume and Reset controls, and Normal run, Moved fixture,
and Blocked layout scenarios. Commissioning evidence and export controls are
collapsed under Technical details.

The operator flow uses Picking stock, Loading CNC, Machining, Unloading, and
Complete. The CNC spindle visibly feeds, sweeps, and rotates only while the
door is closed; pause and reset stop or home it. Machine interior view exposes
the animated spindle and finished stock remains visually distinct. Recovery
uses the existing bounded layout/path search.

The wide aisle-side CNC-loading route in commit `cc9e707` was rejected after
user review because its large base swing and extra settle points looked less
mechanical and less fluid. The replacement keeps the quintic endpoint easing
but restores a compact robot-side transfer: vertical tool through clearance,
a longer outside-door wrist reorientation, then straight axial chuck entry.

Local browser acceptance at `http://127.0.0.1:5173` verified:

- normal closer-table completion with all 1,441 measured poses accepted;
- pause during Machining, resume/reset, and a repeat run;
- Moved fixture blocked at 9 mm against the 50 mm P02 requirement, then
  recovered by bounded search;
- Blocked layout rejected at pose 1147 for robot upper-arm/base self-contact,
  then recovered to the passing closer-table candidate;
- evidence invalidation on reset and scenario changes;
- optional machine-interior view plus desktop and 390 px mobile layouts;
- zero console errors after fresh reload (existing Three.js warnings remain).

The revised CNC load passed the full 1,441-pose planner. A live joint audit
through the changed segment observed less than 0.96 rad/s joint speed, no
runtime or continuity failure, 21 mm maximum TCP tracking error during the
reorientation, and successful progression through machining into unloading.
The blocked reference still fails at measured pose 1147 and moved-fixture
recovery still applies a passing bounded-search result.

Screenshots are local in `output/playwright/demo-polish-desktop.png`,
`demo-polish-machining-paused.png`, `demo-polish-machine-interior.png`,
`demo-polish-complete.png`, `demo-polish-mobile.png`, and
`cnc-loading-reorientation.png`. `npm run check` passes typecheck, all 82
tests, and the production build. Free-text job
instructions remain a documented future idea in `docs/demo-polish-plan.md`.

## Next exact action

Review draft PR #20. Do not mark ready or merge without explicit approval.

## Next product milestone

Production is live at `https://cellforge-orcin.vercel.app`. A later product
milestone can add free-text job instructions without weakening the existing
collision, measured-motion, or release gates. Exact stock removal, protective
field logic, grasp forces, and hardware acknowledgement remain out of scope.
