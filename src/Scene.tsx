import { ContactShadows, Grid, Line, OrbitControls } from '@react-three/drei'
import { Canvas, ThreeEvent, useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { sampleMotion, solveRobotIk, type MotionState } from './simulation'
import type { CellObject, RunState } from './types'

interface SceneProps {
  selected: CellObject
  onSelect: (object: CellObject) => void
  progress: number
  runState: RunState
  faultInjected: boolean
  showEnvelope: boolean
}

interface SelectableProps {
  selected: boolean
  onSelect: () => void
}

const graphite = '#26302f'
const machine = '#aeb8b6'
const steel = '#d8dedc'
const cobalt = '#245df3'
const amber = '#f08a24'

function select(event: ThreeEvent<MouseEvent>, onSelect: () => void) {
  event.stopPropagation()
  onSelect()
}

function SelectionHalo({ radius = 0.72 }: { radius?: number }) {
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={0.015}>
      <ringGeometry args={[radius, radius + 0.025, 64]} />
      <meshBasicMaterial color={cobalt} transparent opacity={0.9} />
    </mesh>
  )
}

function RobotArm({ selected, onSelect, motion }: SelectableProps & { motion: MotionState }) {
  const base = useRef<THREE.Group>(null!)
  const shoulder = useRef<THREE.Group>(null!)
  const elbow = useRef<THREE.Group>(null!)
  const wrist = useRef<THREE.Group>(null!)
  const leftFinger = useRef<THREE.Mesh>(null!)
  const rightFinger = useRef<THREE.Mesh>(null!)

  useFrame((_, delta) => {
    const joints = solveRobotIk(motion.target)
    const fingerOffset = motion.gripperClosed ? 0.052 : 0.105

    if (!joints.withinBoundaries) return

    base.current.rotation.y = THREE.MathUtils.damp(base.current.rotation.y, joints.base, 10, delta)
    shoulder.current.rotation.z = THREE.MathUtils.damp(shoulder.current.rotation.z, joints.shoulder, 10, delta)
    elbow.current.rotation.z = THREE.MathUtils.damp(elbow.current.rotation.z, joints.elbow, 10, delta)
    wrist.current.rotation.z = THREE.MathUtils.damp(wrist.current.rotation.z, joints.wrist, 12, delta)
    leftFinger.current.position.x = THREE.MathUtils.damp(leftFinger.current.position.x, -fingerOffset, 16, delta)
    rightFinger.current.position.x = THREE.MathUtils.damp(rightFinger.current.position.x, fingerOffset, 16, delta)
  })

  return (
    <group onClick={(event) => select(event, onSelect)}>
      {selected && <SelectionHalo radius={0.68} />}
      <mesh position-y={0.12} castShadow receiveShadow>
        <cylinderGeometry args={[0.49, 0.56, 0.24, 48]} />
        <meshStandardMaterial color={graphite} roughness={0.58} />
      </mesh>
      <group ref={base} position-y={0.24}>
        <mesh position-y={0.2} castShadow>
          <cylinderGeometry args={[0.34, 0.4, 0.4, 48]} />
          <meshStandardMaterial color={cobalt} roughness={0.38} />
        </mesh>
        <group ref={shoulder} position-y={0.4}>
          <mesh rotation-x={Math.PI / 2} castShadow>
            <cylinderGeometry args={[0.27, 0.27, 0.44, 40]} />
            <meshStandardMaterial color={graphite} />
          </mesh>
          <mesh position-y={0.65} castShadow>
            <capsuleGeometry args={[0.19, 0.96, 12, 24]} />
            <meshStandardMaterial color={steel} metalness={0.08} roughness={0.38} />
          </mesh>
          <group ref={elbow} position-y={1.3}>
            <mesh rotation-x={Math.PI / 2} castShadow>
              <cylinderGeometry args={[0.24, 0.24, 0.42, 40]} />
              <meshStandardMaterial color={cobalt} />
            </mesh>
            <mesh position-y={0.55} castShadow>
              <capsuleGeometry args={[0.16, 0.78, 12, 24]} />
              <meshStandardMaterial color={steel} metalness={0.08} roughness={0.38} />
            </mesh>
            <group ref={wrist} position-y={1.1}>
              <mesh rotation-x={Math.PI / 2} castShadow>
                <cylinderGeometry args={[0.19, 0.19, 0.34, 32]} />
                <meshStandardMaterial color={graphite} />
              </mesh>
              <mesh position-y={0.22} castShadow>
                <cylinderGeometry args={[0.12, 0.16, 0.3, 32]} />
                <meshStandardMaterial color={cobalt} />
              </mesh>
              <group position-y={0.46}>
                <mesh ref={leftFinger} position-x={-0.105} castShadow>
                  <boxGeometry args={[0.07, 0.31, 0.13]} />
                  <meshStandardMaterial color={graphite} />
                </mesh>
                <mesh ref={rightFinger} position-x={0.105} castShadow>
                  <boxGeometry args={[0.07, 0.31, 0.13]} />
                  <meshStandardMaterial color={graphite} />
                </mesh>
              </group>
              <mesh position-y={0.67} visible={motion.carrying !== null} castShadow>
                <cylinderGeometry args={[0.12, 0.12, 0.16, 32]} />
                <meshStandardMaterial
                  color={motion.carrying === 'finished' ? '#79a998' : '#c4873e'}
                  emissive={motion.carrying === 'finished' ? '#183f34' : '#4a280d'}
                  emissiveIntensity={0.14}
                  metalness={0.5}
                  roughness={0.28}
                />
              </mesh>
            </group>
          </group>
        </group>
      </group>
    </group>
  )
}

