# CellForge

**Configure a robotic workcell, find a feasible motion plan, and inspect the evidence before releasing a job.**

CellForge is a React, TypeScript and Three.js simulation workbench built by
Chet Paslawski. It connects an interactive 3D cell to deterministic process
state, robot kinematics, layout/path comparison and revision-bound exports.
It is a working software prototype; it does not control physical equipment.

**[Open the live CellForge demo](https://cellforge-orcin.vercel.app)**

![CellForge verified closer-table cycle](docs/self-cell-verified.png)

© 2023 Universal Robots A/S. Use hereof is subject to Universal Robots A/S’
Terms and Conditions for Use of Graphical Documentation.

## Try the workflow

Open the [hosted demo](https://cellforge-orcin.vercel.app), or run it locally.
Local development requires Node.js 22.12+ and npm. No API keys, hosted model
or backend are required.

```bash
npm ci
npm run dev
```

1. Click **Replay baseline**. The reference layout is intentionally rejected
   during full-path rehearsal for approximate self-contact near sample 1150.
   A passing P02 clearance check alone cannot authorize the full run.
2. Click **Find best layout & path**. The bounded search compares table
   positions and transfer paths, then selects a complete passing rehearsal.
3. Run the selected closer-table cycle. Watch the robot load/unload the CNC;
   completion requires all 1,441 ordered measured poses and a settled home.
4. Use **Update fixture position** to introduce a +180 mm infeed change. The
   clearance failure blocks execution. Compare repairs or search again.
5. Run the repaired revision and export its local JSON job artifact. It
   contains matching planning/execution evidence and explicitly reports
   `runtimeAcknowledged: false`.

Measured simulation runs take longer than the nominal 24-second sequence.
Changing the layout or path invalidates previous run evidence.

## What is implemented

- React/TypeScript configuration, findings, repair comparison and release UI.
- Three.js scene through React Three Fiber/Drei; licensed UR20 URDF assets,
  custom three-jaw gripper and project-authored CNC machine.
- Damped-least-squares inverse kinematics with tool-position/direction targets.
- Full-path rehearsal against cloned loaded geometry before live animation.
- Bounded layout/path search with complete-candidate ranking and cancellation.
- Joint velocity, acceleration and jerk monitoring; measured pose acceptance.
- Approximate swept bounds for non-adjacent robot links, CNC, tables, stock,
  scanner housing, floor and boundary panels, with named contact exclusions.
- Interlocked process sequencing, simulated payload transfers, pause/resume,
  failed-run blocking and revision-matched JSON export.

## Architecture

```text
Cell configuration + typed job state
    → bounded candidate search → full-path rehearsal
    → selected motion plan → rendered URDF telemetry
    → ordered pose / contact / continuity acceptance
    → revision-bound evidence → local job export
```

Process state and validation live outside the scene graph. The renderer
consumes planned targets; the release gate consumes measured evidence.

Start with [`src/App.tsx`](src/App.tsx), [`src/layoutSearch.ts`](src/layoutSearch.ts),
[`src/pathPlanning.ts`](src/pathPlanning.ts),
[`src/cycleAcceptance.ts`](src/cycleAcceptance.ts) and
[`src/cncContact.ts`](src/cncContact.ts).

## Verification

```bash
npm run check
```

Runs TypeScript, 81 automated tests and the production build. Tests cover
collision bounds, motion continuity, incomplete/stale evidence and related
failure conditions. Browser evidence and reproducible scripts are documented
in [self/cell collision verification](docs/self-cell-collision-verification.md).
Historical measured results are dated there; they are not hardware benchmarks.
See [release review](docs/public-release-review.md) for the current audit.

## Scope

This is an engineering/product prototype, **not a certified simulator or
industrial safety system**. Collision bounds are approximate, not exact
continuous triangle collision. Connected-link/internal-gripper and named
support/grasp contacts have exclusions. Protective-field logic, grasp physics,
obstacle-obstacle layout collisions, calibration, PLC/robot-driver integration
and hardware acknowledgement are not implemented. Search covers a small
explicit candidate family, not general or globally optimal planning.

## Licence and assets

Original CellForge application code and project-authored assets are under the
[MIT licence](LICENSE). Third-party assets retain their own terms, including
restricted Universal Robots graphical-documentation terms. The entire asset
bundle is **not** MIT licensed. See [third-party notices](THIRD_PARTY_NOTICES.md)
and the pinned provenance files before redistribution.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Improvements to collision-aware
configuration selection, candidate coverage and testable runtime boundaries
are welcome. Keep safety and hardware limitations explicit.
