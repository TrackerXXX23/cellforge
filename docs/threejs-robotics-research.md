# Three.js robotics research

Research recorded on 2026-07-21 for CellForge's real-geometry, kinematics, and computed-commissioning milestones.

## Decision

- Keep CellForge's React Three Fiber product shell and domain-first architecture.
- Install only the project-scoped `r3f-best-practices` agent skill.
- Use robotics repositories as implementation references, not as additional agent skills.
- Add `urdf-loader` and `three-mesh-bvh` when the real-robot milestone begins.
- Defer URDF-authoring and ROS skills until CellForge creates its own robot description or connects to a ROS runtime.
- Create a CellForge-specific skill only after the URDF, kinematics, and collision workflow is implemented, tested, and repeating.

This avoids overlapping skills with conflicting or outdated advice while keeping the one skill that directly covers the project's current R3F stack.

## Selected project skill

[`r3f-best-practices`](../.codex/skills/r3f-best-practices/SKILL.md) supplies guardrails for React Three Fiber render loops, loading, lifecycle management, state isolation, visibility, Drei, and performance.

Apply these rules alongside CellForge's existing architecture:

- Keep domain and commissioning state outside the scene graph.
- Mutate Three.js refs inside `useFrame`; do not drive frame-rate state through React setters.
- Use `delta` for animation and avoid allocating objects in the render loop.
- Load robot assets behind Suspense and an error boundary.
- Preserve shared resource lifecycles and explicitly dispose resources owned outside R3F.

## Repository assessment

### Primary implementation reference

[Three.js Robot Workbench](https://github.com/imehsanullah/robotics_arms_web_threejs) is the closest technical analogue found. It includes:

- browser-ready URDF packages for UR5e, Franka Research 3, and xArm7;
- official visual and collision meshes with retained upstream licenses;
- joint limits and named poses;
- position-only CCD inverse kinematics;
- a mounted Robotiq 2F-85 gripper;
- BVH self-collision checks and sampled joint-space path validation;
- a small `MoveGroupLite` planning/execution boundary;
- unit and browser tests.

The project uses vanilla Three.js rather than R3F. Port its domain modules and algorithms into CellForge instead of copying its renderer or UI architecture.

Verification performed against its current `main` branch:

- TypeScript typecheck passed.
- All 33 unit tests passed.
- The Vite production build passed.
- The only build finding was a bundle-size warning for a JavaScript chunk over 500 kB.

Important boundaries retained from the reference project:

- IK solves position, not TCP orientation.
- Collision planning samples up to roughly 30 intermediate states; it is not continuous collision detection.
- Motion is kinematic and does not model actuator dynamics or contact response.
- It is a reference implementation with no releases and should not become a CellForge dependency.

### Runtime libraries to adopt

#### [`urdf-loader`](https://github.com/gkjohnson/urdf-loaders)

Recommended for the real robot model. It loads URDF geometry and kinematic hierarchies into Three.js, exposes joints and frames, supports collision geometry, and provides `setJointValue()`.

- License: Apache-2.0.
- Integration: wrap the loaded `URDFRobot` as an R3F primitive while keeping joint state in CellForge's domain/runtime layer.
- Asset caveat: the loader's license does not cover third-party robot meshes; retain and review every model's upstream license.

#### [`three-mesh-bvh`](https://github.com/gkjohnson/three-mesh-bvh)

Recommended for accelerated collision and spatial queries.

- License: MIT.
- Use collision meshes rather than visual meshes for commissioning checks.
- Exclude identical and directly adjacent robot links from self-collision pairs.
- Sample the authored trajectory for an initial honest commissioning check, then clearly label it as sampled rather than continuous.
- Compute fixture clearance separately from Boolean intersection so findings can report minimum distance.

### Product and architecture references

#### [URDF Studio](https://github.com/OpenLegged/URDF-Studio)

Relevant for transform controls, robot topology, collision editing, worker-assisted imports, structured inspection findings, and asset workflows. Its React 19, R3F 9, and Drei 10 stack closely matches CellForge. Treat it as product and architecture research; its advertised reusable canvas package was not available from npm when checked.

#### [Glowbuzzer React](https://github.com/glowbuzzer/gbr)

Relevant later for industrial jog controls, telemetry, pick-and-place examples, machine state, and runtime synchronization. Do not adopt its whole stack now because it is broad and coupled to the separate Glowbuzzer real-time controller.

#### [`closed-chain-ik-js`](https://github.com/gkjohnson/closed-chain-ik-js)

A capable generalized IK solver, including arbitrary and closed chains. It is unnecessary for the first serial-arm milestone. Reconsider it only when CellForge needs TCP orientation, arbitrary robot definitions, or parallel mechanisms.

### Robot asset source

[Universal Robots' ROS 2 description repository](https://github.com/UniversalRobots/Universal_Robots_ROS2_Description) is a practical first source for a six-axis industrial arm. Prefer a UR5e evaluation model and verify the license of every retained mesh before redistribution; some newer Universal Robots mesh families have additional graphical-documentation terms.

## Deferred skills

- [`earthtojake/text-to-cad@urdf`](https://skills.sh/earthtojake/text-to-cad/urdf): useful when authoring or validating a custom CF-12 URDF, but unnecessary while consuming an upstream model.
- [`arpitg1304/robotics-agent-skills`](https://github.com/arpitg1304/robotics-agent-skills): useful when ROS2, hardware drivers, or production robot-runtime testing enter scope.
- Generic Three.js skill collections: redundant with the selected R3F skill and often oriented toward vanilla Three.js or older React/R3F versions.

## Recommended implementation sequence

1. **Complete:** add one browser-ready, permissively usable six-axis URDF and record asset provenance.
2. **Complete:** load it with `urdf-loader` inside the existing R3F scene.
3. **Complete:** replace the procedural arm hierarchy with the URDF joint chain while preserving the current authored motion and UI through an explicitly temporary render adapter.
4. Enforce URDF joint limits and compute the displayed TCP from the actual chain.
5. Add `three-mesh-bvh` collision pairs for robot self-collision and robot-to-fixture checks.
6. Derive reachability, collision, and sampled minimum-clearance findings from the actual motion states.
7. Add unit tests for joint limits and planning plus a browser test for the baseline/fault/recovery flow.

The milestone is complete when the current machine-tending cycle drives a real URDF chain, every target has a computed reach result, the sampled path has computed collision/clearance findings, and the deploy gate consumes those findings without claiming certified or continuous simulation.
