#!/usr/bin/env python3
"""Build the CellForge vertical machining center source and runtime GLB.

Run with:
  blender --background --python scripts/build-cnc-vmc.py

The generated model uses Blender's conventional Z-up coordinate system. The
runtime component rotates the exported Y-up glTF so the machine door faces the
robot at world -X while preserving the existing CellForge machine footprint.
"""

from __future__ import annotations

import math
from pathlib import Path

import bpy


ROOT = Path(__file__).resolve().parents[1]
SOURCE_PATH = ROOT / "assets/cnc/cellforge-vmc.blend"
GLB_PATH = ROOT / "public/machines/cellforge-vmc/cellforge-vmc.glb"


def reset_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.meshes, bpy.data.curves, bpy.data.materials):
        for datablock in list(datablocks):
            if datablock.users == 0:
                datablocks.remove(datablock)


def material(
    name: str,
    color: tuple[float, float, float, float],
    *,
    metallic: float = 0.0,
    roughness: float = 0.45,
    emission: tuple[float, float, float, float] | None = None,
    emission_strength: float = 0.0,
    transmission: float = 0.0,
) -> bpy.types.Material:
    result = bpy.data.materials.new(name)
    result.use_nodes = True
    result.diffuse_color = color
    result.metallic = metallic
    result.roughness = roughness

    principled = result.node_tree.nodes.get("Principled BSDF")
    principled.inputs["Base Color"].default_value = color
    principled.inputs["Metallic"].default_value = metallic
    principled.inputs["Roughness"].default_value = roughness
    if "Alpha" in principled.inputs:
        principled.inputs["Alpha"].default_value = color[3]
    if "Transmission Weight" in principled.inputs:
        principled.inputs["Transmission Weight"].default_value = transmission
    elif "Transmission" in principled.inputs:
        principled.inputs["Transmission"].default_value = transmission

    if emission:
        emission_input = principled.inputs.get("Emission Color") or principled.inputs.get("Emission")
        strength_input = principled.inputs.get("Emission Strength")
        if emission_input:
            emission_input.default_value = emission
        if strength_input:
            strength_input.default_value = emission_strength

    if color[3] < 1:
        result.surface_render_method = "DITHERED"
        result.use_transparency_overlap = False
    return result


def empty(name: str, parent: bpy.types.Object | None = None) -> bpy.types.Object:
    result = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(result)
    result.parent = parent
    return result


