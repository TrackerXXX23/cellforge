# Public release review — September 16, 2026

Candidate combines the current simulation milestone (`bbeb915`, PRs #13–16)
with documentation, licensing and dependency maintenance. No simulation logic
was changed by release preparation. Added the robot asset copyright notice
and a link to its bundled terms in the UI.

- Fresh `npm ci` and `npm run check`: 81 tests, TypeScript and production build
  pass. Existing large scene-chunk warning remains.
- Updated lockfile resolves reported Vitest/mocker, PostCSS and nanoid
  advisories within the existing dependency constraints. `npm audit` reports
  zero known vulnerabilities at this review; that is a point-in-time result.
- Gitleaks scanned all 42 reachable commits and exported issue/PR text/comments
  with no detected secrets. This is automated detection, not a guarantee.
- Original code receives MIT terms. UR robot graphical assets remain subject
  to the bundled Universal Robots terms; retained BSD robot-description and
  Robotiq notices remain intact. Third-party materials are explicitly excluded
  from the MIT grant. Current UR terms were fetched during review.
- README now reflects actual self/cell collision coverage, the reference
  layout's blocked state, bounded search, measured acceptance and local-only
  export. Earlier analytic-only gate and 24-second actual-run claims removed.

## Fresh browser acceptance

September 16: reference rehearsal blocked at sample 1150 with base/upper-arm
self-contact. Bounded search selected closer tables with 2/4 candidates
passing and 53.5 s rehearsal. The live cycle accepted all 1,441 measured poses
in 54.0 s. Release became available only after completion; local export status
explicitly showed no runtime acknowledgement. Historical fault-injection,
pause, shifted-fixture and mobile evidence remains in the milestone document;
those broader checks were not all repeated for this documentation release.

