# CellForge handoff

## Current state

- Branch: `codex/r3f-skill-testing`, created from `develop` at the clean `main` commit `5c99f45`.
- Branch model: `main` → `develop` → feature branch.
- Infrastructure: project R3F guardrail tests, full verification command, and GitHub CI are implemented and verified on this branch.
- Repository: `https://github.com/TrackerXXX23/cellforge` (private).
- Draft PR: `https://github.com/TrackerXXX23/cellforge/pull/1` targeting `develop`.

## Changed

- Added AST-based checks for React state writes and object allocation inside `useFrame`.
- Added delta enforcement for `MathUtils.damp` and Suspense enforcement for lazy components.
- Added `npm run test:skill` and `npm run check`.
- Added CI for `develop` and `main` pushes and pull requests.
- Added repository branch, verification, and handoff conventions.
- Verified `npm run check`: typecheck passed, all 8 tests passed, and the production build completed.
- The production build retains the existing warning for a scene chunk over 500 kB.

## Blocked

- None.

## Next exact action

Wait for PR #1 checks, address any failures, then mark the PR ready and merge it into `develop`.
