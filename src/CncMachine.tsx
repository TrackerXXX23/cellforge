import { useGLTF } from '@react-three/drei'
import { ThreeEvent, useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import {
  CNC_ASSET_NODES,
  CNC_ASSET_ROTATION_Y,
  CNC_ASSET_URL,
  CNC_DOOR_OPEN_OFFSET,
  CNC_MACHINE_POSITION,
  CNC_REQUIRED_NODE_NAMES,
  CNC_WORKPIECE_LOCAL_POSITION,
} from './cnc'
import type { MotionState } from './simulation'
import {
  FINISHED_WORKPIECE_COLOR,
  RAW_WORKPIECE_COLOR,
  WORKPIECE_HEIGHT,
  WORKPIECE_RADIUS,
} from './workpiece'

import type { CncContactMonitor } from './cncContact'

const cobalt = '#245df3'
const cutawayOpacity = 0.14

interface CncMachineProps {
  motionToken: string
  cncContact: CncContactMonitor
  paused: boolean
  motion: MotionState
  selected: boolean
  interiorView: boolean
  onSelect: () => void
}

function requireNode(scene: THREE.Object3D, name: string) {
  const node = scene.getObjectByName(name)
  if (!node) throw new Error(`CNC asset is missing required node: ${name}`)
  return node
}

function collectMaterials(root: THREE.Object3D) {
  const materials = new Set<THREE.Material>()
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return
    const objectMaterials = Array.isArray(object.material) ? object.material : [object.material]
    for (const material of objectMaterials) materials.add(material)
  })
  return [...materials]
}

function cloneMaterials(root: THREE.Object3D) {
  const replacements = new Map<THREE.Material, THREE.Material>()
  const cloneMaterial = (source: THREE.Material) => {
    const existing = replacements.get(source)
    if (existing) return existing
    const clone = source.clone()
    replacements.set(source, clone)
    return clone
  }

  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return
    object.material = Array.isArray(object.material)
      ? object.material.map(cloneMaterial)
      : cloneMaterial(object.material)
  })
}

function setLampState(node: THREE.Object3D, active: boolean) {
  node.visible = active
  node.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    for (const material of materials) {
      if (!(material instanceof THREE.MeshStandardMaterial)) continue
      material.emissiveIntensity = active ? 2.2 : 0.08
    }
  })
}

