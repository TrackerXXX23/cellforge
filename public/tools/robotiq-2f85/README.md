# Robotiq 2F-85 model assets

The STL meshes in `assets/` come from the `robotiq_2f85` model in Google
DeepMind's MuJoCo Menagerie. That model is derived from the public ROS-Industrial
Robotiq 2F-85 URDF description.

- Product represented: Robotiq 2F-85 Adaptive Gripper
- Source: https://github.com/google-deepmind/mujoco_menagerie/tree/main/robotiq_2f85
- Upstream revision imported: `71f066ad0be9cd271f7ed58c030243ef157af9f4`
- License: BSD-2-Clause; see `LICENSE`

CellForge reproduces the upstream kinematic link hierarchy and animates the
coupled finger joints for visualization. This is a digital-twin visualization,
not a certified robotics or safety model.

