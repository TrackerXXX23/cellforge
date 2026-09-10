export const CNC_ASSET_URL = `${import.meta.env.BASE_URL}machines/cellforge-vmc/cellforge-vmc.glb`

export const CNC_MACHINE_POSITION = [2.17, 0, -0.25] as const
export const CNC_ASSET_ROTATION_Y = -Math.PI / 2
export const CNC_DOOR_OPEN_OFFSET = 1.3
export const CNC_VISE_CENTER_LOCAL_POSITION = [-0.83, 1.01, 0] as const
export const CNC_WORKPIECE_LOCAL_POSITION = [CNC_VISE_CENTER_LOCAL_POSITION[0], 1.06, 0] as const

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
