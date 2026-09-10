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

describe('full cell collision coverage', () => {
  function selfFixture() {
    const robot = new THREE.Group()
    const base = new THREE.Group(); base.name = 'base_link_inertia'
    const shoulder = new THREE.Group(); shoulder.name = 'shoulder_link'
    const elbow = new THREE.Group(); elbow.name = 'forearm_link'
    robot.add(base, shoulder, elbow)
    for (const link of [base, shoulder, elbow]) link.add(new THREE.Mesh(new THREE.BoxGeometry(0.1,0.1,0.1)))
    elbow.position.x = 1
    const machine = new THREE.Mesh(new THREE.BoxGeometry(1,1,1)); machine.position.x = 10
    const monitor = createCncContactMonitor()
    monitor.registerRobot(robot); monitor.registerMachine(machine)
    const check = (token='self') => { robot.updateMatrixWorld(true); machine.updateMatrixWorld(true); return monitor.measure(token,false) }
    return {robot, base, elbow, monitor, check}
  }
  it('excludes connected links while blocking non-adjacent link contact and tunneling', () => {
    const {elbow,check} = selfFixture()
    expect(check()).toBeNull() // base and directly connected shoulder overlap intentionally
    elbow.position.x = -1
    expect(check()).toContain('Self swept contact')
    expect(check()).toContain('Self swept contact')
    expect(check('retry')).toBeNull()
    elbow.position.x = 0
    expect(check('overlap')).toContain('forearm_link')
  })
  it('rotates and scales offset mesh centers into world space', () => {
    const {arm,glass,check,monitor} = fixture()
    arm.geometry.translate(1,0,0)
    monitor.registerRobot(arm)
    arm.position.set(0,0,0); arm.rotation.z = Math.PI/2; arm.scale.setScalar(2)
    glass.position.set(0,2,0)
    expect(check()).toContain('DoorGlass')
    glass.position.set(1,0,0)
    expect(check('clear')).toBeNull()
  })
  it('requires every registered physical cell body and blocks scanner, panels and floor', () => {
    for (const id of ['scanner','fence-back','fence-right','floor']) {
      const {arm,glass} = fixture()
      const monitor = createCncContactMonitor(0,[id]); monitor.registerRobot(arm); monitor.registerMachine(glass)
      expect(monitor.measure('missing',false)).toContain('unavailable')
      monitor.registerCellBody(id,new THREE.Group())
      expect(monitor.measure('empty',false)).toContain('unavailable')
      const body = new THREE.Mesh(new THREE.BoxGeometry(.1,.1,.1)); body.name=id; body.position.x=-1
      body.updateMatrixWorld(true);arm.updateMatrixWorld(true);glass.updateMatrixWorld(true)
      monitor.registerCellBody(id,body)
      expect(monitor.measure('blocked',false)).toContain(id)
      monitor.unregisterCellBody(id)
      expect(monitor.measure('removed',false)).toContain('unavailable')
    }
  })
  it('keeps loose stock active but transitions source and placed stock with the cycle', () => {
    const {arm,glass,monitor}=fixture(); glass.position.x=10;arm.position.x=0
    const stock=new THREE.Mesh(new THREE.BoxGeometry(.1,.1,.1)); stock.name='stock'
    const check=(role:string, rawRemoved:boolean, finishedPlaced:boolean)=>{
      stock.userData.stockRole=role
      arm.updateMatrixWorld(true);glass.updateMatrixWorld(true);stock.updateMatrixWorld(true)
      return monitor.measure(`${role}/${rawRemoved}/${finishedPlaced}`,false,{rawRemoved,finishedPlaced,partAtMachine:false,graspContact: role === 'source' ? 'source' : null})
    }
    monitor.registerTable('infeed',stock)
    expect(check('loose',true,false)).toContain('stock')
    expect(check('source',false,false)).toContain('stock')
    expect(check('source',true,false)).toBeNull()
    expect(check('placed',true,false)).toBeNull()
    expect(check('placed',true,true)).toContain('stock')
    arm.name='GripperContactPad'
    expect(check('source',false,true)).toBeNull()
    expect(check('loose',false,true)).toContain('stock')
  })
  it('checks payload against robot and tool housing while allowing named finger contact', () => {
    const {robot,base,monitor,check}=selfFixture()
    const payload=new THREE.Mesh(new THREE.BoxGeometry(.03,.03,.03));payload.name='CarriedWorkpiece';robot.add(payload)
    monitor.registerRobot(robot)
    expect(check()).toContain('Self swept contact')
    payload.position.x=2; base.position.x=5
    const tool=new THREE.Group();tool.name='Twisting three-jaw centric gripper';robot.add(tool)
    const pad=new THREE.Mesh(new THREE.BoxGeometry(.04,.04,.04));pad.name='GripperContactPad';pad.position.x=2;tool.add(pad)
    monitor.registerRobot(robot)
    expect(check('pad')).toBeNull()
    pad.name='housing';monitor.registerRobot(robot)
    expect(check('housing')).toContain('Self swept contact')
    payload.visible=false
    expect(check('absent-payload')).toBeNull()
  })
})

describe('relative self sweeps and grasp context', () => {
  it('does not confuse co-moving separated bodies with a self-contact, but catches relative crossing', () => {
    const robot = new THREE.Group()
    const a = new THREE.Mesh(new THREE.BoxGeometry(.05,.05,.05));a.name='tool-housing'
    const b = new THREE.Mesh(new THREE.BoxGeometry(.05,.05,.05));b.name='CarriedWorkpiece';b.position.x=.08
    robot.add(a,b)
    const machine=new THREE.Mesh(new THREE.BoxGeometry(.1,.1,.1));machine.position.y=10;machine.updateMatrixWorld(true)
    const monitor=createCncContactMonitor();monitor.registerRobot(robot);monitor.registerMachine(machine)
    robot.updateMatrixWorld(true);expect(monitor.measure('relative',false)).toBeNull()
    robot.position.x=1;robot.rotation.y=.1;robot.updateMatrixWorld(true)
    expect(monitor.measure('relative',false)).toBeNull()
    b.position.x=-.08;robot.updateMatrixWorld(true)
    expect(monitor.measure('relative',false)).toContain('Self swept contact')
  })
  it('never grants target-stock contact outside the named grasp interval', () => {
    const {arm,glass,monitor}=fixture();arm.name='GripperContactPad';glass.position.x=10
    const stock=new THREE.Mesh(new THREE.BoxGeometry(.1,.1,.1));stock.position.x=-1;stock.name='source';stock.userData.stockRole='source'
    arm.updateMatrixWorld(true);glass.updateMatrixWorld(true);stock.updateMatrixWorld(true);monitor.registerTable('stock',stock)
    expect(monitor.measure('transit',false,{rawRemoved:false,finishedPlaced:false,partAtMachine:false,graspContact:null})).toContain('source')
    expect(monitor.measure('grasp',false,{rawRemoved:false,finishedPlaced:false,partAtMachine:false,graspContact:'source'})).toBeNull()
    stock.userData.stockRole='chuck'
    expect(monitor.measure('no-chuck-part',false,{rawRemoved:true,finishedPlaced:false,partAtMachine:false,graspContact:null})).toBeNull()
    expect(monitor.measure('chuck-part',false,{rawRemoved:true,finishedPlaced:false,partAtMachine:true,graspContact:null})).toContain('source')
  })
})
