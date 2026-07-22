export const UR5E_URDF_URL = `${import.meta.env.BASE_URL}robots/ur5e/ur_description/urdf/ur5e.urdf`
export const UR5E_PACKAGE_URL = `${import.meta.env.BASE_URL}robots/ur5e/ur_description`

export const UR5E_RENDER_SCALE = 2.45

export const UR5E_JOINT_NAMES = [
  'shoulder_pan_joint',
  'shoulder_lift_joint',
  'elbow_joint',
  'wrist_1_joint',
  'wrist_2_joint',
  'wrist_3_joint',
] as const

export type Ur5eJointName = (typeof UR5E_JOINT_NAMES)[number]

export const UR5E_IK_JOINT_NAMES = [
  'shoulder_pan_joint',
  'shoulder_lift_joint',
  'elbow_joint',
  'wrist_1_joint',
  'wrist_2_joint',
] as const satisfies readonly Ur5eJointName[]

export const UR5E_READY_JOINTS: Record<Ur5eJointName, number> = {
  shoulder_pan_joint: -0.4886921905584123,
  shoulder_lift_joint: -1.6057029118347832,
  elbow_joint: 1.8151424220741028,
  wrist_1_joint: -1.8151424220741028,
  wrist_2_joint: -Math.PI / 2,
  wrist_3_joint: 0,
}

export const UR5E_JOINT_LIMITS: Record<Ur5eJointName, readonly [number, number]> = {
  shoulder_pan_joint: [-Math.PI * 2, Math.PI * 2],
  shoulder_lift_joint: [-Math.PI * 2, Math.PI * 2],
  elbow_joint: [-Math.PI, Math.PI],
  wrist_1_joint: [-Math.PI * 2, Math.PI * 2],
  wrist_2_joint: [-Math.PI * 2, Math.PI * 2],
  wrist_3_joint: [-Math.PI * 2, Math.PI * 2],
}

export const UR5E_COMMISSIONING_LIMITS: Record<Ur5eJointName, readonly [number, number]> = {
  shoulder_pan_joint: [-Math.PI, Math.PI],
  shoulder_lift_joint: [-Math.PI, 0],
  elbow_joint: [0, Math.PI],
  wrist_1_joint: [-Math.PI * 2, Math.PI * 2],
  wrist_2_joint: [-Math.PI * 2, Math.PI * 2],
  wrist_3_joint: [-Math.PI * 2, Math.PI * 2],
}

export function clampUr5eJoint(name: Ur5eJointName, value: number) {
  const [lower, upper] = UR5E_COMMISSIONING_LIMITS[name]
  return Math.min(upper, Math.max(lower, value))
}
