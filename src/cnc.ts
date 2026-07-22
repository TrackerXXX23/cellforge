export const CNC_ASSET_URL = '/machines/cellforge-vmc/cellforge-vmc.glb'

export const CNC_MACHINE_POSITION = [2.25, 0, -0.25] as const
export const CNC_ASSET_ROTATION_Y = -Math.PI / 2
export const CNC_DOOR_OPEN_OFFSET = 0.72
export const CNC_WORKPIECE_LOCAL_POSITION = [-0.91, 0.97, 0] as const

export const CNC_ASSET_NODES = {
  root: 'VMC_Root',
  shell: 'Shell',
  door: 'Door',
  doorGlass: 'DoorGlass',
  interior: 'InteriorTub',
  table: 'Table',
  vise: 'Vise',
  spindle: 'Spindle',
  tool: 'Tool',
  controls: 'ControlPanel',
  stackLight: 'StackLight',
  stackAmber: 'StackLight_Amber',
  stackGreen: 'StackLight_Green',
} as const

export const CNC_REQUIRED_NODE_NAMES = Object.values(CNC_ASSET_NODES)
