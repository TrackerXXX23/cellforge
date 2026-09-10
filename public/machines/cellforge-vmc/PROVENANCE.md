# CellForge VMC asset provenance

## Ownership and purpose

- Asset: `cellforge-vmc.glb`
- Source: `assets/cnc/cellforge-vmc.blend`
- Generator: `scripts/build-cnc-vmc.py`
- Author: CellForge project
- Third-party model geometry or textures: none

This is a representative vertical machining center authored for the CellForge
virtual-commissioning workbench. It is not a replica of, or endorsed by, a
machine-tool manufacturer.

## Runtime contract

The browser asset preserves the existing Machine 01 footprint: 2.25 m deep,
2.26 m enclosure height, and 1.72 m wide. The glTF is authored in Blender's
Z-up coordinate system and rotated by the runtime so the door faces world -X.

The runtime depends on these named nodes:

- `VMC_Root`
- `Shell`
- `Door` and `DoorGlass`
- `InteriorTub`
- `Table`
- `Vise`
- `Spindle` and `Tool`
- `ControlPanel`
- `StackLight`, `StackLight_Amber`, and `StackLight_Green`

The legacy `Vise` group now holds a horizontal receiving chuck. Its rear pads
contact the back 7 mm of the blank; the front remains accessible to the robot.
The door travels 1.3 m to clear the aperture, and the spindle retracts during
loading and unloading.

The machine component animates `Door`, `Spindle`, and the stack-light lenses
from existing deterministic process state. Robot targets, kinematics, motion
timing, and clearance logic are intentionally outside this asset package.

## Rebuild

With Blender available on `PATH`, run:

```bash
blender --background --python scripts/build-cnc-vmc.py
```

The command regenerates both the editable `.blend` source and the optimized
runtime GLB. Asset tests enforce the node contract, a 100,000-triangle ceiling,
and a 5 MB runtime size ceiling.

## Engineering limitation

This visual asset is aligned with the commissioning envelope, but it is not a
certified collision body or a machining-process simulation. Safety decisions
must continue to use validated engineering data outside the render model.
