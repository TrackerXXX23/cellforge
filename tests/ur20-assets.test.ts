import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const urdfPath = 'public/robots/ur20/ur_description/urdf/ur20.urdf'
const licensePath = 'public/robots/ur20/ur_description/LICENSE'
const graphicalLicensePath = 'public/robots/ur20/ur_description/meshes/ur20/LICENSE.txt'
const provenancePath = 'public/robots/ur20/PROVENANCE.md'

const jointNames = [
  'shoulder_pan_joint',
  'shoulder_lift_joint',
  'elbow_joint',
  'wrist_1_joint',
  'wrist_2_joint',
  'wrist_3_joint',
]

describe('UR20 browser asset package', () => {
  it('retains the six-joint chain plus official visual and collision references', () => {
    const urdf = readFileSync(urdfPath, 'utf8')

    for (const name of jointNames) {
      expect(urdf).toContain(`<joint name="${name}"`)
    }

    expect(urdf.match(/meshes\/ur20\/visual\/.+?\.dae/g)).toHaveLength(7)
    expect(urdf.match(/meshes\/ur20\/collision\/.+?\.stl/g)).toHaveLength(7)
  })

  it('ships the upstream license and pinned provenance', () => {
    const license = readFileSync(licensePath, 'utf8')
    const graphicalLicense = readFileSync(graphicalLicensePath, 'utf8')
    const provenance = readFileSync(provenancePath, 'utf8')

    expect(license).toContain('Redistribution and use in source and binary forms')
    expect(graphicalLicense).toContain('TERMS AND CONDITIONS FOR USE OF GRAPHICAL DOCUMENTATION')
    expect(provenance).toContain('UniversalRobots/Universal_Robots_ROS2_Description')
    expect(provenance).toContain('89bbe795f38a7ab00fb66fe8831dfff79dc99edf')
  })
})
