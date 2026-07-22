import { ContactShadows, Grid, Line, OrbitControls } from '@react-three/drei'
import { Canvas, ThreeEvent } from '@react-three/fiber'
import { Suspense, useMemo } from 'react'
import * as THREE from 'three'
import { CncMachine } from './CncMachine'
import {
  FINISHED_WORKPIECE_COLOR,
  RAW_WORKPIECE_COLOR,
  WORKPIECE_HEIGHT,
  WORKPIECE_RADIUS,
  WORKPIECE_TABLE_CENTER_Y,
} from './workpiece'
import { INFEED_FIXTURE_ORIGIN, P02_KEEP_OUT_LOCAL_BOUNDS } from './commissioning'
import { sampleMotion, type MotionPlan, type Vec3 } from './simulation'
import type { CellObject, RunState } from './types'
import { Ur20Robot } from './Ur20Robot'

interface SceneProps {
  selected: CellObject
  onSelect: (object: CellObject) => void
  progress: number
  runState: RunState
  faultInjected: boolean
  showEnvelope: boolean
  fixtureShiftMm: number
  baselinePath: readonly Vec3[]
  activePath: readonly Vec3[]
  pathState: 'baseline' | 'blocked' | 'preview' | 'repaired'
  showRevisionGhost: boolean
  motionPlan: MotionPlan
}

interface SelectableProps {
  selected: boolean
  onSelect: () => void
}

const graphite = '#26302f'
const steel = '#d8dedc'
const cobalt = '#245df3'
const amber = '#f08a24'
const danger = '#e54835'
const success = '#2f9e75'
const infeedBaseX = INFEED_FIXTURE_ORIGIN[0]
const infeedZ = INFEED_FIXTURE_ORIGIN[2]
const p02KeepOutCenter: Vec3 = [
  (P02_KEEP_OUT_LOCAL_BOUNDS.min[0] + P02_KEEP_OUT_LOCAL_BOUNDS.max[0]) / 2,
  (P02_KEEP_OUT_LOCAL_BOUNDS.min[1] + P02_KEEP_OUT_LOCAL_BOUNDS.max[1]) / 2,
  (P02_KEEP_OUT_LOCAL_BOUNDS.min[2] + P02_KEEP_OUT_LOCAL_BOUNDS.max[2]) / 2,
]
const p02KeepOutSize: Vec3 = [
  P02_KEEP_OUT_LOCAL_BOUNDS.max[0] - P02_KEEP_OUT_LOCAL_BOUNDS.min[0],
  P02_KEEP_OUT_LOCAL_BOUNDS.max[1] - P02_KEEP_OUT_LOCAL_BOUNDS.min[1],
  P02_KEEP_OUT_LOCAL_BOUNDS.max[2] - P02_KEEP_OUT_LOCAL_BOUNDS.min[2],
]

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

interface PartTableProps extends SelectableProps {
  kind: 'infeed' | 'outfeed'
  faultInjected?: boolean
  rawRemoved?: boolean
  finishedPlaced?: boolean
  fixtureShiftMeters?: number
}