def add_box(
    name: str,
    size: tuple[float, float, float],
    location: tuple[float, float, float],
    mat: bpy.types.Material,
    *,
    parent: bpy.types.Object | None = None,
    rotation: tuple[float, float, float] = (0.0, 0.0, 0.0),
    bevel: float = 0.015,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(location=location, rotation=rotation)
    result = bpy.context.active_object
    result.name = name
    result.scale = tuple(axis / 2 for axis in size)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    result.data.materials.append(mat)
    result.parent = parent
    if bevel > 0:
        modifier = result.modifiers.new("EdgeSoftening", "BEVEL")
        modifier.width = bevel
        modifier.segments = 2
        modifier.limit_method = "ANGLE"
        bpy.context.view_layer.objects.active = result
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    return result


def add_cylinder(
    name: str,
    radius: float,
    depth: float,
    location: tuple[float, float, float],
    mat: bpy.types.Material,
    *,
    parent: bpy.types.Object | None = None,
    rotation: tuple[float, float, float] = (0.0, 0.0, 0.0),
    vertices: int = 32,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=depth,
        location=location,
        rotation=rotation,
    )
    result = bpy.context.active_object
    result.name = name
    result.data.materials.append(mat)
    result.parent = parent
    bevel = result.modifiers.new("EdgeSoftening", "BEVEL")
    bevel.width = min(radius * 0.08, 0.01)
    bevel.segments = 2
    bpy.context.view_layer.objects.active = result
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    return result


def build_machine() -> None:
    reset_scene()

    shell_paint = material("ShellPaint", (0.61, 0.67, 0.67, 1), metallic=0.16, roughness=0.31)
    panel_paint = material("PanelPaint", (0.75, 0.79, 0.78, 1), metallic=0.11, roughness=0.36)
    graphite = material("Graphite", (0.055, 0.075, 0.075, 1), metallic=0.28, roughness=0.29)
    cobalt = material("CobaltAccent", (0.025, 0.16, 0.72, 1), metallic=0.12, roughness=0.3)
    dark_steel = material("InteriorSteel", (0.105, 0.135, 0.14, 1), metallic=0.62, roughness=0.25)
    brushed_steel = material("BrushedSteel", (0.46, 0.52, 0.52, 1), metallic=0.78, roughness=0.2)
    rubber = material("Rubber", (0.012, 0.016, 0.016, 1), roughness=0.65)
    glass = material(
        "SafetyGlass",
        (0.055, 0.22, 0.26, 0.22),
        metallic=0.0,
        roughness=0.08,
        transmission=0.25,
    )
    screen = material(
        "ControlScreen",
        (0.025, 0.16, 0.13, 1),
        roughness=0.18,
        emission=(0.035, 0.48, 0.34, 1),
        emission_strength=1.6,
    )
    work_light = material(
        "WorkLight",
        (0.86, 0.93, 0.88, 1),
        roughness=0.25,
        emission=(0.72, 1.0, 0.84, 1),
        emission_strength=3.2,
    )
    amber = material(
        "StackAmber",
        (0.95, 0.31, 0.035, 1),
        roughness=0.2,
        emission=(1.0, 0.16, 0.01, 1),
        emission_strength=2.2,
    )
    green = material(
        "StackGreen",
        (0.04, 0.67, 0.34, 1),
        roughness=0.2,
        emission=(0.01, 1.0, 0.28, 1),
        emission_strength=0.2,
    )
    red = material("EmergencyRed", (0.72, 0.025, 0.015, 1), metallic=0.1, roughness=0.28)

    root = empty("VMC_Root")
    shell = empty("Shell", root)
    interior = empty("InteriorTub", root)
    door = empty("Door", root)
    table = empty("Table", root)
    vise = empty("Vise", root)
    spindle = empty("Spindle", root)
    controls = empty("ControlPanel", root)
    stack = empty("StackLight", root)

    # Full-depth hard-shell enclosure, kept as a distinct hierarchy for cutaway mode.
    add_box("Shell_Base", (1.72, 2.25, 0.24), (0, 0, 0.12), graphite, parent=shell, bevel=0.025)
    add_box("Shell_Left", (0.18, 2.16, 1.86), (-0.77, 0.02, 1.16), shell_paint, parent=shell, bevel=0.035)
    add_box("Shell_Right", (0.18, 2.16, 1.86), (0.77, 0.02, 1.16), shell_paint, parent=shell, bevel=0.035)
    add_box("Shell_Back", (1.42, 0.2, 1.86), (0, 1.02, 1.16), shell_paint, parent=shell, bevel=0.03)
    add_box("Shell_Roof", (1.72, 2.2, 0.18), (0, 0.02, 2.17), graphite, parent=shell, bevel=0.03)
    add_box("Shell_FrontHeader", (1.54, 0.18, 0.32), (0, -1.03, 1.96), panel_paint, parent=shell, bevel=0.025)
    add_box("Shell_FrontApron", (1.54, 0.18, 0.34), (0, -1.03, 0.38), panel_paint, parent=shell, bevel=0.025)
    add_box("Shell_LeftJamb", (0.15, 0.18, 1.3), (-0.695, -1.03, 1.15), shell_paint, parent=shell, bevel=0.018)
    add_box("Shell_RightJamb", (0.15, 0.18, 1.3), (0.695, -1.03, 1.15), shell_paint, parent=shell, bevel=0.018)
    add_box("Shell_Accent", (0.04, 0.205, 1.18), (-0.58, -1.14, 1.15), cobalt, parent=shell, bevel=0.01)

    # Vented side panels make the silhouette read as purpose-built industrial equipment.
    for index in range(8):
        add_box(
            f"Vent_{index + 1:02d}",
            (0.026, 0.42, 0.028),
            (0.872, 0.3, 0.72 + index * 0.07),
            graphite,
            parent=shell,
            bevel=0.005,
        )

    # Interior tub, chip tray, work light, and table.
    add_box("Interior_Back", (1.35, 0.08, 1.25), (0, 0.62, 1.17), dark_steel, parent=interior, bevel=0.01)
    add_box("Interior_Floor", (1.35, 1.45, 0.09), (0, -0.18, 0.59), dark_steel, parent=interior, bevel=0.015)
    add_box("Interior_LeftLiner", (0.07, 1.45, 1.24), (-0.65, -0.18, 1.18), dark_steel, parent=interior, bevel=0.012)
    add_box("Interior_RightLiner", (0.07, 1.45, 1.24), (0.65, -0.18, 1.18), dark_steel, parent=interior, bevel=0.012)
    add_box("Interior_ChipRamp", (1.22, 0.55, 0.08), (0, 0.14, 0.69), brushed_steel, parent=interior, rotation=(math.radians(8), 0, 0), bevel=0.012)
    add_box("Interior_WorkLight", (0.34, 0.045, 0.07), (0, 0.55, 1.74), work_light, parent=interior, bevel=0.01)

    add_box("Table_Bed", (1.14, 0.76, 0.14), (0, -0.4, 0.73), brushed_steel, parent=table, bevel=0.018)
    for index in range(7):
        add_box(
            f"Table_TSlot_{index + 1:02d}",
            (0.035, 0.73, 0.018),
            (-0.45 + index * 0.15, -0.4, 0.81),
            graphite,
            parent=table,
            bevel=0.003,
        )

    # Horizontal receiving chuck: the front half of the blank remains exposed
    # for the robot's radial jaws. Rear chuck pads grip only its last 7 mm.
    add_box("Vise_Base", (0.3, 0.3, 0.12), (0, -0.67, 0.86), graphite, parent=vise)
    add_cylinder("Chuck_Backplate", 0.11, 0.05, (0, -0.755, 1.06), brushed_steel,
                 parent=vise, rotation=(math.pi / 2, 0, 0))
    for index in range(3):
        angle = index * 2 * math.pi / 3
        # Cylindrical pads tangent to the 30 mm blank radius, behind robot fingers.
        add_cylinder(f"Chuck_Jaw_{index}", 0.012, 0.014,
                     (0.042 * math.cos(angle), -0.790, 1.06 + 0.042 * math.sin(angle)),
                     graphite, parent=vise, rotation=(math.pi / 2, 0, 0))

    # Stationary spindle housing plus a separately named rotating spindle/tool node.
    add_box("SpindleHousing", (0.46, 0.36, 0.48), (0, -0.82, 1.61), panel_paint, parent=interior, bevel=0.045)
    spindle.location = (0, -0.82, 1.45)
    add_cylinder("Spindle_Collet", 0.11, 0.18, (0, 0, 0), graphite, parent=spindle)
    add_cylinder("ToolHolder", 0.065, 0.16, (0, 0, -0.16), brushed_steel, parent=spindle)
    add_cylinder("Tool", 0.026, 0.28, (0, 0, -0.36), brushed_steel, parent=spindle, vertices=24)

    # Sliding safety door. Its parent moves along local X in the runtime.
    add_box("Door_Frame_Left", (0.11, 0.07, 1.35), (-0.56, -1.15, 1.18), graphite, parent=door, bevel=0.014)
    add_box("Door_Frame_Right", (0.11, 0.07, 1.35), (0.56, -1.15, 1.18), graphite, parent=door, bevel=0.014)
    add_box("Door_Frame_Top", (1.2, 0.07, 0.11), (0, -1.15, 1.8), graphite, parent=door, bevel=0.014)
    add_box("Door_Frame_Bottom", (1.2, 0.07, 0.11), (0, -1.15, 0.56), graphite, parent=door, bevel=0.014)
    add_box("DoorGlass", (1.03, 0.025, 1.11), (0, -1.155, 1.18), glass, parent=door, bevel=0.006)
    add_box("Door_Handle", (0.04, 0.09, 0.36), (-0.47, -1.23, 1.14), brushed_steel, parent=door, bevel=0.012)

    # Angled operator station on the camera-facing side.
    add_box("Control_Arm", (0.09, 0.48, 0.09), (0.69, -0.88, 1.32), graphite, parent=controls, rotation=(0, 0, math.radians(-18)), bevel=0.015)
    add_box("Control_Body", (0.46, 0.16, 0.62), (0.76, -1.18, 1.38), graphite, parent=controls, rotation=(0, 0, math.radians(-7)), bevel=0.035)
    add_box("ControlScreen", (0.31, 0.025, 0.2), (0.73, -1.275, 1.51), screen, parent=controls, rotation=(0, 0, math.radians(-7)), bevel=0.012)
    for row in range(2):
        for column in range(4):
            button_mat = cobalt if (row + column) % 2 == 0 else panel_paint
            add_cylinder(
                f"Control_Button_{row}_{column}",
                0.025,
                0.025,
                (0.61 + column * 0.075, -1.285, 1.31 - row * 0.075),
                button_mat,
                parent=controls,
                rotation=(math.pi / 2, 0, 0),
                vertices=20,
            )
    add_cylinder("EmergencyStop", 0.055, 0.045, (0.87, -1.29, 1.19), red, parent=controls, rotation=(math.pi / 2, 0, 0), vertices=24)

    # Stack light with independently addressable amber/green lenses.
    add_cylinder("StackLight_Pole", 0.026, 0.35, (0.58, -0.84, 2.38), graphite, parent=stack, vertices=20)
    add_cylinder("StackLight_Amber", 0.072, 0.105, (0.58, -0.84, 2.58), amber, parent=stack, vertices=28)
    add_cylinder("StackLight_Green", 0.072, 0.105, (0.58, -0.84, 2.69), green, parent=stack, vertices=28)

    # Small leveling feet and coolant service details.
    for x in (-0.66, 0.66):
        for y in (-0.82, 0.82):
            add_cylinder(f"Foot_{x}_{y}", 0.075, 0.08, (x, y, 0.02), rubber, parent=root, vertices=24)
    add_cylinder("CoolantPort", 0.06, 0.055, (-0.5, -1.15, 0.39), cobalt, parent=root, rotation=(math.pi / 2, 0, 0), vertices=24)

    for obj in bpy.context.scene.objects:
        if obj.type == "MESH":
            for polygon in obj.data.polygons:
                polygon.use_smooth = False

    bpy.context.scene.unit_settings.system = "METRIC"
    bpy.context.scene.unit_settings.scale_length = 1.0
    bpy.context.scene.render.engine = "BLENDER_EEVEE_NEXT"


def export() -> None:
    SOURCE_PATH.parent.mkdir(parents=True, exist_ok=True)
    GLB_PATH.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE_PATH))
    bpy.ops.export_scene.gltf(
        filepath=str(GLB_PATH),
        export_format="GLB",
        export_apply=True,
        export_materials="EXPORT",
        export_cameras=False,
        export_lights=False,
        export_extras=True,
    )


if __name__ == "__main__":
    build_machine()
    export()
    print(f"Wrote {SOURCE_PATH.relative_to(ROOT)}")
    print(f"Wrote {GLB_PATH.relative_to(ROOT)}")
