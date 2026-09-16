import type { Vec3 } from './simulation'
import { WORKPIECE_TABLE_CENTER_Y, WORKPIECE_HEIGHT } from './workpiece'

export interface CellLayout {
  id: string
  label: string
  infeed: Vec3
  outfeed: Vec3
}
export const TABLE_SIZE: [number, number, number] = [1.42, 0.15, 1.08]
export const TABLE_TOP_Y = WORKPIECE_TABLE_CENTER_Y - WORKPIECE_HEIGHT / 2 - TABLE_SIZE[1] / 2
export const TABLE_LEGS = [[-0.56, -0.42], [0.56, -0.42], [-0.56, 0.42], [0.56, 0.42]] as const
export const REFERENCE_LAYOUT: CellLayout = { id: 'reference', label: 'Reference tables', infeed: [-1.55, 0, 1.15], outfeed: [-1.55, 0, -1.15] }
export const COMPACT_LAYOUT: CellLayout = { id: 'compact', label: 'Closer tables', infeed: [-1.4, 0, 1], outfeed: [-1.4, 0, -1] }
export const LAYOUT_PRESETS = [REFERENCE_LAYOUT, COMPACT_LAYOUT] as const
export function tableSlot(index: number): Vec3 {
  return [-0.42 + index % 3 * 0.42, WORKPIECE_TABLE_CENTER_Y, -0.23 + Math.floor(index / 3) * 0.46]
}
export function layoutTarget(layout: CellLayout, kind: 'infeed' | 'outfeed'): Vec3 {
  const slot = tableSlot(kind === 'infeed' ? 2 : 5)
  const origin = layout[kind]
  return [slot[0] + origin[0], slot[1] + origin[1], slot[2] + origin[2]]
}
