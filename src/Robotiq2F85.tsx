import { useFrame, useLoader } from '@react-three/fiber'
import { useRef, type RefObject } from 'react'
import * as THREE from 'three'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { ROBOTIQ_2F85_GRASP_ANGLE, ROBOTIQ_2F85_TCP_OFFSET } from './eoat'
import type { MotionState } from './simulation'
import { UR20_RENDER_SCALE } from './ur20'
import {
  FINISHED_WORKPIECE_COLOR,
  RAW_WORKPIECE_COLOR,
  WORKPIECE_HEIGHT,
  WORKPIECE_RADIUS,
} from './workpiece'

const ASSET_ROOT = `${import.meta.env.BASE_URL}tools/robotiq-2f85/assets`
const MESH_URLS: string[] = [
  `${ASSET_ROOT}/base_mount.stl`,
  `${ASSET_ROOT}/base.stl`,
  `${ASSET_ROOT}/driver.stl`,
  `${ASSET_ROOT}/coupler.stl`,
  `${ASSET_ROOT}/spring_link.stl`,
  `${ASSET_ROOT}/follower.stl`,
  `${ASSET_ROOT}/pad.stl`,
  `${ASSET_ROOT}/silicone_pad.stl`,
]

const blackMaterial = new THREE.MeshStandardMaterial({
  color: '#252929',
  metalness: 0.18,
  roughness: 0.38,
})
const grayMaterial = new THREE.MeshStandardMaterial({
  color: '#767c7b',
  metalness: 0.46,
  roughness: 0.3,
})
const padMaterial = new THREE.MeshStandardMaterial({
  color: '#aeb4b3',
  metalness: 0.34,
  roughness: 0.38,
})
const siliconeMaterial = new THREE.MeshStandardMaterial({
  color: '#171a1a',
  metalness: 0,
  roughness: 0.78,
})
const preserveMaterial = { preserveMaterial: true }

const JOINT_DAMPING = 14

interface FingerProps {
  side: 'left' | 'right'
  driverGeometry: THREE.BufferGeometry
  couplerGeometry: THREE.BufferGeometry
  springGeometry: THREE.BufferGeometry
  followerGeometry: THREE.BufferGeometry
  padGeometry: THREE.BufferGeometry
  siliconePadGeometry: THREE.BufferGeometry
  driverRef: RefObject<THREE.Group | null>
  springRef: RefObject<THREE.Group | null>
  followerRef: RefObject<THREE.Group | null>
}

function Finger({
  side,
  driverGeometry,
  couplerGeometry,
  springGeometry,
  followerGeometry,
  padGeometry,
  siliconePadGeometry,
  driverRef,
  springRef,
  followerRef,
}: FingerProps) {
  const direction = side === 'left' ? -1 : 1
  const mirrored = side === 'left'

  return (
    <>
      <group
        ref={driverRef}
        position={[0, direction * 0.0306011, 0.054904]}
        rotation-z={mirrored ? Math.PI : 0}
      >
        <mesh geometry={driverGeometry} material={grayMaterial} scale={0.001} castShadow receiveShadow />
        <group position={[0, 0.0315, -0.0041]}>
          <mesh geometry={couplerGeometry} material={blackMaterial} scale={0.001} castShadow receiveShadow />
        </group>
      </group>
      <group
        ref={springRef}
        position={[0, direction * 0.0132, 0.0609]}
        rotation-z={mirrored ? Math.PI : 0}
      >
        <mesh geometry={springGeometry} material={blackMaterial} scale={0.001} castShadow receiveShadow />
        <group ref={followerRef} position={[0, 0.055, 0.0375]}>
          <mesh geometry={followerGeometry} material={blackMaterial} scale={0.001} castShadow receiveShadow />
          <group position={[0, -0.0189, 0.01352]}>
            <mesh geometry={padGeometry} material={padMaterial} scale={0.001} castShadow receiveShadow />
            <mesh geometry={siliconePadGeometry} material={siliconeMaterial} scale={0.001} castShadow receiveShadow />
          </group>
        </group>
      </group>
    </>
  )
}

