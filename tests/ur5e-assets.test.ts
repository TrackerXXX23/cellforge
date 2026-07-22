import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const urdfPath = 'public/robots/ur5e/ur_description/urdf/ur5e.urdf'
const licensePath = 'public/robots/ur5e/ur_description/LICENSE'
const provenancePath = 'public/robots/ur5e/PROVENANCE.md'

const jointNames = [
  'shoulder_pan_joint',
  'shoulder_lift_joint',
  'elbow_joint',
  'wrist_1_joint',
  'wrist_2_joint',
  'wrist_3_joint',
]

describe('UR5e browser asset package', () => {
  it('retains the six-joint chain plus official visual and collision references', () => {
    const urdf = readFileSync(urdfPath, 'utf8')

    for (const name of jointNames) {
      expect(urdf).toContain(`<joint name="${name}"`)
    }

    expect(urdf.match(/meshes\/ur5e\/visual\/.+?\.dae/g)).toHaveLength(7)
    expect(urdf.match(/meshes\/ur5e\/collision\/.+?\.stl/g)).toHaveLength(7)
  })

  it('ships the upstream license and pinned provenance', () => {
    const license = readFileSync(licensePath, 'utf8')
    const provenance = readFileSync(provenancePath, 'utf8')

    expect(license).toContain('Redistribution and use in source and binary forms')
    expect(provenance).toContain('UniversalRobots/Universal_Robots_ROS2_Description')
    expect(provenance).toContain('ae333289875f9ba5a9ea6649a54036efb5ccabee')
    expect(provenance).toContain('a28d6620579cee080aa0679e1e1e2904f63878dd')
  })
})
