import * as THREE from 'three'
import { OBB } from 'three/addons/math/OBB.js'

interface Body {
  mesh: THREE.Mesh
  local: OBB
  current: OBB
  previous: OBB
  swept: OBB
  initialized: boolean
}

function bodies(root: THREE.Object3D): Body[] {
  const result: Body[] = []
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return
    object.geometry.computeBoundingBox()
    if (!object.geometry.boundingBox) return
    result.push({ mesh: object, local: new OBB().fromBox3(object.geometry.boundingBox),
      current: new OBB(), previous: new OBB(), swept: new OBB(), initialized: false })
  })
  return result
}

const inverseRotation = new THREE.Matrix3()
const relativeRotation = new THREE.Matrix3()
const offset = new THREE.Vector3()
const shift = new THREE.Vector3()

// Enclose both oriented endpoint boxes in the current local frame. This bounds
// linear corner sweeps without expanding backward when the gripper withdraws.
// The 2 mm padding allows small curved excursions: this is an approximate
// swept-volume guard, not an exact continuous triangle collision certificate.
function update(body: Body, paused: boolean) {
  body.current.copy(body.local).applyMatrix4(body.mesh.matrixWorld)
  body.swept.copy(body.current)
  if (body.initialized && !paused) {
    inverseRotation.copy(body.current.rotation).transpose()
    relativeRotation.multiplyMatrices(inverseRotation, body.previous.rotation)
    offset.subVectors(body.previous.center, body.current.center).applyMatrix3(inverseRotation)
    const r = relativeRotation.elements
    for (let axis = 0; axis < 3; axis += 1) {
      const extent = Math.abs(r[axis]) * body.previous.halfSize.x
        + Math.abs(r[axis + 3]) * body.previous.halfSize.y
        + Math.abs(r[axis + 6]) * body.previous.halfSize.z
      const lower = Math.min(-body.current.halfSize.getComponent(axis), offset.getComponent(axis) - extent)
      const upper = Math.max(body.current.halfSize.getComponent(axis), offset.getComponent(axis) + extent)
      body.swept.halfSize.setComponent(axis, (upper - lower) / 2 + 0.002)
      shift.setComponent(axis, (upper + lower) / 2)
    }
    body.swept.center.add(shift.applyMatrix3(body.current.rotation))
  }
}

export function createCncContactMonitor() {
  let arm: Body[] = []
  let machine: Body[] = []
  let token = ''
  let failure: string | null = null
  let frames = 0
  return {
    registerRobot(root: THREE.Object3D) { arm = bodies(root) },
    registerMachine(root: THREE.Object3D) { machine = bodies(root) },
    measure(nextToken: string, paused: boolean) {
      if (token !== nextToken) {
        token = nextToken
        failure = null
        frames = 0
        for (const body of arm) body.initialized = false
        for (const body of machine) body.initialized = false
      }
      if (!arm.length || !machine.length) return 'CNC contact geometry unavailable'
      if (failure) return failure
      for (const body of arm) update(body, paused)
      for (const body of machine) update(body, paused)
      for (const moving of arm) {
        if (!moving.mesh.visible) continue
        for (const fixed of machine) {
          // The carried blank intentionally contacts the receiving chuck pads.
          // All robot/gripper meshes and the chuck backplate remain checked.
          if (moving.mesh.name === 'CarriedWorkpiece' && fixed.mesh.name.startsWith('Chuck_Jaw_')) continue
          if (moving.swept.intersectsOBB(fixed.swept, 1e-8)) {
            failure = `CNC swept contact: ${moving.mesh.name || moving.mesh.parent?.name || 'robot mesh'} / ${fixed.mesh.name}`
            return failure
          }
        }
      }
      for (const body of arm) { body.previous.copy(body.current); body.initialized = true }
      for (const body of machine) { body.previous.copy(body.current); body.initialized = true }
      if (!paused) frames += 1
      return null
    },
    get frames() { return frames },
  }
}
export type CncContactMonitor = ReturnType<typeof createCncContactMonitor>
