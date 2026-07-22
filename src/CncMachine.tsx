import { useGLTF } from '@react-three/drei'
import { ThreeEvent, useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
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

const cobalt = '#245df3'
const rawPart = '#c4873e'
const finishedPart = '#79a998'
const cutawayOpacity = 0.14

interface CncMachineProps {
  motion: MotionState
  selected: boolean
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

function cloneShellMaterials(root: THREE.Object3D) {
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

export function CncMachine({ motion, selected, onSelect }: CncMachineProps) {
  const { scene } = useGLTF(CNC_ASSET_URL)
  const machineScene = useMemo(() => {
    const instance = scene.clone(true)
    cloneShellMaterials(requireNode(instance, CNC_ASSET_NODES.shell))
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
  const shellMaterials = useMemo(() => collectMaterials(nodes.shell), [nodes.shell])

  useEffect(() => {
    machineScene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return
      object.castShadow = true
      object.receiveShadow = true
    })
  }, [machineScene])

  useEffect(() => {
    for (const material of shellMaterials) {
      material.transparent = selected
      material.opacity = selected ? cutawayOpacity : 1
      material.depthWrite = !selected
      material.needsUpdate = true
    }
  }, [selected, shellMaterials])

  useEffect(() => {
    setLampState(nodes.stackAmber, !motion.machineRunning)
    setLampState(nodes.stackGreen, motion.machineRunning)
  }, [motion.machineRunning, nodes.stackAmber, nodes.stackGreen])

  useFrame((_, delta) => {
    const doorTarget = motion.doorOpen ? CNC_DOOR_OPEN_OFFSET : 0
    nodes.door.position.x = THREE.MathUtils.damp(nodes.door.position.x, doorTarget, 8, delta)
    if (motion.machineRunning) nodes.spindle.rotation.y += delta * 18
  })

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
      <mesh
        position={CNC_WORKPIECE_LOCAL_POSITION}
        visible={motion.partAtMachine}
        castShadow
      >
        <cylinderGeometry args={[0.12, 0.12, 0.16, 32]} />
        <meshStandardMaterial
          color={motion.partFinished ? finishedPart : rawPart}
          metalness={0.62}
          roughness={0.25}
        />
      </mesh>
    </group>
  )
}

useGLTF.preload(CNC_ASSET_URL)
