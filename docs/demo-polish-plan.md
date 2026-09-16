# Play-first demo polish — approved scope

User approved these five changes on September 16, 2026, for implementation in
a fresh task using gpt-5.6-sol with medium reasoning. Complete them autonomously
with local browser acceptance. The objective is a smooth, understandable job
application example: configure a small robot cell, run it, and recover from a
problem. Reuse the working simulation rather than rebuild it.

## Five changes

1. Open on the known passing closer-table configuration with a prominent
   **Run cell** button. Keep the rejected reference arrangement as an optional
   scenario, not the visitor's first experience.
2. Present **Run, Pause/Resume, Reset** and three clear scenarios: **Normal run,
   Moved fixture, Blocked layout**. Move revision history, release/export,
   collision metrics and other commissioning details into **Technical details**.
   Keep revision-bound acceptance and export gates internally correct.
3. Explain the process in plain language: **Picking stock → Loading CNC →
   Machining → Unloading → Complete**. Failures must explain the actual reason
   and offer **Find working layout** where supported. The recovery must use the
   real bounded planner, not claim success from a timer or staged animation.
4. Show the CNC working: animate the existing spindle rotating/moving through
   a representative machining phase and visually distinguish the finished part.
   Add an optional machine-interior view. Respect door/robot interlocks, actual
   machine orientation and contact checks. This is illustrative machining,
   not physical stock-removal simulation. Ensure pause and reset affect it too.
5. Polish the entire loop locally: camera framing, smooth robot/machine motion,
   repeat runs, scenario changes, reset, recovery, desktop and mobile. Exercise
   blocked states and invalidated evidence as well as successful cycles. Inspect
   screenshots and actual motion, fix defects, and run npm run check.

## Boundaries and deferred ideas

- User explicitly said do not deploy until the experience is smooth and ready.
  For this task: no deployment, merge, promotion or push. GitHub is connected to
  Vercel, so even a feature push triggers a preview deployment. This overrides
  AGENTS.md's usual push/draft-PR completion workflow for this slice. Save local
  commits and durable proof; leave a local preview and concise completion report.
  Do not disable or modify the existing hosting integration to work around this.
- Free-text instructions (describe a desired job, then configure/rehearse it)
  are a desired future feature. Preserve this idea; do not implement it now.
- Arbitrary machine configuration, an LLM service, exact material removal and
  expanded general-purpose robotics planning are outside this focused pass.
- No routine user visual approval is needed for implementation: own acceptance.
  A later deployment requires the user's go-ahead.

## Starting evidence and branch state

- Start from this preserved handoff branch, based on codex/hosted-demo at
  de44b3f, which includes the main release 69e1f22. PR #19 contains only hosting
  documentation and was draft with green CI at last check; do not merge it.
- Production: https://cellforge-orcin.vercel.app . Original public source:
  https://github.com/TrackerXXX23/cellforge . Existing Vercel project is named
  cellforge-demo. Leave production unchanged.
- Prior proof: npm run check passed 81 tests, typecheck, build. Hosted reference
  rejected at sample 1150; closer layout accepted 1441 measured poses and
  exported Revision 08. See docs/self-cell-collision-verification.md and other
  verification documents for scoped collision approximations and failure tests.
- Original recovery checkout and the public-release worktree (with its
  pre-existing uncommitted NOW.md) stay untouched. The required app and plan
  are committed on this handoff branch; no old worktree path is required.
- Read AGENTS.md and relevant frontend-design/R3F skills before implementation.
  Do not weaken collision, motion or release gates for a smoother-looking demo.

## Completion evidence

Record tested scenarios, meaningful failures, repeat/reset behavior, screenshots,
local preview URL, npm run check results, remaining limitations and local commit
in NOW.md. End with the usable local result; do not publish it.