function CncMachine({ selected, onSelect, motion }: SelectableProps & { motion: MotionState }) {
  const door = useRef<THREE.Mesh>(null!)

  useFrame((_, delta) => {
    const target = motion.doorOpen ? 0.62 : 0
    door.current.position.z = THREE.MathUtils.damp(door.current.position.z, target, 8, delta)
  })

  return (
    <group position={[2.25, 0, -0.25]} onClick={(event) => select(event, onSelect)}>
      {selected && <SelectionHalo radius={1.32} />}
      <mesh position={[0, 1.13, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.25, 2.26, 1.72]} />
        <meshStandardMaterial color={machine} roughness={0.58} metalness={0.16} />
      </mesh>
      <mesh position={[-0.01, 2.18, 0]} castShadow>
        <boxGeometry args={[2.3, 0.18, 1.77]} />
        <meshStandardMaterial color={graphite} roughness={0.5} />
      </mesh>
      <mesh position={[-1.14, 0.38, 0]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[1.46, 0.18]} />
        <meshStandardMaterial color={cobalt} />
      </mesh>
      <mesh position={[-1.135, 1.12, 0]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[1.24, 1.5]} />
        <meshStandardMaterial color="#1a2222" roughness={0.3} />
      </mesh>
      <mesh ref={door} position={[-1.15, 1.12, 0.08]} rotation-y={Math.PI / 2} castShadow>
        <boxGeometry args={[1.35, 1.65, 0.08]} />
        <meshStandardMaterial color={steel} metalness={0.18} roughness={0.4} />
      </mesh>
      <mesh position={[-1.2, 1.12, -0.01]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[0.82, 0.98]} />
        <meshPhysicalMaterial color="#1c3135" transparent opacity={0.52} roughness={0.15} />
      </mesh>
      <mesh position={[-1.18, 1.64, -0.69]} rotation-y={Math.PI / 2}>
        <boxGeometry args={[0.26, 0.42, 0.12]} />
        <meshStandardMaterial color={graphite} />
      </mesh>
      <mesh position={[-1.25, 1.7, -0.7]} rotation-y={Math.PI / 2}>
        <boxGeometry args={[0.16, 0.25, 0.02]} />
        <meshBasicMaterial color="#63b9a0" />
      </mesh>
      <mesh position={[-1.25, 1.53, -0.7]} rotation-y={Math.PI / 2}>
        <cylinderGeometry args={[0.055, 0.055, 0.04, 24]} />
        <meshStandardMaterial color={amber} />
      </mesh>
      <mesh position={[-0.78, 2.36, -0.58]}>
        <cylinderGeometry args={[0.045, 0.045, 0.36, 18]} />
        <meshStandardMaterial color={graphite} />
      </mesh>
      <mesh position={[-0.78, 2.58, -0.58]}>
        <cylinderGeometry args={[0.09, 0.09, 0.16, 18]} />
        <meshBasicMaterial color={motion.machineRunning ? '#3ec58f' : amber} />
      </mesh>
    </group>
  )
}

