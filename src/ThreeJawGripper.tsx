import { useFrame } from '@react-three/fiber'
import { useRef, type RefObject } from 'react'
import * as THREE from 'three'
import {
  THREE_JAW_CLOSED_RADIUS,
  THREE_JAW_OPEN_RADIUS,
  THREE_JAW_TCP_OFFSET,
  THREE_JAW_TWIST_ANGLE,
} from './eoat'
import type { MotionState } from './simulation'
import { UR20_RENDER_SCALE } from './ur20'
import {
  FINISHED_WORKPIECE_COLOR,
  RAW_WORKPIECE_COLOR,
  WORKPIECE_HEIGHT,
  WORKPIECE_RADIUS,
} from './workpiece'

const bodyMaterial = new THREE.MeshStandardMaterial({
  color: '#202625',
  metalness: 0.42,
  roughness: 0.3,
})
const rotorMaterial = new THREE.MeshStandardMaterial({
  color: '#596361',
  metalness: 0.58,
  roughness: 0.26,
})
const jawMaterial = new THREE.MeshStandardMaterial({
  color: '#858e8c',
  metalness: 0.52,
  roughness: 0.3,
})
const contactMaterial = new THREE.MeshStandardMaterial({
  color: '#151919',
  metalness: 0.08,
  roughness: 0.76,
})
const preserveMaterial = { preserveMaterial: true }
const JAW_DAMPING = 16

interface JawProps {
  angle: number
  jawRef: RefObject<THREE.Group | null>
}

function Jaw({ angle, jawRef }: JawProps) {
  return (
    <group rotation-z={angle}>
      <group ref={jawRef} position-x={THREE_JAW_OPEN_RADIUS}>
        <mesh position-z={0.108} castShadow receiveShadow>
          <boxGeometry args={[0.028, 0.026, 0.024]} />
          <primitive object={jawMaterial} attach="material" />
        </mesh>
        <mesh position={[0, 0, 0.137]} castShadow receiveShadow>
          <boxGeometry args={[0.012, 0.025, 0.058]} />
          <primitive object={contactMaterial} attach="material" />
        </mesh>
      </group>
    </group>
  )
}

interface ThreeJawGripperProps {
  motion: MotionState
  tcpRef: RefObject<THREE.Object3D | null>
}

function dampJaw(ref: RefObject<THREE.Group | null>, radius: number, delta: number) {
  ref.current!.position.x = THREE.MathUtils.damp(ref.current!.position.x, radius, JAW_DAMPING, delta)
}

export function ThreeJawGripper({ motion, tcpRef }: ThreeJawGripperProps) {
  const rotorRef = useRef<THREE.Group>(null)
  const firstJawRef = useRef<THREE.Group>(null)
  const secondJawRef = useRef<THREE.Group>(null)
  const thirdJawRef = useRef<THREE.Group>(null)

  useFrame((_, delta) => {
    const jawRadius = motion.gripperClosed ? THREE_JAW_CLOSED_RADIUS : THREE_JAW_OPEN_RADIUS
    const rotorAngle = motion.gripperClosed ? THREE_JAW_TWIST_ANGLE : 0

    rotorRef.current!.rotation.z = THREE.MathUtils.damp(
      rotorRef.current!.rotation.z,
      rotorAngle,
      JAW_DAMPING,
      delta,
    )
    dampJaw(firstJawRef, jawRadius, delta)
    dampJaw(secondJawRef, jawRadius, delta)
    dampJaw(thirdJawRef, jawRadius, delta)
  })

  return (
    <group name="Twisting three-jaw centric gripper" scale={1 / UR20_RENDER_SCALE} userData={preserveMaterial}>
      <mesh position-z={0.035} rotation-x={Math.PI / 2} castShadow receiveShadow>
        <cylinderGeometry args={[0.046, 0.046, 0.07, 48]} />
        <primitive object={bodyMaterial} attach="material" />
      </mesh>
      <mesh position-z={0.074} rotation-x={Math.PI / 2} castShadow receiveShadow>
        <cylinderGeometry args={[0.052, 0.052, 0.012, 48]} />
        <primitive object={rotorMaterial} attach="material" />
      </mesh>
      <group ref={rotorRef}>
        <mesh position-z={0.082} rotation-x={Math.PI / 2} castShadow receiveShadow>
          <cylinderGeometry args={[0.041, 0.041, 0.012, 48]} />
          <primitive object={bodyMaterial} attach="material" />
        </mesh>
        <Jaw angle={0} jawRef={firstJawRef} />
        <Jaw angle={(Math.PI * 2) / 3} jawRef={secondJawRef} />
        <Jaw angle={(Math.PI * 4) / 3} jawRef={thirdJawRef} />
      </group>
      <mesh
        position-z={THREE_JAW_TCP_OFFSET}
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
      <object3D ref={tcpRef} position-z={THREE_JAW_TCP_OFFSET} />
    </group>
  )
}
