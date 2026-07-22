import { createPortal, useFrame, useLoader } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type RefObject } from 'react'
import * as THREE from 'three'
import URDFLoader, { type URDFRobot } from 'urdf-loader'
import type { MotionState } from './simulation'
import {
  UR5E_PACKAGE_URL,
  UR5E_READY_JOINTS,
  UR5E_RENDER_SCALE,
  UR5E_URDF_URL,
} from './ur5e'
import { createUr5eIkWorkspace, stepUr5eIk } from './ur5eIk'

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

interface Ur5eMotionDebug {
  tcpError: number
  directionError: number
  target: [number, number, number]
  tcp: [number, number, number]
}

declare global {
  interface Window {
    __CELLFORGE_UR5E_MOTION__?: Ur5eMotionDebug
  }
}

const motionDebug: Ur5eMotionDebug = {
  tcpError: Number.POSITIVE_INFINITY,
  directionError: Number.POSITIVE_INFINITY,
  target: [0, 0, 0],
  tcp: [0, 0, 0],
}

interface Ur5eRobotProps {
  motion: MotionState
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

function ParallelGripper({
  motion,
  tcpRef,
}: Pick<Ur5eRobotProps, 'motion'> & { tcpRef: RefObject<THREE.Object3D | null> }) {
  const leftFinger = useRef<THREE.Mesh>(null!)
  const rightFinger = useRef<THREE.Mesh>(null!)

  useFrame((_, delta) => {
    const fingerOffset = motion.gripperClosed ? 0.022 : 0.044
    leftFinger.current.position.x = THREE.MathUtils.damp(leftFinger.current.position.x, -fingerOffset, 16, delta)
    rightFinger.current.position.x = THREE.MathUtils.damp(rightFinger.current.position.x, fingerOffset, 16, delta)
  })

  return (
    <group position-z={0.08}>
      <mesh position-z={0.025} castShadow>
        <cylinderGeometry args={[0.055, 0.065, 0.05, 28]} />
        <meshStandardMaterial color={graphite} roughness={0.42} />
      </mesh>
      <mesh ref={leftFinger} position={[-0.044, 0, 0.12]} castShadow>
        <boxGeometry args={[0.025, 0.04, 0.15]} />
        <meshStandardMaterial color={graphite} roughness={0.48} />
      </mesh>
      <mesh ref={rightFinger} position={[0.044, 0, 0.12]} castShadow>
        <boxGeometry args={[0.025, 0.04, 0.15]} />
        <meshStandardMaterial color={graphite} roughness={0.48} />
      </mesh>
      <mesh position-z={0.23} visible={motion.carrying !== null} castShadow>
        <cylinderGeometry args={[0.055, 0.055, 0.075, 28]} />
        <meshStandardMaterial
          color={motion.carrying === 'finished' ? '#79a998' : '#c4873e'}
          emissive={motion.carrying === 'finished' ? '#183f34' : '#4a280d'}
          emissiveIntensity={0.14}
          metalness={0.5}
          roughness={0.28}
        />
      </mesh>
      <object3D ref={tcpRef} position-z={0.23} />
    </group>
  )
}

export function Ur5eRobot({ motion, selected, onSelect }: Ur5eRobotProps) {
  const robot = useLoader(R3fUrdfLoader, UR5E_URDF_URL, (loader) => {
    const urdfLoader = loader as unknown as URDFLoader
    urdfLoader.packages = { ur_description: UR5E_PACKAGE_URL }
    urdfLoader.parseVisual = true
    urdfLoader.parseCollision = false
  })
  const toolFrame = robot.frames.tool0
  const tcpRef = useRef<THREE.Object3D>(null)
  const ikWorkspace = useMemo(createUr5eIkWorkspace, [])

  useEffect(() => {
    if (import.meta.env.DEV) window.__CELLFORGE_UR5E_MOTION__ = motionDebug
    robot.setJointValues(UR5E_READY_JOINTS)
    robot.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return
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
      if (import.meta.env.DEV) delete window.__CELLFORGE_UR5E_MOTION__
    }
  }, [robot])

  useFrame((_, delta) => {
    const tcpError = stepUr5eIk(
      robot,
      tcpRef.current,
      motion.target,
      motion.toolDirection,
      delta,
      ikWorkspace,
    )
    if (import.meta.env.DEV) {
      motionDebug.tcpError = tcpError
      motionDebug.directionError = ikWorkspace.directionError
      motionDebug.target[0] = motion.target[0]
      motionDebug.target[1] = motion.target[1]
      motionDebug.target[2] = motion.target[2]
      motionDebug.tcp[0] = ikWorkspace.toolPosition.x
      motionDebug.tcp[1] = ikWorkspace.toolPosition.y
      motionDebug.tcp[2] = ikWorkspace.toolPosition.z
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
        scale={UR5E_RENDER_SCALE}
        dispose={null}
      />
      {toolFrame && createPortal(<ParallelGripper motion={motion} tcpRef={tcpRef} />, toolFrame)}
    </group>
  )
}