interface Robotiq2F85Props {
  motion: MotionState
  tcpRef: RefObject<THREE.Object3D | null>
}

export function Robotiq2F85({ motion, tcpRef }: Robotiq2F85Props) {
  const [
    baseMountGeometry,
    baseGeometry,
    driverGeometry,
    couplerGeometry,
    springGeometry,
    followerGeometry,
    padGeometry,
    siliconePadGeometry,
  ] = useLoader(STLLoader, MESH_URLS)
  const leftDriver = useRef<THREE.Group>(null)
  const rightDriver = useRef<THREE.Group>(null)
  const leftSpring = useRef<THREE.Group>(null)
  const rightSpring = useRef<THREE.Group>(null)
  const leftFollower = useRef<THREE.Group>(null)
  const rightFollower = useRef<THREE.Group>(null)

  useFrame((_, delta) => {
    const jointAngle = motion.gripperClosed ? ROBOTIQ_2F85_GRASP_ANGLE : 0
    leftDriver.current!.rotation.x = THREE.MathUtils.damp(leftDriver.current!.rotation.x, jointAngle, JOINT_DAMPING, delta)
    rightDriver.current!.rotation.x = THREE.MathUtils.damp(rightDriver.current!.rotation.x, jointAngle, JOINT_DAMPING, delta)
    leftSpring.current!.rotation.x = THREE.MathUtils.damp(leftSpring.current!.rotation.x, jointAngle, JOINT_DAMPING, delta)
    rightSpring.current!.rotation.x = THREE.MathUtils.damp(rightSpring.current!.rotation.x, jointAngle, JOINT_DAMPING, delta)
    leftFollower.current!.rotation.x = THREE.MathUtils.damp(leftFollower.current!.rotation.x, -jointAngle, JOINT_DAMPING, delta)
    rightFollower.current!.rotation.x = THREE.MathUtils.damp(rightFollower.current!.rotation.x, -jointAngle, JOINT_DAMPING, delta)
  })

  return (
    <group name="Robotiq 2F-85" scale={1 / UR20_RENDER_SCALE} userData={preserveMaterial}>
      <group position-z={0.007} scale={0.001}>
        <mesh geometry={baseMountGeometry} material={blackMaterial} castShadow receiveShadow />
      </group>
      <group position-z={0.0108} rotation-z={-Math.PI / 2}>
        <group>
          <mesh geometry={baseGeometry} material={blackMaterial} scale={0.001} castShadow receiveShadow />
          <Finger
            side="left"
            driverGeometry={driverGeometry}
            couplerGeometry={couplerGeometry}
            springGeometry={springGeometry}
            followerGeometry={followerGeometry}
            padGeometry={padGeometry}
            siliconePadGeometry={siliconePadGeometry}
            driverRef={leftDriver}
            springRef={leftSpring}
            followerRef={leftFollower}
          />
          <Finger
            side="right"
            driverGeometry={driverGeometry}
            couplerGeometry={couplerGeometry}
            springGeometry={springGeometry}
            followerGeometry={followerGeometry}
            padGeometry={padGeometry}
            siliconePadGeometry={siliconePadGeometry}
            driverRef={rightDriver}
            springRef={rightSpring}
            followerRef={rightFollower}
          />
        </group>
        <mesh
          position-z={ROBOTIQ_2F85_TCP_OFFSET - 0.0108}
          rotation-x={Math.PI / 2}
          visible={motion.carrying !== null}
          castShadow
        >
          <cylinderGeometry args={[WORKPIECE_RADIUS, WORKPIECE_RADIUS, WORKPIECE_HEIGHT, 32]} />
          <meshStandardMaterial
            color={motion.carrying === 'finished' ? FINISHED_WORKPIECE_COLOR : RAW_WORKPIECE_COLOR}
            emissive={motion.carrying === 'finished' ? '#183f34' : '#4a280d'}
            emissiveIntensity={0.14}
            metalness={0.5}
            roughness={0.28}
          />
        </mesh>
        <object3D ref={tcpRef} position-z={ROBOTIQ_2F85_TCP_OFFSET - 0.0108} />
      </group>
    </group>
  )
}
