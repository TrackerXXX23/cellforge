import * as THREE from 'three'

export const UR20_URDF_URL = `${import.meta.env.BASE_URL}robots/ur20/ur_description/urdf/ur20.urdf`
export const UR20_PACKAGE_URL = `${import.meta.env.BASE_URL}robots/ur20/ur_description`

export const UR20_RENDER_SCALE = 1

export const UR20_JOINT_NAMES = [
  'shoulder_pan_joint',
  'shoulder_lift_joint',
  'elbow_joint',
  'wrist_1_joint',
  'wrist_2_joint',
  'wrist_3_joint',
] as const

export type Ur20JointName = (typeof UR20_JOINT_NAMES)[number]

export const UR20_IK_JOINT_NAMES = [
  'shoulder_pan_joint',
  'shoulder_lift_joint',
  'elbow_joint',
  'wrist_1_joint',
  'wrist_2_joint',
] as const satisfies readonly Ur20JointName[]

export const UR20_MAX_JOINT_VELOCITIES: Record<Ur20JointName, number> = {
  shoulder_pan_joint: THREE.MathUtils.degToRad(120),
  shoulder_lift_joint: THREE.MathUtils.degToRad(120),
  elbow_joint: THREE.MathUtils.degToRad(150),
  wrist_1_joint: THREE.MathUtils.degToRad(210),
  wrist_2_joint: THREE.MathUtils.degToRad(210),
  wrist_3_joint: THREE.MathUtils.degToRad(210),
}

export const UR20_READY_JOINTS: Record<Ur20JointName, number> = {
  shoulder_pan_joint: -0.4886921905584123,
  shoulder_lift_joint: -1.6057029118347832,
  elbow_joint: 1.8151424220741028,
  wrist_1_joint: -1.8151424220741028,
  wrist_2_joint: -Math.PI / 2,
  wrist_3_joint: 0,
}

export const UR20_CNC_APPROACH_SEED_JOINTS: Record<Ur20JointName, number> = {
  shoulder_pan_joint: -0.341503827083313,
  shoulder_lift_joint: -2.4974208148445793,
  elbow_joint: 2.1003072187564054,
  wrist_1_joint: -2.7091105138357507,
  wrist_2_joint: -1.2920003726032239,
  wrist_3_joint: 0,
}

export const UR20_OUTFEED_SEED_JOINTS: Record<Ur20JointName, number> = {
  shoulder_pan_joint: 2.211,
  shoulder_lift_joint: -1.393,
  elbow_joint: 1.487,
  wrist_1_joint: -1.706,
  wrist_2_joint: -1.517,
  wrist_3_joint: 0,
}

export const UR20_JOINT_LIMITS: Record<Ur20JointName, readonly [number, number]> = {
  shoulder_pan_joint: [-Math.PI * 2, Math.PI * 2],
  shoulder_lift_joint: [-Math.PI * 2, Math.PI * 2],
  elbow_joint: [-Math.PI, Math.PI],
  wrist_1_joint: [-Math.PI * 2, Math.PI * 2],
  wrist_2_joint: [-Math.PI * 2, Math.PI * 2],
  wrist_3_joint: [-Math.PI * 2, Math.PI * 2],
}

export const UR20_COMMISSIONING_LIMITS: Record<Ur20JointName, readonly [number, number]> = {
  shoulder_pan_joint: [-2.95, 2.95],
  shoulder_lift_joint: [-2.9, -0.35],
  elbow_joint: [-2.9, 2.9],
  wrist_1_joint: [-4.5, 1.4],
  wrist_2_joint: [-3, 0],
  wrist_3_joint: [-Math.PI * 2, Math.PI * 2],
}

export function clampUr20Joint(name: Ur20JointName, value: number) {
  const [lower, upper] = UR20_COMMISSIONING_LIMITS[name]
  return Math.min(upper, Math.max(lower, value))
}
