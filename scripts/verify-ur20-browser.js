// With Vite running and a Playwright CLI browser open:
// playwright-cli run-code "$(cat scripts/verify-ur20-browser.js)"
async (page) => {
  const results = await page.evaluate(async () => {
    const THREE = await import('/node_modules/.vite/deps/three.js')
    const { default: Loader } = await import('/node_modules/.vite/deps/urdf-loader.js')
    const ik = await import('/src/ur20Ik.ts')
    const config = await import('/src/ur20.ts')
    const { THREE_JAW_TCP_OFFSET } = await import('/src/eoat.ts')
    const { CYCLE_SAMPLES } = await import('/src/cycleAcceptance.ts')
    const { sampleMotion } = await import('/src/simulation.ts')
    const { evaluateCommissioning, recoveryProposals } = await import('/src/commissioning.ts')
    const xml = await (await fetch(config.UR20_URDF_URL)).text()
    const loader = new Loader()
    loader.parseVisual = false
    loader.parseCollision = false
    const robot = loader.parse(xml)
    const root = new THREE.Group()
    root.rotation.x = -Math.PI / 2
    root.add(robot)
    const tcp = new THREE.Object3D()
    tcp.position.z = THREE_JAW_TCP_OFFSET
    robot.frames.tool0.add(tcp)
    root.updateMatrixWorld(true)
    const results = []

    for (const repair of [null, ...recoveryProposals.map((proposal) => proposal.id)]) {
      const evaluation = evaluateCommissioning({ fixtureShiftMm: repair ? 180 : 0, repairId: repair })
      const plan = {
        infeedApproachTarget: evaluation.approachTarget,
        infeedPickTarget: evaluation.pickTarget,
      }
      robot.setJointValues(config.UR20_READY_JOINTS)
      const workspace = ik.createUr20IkWorkspace()
      const failures = []
      for (let index = 0; index <= CYCLE_SAMPLES; index += 1) {
        const motion = sampleMotion(index / CYCLE_SAMPLES, 'running', plan)
        const error = ik.solveUr20IkTarget(robot, tcp, motion.target, motion.toolDirection, workspace)
        const validJoints = config.UR20_JOINT_NAMES.every((name) => {
          const [lower, upper] = config.UR20_COMMISSIONING_LIMITS[name]
          const angle = robot.joints[name].angle
          return Number.isFinite(angle) && angle >= lower && angle <= upper
        })
        if (!validJoints || !ik.isUr20TcpPoseAccepted(error, workspace.directionError)) {
          failures.push({ index, target: motion.target, error, direction: workspace.directionError, validJoints })
        }
      }
      results.push({ repair, samples: CYCLE_SAMPLES + 1, failures })
    }
    window.__CELLFORGE_SOLVER_SWEEP__ = results
    return results
  })
  if (results.some((plan) => plan.failures.length)) throw new Error(JSON.stringify(results))
  return results
}
