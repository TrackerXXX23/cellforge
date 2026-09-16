import { useFrame } from '@react-three/fiber'
import { useEffect, useRef, type RefObject } from 'react'
import * as THREE from 'three'
import {
  THREE_JAW_AXIAL_TRAVEL,
  THREE_JAW_CLOSED_RADIUS,
  THREE_JAW_BODY_CENTER,
  THREE_JAW_BODY_DEPTH,
  THREE_JAW_MOUNT_CENTER,
  THREE_JAW_MOUNT_DEPTH,
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
const indexMaterial = new THREE.MeshStandardMaterial({
  color: '#245df3',
  metalness: 0.18,
  roughness: 0.32,
})
const preserveMaterial = { preserveMaterial: true }
const JAW_DAMPING = 7
const MOUNT_BOLT_POSITIONS = [0, 1, 2, 3, 4, 5].map((index) => {
  const angle = (index * Math.PI) / 3
  return [Math.cos(angle) * 0.038, Math.sin(angle) * 0.038, 0.011] as const
})

interface JawProps {
  angle: number
  jawRef: RefObject<THREE.Group | null>
}

function Jaw({ angle, jawRef }: JawProps) {
  return (
    <group rotation-z={angle}>
      <group name="GripperJaw" ref={jawRef} position={[THREE_JAW_OPEN_RADIUS, 0, -THREE_JAW_AXIAL_TRAVEL]}>
        <mesh name="GripperJawCarrier" position-z={0.072} castShadow receiveShadow>
          <boxGeometry args={[0.028, 0.026, 0.032]} />
          <primitive object={jawMaterial} attach="material" />
        </mesh>
        <mesh name="GripperContactPad" position={[0, 0, 0.125]} castShadow receiveShadow>
          <boxGeometry args={[0.012, 0.025, 0.082]} />
          <primitive object={contactMaterial} attach="material" />
        </mesh>
      </group>
    </group>
  )
}

interface ThreeJawGripperProps {
  motionToken: string
  paused: boolean
  motion: MotionState
  tcpRef: RefObject<THREE.Object3D | null>
}

function dampJaw(
  ref: RefObject<THREE.Group | null>,
  radius: number,
  axialOffset: number,
  delta: number,
) {
  ref.current!.position.x = THREE.MathUtils.damp(ref.current!.position.x, radius, JAW_DAMPING, delta)
  ref.current!.position.z = THREE.MathUtils.damp(
    ref.current!.position.z,
    axialOffset,
    JAW_DAMPING,
    delta,
  )
}

export function ThreeJawGripper({ motionToken, motion, tcpRef, paused }: ThreeJawGripperProps) {
  const rotorRef = useRef<THREE.Group>(null)
  const firstJawRef = useRef<THREE.Group>(null)
  const secondJawRef = useRef<THREE.Group>(null)
  const thirdJawRef = useRef<THREE.Group>(null)

  useEffect(() => {
    rotorRef.current!.rotation.z = 0
    for (const ref of [firstJawRef, secondJawRef, thirdJawRef]) {
      ref.current!.position.x = THREE_JAW_OPEN_RADIUS
      ref.current!.position.z = -THREE_JAW_AXIAL_TRAVEL
    }
  }, [motionToken])

  useFrame((_, delta) => {
    if (paused) return
    const jawRadius = motion.gripperClosed ? THREE_JAW_CLOSED_RADIUS : THREE_JAW_OPEN_RADIUS
    const rotorAngle = motion.gripperClosed ? THREE_JAW_TWIST_ANGLE : 0
    const jawAxialOffset = motion.gripperClosed ? 0 : -THREE_JAW_AXIAL_TRAVEL

    rotorRef.current!.rotation.z = THREE.MathUtils.damp(
      rotorRef.current!.rotation.z,
      rotorAngle,
      JAW_DAMPING,
      delta,
    )
    dampJaw(firstJawRef, jawRadius, jawAxialOffset, delta)
    dampJaw(secondJawRef, jawRadius, jawAxialOffset, delta)
    dampJaw(thirdJawRef, jawRadius, jawAxialOffset, delta)
  }, -1.5)

  return (
    <group
      name="Twisting three-jaw centric gripper"
      scale={1 / UR20_RENDER_SCALE}
      userData={preserveMaterial}
      dispose={null}
    >
      <group name="UR20 tool0 mounting interface">
        <mesh position-z={THREE_JAW_MOUNT_CENTER} rotation-x={Math.PI / 2} castShadow receiveShadow>
          <cylinderGeometry args={[0.041, 0.041, THREE_JAW_MOUNT_DEPTH, 48]} />
          <primitive object={bodyMaterial} attach="material" />
        </mesh>
        <mesh position-z={0.004} rotation-x={Math.PI / 2} castShadow receiveShadow>
          <cylinderGeometry args={[0.052, 0.052, 0.014, 48]} />
          <primitive object={jawMaterial} attach="material" />
        </mesh>
        {MOUNT_BOLT_POSITIONS.map((position, index) => (
          <mesh key={index} position={position} rotation-x={Math.PI / 2} castShadow>
            <cylinderGeometry args={[0.003, 0.003, 0.004, 12]} />
            <primitive object={contactMaterial} attach="material" />
          </mesh>
        ))}
      </group>
      <mesh position-z={THREE_JAW_BODY_CENTER} rotation-x={Math.PI / 2} castShadow receiveShadow>
        <cylinderGeometry args={[0.046, 0.046, THREE_JAW_BODY_DEPTH, 48]} />
        <primitive object={bodyMaterial} attach="material" />
      </mesh>
      <mesh position-z={0.074} rotation-x={Math.PI / 2} castShadow receiveShadow>
        <cylinderGeometry args={[0.052, 0.052, 0.012, 48]} />
        <primitive object={rotorMaterial} attach="material" />
      </mesh>
      <group name="GripperRotor" ref={rotorRef}>
        <mesh position-z={0.082} rotation-x={Math.PI / 2} castShadow receiveShadow>
          <cylinderGeometry args={[0.041, 0.041, 0.012, 48]} />
          <primitive object={bodyMaterial} attach="material" />
        </mesh>
        <mesh position={[0.028, 0, 0.09]} castShadow>
          <boxGeometry args={[0.018, 0.006, 0.004]} />
          <primitive object={indexMaterial} attach="material" />
        </mesh>
        <Jaw angle={0} jawRef={firstJawRef} />
        <Jaw angle={(Math.PI * 2) / 3} jawRef={secondJawRef} />
        <Jaw angle={(Math.PI * 4) / 3} jawRef={thirdJawRef} />
      </group>
      <mesh
        position-z={THREE_JAW_TCP_OFFSET}
        rotation-x={Math.PI / 2}
        name="CarriedWorkpiece" visible={motion.carrying !== null}
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