function PartTable({
  kind,
  selected,
  onSelect,
  faultInjected = false,
  rawRemoved = false,
  finishedPlaced = false,
  fixtureShiftMeters = 0,
}: PartTableProps) {
  const positionX = infeedBaseX + (kind === 'infeed' ? fixtureShiftMeters : 0)
  const positionZ = kind === 'infeed' ? infeedZ : -1.15
  const partIndices = kind === 'infeed'
    ? [0, 1, 2, 3, 4, 5].filter((index) => !(rawRemoved && index === 2))
    : [0, 1, 2, ...(finishedPlaced ? [5] : [])]

  return (
    <group position-x={positionX} position-z={positionZ} onClick={(event) => select(event, onSelect)}>
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
          <mesh key={index} position={[-0.42 + column * 0.42, WORKPIECE_TABLE_CENTER_Y, -0.23 + row * 0.46]} castShadow>
            <cylinderGeometry args={[WORKPIECE_RADIUS, WORKPIECE_RADIUS, WORKPIECE_HEIGHT, 32]} />
            <meshStandardMaterial color={kind === 'infeed' ? RAW_WORKPIECE_COLOR : FINISHED_WORKPIECE_COLOR} metalness={0.56} roughness={0.31} />
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

function InfeedRevisionGhost() {
  return (
    <group position-x={infeedBaseX} position-z={infeedZ}>
      <mesh position-y={0.56}>
        <boxGeometry args={[1.42, 0.15, 1.08]} />
        <meshBasicMaterial color={cobalt} wireframe transparent opacity={0.24} depthWrite={false} />
      </mesh>
      {[[-0.56, -0.42], [0.56, -0.42], [-0.56, 0.42], [0.56, 0.42]].map(([x, z]) => (
        <mesh key={`${x}-${z}`} position={[x, 0.27, z]}>
          <boxGeometry args={[0.08, 0.55, 0.08]} />
          <meshBasicMaterial color={cobalt} wireframe transparent opacity={0.18} depthWrite={false} />
        </mesh>
      ))}
      <mesh rotation-x={-Math.PI / 2} position-y={0.02}>
        <ringGeometry args={[0.79, 0.82, 64]} />
        <meshBasicMaterial color={cobalt} transparent opacity={0.32} depthWrite={false} />
      </mesh>
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

function CellLoadingFallback() {
  return (
    <>
      <ambientLight intensity={1.3} />
      <directionalLight position={[-4, 8, 5]} intensity={2.2} />
      <mesh position-y={0.72}>
        <boxGeometry args={[0.72, 1.44, 0.72]} />
        <meshStandardMaterial color={cobalt} wireframe transparent opacity={0.38} />
      </mesh>
    </>
  )
}

function Cell({
  selected,
  onSelect,
  progress,
  runState,
  faultInjected,
  showEnvelope,
  fixtureShiftMm,
  baselinePath,
  activePath,
  pathState,
  showRevisionGhost,
  motionPlan,
}: SceneProps) {
  const motion = sampleMotion(progress, runState, motionPlan)
  const fixtureShiftMeters = fixtureShiftMm / 1000
  const baselinePathPoints = useMemo(
    () => baselinePath.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    [baselinePath],
  )
  const activePathPoints = useMemo(
    () => activePath.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    [activePath],
  )
  const failingSegmentPoints = useMemo(
    () => activePathPoints.slice(-2),
    [activePathPoints],
  )
  const fixtureDeltaPoints = useMemo(
    () => [
      new THREE.Vector3(infeedBaseX, 0.82, infeedZ),
      new THREE.Vector3(infeedBaseX + fixtureShiftMeters, 0.82, infeedZ),
    ],
    [fixtureShiftMeters],
  )
  const pathChanged = useMemo(
    () => baselinePath.length !== activePath.length || baselinePath.some((point, index) => (
      point[0] !== activePath[index]?.[0]
      || point[1] !== activePath[index]?.[1]
      || point[2] !== activePath[index]?.[2]
    )),
    [activePath, baselinePath],
  )
  const showBaselinePath = showRevisionGhost || pathState !== 'baseline' || pathChanged
  const activePathColor = pathState === 'blocked' ? danger : pathState === 'repaired' ? success : cobalt

  return (
    <>
      <ambientLight intensity={1.3} />
      <directionalLight
        position={[-4, 8, 5]}
        intensity={2.2}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0002}
        shadow-normalBias={0.04}
      />
      <directionalLight position={[5, 3, -4]} intensity={0.7} color="#c9ddff" />
      <Ur20Robot selected={selected === 'robot'} onSelect={(event) => select(event, () => onSelect('robot'))} motion={motion} />
      <CncMachine selected={selected === 'cnc'} onSelect={() => onSelect('cnc')} motion={motion} />
      {showRevisionGhost && <InfeedRevisionGhost />}
      <PartTable
        kind="infeed"
        selected={selected === 'infeed'}
        onSelect={() => onSelect('infeed')}
        faultInjected={faultInjected}
        rawRemoved={motion.rawRemoved}
        fixtureShiftMeters={fixtureShiftMeters}
      />
      <PartTable kind="outfeed" selected={selected === 'outfeed'} onSelect={() => onSelect('outfeed')} finishedPlaced={motion.finishedPlaced} />
      <SafetyScanner faultInjected={faultInjected} />

      {showRevisionGhost && fixtureShiftMm !== 0 && (
        <group>
          <Line points={fixtureDeltaPoints} color={amber} lineWidth={2.2} dashed dashSize={0.045} gapSize={0.025} transparent opacity={0.95} />
          <mesh position-x={infeedBaseX} position-y={0.82} position-z={infeedZ}>
            <sphereGeometry args={[0.035, 18, 18]} />
            <meshBasicMaterial color={cobalt} transparent opacity={0.75} />
          </mesh>
          <mesh position-x={infeedBaseX + fixtureShiftMeters} position-y={0.82} position-z={infeedZ}>
            <sphereGeometry args={[0.055, 18, 18]} />
            <meshBasicMaterial color={amber} />
          </mesh>
        </group>
      )}

      {showRevisionGhost && (
        <group position-x={infeedBaseX + fixtureShiftMeters} position-z={infeedZ}>
          <mesh position={p02KeepOutCenter}>
            <boxGeometry args={p02KeepOutSize} />
            <meshBasicMaterial
              color={pathState === 'blocked' ? danger : amber}
              wireframe
              transparent
              opacity={pathState === 'blocked' ? 0.72 : 0.3}
              depthWrite={false}
            />
          </mesh>
        </group>
      )}

      {showEnvelope && (
        <mesh position-y={0.64} scale={[2.4, 2.4, 2.4]}>
          <sphereGeometry args={[1, 32, 18]} />
          <meshBasicMaterial color={faultInjected ? amber : cobalt} wireframe transparent opacity={0.12} />
        </mesh>
      )}

      {showBaselinePath && baselinePathPoints.length > 1 && (
        <Line points={baselinePathPoints} color={cobalt} lineWidth={1.2} dashed dashSize={0.11} gapSize={0.08} transparent opacity={0.28} />
      )}
      {activePathPoints.length > 1 && (
        <Line
          points={activePathPoints}
          color={activePathColor}
          lineWidth={pathState === 'blocked' ? 2.4 : 2}
          dashed={pathState === 'baseline'}
          dashSize={0.13}
          gapSize={0.09}
          transparent
          opacity={pathState === 'preview' ? 0.82 : 0.9}
        />
      )}
      {pathState === 'blocked' && failingSegmentPoints.length === 2 && (
        <>
          <Line points={failingSegmentPoints} color={danger} lineWidth={5} transparent opacity={1} />
          <mesh position={failingSegmentPoints[1]}>
            <sphereGeometry args={[0.085, 24, 24]} />
            <meshBasicMaterial color={danger} transparent opacity={0.9} />
          </mesh>
        </>
      )}
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
      <OrbitControls makeDefault target={motion.target} minDistance={1.2} maxDistance={8.5} maxPolarAngle={Math.PI / 2.05} />
    </>
  )
}

export function CommissioningScene(props: SceneProps) {
  return (
    <Canvas
      shadows="basic"
      camera={{ position: [-2.5, 2.7, 3.5], fov: 32, near: 0.1, far: 100 }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
      dpr={[1, 1.75]}
      onPointerMissed={() => props.onSelect('robot')}
    >
      <color attach="background" args={['#e7ebea']} />
      <fog attach="fog" args={['#e7ebea', 10, 17]} />
      <Suspense fallback={<CellLoadingFallback />}>
        <Cell {...props} />
      </Suspense>
    </Canvas>
  )
}
