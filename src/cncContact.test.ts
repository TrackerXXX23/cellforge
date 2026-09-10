import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createCncContactMonitor } from './cncContact'

function fixture() {
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1))
  arm.name = 'wrist'
  arm.position.x = -1
  const glass = new THREE.Mesh(new THREE.BoxGeometry(0.01, 1, 1))
  glass.name = 'DoorGlass'
  const monitor = createCncContactMonitor()
  monitor.registerRobot(arm)
  monitor.registerMachine(glass)
  const check = (token = 'run') => {
    arm.updateMatrixWorld(true)
    glass.updateMatrixWorld(true)
    return monitor.measure(token, false)
  }
  return { arm, glass, monitor, check }
}

describe('CNC swept contact gate', () => {
  it('detects tunneling through thin glass even when both endpoints are clear', () => {
    const { arm, check } = fixture()
    expect(check()).toBeNull()
    arm.position.x = 1
    expect(check()).toContain('DoorGlass')
    arm.position.x = 2
    expect(check()).toContain('DoorGlass')
    expect(check('new-run')).toBeNull()
  })
  it('checks the moving door sweep against a stationary arm', () => {
    const { glass, check } = fixture()
    glass.position.x = -2
    expect(check()).toBeNull()
    glass.position.x = 0
    expect(check()).toContain('DoorGlass')
  })
  it('keeps geometry checks active for transparent cutaways', () => {
    const { arm, glass, check } = fixture()
    ;(glass.material as THREE.MeshBasicMaterial).opacity = 0.14
    arm.position.x = 0
    expect(check()).toContain('DoorGlass')
  })
  it('allows only named payload/chuck-pad contact, never gripper or backplate contact', () => {
    const { arm, glass, check } = fixture()
    arm.position.x = 0
    arm.name = 'CarriedWorkpiece'
    glass.name = 'Chuck_Jaw_0'
    expect(check()).toBeNull()
    glass.name = 'Chuck_Backplate'
    expect(check('backplate')).toContain('Chuck_Backplate')
    glass.name = 'Chuck_Jaw_0'
    arm.name = 'gripper'
    expect(check('gripper')).toContain('Chuck_Jaw_0')
  })
  it('does not invent contact behind a body withdrawing sideways from a fixture', () => {
    const { arm, check } = fixture()
    arm.position.x = -0.061
    expect(check()).toBeNull()
    arm.position.set(-0.08, 0.08, 0)
    expect(check()).toBeNull()
  })
  it('fails closed when geometry has not registered', () => {
    expect(createCncContactMonitor().measure('run', false)).toContain('unavailable')
  })
})

describe('table contact and support gates', () => {
  function tableFixture() {
    const { arm, glass, monitor } = fixture()
    glass.position.x = 10
    const top = new THREE.Mesh(new THREE.BoxGeometry(1, 0.1, 1))
    top.name = 'infeed-tabletop'
    top.userData.supportSlot = [0,0,0]
    monitor.registerTable('infeed', top)
    const check = (token = 'table') => {
      arm.updateMatrixWorld(true)
      glass.updateMatrixWorld(true)
      top.updateMatrixWorld(true)
      return monitor.measure(token,false)
    }
    return { arm, monitor, check }
  }
  it('blocks arm contact and thin-table tunneling, independent of CNC clearance', () => {
    const {arm, check} = tableFixture()
    arm.position.set(0,0.3,0)
    expect(check()).toBeNull()
    arm.position.y = -0.3
    expect(check()).toContain('infeed-tabletop')
  })
  it('allows only named payload support from above at the designated slot', () => {
    const {arm, check} = tableFixture()
    arm.name = 'CarriedWorkpiece'
    arm.position.set(0,0.1,0)
    expect(check()).toBeNull()
    arm.name = 'gripper'
    expect(check('gripper')).toContain('infeed-tabletop')
    arm.name = 'CarriedWorkpiece'
    arm.position.x = 0.2
    expect(check('wrong-slot')).toContain('infeed-tabletop')
    arm.position.set(0,0.07,0)
    expect(check('penetration')).toContain('infeed-tabletop')
  })
  it('does not exempt a payload crossing from below into the support slot', () => {
    const {arm, check} = tableFixture()
    arm.name = 'CarriedWorkpiece'
    arm.position.set(0,-0.3,0)
    expect(check()).toBeNull()
    arm.position.y = 0.1
    expect(check()).toContain('infeed-tabletop')
  })
  it('requires both tables for the full-cell runtime monitor', () => {
    const monitor = createCncContactMonitor(2)
    monitor.registerRobot(new THREE.Mesh(new THREE.BoxGeometry(1,1,1)))
    monitor.registerMachine(new THREE.Mesh(new THREE.BoxGeometry(1,1,1)))
    expect(monitor.measure('missing',false)).toContain('unavailable')
    monitor.registerTable('infeed',new THREE.Group())
    monitor.registerTable('outfeed',new THREE.Group())
    expect(monitor.measure('empty',false)).toContain('unavailable')
  })
})
