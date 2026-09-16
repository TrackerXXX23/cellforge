# Trustworthy cycle verification

Verified 2026-09-09 on `codex/trustworthy-cycle-verification` against the local Vite app.

## Acceptance contract

The app measures the rendered URDF chain, including the gripper TCP offset, before advancing each of 241 ordered cycle samples. Acceptance requires fresh telemetry for the current run and progress, TCP position error ≤18 mm, tool-axis direction error ≤15°, an accepted solver result, and all six joints inside commissioning limits. Final home must pass too. Eight seconds without acceptance fails the run and blocks release. Pause freezes arm, gripper, and CNC animation; its duration is excluded from run time and does not reset the acceptance timeout budget.

Evidence is reset when a run starts or the layout/repair/preview changes. Export requires complete evidence for the current revision and passing preflight. Schema `cellforge.job/v2` includes every accepted sample, joint values, residuals, the revision key, nominal cycle time, measured run time, and `runtimeAcknowledged: false`.

## Evidence

| Workflow | Result |
| --- | --- |
| Baseline | 241/241 measured poses; 37.19 s; max accepted TCP error 17.97 mm; max direction error 4.00° |
| Lifted approach | 241/241 measured poses; 38.79 s; max accepted TCP error 17.96 mm; max direction error 4.07° |
| Side entry | 241/241 measured poses; 38.39 s; max accepted TCP error 17.95 mm; max direction error 3.95° |
| Fixture shifted without repair | 9 mm P02 clearance; run disabled and release blocked |
| Injected tracking error | TCP error forced to 1 m; failed after 8.00 s with zero accepted samples; release blocked |
| Pause and interruption | Joint values and accepted count stayed unchanged after pause settled; resume worked; restoring baseline discarded the interrupted revision |
| Local export | Downloaded both repaired artifacts; validated revision, 241 ordered samples, residuals, measured duration, and no runtime acknowledgement |
| Layout | Desktop cell overview and 390 px release workflow inspected |

Screenshots and downloaded JSON are retained in `output/playwright/` in this worktree. They are ignored by Git. The reusable planner sweep is `scripts/verify-ur20-browser.js`; run it through Playwright CLI with the local Vite app open. It checks all 723 planned poses across baseline and both repairs using the actual URDF kinematic chain. It complements, rather than replaces, the full rendered-cycle checks above.

`npm run check` passes: TypeScript, 40 tests, and production build. The existing large scene-bundle warning and asset-loader deprecation/axis warnings remain; browser verification reported no console errors.

## Limits and next milestone

This is sampled pose acceptance, not a continuous tracking or collision certificate. The arm may take longer than the nominal cycle to settle at commanded samples. Clearance evidence covers the **planned P02 tool envelope only**; it does not validate the actual swept arm, self-collision, other cell obstacles, grasp forces, or hardware handshakes. Runtime integration is absent. The next product milestone is actual swept-motion collision coverage and continuity checks, with failures tied to the same revision-bound release gate.
