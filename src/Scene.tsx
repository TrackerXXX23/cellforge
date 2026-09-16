import { CELL_BODY_IDS, FENCE_PANELS } from './cellBodies'
import { searchLayouts, type SearchRequest } from './layoutSearch'
import { tableSlot, TABLE_SIZE, TABLE_TOP_Y, TABLE_LEGS, type CellLayout } from './cellLayout'
import { geometryForLayout, rehearsePlan, type PlanningRequest } from './pathPlanning'
import { ContactShadows, Grid, Line, OrbitControls } from '@react-three/drei'
import { Canvas, ThreeEvent } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { createCncContactMonitor } from './cncContact'
import { CncMachine } from './CncMachine'
import {
  FINISHED_WORKPIECE_COLOR,
  RAW_WORKPIECE_COLOR,
  WORKPIECE_HEIGHT,
  WORKPIECE_RADIUS,
} from './workpiece'
import { P02_KEEP_OUT_LOCAL_BOUNDS } from './commissioning'
import { sampleMotion, type MotionPlan, type Vec3 } from './simulation'
import type { CellObject, RunState } from './types'
import { Ur20Robot } from './Ur20Robot'

import type { MotionTelemetry } from './cycleAcceptance'

interface SceneProps {
  layout: CellLayout
  planningRequest: React.RefObject<PlanningRequest | null>
  searchRequest: React.RefObject<SearchRequest | null>
  telemetry: React.RefObject<MotionTelemetry | null>
  motionToken: string
  selected: CellObject
  onSelect: (object: CellObject) => void
  progress: number
  runState: RunState
  faultInjected: boolean
  showEnvelope: boolean
  showMachineInterior: boolean
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
    <mesh userData={{ contactIgnored: true }} rotation-x={-Math.PI / 2} position-y={0.015}>
      <ringGeometry args={[radius, radius + 0.025, 64]} />
      <meshBasicMaterial color={cobalt} transparent opacity={0.9} />
    </mesh>
  )
}

interface PartTableProps extends SelectableProps {
  layout: CellLayout
  cncContact: ReturnType<typeof createCncContactMonitor>
  kind: 'infeed' | 'outfeed'
  faultInjected?: boolean
  rawRemoved?: boolean
  finishedPlaced?: boolean
  fixtureShiftMeters?: number
}

function PartTable({
  layout, cncContact,
  kind,
  selected,
  onSelect,
  faultInjected = false,
  rawRemoved = false,
  finishedPlaced = false,
  fixtureShiftMeters = 0,
}: PartTableProps) {
  const root = useRef<THREE.Group>(null)
  useEffect(() => {
    if (root.current) cncContact.registerTable(kind, root.current)
    return () => cncContact.unregisterTable(kind)
  }, [cncContact, kind, layout, fixtureShiftMeters])
  const positionX = layout[kind][0] + (kind === 'infeed' ? fixtureShiftMeters : 0)
  const positionZ = layout[kind][2]
  const partIndices = kind === 'infeed'
    ? [0, 1, 2, 3, 4, 5]
    : [0, 1, 2, 5]

  return (
    <group ref={root} name={`${kind}-table`} position-x={positionX} position-y={layout[kind][1]} position-z={positionZ} onClick={(event) => select(event, onSelect)}>
      {selected && <SelectionHalo radius={0.84} />}
      <mesh name={`${kind}-tabletop`} userData={{ supportSlot: tableSlot(kind === 'infeed' ? 2 : 5) }} position-y={TABLE_TOP_Y} castShadow receiveShadow>
        <boxGeometry args={TABLE_SIZE} />
        <meshStandardMaterial color={kind === 'infeed' && faultInjected ? '#d7a06c' : steel} roughness={0.5} />
      </mesh>
      {TABLE_LEGS.map(([x, z]) => (
        <mesh name={`${kind}-leg`} key={`${x}-${z}`} position={[x, 0.27, z]} castShadow>
          <boxGeometry args={[0.08, 0.55, 0.08]} />
          <meshStandardMaterial color={graphite} />
        </mesh>
      ))}
      {partIndices.map((index) => {
        return (
          <mesh name={`${kind}-stock-${index}`} userData={{stockRole: kind === 'infeed' && index === 2 ? 'source' : kind === 'outfeed' && index === 5 ? 'placed' : 'loose'}} visible={kind === 'infeed' ? !(rawRemoved && index === 2) : index !== 5 || finishedPlaced} key={index} position={tableSlot(index)} castShadow>
            <cylinderGeometry args={[WORKPIECE_RADIUS, WORKPIECE_RADIUS, WORKPIECE_HEIGHT, 32]} />
            <meshStandardMaterial color={kind === 'infeed' ? RAW_WORKPIECE_COLOR : FINISHED_WORKPIECE_COLOR} metalness={0.56} roughness={0.31} />
          </mesh>
        )
      })}
      {kind === 'infeed' && faultInjected && (
        <mesh userData={{ contactIgnored: true }} position={[0.72, 0.75, 0]} rotation-x={Math.PI / 2}>
          <ringGeometry args={[0.12, 0.16, 32]} />
          <meshBasicMaterial color={amber} />
        </mesh>
      )}
    </group>
  )
}

