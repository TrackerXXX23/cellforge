import * as THREE from 'three'
import type { MotionState } from './simulation'
import { OBB } from 'three/addons/math/OBB.js'

interface Body {
  mesh: THREE.Mesh
  local: OBB
  current: OBB
  previous: OBB
  swept: OBB
  initialized: boolean
  group: number
  previousMatrix: THREE.Matrix4
  sections: OBB[]
}

const links = ['base_link_inertia', 'shoulder_link', 'upper_arm_link', 'forearm_link', 'wrist_1_link', 'wrist_2_link', 'wrist_3_link']
function collisionGroup(mesh: THREE.Object3D): number {
  if (mesh.name === 'CarriedWorkpiece') return 8
  let object: THREE.Object3D | null = mesh
  while (object) {
    if (object.name === 'Twisting three-jaw centric gripper') return 7
    const index = links.indexOf(object.name)
    if (index >= 0) return index
    object = object.parent
  }
  return -1
}
const initialStock = {rawRemoved:false, finishedPlaced:false, partAtMachine:false, graspContact:null}
function stockActive(mesh: THREE.Object3D, stock: Pick<MotionState, 'rawRemoved' | 'finishedPlaced' | 'partAtMachine'>) {
  return mesh.userData.stockRole === 'source' ? !stock.rawRemoved
    : mesh.userData.stockRole === 'placed' ? stock.finishedPlaced : mesh.userData.stockRole === 'chuck' ? stock.partAtMachine : true
}
function intendedSelfPair(a: Body, b: Body) {
  if (a.group < 0 || b.group < 0) return false
  if (a.group === 8 || b.group === 8) {
    const other = a.group === 8 ? b : a
    return other.mesh.name === 'GripperContactPad'
  }
  return a.group === b.group || Math.abs(a.group - b.group) === 1
}

// Bound complete triangles in short longitudinal sections. One box around an
// entire curved casting includes empty space near the shoulder and wrist.
const sectionCache = new WeakMap<THREE.BufferGeometry, OBB[]>()
function meshSections(geometry: THREE.BufferGeometry): OBB[] {
  const cached = sectionCache.get(geometry)
  if (cached) return cached
  const box = geometry.boundingBox!
  const size = box.getSize(new THREE.Vector3())
  const axis = size.x >= size.y && size.x >= size.z ? 0 : size.y >= size.z ? 1 : 2
  const count = Math.max(1, Math.ceil(size.getComponent(axis) / 0.06))
  const buckets = Array.from({length:count}, () => new THREE.Box3())
  const position = geometry.getAttribute('position')
  const index = geometry.index
  const vertices = [new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3()]
  for (let face = 0; face < (index?.count ?? position.count); face += 3) {
    for (let i = 0; i < 3; i++) vertices[i].fromBufferAttribute(position, index ? index.getX(face+i) : face+i)
    const center = (vertices[0].getComponent(axis)+vertices[1].getComponent(axis)+vertices[2].getComponent(axis))/3
    const bucket = Math.min(count-1, Math.max(0, Math.floor((center-box.min.getComponent(axis))/size.getComponent(axis)*count)))
    for (const vertex of vertices) buckets[bucket].expandByPoint(vertex)
  }
  const result = buckets.filter(value => !value.isEmpty()).map(value => new OBB().fromBox3(value))
  sectionCache.set(geometry,result)
  return result
}

function bodies(root: THREE.Object3D): Body[] {
  const result: Body[] = []
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || object.userData.contactIgnored) return
    object.geometry.computeBoundingBox()
    if (!object.geometry.boundingBox) return
    result.push({ mesh: object, local: new OBB().fromBox3(object.geometry.boundingBox),
      current: new OBB(), previous: new OBB(), swept: new OBB(), initialized: false, group: collisionGroup(object), previousMatrix: new THREE.Matrix4(), sections: meshSections(object.geometry) })
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
function transformBox(local: OBB, matrix: THREE.Matrix4, target: OBB) {
  target.copy(local).applyMatrix4(matrix)
  // OBB.applyMatrix4 only translates the center; asset centers are offset.
  target.center.copy(local.center).applyMatrix4(matrix)
}
function encloseSweep(current: OBB, previous: OBB, swept: OBB, moving: boolean) {
  swept.copy(current)
  if (!moving) return
  inverseRotation.copy(current.rotation).transpose()
  relativeRotation.multiplyMatrices(inverseRotation, previous.rotation)
  offset.subVectors(previous.center, current.center).applyMatrix3(inverseRotation)
  const r = relativeRotation.elements
  for (let axis = 0; axis < 3; axis += 1) {
    const extent = Math.abs(r[axis]) * previous.halfSize.x
      + Math.abs(r[axis + 3]) * previous.halfSize.y
      + Math.abs(r[axis + 6]) * previous.halfSize.z
    const lower = Math.min(-current.halfSize.getComponent(axis), offset.getComponent(axis) - extent)
    const upper = Math.max(current.halfSize.getComponent(axis), offset.getComponent(axis) + extent)
    swept.halfSize.setComponent(axis, (upper - lower) / 2 + 0.002)
    shift.setComponent(axis, (upper + lower) / 2)
  }
  swept.center.add(shift.applyMatrix3(current.rotation))
}
function update(body: Body, paused: boolean) {
  transformBox(body.local, body.mesh.matrixWorld, body.current)
  encloseSweep(body.current, body.previous, body.swept, body.initialized && !paused)
}
const relativeMatrix = new THREE.Matrix4()
const previousRelativeMatrix = new THREE.Matrix4()
const relativeCurrent = new OBB()
const relativePrevious = new OBB()
const relativeSweep = new OBB()
function selfContact(a: Body, b: Body, paused: boolean) {
  if (!a.swept.intersectsOBB(b.swept, 1e-8)) return false
  // Compare in one body's frame. Sweeping two co-moving world boxes falsely
  // reports the grasped payload hitting its housing during ordinary transport.
  relativeMatrix.copy(a.mesh.matrixWorld).invert().multiply(b.mesh.matrixWorld)
  transformBox(b.local, relativeMatrix, relativeCurrent)
  previousRelativeMatrix.copy(a.previousMatrix).invert().multiply(b.previousMatrix)
  transformBox(b.local, previousRelativeMatrix, relativePrevious)
  const moving = a.initialized && b.initialized && !paused
  encloseSweep(relativeCurrent, relativePrevious, relativeSweep, moving)
  if (!a.local.intersectsOBB(relativeSweep, 1e-8)) return false
  for (const sectionB of b.sections) {
    transformBox(sectionB, relativeMatrix, relativeCurrent)
    transformBox(sectionB, previousRelativeMatrix, relativePrevious)
    encloseSweep(relativeCurrent, relativePrevious, relativeSweep, moving)
    for (const sectionA of a.sections) if (sectionA.intersectsOBB(relativeSweep, 1e-8)) return true
  }
  return false
}