interface PartTableProps extends SelectableProps {
  kind: 'infeed' | 'outfeed'
  faultInjected?: boolean
  rawRemoved?: boolean
  finishedPlaced?: boolean
}

function PartTable({ kind, selected, onSelect, faultInjected = false, rawRemoved = false, finishedPlaced = false }: PartTableProps) {
  const shiftedX = -1.55 - (kind === 'infeed' && faultInjected ? 0.18 : 0)
  const position: [number, number, number] = kind === 'infeed' ? [shiftedX, 0, 1.15] : [-1.55, 0, -1.15]
  const partIndices = kind === 'infeed'
    ? [0, 1, 2, 3, 4, 5].filter((index) => !(rawRemoved && index === 2))
    : [0, 1, 2, ...(finishedPlaced ? [5] : [])]

  return (
    <group position={position} onClick={(event) => select(event, onSelect)}>
      {selected && <SelectionHalo radius={0.84} />}
      <mesh position-y={0.56} castShadow receiveShadow>
        <boxGeometry args={[1.42, 0.15, 1.08]} />
        <meshStandardMaterial color={kind === 'infeed' && faultInjected ? '#d7a06c' : steel} roughness={0.5} />
      </mesh>
      {[[-0.56, -0.42], [0.56, -0.42], [-0.56, 0.42], [0.56, 0.42]].map(([x, z]) => (
        <mesh key={`${x}-${z}`} position={[x, 0.27, z]} castShadow>
          <boxGeometry args={[0.08, 0.55, 0.08]} />
          <meshStandardMaterial color={graphite} />
        </mesh>
      ))}
      {partIndices.map((index) => {
        const column = index % 3
        const row = Math.floor(index / 3)
        return (
          <mesh key={index} position={[-0.42 + column * 0.42, 0.69, -0.23 + row * 0.46]} castShadow>
            <cylinderGeometry args={[0.12, 0.12, 0.16, 32]} />
            <meshStandardMaterial color={kind === 'infeed' ? '#556260' : '#79a998'} metalness={0.56} roughness={0.31} />
          </mesh>
        )
      })}
      {kind === 'infeed' && faultInjected && (
        <mesh position={[0.72, 0.75, 0]} rotation-x={Math.PI / 2}>
          <ringGeometry args={[0.12, 0.16, 32]} />
          <meshBasicMaterial color={amber} />
        </mesh>
      )}
    </group>
  )
}

