# Self and remaining-cell collision verification

Branch: `codex/self-cell-collision`, based on PR #15 head `44a8e49`. This draft depends on open PRs #15, #14 and #13; their branches remain unchanged.

## What changed

Planning and live execution now use the same guard for non-adjacent robot links, the tool and carried payload, CNC, table frames, loose stock, the phased source/chuck/placed workpiece, scanner housing, floor and two rendered boundary panels. Missing required cell bodies fails closed. Scanner field graphics, selection halos and revision ghosts are informational overlays.

An inherited defect placed offset mesh boxes incorrectly: Three.js OBB `applyMatrix4` scales/rotates the box axes but only translates its center. The guard now transforms the local center through the full world matrix. Prior collision acceptance must be rechecked; revision and rehearsal methods were incremented to prevent stale evidence from authorizing release. Reference Revision 07 is visibly marked for recheck.

Self-contact uses a broad swept-box test followed by relative-frame, sectioned mesh boxes. Complete triangles are enclosed in longitudinal sections; the method remains conservative and approximate. Relative-frame comparison avoids inventing collisions between co-moving payload and housing. Exclusions cover same-link/internal-gripper pairs, directly adjacent link pairs, and named finger/payload contact. External finger contact is restricted to the named workpiece and its grasp/release phase. Other stock, gripper carriers and housings remain checked. This does not model internal gripper mechanics or contact forces.

The old jaw carriers intruded into the blank; carriers were moved toward the wrist and fingers extended with overlap to retain a connected assembly. Unloading now reorients outside the CNC before moving toward outfeed, avoiding the prior wrist/forearm contact. Limits and acceptance tolerances remain unchanged.

## Rehearsal outcomes

The [search comparison](self-cell-search-benchmark.json) records complete candidates and failures. Baseline search passes 2/4 candidates; shifted fixture search passes 4/12 (four additional candidates fail P02 preflight). Repetition returns the same winner and duration, cancellation retains no partial winner, and blocked CNC geometry produces no winner.

| Fixture | Selected layout/path | Rehearsal |
| --- | --- | --- |
| Original | Closer tables / standard transfer | 53.55 s |
| +180 mm | Closer tables / side entry / standard transfer | 53.1667 s |

All three closer-table repair scenarios accepted 1,441 poses. The reference layout is rejected near sample 1150 for base/upper-arm contact at its outfeed approach. The new guard is not weakened to preserve the previous pass claim. This is a rejection under the approximate geometry model, not proof of triangle-level physical penetration.

## Failure coverage

Unit checks cover non-adjacent self-contact and tunneling, connected-link exclusions, payload/housing rejection, named pad contact, relative co-motion, corrected rotated/scaled offset centers, required cell bodies, scanner/panel/floor contact, stock lifecycle and grasp-phase exclusions. Existing tests retain door/table tunneling, continuity, complete ordered samples and revision-bound release coverage.

`scripts/verify-cell-collision-failures-browser.js` injects collisions into clones of the loaded assets. It checks missing required body identities, each physical boundary/scanner/floor, loose stock and self-contact. Search uses cloned geometry; live assets remain unchanged by those tests.

## Live acceptance

| Run | Measured time | Maximum observed jerk | Final speed | Final acceleration |
| --- | --- | --- | --- | --- |
| baseline | 53.8570 s | 120.0000 rad/s³ | 0.00682 rad/s | 0.04036 rad/s² |
| shifted | 53.6769 s | 120.0000 rad/s³ | 0.00699 rad/s | 0.03419 rad/s² |

Both runs accepted all 1,441 measured poses and exported matching revision/rehearsal evidence with hardware acknowledgement false. The baseline UI rehearsal rejected the reference layout before execution, then search applied the closer layout. During the shifted run, moving the scanner housing into the arm stopped execution and blocked download. Restoring the scanner and retrying completed successfully. Pause held joints/progress after the paused UI settled; resume completed. The 390 px viewport had no horizontal overflow. The final [screenshot](self-cell-verified.png) was inspected.

All eleven loaded-asset failure injections passed; results are in [failure evidence](self-cell-failure-benchmark.json). Raw browser logs, screenshots and local exports are preserved at `/Users/chetpaslawski/.codex/artifacts/cellforge/self-cell-collision-2026-09-10/`.

`npm run check` passed all 81 tests, TypeScript and the production build. Existing bundle-size warning remains. R3F and React self-review found no new per-frame React state writes or construction of Three.js objects; collision sections are cached outside the frame loop.

## Limits and next milestone

These are approximate swept boxes with 2 mm padding, not exact continuous triangle collision or a certified safety analysis. Same-link and adjacent-link/internal-gripper intersections are excluded. Scanner protective-field logic, grasp physics, obstacle-obstacle layout collisions, and hardware acknowledgement remain unmodeled. The two panels are physical scene obstacles, not a complete certified enclosure.

Next: improve the rejected reference outfeed route and candidate coverage using collision-aware configuration selection; preserve full rehearsal, live acceptance and truthful local exports. Merge/deploy only with explicit authorization.
