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
    if (!(object instanceof THREE.Mesh) || object.userData.contactIgnored) return
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

export function createCncContactMonitor(requiredTables = 0) {
  let arm: Body[] = []
  let machine: Body[] = []
  let robotRoot: THREE.Object3D | null = null
  let machineRoot: THREE.Object3D | null = null
  const tables = new Map<string, { root: THREE.Object3D; bodies: Body[] }>()
  let obstacles: Body[] = []
  let readyTables = 0
  const refreshObstacles = () => {
    const registered = [...tables.values()]
    obstacles = [...machine, ...registered.flatMap(value => value.bodies)]
    readyTables = registered.filter(value => value.bodies.length > 0).length
  }
  let token = ''
  let failure: string | null = null
  let frames = 0
  return {
    registerRobot(root: THREE.Object3D) { robotRoot = root; arm = bodies(root) },
    registerMachine(root: THREE.Object3D) { machineRoot = root; machine = bodies(root); refreshObstacles() },
    registerTable(id: string, root: THREE.Object3D) { tables.set(id, { root, bodies: bodies(root) }); refreshObstacles() },
    unregisterTable(id: string) { tables.delete(id); refreshObstacles() },
    getGeometry() { return { robot: robotRoot, machine: machineRoot, tables: [...tables.values()].map(value => value.root) } },
    measure(nextToken: string, paused: boolean) {
      if (token !== nextToken) {
        token = nextToken
        failure = null
        frames = 0
        for (const body of arm) body.initialized = false
        for (const body of obstacles) body.initialized = false
      }
      if (!arm.length || !machine.length || readyTables < requiredTables) return 'CNC contact geometry unavailable'
      if (failure) return failure
      for (const body of arm) update(body, paused)
      for (const body of obstacles) update(body, paused)
      for (const moving of arm) {
        if (!moving.mesh.visible) continue
        for (const fixed of obstacles) {
          // The carried blank intentionally contacts the receiving chuck pads.
          // All robot/gripper meshes and the chuck backplate remain checked.
          if (moving.mesh.name === 'CarriedWorkpiece' && fixed.mesh.name.startsWith('Chuck_Jaw_')) continue
          // Only the payload may rest on its named table slot, from above.
          // Robot/gripper contact and all other table intersections remain blocked.
          const slot = fixed.mesh.userData.supportSlot as number[] | undefined
          if (moving.mesh.name === 'CarriedWorkpiece' && slot) {
            const r = moving.current.rotation.elements
            const extentY = Math.abs(r[1]) * moving.current.halfSize.x + Math.abs(r[4]) * moving.current.halfSize.y + Math.abs(r[7]) * moving.current.halfSize.z
            const top = fixed.current.center.y + fixed.current.halfSize.y
            const previousRotation = moving.previous.rotation.elements
            const previousExtentY = Math.abs(previousRotation[1]) * moving.previous.halfSize.x + Math.abs(previousRotation[4]) * moving.previous.halfSize.y + Math.abs(previousRotation[7]) * moving.previous.halfSize.z
            if ((!moving.initialized || moving.previous.center.y - previousExtentY >= top - 0.006)
              && moving.current.center.y - extentY >= top - 0.006
              && Math.hypot(moving.current.center.x - fixed.current.center.x - slot[0], moving.current.center.z - fixed.current.center.z - slot[2]) < 0.04) continue
          }
          if (moving.swept.intersectsOBB(fixed.swept, 1e-8)) {
            failure = `CNC swept contact: ${moving.mesh.name || moving.mesh.parent?.name || 'robot mesh'} / ${fixed.mesh.name}`
            return failure
          }
        }
      }
      for (const body of arm) { body.previous.copy(body.current); body.initialized = true }
      for (const body of obstacles) { body.previous.copy(body.current); body.initialized = true }
      if (!paused) frames += 1
      return null
    },
    get frames() { return frames },
  }
}
export type CncContactMonitor = ReturnType<typeof createCncContactMonitor>
