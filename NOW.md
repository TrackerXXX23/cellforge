# CellForge handoff

Updated September 16, 2026.

## Current work

User requested a public open-source release to accompany a Trener application.
Release branch `codex/public-release` starts from develop and includes the
latest stacked self/cell collision milestone (`bbeb915`, PRs #13–16).
Original recovery checkout and feature branches are preserved.

Added MIT licence for original code, separate third-party asset notices,
contributor instructions and a corrected README/demo guide. Refreshed lockfile
removes the reported dependency advisories. No simulation source changes.
Fresh clean install, 81 tests, typecheck and build pass; zero reported npm
advisories. Automated full-history and issue/comment secret scans found no
matches. See docs/public-release-review.md for scope and limits.

## Next exact action

Finish browser acceptance, push the release PR to develop, verify CI and
promote tested code to main for the user-requested public release. Keep
third-party asset terms separate from the application licence. Verify the
public repository anonymously before using its link in applications.

## Next product milestone

Improve the rejected reference outfeed route and expand collision-aware
candidate selection. Approximate geometry and absent hardware integration
remain explicit limitations.
