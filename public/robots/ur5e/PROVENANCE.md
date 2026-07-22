# UR5e asset provenance

CellForge includes a browser-ready UR5e description for virtual-commissioning
research and visualization.

## Upstream model

- Project: `UniversalRobots/Universal_Robots_ROS2_Description`
- Release: `4.3.1`
- Tag commit: `ae333289875f9ba5a9ea6649a54036efb5ccabee`
- Source: <https://github.com/UniversalRobots/Universal_Robots_ROS2_Description/tree/4.3.1>
- License: BSD 3-Clause; retained in `ur_description/LICENSE`

The visual DAE meshes, collision STL meshes, and UR5e configuration files are
retained from that release. CellForge renders the official visual geometry and
keeps the lower-detail collision meshes available for the next BVH milestone.

## Static browser URDF

- Conversion source: `imehsanullah/robotics_arms_web_threejs`
- Source commit: `a28d6620579cee080aa0679e1e1e2904f63878dd`
- Source: <https://github.com/imehsanullah/robotics_arms_web_threejs/tree/a28d6620579cee080aa0679e1e1e2904f63878dd/public/ur_description>

`ur_description/urdf/ur5e.urdf` is the conversion source's static expansion of
the upstream ROS 2 xacro and configuration. It keeps the original mesh paths,
joint origins, axes, and limits so it can load directly in a browser without a
ROS or xacro runtime.

## Product boundary

The asset and joint hierarchy are suitable for product visualization and
engineering-aid checks. They do not make CellForge a certified robot simulator
or validate controller-specific dynamics, calibration, or safety behavior.
