# Contributing

Use Node.js 22.12+ and `npm ci`. Branch from `develop` and send pull requests
to `develop`; tested releases are promoted to `main` separately.

Run `npm run check` before opening a PR. For simulation changes, exercise a
complete passing run and a meaningful blocked failure, and verify exported
evidence matches the selected revision. An elapsed timer is not acceptance.

Keep deterministic process state outside the scene graph. Preserve asset
provenance and separate licences. Do not describe approximate geometry or
simulation evidence as hardware safety certification.

Small focused PRs with the problem, resulting behaviour, verification and
remaining limitations are easiest to review. See AGENTS.md for repository
workflow details.
