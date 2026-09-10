import { createPortal, useFrame, useLoader } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import URDFLoader, { type URDFRobot } from 'urdf-loader'
import { THREE_JAW_TCP_OFFSET } from './eoat'
import { ThreeJawGripper } from './ThreeJawGripper'
import type { MotionTelemetry } from './cycleAcceptance'
import { UR20_JOINT_NAMES } from './ur20'
import type { MotionState } from './simulation'
import {
  UR20_PACKAGE_URL,
  UR20_IK_JOINT_NAMES,
  UR20_OUTFEED_SEED_JOINTS,
  UR20_READY_JOINTS,
  UR20_RENDER_SCALE,
  UR20_URDF_URL,
} from './ur20'
import {
  createUr20IkWorkspace,
  measureUr20TcpPose,
  solveUr20IkTarget,
  stepUr20JointMotion,
} from './ur20Ik'

const graphite = '#26302f'
const shellMaterial = new THREE.MeshStandardMaterial({
  color: '#d8dedc',
  metalness: 0.08,
  roughness: 0.38,
})
const jointMaterial = new THREE.MeshStandardMaterial({
  color: '#245df3',
  metalness: 0.04,
  roughness: 0.34,
})
const baseMaterial = new THREE.MeshStandardMaterial({
  color: graphite,
  metalness: 0.12,
  roughness: 0.46,
})
const R3fUrdfLoader = URDFLoader as unknown as new (
  manager?: THREE.LoadingManager,
) => THREE.Loader<URDFRobot>

interface Ur20MotionDebug {
  tcpError: number
  directionError: number
  target: [number, number, number]
  tcp: [number, number, number]
  joints: [number, number, number, number, number, number]
  plannedTcpError: number
  plannedDirectionError: number
  plannedJoints: [number, number, number, number, number]
  action: string
  jointVelocities: [number, number, number, number, number]
}

declare global {
  interface Window {
    __CELLFORGE_UR20_MOTION__?: Ur20MotionDebug
  }
}

const motionDebug: Ur20MotionDebug = {
  tcpError: Number.POSITIVE_INFINITY,
  directionError: Number.POSITIVE_INFINITY,
  target: [0, 0, 0],
  tcp: [0, 0, 0],
  joints: [0, 0, 0, 0, 0, 0],
  plannedTcpError: Number.POSITIVE_INFINITY,
  plannedDirectionError: Number.POSITIVE_INFINITY,
  plannedJoints: [0, 0, 0, 0, 0],
  action: '',
  jointVelocities: [0, 0, 0, 0, 0],
}

interface Ur20RobotProps {
  motion: MotionState
  telemetry: React.RefObject<MotionTelemetry | null>
  motionToken: string
  progress: number
  paused: boolean
  selected: boolean
  onSelect: (event: import('@react-three/fiber').ThreeEvent<MouseEvent>) => void
}

function getUrdfLinkName(object: THREE.Object3D) {
  let current: THREE.Object3D | null = object

  while (current) {
    const candidate = current as THREE.Object3D & { isURDFLink?: boolean; urdfName?: string }
    if (candidate.isURDFLink) return candidate.urdfName ?? ''
    current = current.parent
  }

  return ''
}

function preservesAttachedMaterial(object: THREE.Object3D) {
  let current: THREE.Object3D | null = object

  while (current) {
    if (current.userData.preserveMaterial === true) return true
    current = current.parent
  }

  return false
}

