# CellForge agent instructions

## Branch workflow

- `main` is the clean release branch.
- `develop` is the integration branch and must contain `main` before feature work begins.
- Create work branches from `develop`; Codex branches use the `codex/` prefix.
- Target feature pull requests at `develop`. Promote tested `develop` changes to `main` separately.
- Do not commit feature work directly to `main` or `develop`.

## React Three Fiber work

- Read `.codex/skills/r3f-best-practices/SKILL.md` before writing, reviewing, or optimizing R3F code.
- Keep commissioning and runtime state outside the scene graph.
- Mutate Three.js refs in `useFrame`; do not call React state setters or allocate new objects there.
- Use frame delta for damping or velocity-driven animation.
- Put lazy 3D components behind Suspense and preserve asset-loading error boundaries.
- Treat robotics simulation results as engineering aids, not certified safety results.

## Verification

Run the narrowest useful command while iterating:

- `npm run test:skill` for R3F guardrails.
- `npm test` for the complete test suite.
- `npm run typecheck` for TypeScript.
- `npm run check` before commit or handoff; it runs typecheck, tests, and the production build.

CI runs `npm run check` for pushes and pull requests involving `develop` or `main`.

## Handoff

- Keep `NOW.md` current with changes, blockers, the next exact action, and the active branch or PR.
- Run `./continue` to print the branch, working tree, current handoff, and likely active tickets.
- Follow the global commit format: `type(scope): summary` with `Why`, `What`, and `Notes` sections.