export function createCncContactMonitor(requiredTables = 0, requiredCellBodies: readonly string[] = []) {
  let arm: Body[] = []
  let machine: Body[] = []
  let robotRoot: THREE.Object3D | null = null
  let machineRoot: THREE.Object3D | null = null
  const tables = new Map<string, { root: THREE.Object3D; bodies: Body[] }>()
  const cellBodies = new Map<string, { root: THREE.Object3D; bodies: Body[] }>()
  let selfPairs: [Body, Body][] = []
  let obstacles: Body[] = []
  let readyTables = 0
  const refreshObstacles = () => {
    const registered = [...tables.values()]
    obstacles = [...machine, ...registered.flatMap(value => value.bodies), ...[...cellBodies.values()].flatMap(value => value.bodies)]
    readyTables = registered.filter(value => value.bodies.length > 0).length
  }
  let token = ''
  let failure: string | null = null
  let frames = 0
  return {
    registerRobot(root: THREE.Object3D) {
      robotRoot = root; arm = bodies(root)
      selfPairs = []
      for (let i = 0; i < arm.length; i++) for (let j = i + 1; j < arm.length; j++) {
        if (!intendedSelfPair(arm[i], arm[j])) selfPairs.push([arm[i], arm[j]])
      }
    },
    registerMachine(root: THREE.Object3D) { machineRoot = root; machine = bodies(root); refreshObstacles() },
    registerTable(id: string, root: THREE.Object3D) { tables.set(id, { root, bodies: bodies(root) }); refreshObstacles() },
    unregisterTable(id: string) { tables.delete(id); refreshObstacles() },
    registerCellBody(id: string, root: THREE.Object3D) { cellBodies.set(id, {root, bodies:bodies(root)}); refreshObstacles() },
    unregisterCellBody(id: string) { cellBodies.delete(id); refreshObstacles() },
    getGeometry() { return { robot: robotRoot, machine: machineRoot, tables: [...tables.values()].map(value => value.root), cellBodies: [...cellBodies.entries()].map(([id, value]) => ({id, root:value.root})) } },
    measure(nextToken: string, paused: boolean, stock: Pick<MotionState, 'rawRemoved' | 'finishedPlaced' | 'partAtMachine' | 'graspContact'> = initialStock) {
      if (token !== nextToken) {
        token = nextToken
        failure = null
        frames = 0
        for (const body of arm) body.initialized = false
        for (const body of obstacles) body.initialized = false
      }
      if (!arm.length || !machine.length || readyTables < requiredTables || requiredCellBodies.some(id => !cellBodies.get(id)?.bodies.length)) return 'Cell contact geometry unavailable'
      if (failure) return failure
      for (const body of arm) update(body, paused)
      for (const body of obstacles) update(body, paused)
      for (const [a, b] of selfPairs) {
        if (!a.mesh.visible || !b.mesh.visible) continue
        if (selfContact(a, b, paused)) {
          failure = `Self swept contact: ${links[a.group] ?? (a.mesh.name || a.mesh.parent?.name || 'tool')} / ${links[b.group] ?? (b.mesh.name || b.mesh.parent?.name || 'tool')}`
          return failure
        }
      }
      for (const moving of arm) {
        if (!moving.mesh.visible) continue
        for (const fixed of obstacles) {
          if (!stockActive(fixed.mesh, stock)) continue
          // Only finger pads may touch a named workpiece during its grasp/release phase.
          if (moving.mesh.name === 'GripperContactPad' && stock.graspContact !== null && fixed.mesh.userData.stockRole === stock.graspContact) continue
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
      for (const body of arm) { body.previous.copy(body.current); body.previousMatrix.copy(body.mesh.matrixWorld); body.initialized = true }
      for (const body of obstacles) { body.previous.copy(body.current); body.previousMatrix.copy(body.mesh.matrixWorld); body.initialized = true }
      if (!paused) frames += 1
      return null
    },
    get frames() { return frames },
  }
}
export type CncContactMonitor = ReturnType<typeof createCncContactMonitor>
