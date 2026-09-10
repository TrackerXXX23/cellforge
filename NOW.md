# CellForge handoff

<!-- codex-handoff:start -->
## CONTEXT FOR /work

**Last handoff**: 2026-09-09 23:02:17 CST
**Branch**: `codex/smooth-cnc-motion`
**Active ticket**: `None found`
**Summary**: Implemented smooth elapsed-time joint tracking, dense revision-bound acceptance, CNC swept-bound contact and continuity gates, clear door travel, axial entry/withdrawal, receiving chuck and spindle retraction. npm run check passes with 51 tests. Browser baseline/lifted/side runs passed 1441 poses each in 49.91/48.55/48.81 seconds; both repair exports verified; injected glass contact blocked release and retry passed; pause and mobile layout verified. See docs/motion-cnc-verification.md. Swept boxes are approximate; no self-collision, other-cell obstacle, grasp-force, or hardware certification. Recovery branch remains at a6db462. Ready to publish a draft PR to develop; no merge/deploy authorization.
**Next exact action**: Review the verified draft PR for codex/smooth-cnc-motion against develop; await explicit merge authorization. Next product slice: collision-aware trajectory planning.
**Blocker**: None

**Git status at handoff**:

```text
 M assets/cnc/cellforge-vmc.blend
 M public/machines/cellforge-vmc/PROVENANCE.md
 M public/machines/cellforge-vmc/cellforge-vmc.glb
 M scripts/build-cnc-vmc.py
 M scripts/verify-ur20-browser.js
 M src/App.tsx
 M src/CncMachine.tsx
 M src/Scene.tsx
 M src/ThreeJawGripper.tsx
 M src/Ur20Robot.tsx
 M src/cnc.ts
 M src/cycleAcceptance.test.ts
 M src/cycleAcceptance.ts
 M src/simulation.test.ts
 M src/simulation.ts
 M src/ur20Ik.ts
 M tests/cnc-assets.test.ts
?? docs/cnc-contact-clearance.png
?? docs/motion-cnc-verification.md
?? scripts/verify-cnc-sweep-browser.js
?? src/cncContact.test.ts
?? src/cncContact.ts
?? src/motionContinuity.test.ts
?? src/motionContinuity.ts
```

---
<!-- codex-handoff:end -->
## Current state

- Active branch: `codex/smooth-cnc-motion`, based on merged `origin/develop` at `177931b` plus the preserved handoff checkpoint.
- Verified motion/CNC contact slice ready for a draft PR to `develop`; no merge or deployment authorization.
- Evidence and limitations: [motion/CNC verification](docs/motion-cnc-verification.md).
- Recovery branch `codex/recovery-before-trustworthy-cycle` remains untouched at `a6db4621056b9bea01ff7b15815493488395b642`.

## Next product milestone

Plan collision-free trajectories before execution, with velocity/acceleration/jerk limits and the runtime contact guard as a second check. Current swept bounds are approximate and cover CNC meshes only; self-collision, other cell obstacles, grasp stability, and hardware acknowledgement remain out of scope. Verified runs take approximately 49 seconds versus the prior 37-second endpoint-only baseline.