function SafetyScanner({ faultInjected }: Pick<SceneProps, 'faultInjected'>) {
  return (
    <group position={[0.78, 0, 2.55]}>
      <mesh position-y={0.12} castShadow>
        <boxGeometry args={[0.24, 0.24, 0.24]} />
        <meshStandardMaterial color={graphite} />
      </mesh>
      <mesh position-y={0.26}>
        <sphereGeometry args={[0.055, 20, 20]} />
        <meshBasicMaterial color={faultInjected ? '#f04d35' : '#44b58d'} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.02}>
        <circleGeometry args={[2.1, 64, 0, Math.PI]} />
        <meshBasicMaterial color={faultInjected ? '#f04d35' : cobalt} transparent opacity={0.065} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

function Cell({ selected, onSelect, progress, runState, faultInjected, showEnvelope }: SceneProps) {
  const motion = sampleMotion(progress, runState)
  const pathPoints = useMemo(
    () => [
      new THREE.Vector3(-1.13, 0.78, 0.92),
      new THREE.Vector3(-1.13, 1.42, 0.92),
      new THREE.Vector3(0.72, 1.55, -0.25),
      new THREE.Vector3(1.34, 1.06, -0.25),
      new THREE.Vector3(0.72, 1.55, -0.25),
      new THREE.Vector3(-1.13, 1.42, -0.92),
      new THREE.Vector3(-1.13, 0.78, -0.92),
    ],
    [],
  )

  return (
    <>
      <ambientLight intensity={1.3} />
      <directionalLight position={[-4, 8, 5]} intensity={2.2} castShadow shadow-mapSize={[2048, 2048]} />
      <directionalLight position={[5, 3, -4]} intensity={0.7} color="#c9ddff" />
      <RobotArm selected={selected === 'robot'} onSelect={() => onSelect('robot')} motion={motion} />
      <CncMachine selected={selected === 'cnc'} onSelect={() => onSelect('cnc')} motion={motion} />
      <PartTable kind="infeed" selected={selected === 'infeed'} onSelect={() => onSelect('infeed')} faultInjected={faultInjected} rawRemoved={motion.rawRemoved} />
      <PartTable kind="outfeed" selected={selected === 'outfeed'} onSelect={() => onSelect('outfeed')} finishedPlaced={motion.finishedPlaced} />
      <SafetyScanner faultInjected={faultInjected} />

      {motion.partAtMachine && (
        <mesh position={[1.34, 0.97, -0.25]} castShadow>
          <cylinderGeometry args={[0.12, 0.12, 0.16, 32]} />
          <meshStandardMaterial color={motion.partFinished ? '#79a998' : '#c4873e'} metalness={0.56} roughness={0.31} />
        </mesh>
      )}

      {showEnvelope && (
        <mesh position-y={0.64} scale={[2.4, 2.4, 2.4]}>
          <sphereGeometry args={[1, 32, 18]} />
          <meshBasicMaterial color={faultInjected ? amber : cobalt} wireframe transparent opacity={0.12} />
        </mesh>
      )}

      <Line points={pathPoints} color={faultInjected ? amber : cobalt} lineWidth={1.6} dashed dashSize={0.13} gapSize={0.09} transparent opacity={0.7} />
      <mesh rotation-x={-Math.PI / 2} position-y={-0.04} receiveShadow>
        <planeGeometry args={[10, 8]} />
        <meshStandardMaterial color="#eef1f0" roughness={0.92} />
      </mesh>
      <Grid
        position={[0, -0.02, 0]}
        args={[10, 8]}
        cellSize={0.25}
        cellThickness={0.35}
        cellColor="#aab6b3"
        sectionSize={1}
        sectionThickness={0.7}
        sectionColor="#7d8c89"
        fadeDistance={11}
        fadeStrength={1}
        infiniteGrid={false}
      />
      <ContactShadows position={[0, 0.005, 0]} opacity={0.34} scale={9} blur={2.5} far={4.5} />
      <OrbitControls makeDefault target={[0.1, 0.85, 0]} minDistance={5.2} maxDistance={11} maxPolarAngle={Math.PI / 2.05} />
    </>
  )
}

export function CommissioningScene(props: SceneProps) {
  return (
    <Canvas
      shadows="basic"
      camera={{ position: [-6.9, 5.6, 7.4], fov: 36, near: 0.1, far: 100 }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
      dpr={[1, 1.75]}
      onPointerMissed={() => props.onSelect('robot')}
    >
      <color attach="background" args={['#e7ebea']} />
      <fog attach="fog" args={['#e7ebea', 10, 17]} />
      <Cell {...props} />
    </Canvas>
  )
}
