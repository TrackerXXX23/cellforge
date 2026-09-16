import type { Vec3 } from './simulation'

// Physical collision bodies shared with the rendered cell. The scanner field
// graphic is informational; these panels do not constitute a certified enclosure.
export const CELL_BODY_IDS = ['floor', 'scanner', 'fence-back', 'fence-right', 'chuck-stock'] as const
export const FENCE_PANELS: { id: string; position: Vec3; size: Vec3 }[] = [
  { id: 'fence-back', position: [0.6, 1, -3.2], size: [6.4, 2, 0.06] },
  { id: 'fence-right', position: [3.8, 1, 0], size: [0.06, 2, 6.4] },
]
export const COLLISION_COVERAGE = '1441 measured poses; approximate swept arm/tool/payload bounds against CNC, tables, loose stock, scanner housing, floor and two boundary panels; non-adjacent robot links and tool/payload self-contact. Connected-link and internal gripper pairs excluded; named grasp and support contacts allowed. Excludes triangle-exact continuous collision, grasp forces, scanner protective-field logic and hardware certification.'