export function Ur20Robot({ motion, selected, onSelect, telemetry, motionToken, progress, paused }: Ur20RobotProps) {
  const robot = useLoader(R3fUrdfLoader, UR20_URDF_URL, (loader) => {
    const urdfLoader = loader as unknown as URDFLoader
    urdfLoader.packages = { ur_description: UR20_PACKAGE_URL }
    urdfLoader.parseVisual = true
    urdfLoader.parseCollision = false
  })
  const toolFrame = robot.frames.tool0
  const tcpRef = useRef<THREE.Object3D>(null)
  const measurement = useMemo<MotionTelemetry>(() => ({ token: '', progress: 0, timestamp: 0, tcpError: Infinity, directionError: Infinity, plannedTcpError: Infinity, plannedDirectionError: Infinity, joints: Array(6).fill(0) }), [])
  const motionWorkspace = useMemo(createUr20IkWorkspace, [])
  const planner = useMemo(() => {
    const plannerRobot = robot.clone(true)
    const root = new THREE.Group()
    const tcp = new THREE.Object3D()
    root.rotation.x = -Math.PI / 2
    root.scale.setScalar(UR20_RENDER_SCALE)
    root.add(plannerRobot)
    plannerRobot.frames.tool0?.add(tcp)
    tcp.position.z = THREE_JAW_TCP_OFFSET / UR20_RENDER_SCALE
    plannerRobot.setJointValues(UR20_READY_JOINTS)
    root.updateMatrixWorld(true)
    return {
      robot: plannerRobot,
      root,
      tcp,
      workspace: createUr20IkWorkspace(),
      targetJoints: UR20_IK_JOINT_NAMES.map((name) => UR20_READY_JOINTS[name]),
      tcpError: Number.POSITIVE_INFINITY,
    }
  }, [robot])

  useEffect(() => {
    if (import.meta.env.DEV) window.__CELLFORGE_UR20_MOTION__ = motionDebug
    robot.setJointValues(UR20_READY_JOINTS)
    robot.traverse((object) => {
      if (!(object instanceof THREE.Mesh) || preservesAttachedMaterial(object)) return
      const linkName = getUrdfLinkName(object)
      object.castShadow = true
      object.receiveShadow = true
      object.material = linkName === 'base_link_inertia'
        ? baseMaterial
        : linkName === 'shoulder_link' || linkName.startsWith('wrist_')
          ? jointMaterial
          : shellMaterial
    })
    return () => {
      if (import.meta.env.DEV) delete window.__CELLFORGE_UR20_MOTION__
    }
  }, [robot])

  useEffect(() => {
    const followsOutfeedBranch = motion.action === 'Moving to outfeed approach'
      || motion.action === 'Descending to outfeed slot'
      || motion.action === 'Releasing finished part'
    if (followsOutfeedBranch) planner.robot.setJointValues(UR20_OUTFEED_SEED_JOINTS)
    planner.tcpError = solveUr20IkTarget(
      planner.robot,
      planner.tcp,
      motion.target,
      motion.toolDirection,
      planner.workspace,
    )
    for (let index = 0; index < UR20_IK_JOINT_NAMES.length; index += 1) {
      planner.targetJoints[index] = planner.robot.joints[UR20_IK_JOINT_NAMES[index]].angle
    }
  }, [
    motion.target[0],
    motion.target[1],
    motion.target[2],
    motion.toolDirection[0],
    motion.toolDirection[1],
    motion.toolDirection[2],
    planner,
  ])

  useFrame((_, delta) => {
    if (!paused) stepUr20JointMotion(robot, planner.targetJoints, delta, motionWorkspace)
    const tcpError = measureUr20TcpPose(
      tcpRef.current,
      motion.target,
      motion.toolDirection,
      motionWorkspace,
    )
    measurement.token = motionToken
    measurement.progress = progress
    measurement.timestamp = performance.now()
    measurement.tcpError = tcpError
    measurement.directionError = motionWorkspace.directionError
    measurement.plannedTcpError = planner.tcpError
    measurement.plannedDirectionError = planner.workspace.directionError
    for (let index = 0; index < UR20_JOINT_NAMES.length; index += 1) {
      measurement.joints[index] = robot.joints[UR20_JOINT_NAMES[index]]?.angle ?? NaN
    }
    telemetry.current = measurement
    if (import.meta.env.DEV) {
      motionDebug.tcpError = tcpError
      motionDebug.directionError = motionWorkspace.directionError
      motionDebug.target[0] = motion.target[0]
      motionDebug.target[1] = motion.target[1]
      motionDebug.target[2] = motion.target[2]
      motionDebug.tcp[0] = motionWorkspace.toolPosition.x
      motionDebug.tcp[1] = motionWorkspace.toolPosition.y
      motionDebug.tcp[2] = motionWorkspace.toolPosition.z
      motionDebug.joints[0] = robot.joints.shoulder_pan_joint?.angle ?? 0
      motionDebug.joints[1] = robot.joints.shoulder_lift_joint?.angle ?? 0
      motionDebug.joints[2] = robot.joints.elbow_joint?.angle ?? 0
      motionDebug.joints[3] = robot.joints.wrist_1_joint?.angle ?? 0
      motionDebug.joints[4] = robot.joints.wrist_2_joint?.angle ?? 0
      motionDebug.joints[5] = robot.joints.wrist_3_joint?.angle ?? 0
      motionDebug.plannedTcpError = planner.tcpError
      motionDebug.plannedDirectionError = planner.workspace.directionError
      motionDebug.action = motion.action
      for (let index = 0; index < UR20_IK_JOINT_NAMES.length; index += 1) {
        motionDebug.plannedJoints[index] = planner.targetJoints[index]
        motionDebug.jointVelocities[index] = motionWorkspace.jointVelocities[index]
      }
    }
  })

  return (
    <group onClick={onSelect}>
      {selected && (
        <mesh rotation-x={-Math.PI / 2} position-y={0.015}>
          <ringGeometry args={[0.45, 0.475, 64]} />
          <meshBasicMaterial color="#245df3" transparent opacity={0.9} />
        </mesh>
      )}
      <primitive
        object={robot}
        rotation-x={-Math.PI / 2}
        scale={UR20_RENDER_SCALE}
        dispose={null}
      />
      {toolFrame && createPortal(<ThreeJawGripper paused={paused} motion={motion} tcpRef={tcpRef} />, toolFrame)}
    </group>
  )
}