export function CncMachine({ motionToken, motion, selected, interiorView, onSelect, paused, cncContact }: CncMachineProps) {
  const workpieceRef = useRef<THREE.Mesh>(null)
  useEffect(() => {
    cncContact.registerCellBody('chuck-stock', workpieceRef.current!)
    return () => cncContact.unregisterCellBody('chuck-stock')
  }, [cncContact])
  const { scene } = useGLTF(CNC_ASSET_URL)
  const machineScene = useMemo(() => {
    const instance = scene.clone(true)
    cloneMaterials(instance)
    return instance
  }, [scene])
  const nodes = useMemo(() => {
    for (const name of CNC_REQUIRED_NODE_NAMES) requireNode(machineScene, name)
    return {
      shell: requireNode(machineScene, CNC_ASSET_NODES.shell),
      door: requireNode(machineScene, CNC_ASSET_NODES.door),
      spindle: requireNode(machineScene, CNC_ASSET_NODES.spindle),
      stackAmber: requireNode(machineScene, CNC_ASSET_NODES.stackAmber),
      stackGreen: requireNode(machineScene, CNC_ASSET_NODES.stackGreen),
    }
  }, [machineScene])
  const spindleHomeY = useMemo(() => nodes.spindle.position.y, [nodes.spindle])
  const spindleHomeX = useMemo(() => nodes.spindle.position.x, [nodes.spindle])
  const spindleHomeZ = useMemo(() => nodes.spindle.position.z, [nodes.spindle])
  const shellMaterials = useMemo(() => collectMaterials(nodes.shell), [nodes.shell])

  useEffect(() => {
    cncContact.registerMachine(machineScene)
    if (import.meta.env.DEV) Object.assign(window, { __CELLFORGE_CNC__: machineScene })
    machineScene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return
      object.castShadow = true
      object.receiveShadow = true
    })
  }, [machineScene, cncContact])

  useEffect(() => {
    for (const material of shellMaterials) {
      material.transparent = interiorView
      material.opacity = interiorView ? cutawayOpacity : 1
      material.depthWrite = !interiorView
      material.needsUpdate = true
    }
  }, [interiorView, shellMaterials])

  useEffect(() => {
    setLampState(nodes.stackAmber, !motion.machineRunning)
    setLampState(nodes.stackGreen, motion.machineRunning)
  }, [motion.machineRunning, nodes.stackAmber, nodes.stackGreen])

  useEffect(() => {
    nodes.door.position.x = CNC_DOOR_OPEN_OFFSET
    nodes.spindle.position.y = spindleHomeY + 0.44
    nodes.spindle.position.x = spindleHomeX
    nodes.spindle.position.z = spindleHomeZ
    machineScene.updateWorldMatrix(true, true)
  }, [motionToken, nodes, spindleHomeX, spindleHomeY, spindleHomeZ, machineScene])

  useFrame((_, delta) => {
    if (paused) return
    const doorTarget = motion.doorOpen ? CNC_DOOR_OPEN_OFFSET : 0
    nodes.door.position.x = THREE.MathUtils.damp(nodes.door.position.x, doorTarget, 8, delta)
    const spindleTarget = spindleHomeY + (motion.machineRunning ? 0.14 : 0.44)
    nodes.spindle.position.y = THREE.MathUtils.damp(nodes.spindle.position.y, spindleTarget, 8, delta)
    const cutSweep = motion.machineRunning ? Math.sin(motion.machiningProgress * Math.PI * 2) * 0.1 : 0
    nodes.spindle.position.x = THREE.MathUtils.damp(nodes.spindle.position.x, spindleHomeX + cutSweep, 9, delta)
    nodes.spindle.position.z = THREE.MathUtils.damp(nodes.spindle.position.z, spindleHomeZ + (motion.machineRunning ? 0.045 : 0), 9, delta)
    if (motion.machineRunning) nodes.spindle.rotation.y += delta * 24
    machineScene.updateWorldMatrix(true, true)
  }, -2)

  function handleSelect(event: ThreeEvent<MouseEvent>) {
    event.stopPropagation()
    onSelect()
  }

  return (
    <group position={CNC_MACHINE_POSITION} onClick={handleSelect}>
      {selected && (
        <mesh rotation-x={-Math.PI / 2} position-y={0.015}>
          <ringGeometry args={[1.32, 1.345, 64]} />
          <meshBasicMaterial color={cobalt} transparent opacity={0.9} />
        </mesh>
      )}
      <primitive
        object={machineScene}
        rotation-y={CNC_ASSET_ROTATION_Y}
        dispose={null}
      />
      <pointLight
        position={[-0.52, 1.46, 0]}
        color="#d9ffe8"
        intensity={selected ? 2.1 : 1.35}
        distance={2.5}
        decay={2}
      />
      <mesh ref={workpieceRef} name="ChuckWorkpiece" userData={{stockRole:'chuck'}}
        position={CNC_WORKPIECE_LOCAL_POSITION}
        rotation-z={Math.PI / 2}
        visible={motion.partAtMachine}
        castShadow
      >
        <cylinderGeometry args={[WORKPIECE_RADIUS, WORKPIECE_RADIUS, WORKPIECE_HEIGHT, 32]} />
        <meshStandardMaterial
          color={motion.partFinished ? FINISHED_WORKPIECE_COLOR : RAW_WORKPIECE_COLOR}
          metalness={0.62}
          roughness={0.25}
        />
      </mesh>
    </group>
  )
}

useGLTF.preload(CNC_ASSET_URL)
