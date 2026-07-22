# UR20 asset provenance

CellForge includes a browser-ready UR20 description for virtual-commissioning
research and visualization.

## Upstream model

- Project: `UniversalRobots/Universal_Robots_ROS2_Description`
- Package version: `4.3.1`
- Source commit: `89bbe795f38a7ab00fb66fe8831dfff79dc99edf`
- Source: <https://github.com/UniversalRobots/Universal_Robots_ROS2_Description/tree/89bbe795f38a7ab00fb66fe8831dfff79dc99edf>
- Robot-description license: BSD 3-Clause, retained in `ur_description/LICENSE`
- UR20 graphical-documentation terms: retained in `ur_description/meshes/ur20/LICENSE.txt`

The visual DAE meshes, collision STL meshes, UR20 configuration files, and
their license terms are retained from that source. CellForge renders the
official visual geometry and keeps the collision meshes with the browser asset.

## Static browser URDF

`ur_description/urdf/ur20.urdf` is a static expansion of the upstream
`urdf/ur.urdf.xacro` with `ur_type:=ur20`. It keeps the upstream mesh paths,
joint origins, axes, and limits so it can load directly without ROS or xacro.

## Product boundary

The asset and joint hierarchy are suitable for product visualization and
engineering-aid checks. They do not make CellForge a certified robot simulator
or validate controller-specific dynamics, calibration, or safety behavior.

© 2023 Universal Robots A/S. Use hereof is subject to Universal Robots A/S’
Terms and Conditions for Use of Graphical Documentation.
