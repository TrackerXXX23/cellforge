// Run through Playwright CLI with the app loaded. Uses copies of rendered assets.
async (page) => {
  await page.waitForFunction(() => window.__CELLFORGE_ROBOT__?.getObjectByName('GripperRotor') && window.__CELLFORGE_CNC__)
  const results = await page.evaluate(async () => {
    const THREE = await import('/node_modules/.vite/deps/three.js')
    const ik = await import('/src/ur20Ik.ts')
    const { createMotionContinuityMonitor } = await import('/src/motionContinuity.ts')
    const config = await import('/src/ur20.ts')
    const { createCncContactMonitor } = await import('/src/cncContact.ts')
    const { sampleMotion } = await import('/src/simulation.ts')
    const { CYCLE_SAMPLES } = await import('/src/cycleAcceptance.ts')
    const { evaluateCommissioning } = await import('/src/commissioning.ts')
    const { CNC_DOOR_OPEN_OFFSET, CNC_MACHINE_POSITION } = await import('/src/cnc.ts')
    const results = []
    for (const repair of [null, 'lifted-approach', 'side-entry']) {
      const robot = window.__CELLFORGE_ROBOT__.clone(true)
      robot.setJointValues(config.UR20_READY_JOINTS)
      const machine = window.__CELLFORGE_CNC__.clone(true)
      machine.position.fromArray(CNC_MACHINE_POSITION)
      const spindle = machine.getObjectByName('Spindle')
      spindle.position.y = 1.89
      const door = machine.getObjectByName('Door')
      door.position.x = CNC_DOOR_OPEN_OFFSET
      const jaws = robot.getObjectsByProperty('name', 'GripperJaw')
      const rotor = robot.getObjectByName('GripperRotor')
      if (jaws.length !== 3 || !rotor) throw new Error('Gripper geometry missing')
      const planner = robot.clone(true)
      const tcp = new THREE.Object3D()
      tcp.position.z = 0.14
      robot.frames.tool0.add(tcp)
      const plannedTcp = tcp.clone()
      planner.frames.tool0.add(plannedTcp)
      const ws = ik.createUr20IkWorkspace()
      const plannerWs = ik.createUr20IkWorkspace()
      const continuity = createMotionContinuityMonitor()
      const monitor = createCncContactMonitor()
      monitor.registerRobot(robot)
      monitor.registerMachine(machine)
      const evaluation = evaluateCommissioning({fixtureShiftMm: repair ? 180 : 0, repairId: repair})
      const plan = {infeedApproachTarget:evaluation.approachTarget,infeedPickTarget:evaluation.pickTarget}
      let failure = null, frameCount = 0, maxJump = 0, jumpAt = 0
      let priorTargets = null
      for (let index = 0; index <= CYCLE_SAMPLES; index++) {
        const motion = sampleMotion(index / CYCLE_SAMPLES, 'running', plan)
        const error = ik.solveUr20IkTarget(planner, plannedTcp, motion.target, motion.toolDirection, plannerWs)
        const targets = config.UR20_IK_JOINT_NAMES.map(name => planner.joints[name].angle)
        if (priorTargets) {
          const jump = Math.max(...targets.map((v,i) => Math.abs(v-priorTargets[i])))
          if (jump > maxJump) { maxJump = jump; jumpAt = index }
        }
        priorTargets = targets
        robot.getObjectByName('CarriedWorkpiece').visible = motion.carrying !== null
        for (let frame = 0; frame < 480; frame++) {
          frameCount++
          rotor.rotation.z = THREE.MathUtils.damp(rotor.rotation.z, motion.gripperClosed ? Math.PI / 6 : 0, 7, 1/60)
          for (const jaw of jaws) {
            jaw.position.x = THREE.MathUtils.damp(jaw.position.x, motion.gripperClosed ? 0.036 : 0.058, 7, 1/60)
            jaw.position.z = THREE.MathUtils.damp(jaw.position.z, motion.gripperClosed ? 0 : -0.018, 7, 1/60)
          }
          ik.stepUr20JointMotion(robot, targets, 1/60, ws)
          door.position.x = THREE.MathUtils.damp(door.position.x, motion.doorOpen ? CNC_DOOR_OPEN_OFFSET : 0, 8, 1/60)
          spindle.position.y = THREE.MathUtils.damp(spindle.position.y, motion.machineRunning ? 1.59 : 1.89, 8, 1/60)
          machine.updateMatrixWorld(true)
          const contact = monitor.measure('sweep', false) || continuity.measure(config.UR20_JOINT_NAMES.map(name => robot.joints[name].angle), 1/60, false, 'sweep')
          if (contact) { failure = {index, progress:index/CYCLE_SAMPLES, contact, target:motion.target}; break }
          const actualError = ik.measureUr20TcpPose(tcp, motion.target, motion.toolDirection, ws)
          if (ik.isUr20TcpPoseAccepted(actualError, ws.directionError) && ik.isUr20TcpPoseAccepted(error, plannerWs.directionError)) break
          if (frame === 479) failure = {index, actualError, error, direction:plannerWs.directionError, reason:'tracking timeout'}
        }
        if (failure) break
      }
      results.push({repair, failure, frameCount, maxJump, jumpAt, maxVelocity:continuity.maxVelocity, maxAcceleration:continuity.maxAcceleration})
    }
    window.__CELLFORGE_CNC_SWEEP__ = results
    return results
  })
  if (results.some(result => result.failure)) throw new Error(JSON.stringify(results))
  return results
}
