import { readFileSync, statSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  CNC_MACHINE_POSITION,
  CNC_REQUIRED_NODE_NAMES,
  CNC_VISE_CENTER_LOCAL_POSITION,
  CNC_WORKPIECE_LOCAL_POSITION,
} from '../src/cnc'
import { CNC_CHUCK_TARGET } from '../src/simulation'

const assetPath = 'public/machines/cellforge-vmc/cellforge-vmc.glb'
const sourcePath = 'assets/cnc/cellforge-vmc.blend'
const generatorPath = 'scripts/build-cnc-vmc.py'
const provenancePath = 'public/machines/cellforge-vmc/PROVENANCE.md'

interface GlbJson {
  accessors?: { count: number }[]
  buffers?: { uri?: string }[]
  meshes?: {
    primitives: {
      attributes: { POSITION?: number }
      indices?: number
      mode?: number
    }[]
  }[]
  nodes?: { name?: string; translation?: number[] }[]
}

function readGlbJson() {
  const glb = readFileSync(assetPath)
  expect(glb.readUInt32LE(0)).toBe(0x46546c67)
  expect(glb.readUInt32LE(4)).toBe(2)
  expect(glb.readUInt32LE(8)).toBe(glb.length)

  const jsonLength = glb.readUInt32LE(12)
  expect(glb.readUInt32LE(16)).toBe(0x4e4f534a)
  return JSON.parse(glb.subarray(20, 20 + jsonLength).toString('utf8').trim()) as GlbJson
}

function triangleCount(document: GlbJson) {
  const accessors = document.accessors ?? []
  return (document.meshes ?? []).reduce((total, mesh) => total + mesh.primitives.reduce((meshTotal, primitive) => {
    if ((primitive.mode ?? 4) !== 4) return meshTotal
    const accessorIndex = primitive.indices ?? primitive.attributes.POSITION
    if (accessorIndex === undefined) return meshTotal
    return meshTotal + accessors[accessorIndex].count / 3
  }, 0), 0)
}

describe('CellForge VMC browser asset', () => {
  it('ships an embedded GLB within the runtime budgets', () => {
    const document = readGlbJson()

    expect(statSync(assetPath).size).toBeLessThanOrEqual(5 * 1024 * 1024)
    expect(triangleCount(document)).toBeGreaterThan(1_000)
    expect(triangleCount(document)).toBeLessThanOrEqual(100_000)
    expect(document.buffers).toHaveLength(1)
    expect(document.buffers?.[0].uri).toBeUndefined()
  })

  it('retains the runtime node contract for interaction and cutaway mode', () => {
    const names = new Set((readGlbJson().nodes ?? []).map((node) => node.name))

    for (const name of CNC_REQUIRED_NODE_NAMES) {
      expect(names.has(name), `Missing CNC node ${name}`).toBe(true)
    }
  })

  it('centers the CNC vise and rendered blank on the commissioned chuck target', () => {
    const worldViseCenter = CNC_MACHINE_POSITION.map(
      (coordinate, index) => coordinate + CNC_VISE_CENTER_LOCAL_POSITION[index],
    )
    const worldWorkpieceCenter = CNC_MACHINE_POSITION.map(
      (coordinate, index) => coordinate + CNC_WORKPIECE_LOCAL_POSITION[index],
    )

    expect(worldViseCenter[0]).toBeCloseTo(CNC_CHUCK_TARGET[0])
    expect(worldViseCenter[2]).toBeCloseTo(CNC_CHUCK_TARGET[2])
    worldWorkpieceCenter.forEach((coordinate, index) => {
      expect(coordinate).toBeCloseTo(CNC_CHUCK_TARGET[index])
    })
  })

  it('keeps the horizontal chuck behind the blank with a rear gripping zone', () => {
    const nodes = readGlbJson().nodes ?? []
    const backplate = nodes.find(node => node.name === 'Chuck_Backplate')!
    const pad = nodes.find(node => node.name === 'Chuck_Jaw_0')!
    expect(backplate).toBeDefined()
    expect(pad).toBeDefined()
    // glTF +Z becomes world -X. Backplate thickness is 50 mm.
    const frontOfBackplate = CNC_MACHINE_POSITION[0] - backplate.translation![2] - 0.025
    const blankRear = CNC_CHUCK_TARGET[0] + 0.04
    const padFront = CNC_MACHINE_POSITION[0] - pad.translation![2] - 0.007
    expect(frontOfBackplate - blankRear).toBeCloseTo(0.01, 5)
    expect(blankRear - padFront).toBeCloseTo(0.007, 5)
    expect(nodes.some(node => node.name === 'Vise_MovingJaw')).toBe(false)
  })

  it('retains editable source, a reproducible generator, and asset notes', () => {
    expect(statSync(sourcePath).size).toBeGreaterThan(100_000)
    expect(readFileSync(generatorPath, 'utf8')).toContain('bpy.ops.export_scene.gltf')

    const provenance = readFileSync(provenancePath, 'utf8')
    expect(provenance).toContain('Third-party model geometry or textures: none')
    expect(provenance).toContain('Robot targets, kinematics, motion')
    expect(provenance).toContain('certified collision body')
  })
})
