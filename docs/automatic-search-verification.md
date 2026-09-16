# Automatic layout/path search and jerk-limited motion

Branch: `codex/automatic-layout-jerk-motion`, based on PR #14 head `8632ec5`.
This slice depends on open PR #14 and PR #13; neither parent branch was changed.

## Behavior and limits

“Find best layout & path” exhausts two table presets and two transfer heights (standard or +100 mm). With a shifted fixture it also considers no repair, lifted approach, and side entry. This yields four baseline or twelve shifted candidates. P02 preflight rejects unsafe candidates before asset rehearsal. Only complete, passing 1,441-pose rehearsals are ranked, by elapsed simulated time, TCP travel, then stable candidate ID. This is a bounded candidate search, not a global optimum or a general obstacle-routing planner.

Search uses cloned table frames and the existing loaded robot/CNC collision geometry. Applying a winner invalidates old execution evidence. Run independently rehearses the selected configuration and requires measured execution before export. Changing configuration cancels outstanding search; cancellation never applies a partial winner. Search comparisons, selected motion, configured limits, and revision-bound rehearsal/run evidence accompany local exports. Hardware acknowledgement remains false.

The controller now stores acceleration and integrates constant-jerk substeps, with velocity headroom for acceleration ramp-down. Prototype settings are 4 rad/s² acceleration and 120 rad/s³ jerk; these are application settings, not manufacturer-certified jerk specifications. The runtime continuity monitor measures signed divided differences at uneven frame intervals, allowing 0.1 numerical tolerance. Final home requires speed ≤0.01 rad/s and acceleration ≤0.05 rad/s². Pause preserves integration history; a new run resets it.

## Verified results

The checked-in [benchmark JSON](automatic-search-benchmark.json) contains every candidate and rejection. Repeating the baseline search produced the identical winner and duration. Candidate search did not mutate live joints or table transforms.

| Fixture | Winning candidate | Passing / total | Rehearsal |
| --- | --- | --- | --- |
| Original | Closer tables, standard transfer | 4 / 4 | 50.8167 s |
| +180 mm | Closer tables, side entry, standard transfer | 8 / 12 | 50.4333 s |

The four shifted candidates without repair were P02-blocked. Reference baseline took 56.9833 s under the same profile. All passing rehearsals accepted 1,441 poses and stayed within acceleration/jerk tolerance. The previous PR #14 compact baseline was 44.45 s: this configured jerk-limited profile is about 14% slower and should not be described as a cycle-time improvement across controller versions.

Live baseline accepted all 1,441 poses in 51.0192 s, with maximum observed jerk approximately 120 rad/s³ and final speed 0.00642 rad/s, acceleration 0.04727 rad/s². Pause/resume preserved joints, progress, and acceleration. A 390 px viewport had no horizontal overflow. The released [desktop screenshot](automatic-search-verified.png) was visually inspected.

Cancellation through fixture restore discarded pending search and blocked stale export. Enlarging CNC DoorGlass rejected all four candidates with CNC swept-contact failures, producing no winner. Restoring geometry and shifting the fixture selected the expected side-entry winner. Unit coverage includes excessive jerk below acceleration/velocity limits, uneven frame intervals, reversal and saturated velocity, missing/invalid evidence, incomplete coverage, cancellation even on the last candidate, and all-candidate failure.

Live shifted-winner export also accepted all 1,441 poses in 50.5076 s, maximum jerk 120.0000 rad/s³, final speed 0.00682 rad/s and acceleration 0.02915 rad/s². Its twelve-candidate audit and rehearsal match the executed revision; hardware acknowledgement is false.

## Scope

Collision checks remain approximate swept bounds for arm/tool/payload against CNC and table meshes, with named support contacts allowed. Self-collision, loose stock, scanner/fences, grasp forces, and hardware certification remain excluded. Fixed 60 Hz rehearsal is predictive evidence; actual browser motion is separately checked. This is an engineering aid, not a safety certificate.

Next milestone: add self-collision and remaining cell bodies while preserving rejection, measured execution, and truthful export gates; then improve timing within the configured motion bounds.

Validation: `npm run check` passed TypeScript, all 74 tests, and the production build. Existing bundle-size warning remains.