function InfeedRevisionGhost({ layout }: { layout: CellLayout }) {
  return (
    <group position-x={layout.infeed[0]} position-y={layout.infeed[1]} position-z={layout.infeed[2]}>
      <mesh position-y={TABLE_TOP_Y}>
        <boxGeometry args={TABLE_SIZE} />
        <meshBasicMaterial color={cobalt} wireframe transparent opacity={0.24} depthWrite={false} />
      </mesh>
      {TABLE_LEGS.map(([x, z]) => (
        <mesh key={`${x}-${z}`} position={[x, 0.27, z]}>
          <boxGeometry args={[0.08, 0.55, 0.08]} />
          <meshBasicMaterial color={cobalt} wireframe transparent opacity={0.18} depthWrite={false} />
        </mesh>
      ))}
      <mesh userData={{ contactIgnored: true }} rotation-x={-Math.PI / 2} position-y={0.02}>
        <ringGeometry args={[0.79, 0.82, 64]} />
        <meshBasicMaterial color={cobalt} transparent opacity={0.32} depthWrite={false} />
      </mesh>
    </group>
  )
}

function SafetyScanner({ faultInjected, cncContact }: Pick<SceneProps, 'faultInjected'> & {cncContact: ReturnType<typeof createCncContactMonitor>}) {
  const root = useRef<THREE.Group>(null)
  useEffect(() => {
    cncContact.registerCellBody('scanner', root.current!)
    return () => cncContact.unregisterCellBody('scanner')
  }, [cncContact])
  return (
    <group ref={root} name="scanner" position={[0.78, 0, 2.55]}>
      <mesh name="ScannerHousing" position-y={0.12} castShadow>
        <boxGeometry args={[0.24, 0.24, 0.24]} />
        <meshStandardMaterial color={graphite} />
      </mesh>
      <mesh name="ScannerLens" position-y={0.26}>
        <sphereGeometry args={[0.055, 20, 20]} />
        <meshBasicMaterial color={faultInjected ? '#f04d35' : '#44b58d'} />
      </mesh>
      <mesh userData={{ contactIgnored: true }} rotation-x={-Math.PI / 2} position-y={0.02}>
        <circleGeometry args={[2.1, 64, 0, Math.PI]} />
        <meshBasicMaterial color={faultInjected ? '#f04d35' : cobalt} transparent opacity={0.065} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

function CellBoundary({cncContact}: {cncContact: ReturnType<typeof createCncContactMonitor>}) {
  const root = useRef<THREE.Group>(null)
  useEffect(() => {
    for (const id of ['floor', ...FENCE_PANELS.map(panel => panel.id)]) cncContact.registerCellBody(id, root.current!.getObjectByName(id)!)
    return () => { for (const id of ['floor', ...FENCE_PANELS.map(panel => panel.id)]) cncContact.unregisterCellBody(id) }
  }, [cncContact])
  return <group ref={root}>
    <mesh name="floor" position-y={-0.09} receiveShadow>
      <boxGeometry args={[10, 0.1, 8]} />
      <meshStandardMaterial color="#eef1f0" roughness={0.92} />
    </mesh>
    {FENCE_PANELS.map(panel => <mesh key={panel.id} name={panel.id} position={panel.position}>
      <boxGeometry args={panel.size} />
      <meshStandardMaterial color="#7d8c89" transparent opacity={0.12} depthWrite={false} />
    </mesh>)}
  </group>
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
  layout, planningRequest, searchRequest,
  telemetry,
  motionToken,
  selected,
  onSelect,
  progress,
  runState,
  faultInjected,
  showEnvelope,
  showMachineInterior,
  fixtureShiftMm,
  baselinePath,
  activePath,
  pathState,
  showRevisionGhost,
  motionPlan,
}: SceneProps) {
  const infeedBaseX = layout.infeed[0]
  const infeedZ = layout.infeed[2]
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
    [fixtureShiftMeters, infeedBaseX, infeedZ],
  )
  const pathChanged = useMemo(
    () => baselinePath.length !== activePath.length || baselinePath.some((point, index) => (
      point[0] !== activePath[index]?.[0]
      || point[1] !== activePath[index]?.[1]
      || point[2] !== activePath[index]?.[2]
    )),
    [activePath, baselinePath],
  )
  const cncContact = useMemo(() => createCncContactMonitor(2, CELL_BODY_IDS), [])
  useEffect(() => {
    if (import.meta.env.DEV) Object.assign(window, { __CELLFORGE_GEOMETRY__: () => cncContact.getGeometry() })
    planningRequest.current = (plan, cancelled) => rehearsePlan(cncContact.getGeometry(), plan, cancelled)
    searchRequest.current = (fixtureShiftMm, cancelled, onProgress) => searchLayouts(fixtureShiftMm,
      candidate => rehearsePlan(geometryForLayout(cncContact.getGeometry(), candidate.layout, fixtureShiftMm), candidate.motionPlan, cancelled), cancelled, onProgress)
    return () => { planningRequest.current = null; searchRequest.current = null }
  }, [cncContact, planningRequest, searchRequest])
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
      <Ur20Robot cncContact={cncContact} telemetry={telemetry} motionToken={motionToken} progress={progress} paused={runState !== 'running'} selected={selected === 'robot'} onSelect={(event) => select(event, () => onSelect('robot'))} motion={motion} />
      <CncMachine motionToken={motionToken} cncContact={cncContact} paused={runState !== 'running'} selected={selected === 'cnc'} interiorView={showMachineInterior} onSelect={() => onSelect('cnc')} motion={motion} />
      {showRevisionGhost && <InfeedRevisionGhost layout={layout} />}
      <PartTable
        layout={layout} cncContact={cncContact} kind="infeed"
        selected={selected === 'infeed'}
        onSelect={() => onSelect('infeed')}
        faultInjected={faultInjected}
        rawRemoved={motion.rawRemoved}
        fixtureShiftMeters={fixtureShiftMeters}
      />
      <PartTable layout={layout} cncContact={cncContact} kind="outfeed" selected={selected === 'outfeed'} onSelect={() => onSelect('outfeed')} finishedPlaced={motion.finishedPlaced} />
      <SafetyScanner faultInjected={faultInjected} cncContact={cncContact} />
      <CellBoundary cncContact={cncContact} />

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
      <OrbitControls makeDefault target={[0.55, 0.85, 0]} minDistance={1.2} maxDistance={8.5} maxPolarAngle={Math.PI / 2.05} />
    </>
  )
}

export function CommissioningScene(props: SceneProps) {
  return (
    <Canvas
      shadows="basic"
      camera={{ position: [-4.5, 3.7, 5.5], fov: 42, near: 0.1, far: 100 }}
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
