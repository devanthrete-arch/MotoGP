"""Builds a showroom car in Blender from a profile spec, to the model spec in docs/SHOWROOM_MODELS.md.

  blender --background --factory-startup --python scripts/blender/build_car.py -- <car-id> <out.glb> [--level 2] [--blend out.blend]

--level is the body's subdivision level: 2 for the full model, 1 for the light one.
Blender axes: X forward, Y to the car's left, Z up. The glTF exporter turns Z-up into Y-up, so the
front still faces +X and the right-hand side ends up on +Z, as the spec asks.

The body is one low-poly cage lofted through cross-sections (rocker, door, shoulder, belt, glass,
roof), mirrored and smoothed with a subdivision surface; the windows are faces of the same surface,
so pillars, glass and roof meet flush. Wheel arches and door shut lines are boolean cuts. Lamps,
grille, intakes and plates are traced onto the finished body by casting rays at it.
"""
import math
import sys

import bmesh
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

# --------------------------------------------------------------------------------------------
# Specs. Heights in metres; positions along the car as u = x / length, from -0.5 (tail) to 0.5 (nose).
# Front-view outlines are (y, z): y across the car from the centre line (left side; mirrored).

SPECS = {
    "maruti-baleno": {
        "length": 3.99, "width": 1.745, "wheelbase": 2.52, "front_overhang": 0.80,
        "tyre_radius": 0.305, "tyre_width": 0.195, "rim_radius": 0.205, "spokes": 5,
        "ground_clearance": 0.17,
        # Bottom edge of the body: bumpers rise at both ends.
        "bottom": [(-0.5, 0.36), (-0.45, 0.22), (-0.38, 0.17), (0.38, 0.17), (0.45, 0.2), (0.5, 0.24)],
        # Belt line (top of the doors, the bonnet at the front, the tailgate at the back).
        "belt": [(-0.5, 0.92), (-0.47, 1.04), (-0.4, 1.08), (-0.3, 1.04), (-0.15, 1.0), (0.0, 0.98), (0.2, 0.93),
                 (0.34, 0.88), (0.44, 0.82), (0.48, 0.77), (0.5, 0.73)],
        # Roof centre line, running down the windscreen at the front and the hatch glass at the back.
        # The windscreen starts behind the front wheel, under a long bonnet; the roof peaks over the
        # front seats and falls away to the hatch.
        "roof": [(-0.47, 1.06), (-0.45, 1.18), (-0.4, 1.31), (-0.3, 1.4), (-0.18, 1.46), (-0.06, 1.49),
                 (0.0, 1.485), (0.06, 1.44), (0.24, 0.92)],
        "glass_front": 0.24, "glass_rear": -0.47,      # where the glasshouse meets the body
        "roof_front": 0.0, "roof_rear": -0.41,         # windscreen top and hatch-glass top
        "b_pillar": -0.11, "c_pillar": -0.3, "quarter_end": -0.41,
        "glass_inset": 0.06, "tumblehome": 0.17,       # how far the glass sits in, and leans in
        "nose_start": 0.32, "nose_taper": 0.62, "tail_start": 0.4, "tail_taper": 0.38,
        "nose_rake": 0.1, "tail_rake": 0.06, "shoulder_drop": 0.1,
        "nose_sweep": 0.13, "tail_sweep": 0.05,        # corners swept back: a V-shaped nose in plan
        "door_lines": [0.17, -0.105, -0.32],           # front of front door, B-pillar, back of rear door
        "handles": [-0.06, -0.28],                     # near the back of each door
        "paint": (0.12, 0.24, 0.55),                   # Nexa Blue
        "front": {
            # Large swept lamps tucked under the bonnet's edge, wrapping round the swept-back corners.
            "lamp": [(0.34, 0.66), (0.45, 0.705), (0.58, 0.735), (0.7, 0.75), (0.8, 0.74), (0.83, 0.68),
                     (0.73, 0.64), (0.57, 0.625), (0.42, 0.628)],
            # Chrome projector units inside the lamp: (y, z, radius).
            "projectors": [(0.5, 0.682, 0.028), (0.63, 0.698, 0.026)],
            # The three-element light strip along the lamp's lower edge, rising outward.
            "drl": [[(0.43, 0.642), (0.52, 0.641), (0.52, 0.652), (0.43, 0.653)],
                    [(0.55, 0.643), (0.64, 0.647), (0.64, 0.658), (0.55, 0.654)],
                    [(0.67, 0.652), (0.76, 0.664), (0.76, 0.675), (0.67, 0.663)]],
            "grille": [(0.0, 0.615), (0.36, 0.615), (0.39, 0.585), (0.35, 0.475), (0.26, 0.45), (0.0, 0.445)],
            # Upper chrome bar rises into the lamps' inner ends; a second bar lower down.
            "chrome": [[(0.0, 0.598), (0.36, 0.6), (0.455, 0.628), (0.445, 0.648), (0.35, 0.624), (0.0, 0.622)],
                       [(0.0, 0.548), (0.36, 0.548), (0.37, 0.566), (0.0, 0.566)]],
            "intake": [(0.0, 0.38), (0.47, 0.38), (0.53, 0.34), (0.49, 0.27), (0.0, 0.27)],
            "fog_pod": [(0.55, 0.39), (0.68, 0.41), (0.69, 0.31), (0.57, 0.29)],
            "fog_chrome": [(0.54, 0.4), (0.69, 0.42), (0.7, 0.408), (0.555, 0.39)],
            "fog": (0.62, 0.35, 0.028),
            "plate": [(0.0, 0.33), (0.26, 0.33), (0.26, 0.435), (0.0, 0.435)],
            # Honeycomb-like mesh: short staggered bars, kept clear of the lower chrome bar.
            "pattern": {"kind": "mesh", "dash": 0.045, "pitch": 0.06, "thick": 0.009, "row": 0.022,
                        "skip": [(0.535, 0.57)]},
        },
        "rear": {
            "lamp": [(0.46, 0.94), (0.62, 0.96), (0.76, 0.955), (0.8, 0.92), (0.79, 0.85), (0.64, 0.84), (0.5, 0.87)],
            "lamp_inner": [(0.55, 0.915), (0.72, 0.925), (0.74, 0.9), (0.57, 0.89)],
            "chrome": [[(0.0, 0.875), (0.46, 0.875), (0.46, 0.89), (0.0, 0.89)]],
            "plate": [(0.0, 0.6), (0.26, 0.6), (0.26, 0.71), (0.0, 0.71)],
            "bumper": [(0.0, 0.36), (0.74, 0.37), (0.8, 0.45), (0.0, 0.43)],
        },
    },

    # Compact SUV: tiger-nose grille with a silver "smile", light strips turning down the bumper
    # corners, a big lower grille in a silver skid frame, black pillars, rails and cladding.
    "kia-sonet": {
        "length": 3.995, "width": 1.79, "wheelbase": 2.5, "front_overhang": 0.82,
        "tyre_radius": 0.332, "tyre_width": 0.215, "rim_radius": 0.203, "spokes": 5,
        "ground_clearance": 0.205,
        "bottom": [(-0.5, 0.46), (-0.45, 0.26), (-0.38, 0.205), (0.38, 0.205), (0.45, 0.28), (0.5, 0.34)],
        "belt": [(-0.5, 1.0), (-0.47, 1.1), (-0.4, 1.13), (-0.32, 1.12), (-0.15, 1.08), (0.0, 1.06), (0.18, 1.03),
                 (0.3, 0.99), (0.42, 0.95), (0.48, 0.92), (0.5, 0.88)],
        # The rear glass rakes forward and the roof eases down towards it.
        "roof": [(-0.485, 1.1), (-0.46, 1.33), (-0.43, 1.48), (-0.39, 1.55), (-0.25, 1.59), (-0.1, 1.61), (0.0, 1.6),
                 (0.05, 1.57), (0.22, 1.05)],
        "glass_front": 0.22, "glass_rear": -0.485, "roof_front": 0.03, "roof_rear": -0.41,
        "b_pillar": -0.1, "c_pillar": -0.3, "quarter_end": -0.42,
        "glass_inset": 0.05, "tumblehome": 0.12,
        "nose_start": 0.34, "nose_taper": 0.42, "tail_start": 0.42, "tail_taper": 0.3,
        "nose_rake": 0.1, "tail_rake": 0.04, "shoulder_drop": 0.1, "nose_sweep": 0.08, "tail_sweep": 0.03,
        "door_lines": [0.16, -0.095, -0.3], "handles": [-0.05, -0.27], "cladding_width": 0.08,
        "dlo_taper": (-0.22, -0.42, 0.13),
        "paint": (0.5, 0.04, 0.06), "mirror": "GlossBlack", "cladding": True, "roof_rails": "black",
        "aerial_u": -0.36,
        "front": {
            "grille": [(0.0, 0.775), (0.15, 0.785), (0.32, 0.8), (0.42, 0.79), (0.44, 0.735), (0.38, 0.68),
                       (0.15, 0.69), (0.0, 0.705)],
            "pattern": {"kind": "mesh", "dash": 0.06, "pitch": 0.075, "thick": 0.012, "row": 0.026, "material": "Silver"},
            "silver": [[(0.0, 0.65), (0.3, 0.645), (0.44, 0.657), (0.5, 0.675), (0.5, 0.69), (0.44, 0.672), (0.3, 0.66), (0.0, 0.665)],
                       [(0.0, 0.385), (0.54, 0.39), (0.6, 0.49), (0.58, 0.5), (0.5, 0.41), (0.0, 0.41)]],
            "lamp": [(0.44, 0.8), (0.58, 0.83), (0.74, 0.84), (0.82, 0.82), (0.8, 0.78), (0.62, 0.76), (0.46, 0.75)],
            "drl": [[(0.47, 0.742), (0.62, 0.752), (0.79, 0.772), (0.79, 0.785), (0.62, 0.765), (0.47, 0.755)],
                    [(0.775, 0.62), (0.79, 0.62), (0.815, 0.78), (0.8, 0.78)]],
            "intake": [(0.0, 0.6), (0.5, 0.6), (0.55, 0.52), (0.5, 0.42), (0.0, 0.42)],
            "intake_pattern": {"kind": "mesh", "dash": 0.06, "pitch": 0.075, "thick": 0.012, "row": 0.03, "material": "Trim"},
            "fog_pod": [(0.64, 0.6), (0.76, 0.62), (0.76, 0.5), (0.64, 0.5)],
            "fog": (0.7, 0.56, 0.024),
            "plate": [(0.0, 0.555), (0.26, 0.555), (0.26, 0.66), (0.0, 0.66)],
        },
        "rear": {
            "lamp": [(0.45, 1.02), (0.78, 1.03), (0.82, 0.98), (0.8, 0.92), (0.62, 0.93), (0.45, 0.96)],
            "lamp_inner": [(0.55, 1.0), (0.76, 1.01), (0.78, 0.99), (0.56, 0.985)],
            "bar": [(0.0, 0.985), (0.46, 0.985), (0.46, 0.997), (0.0, 0.997)],
            "silver": [[(0.0, 0.47), (0.5, 0.48), (0.5, 0.5), (0.0, 0.495)]],
            "plate": [(0.0, 0.64), (0.26, 0.64), (0.26, 0.75), (0.0, 0.75)],
            "bumper": [(0.0, 0.46), (0.8, 0.48), (0.84, 0.6), (0.0, 0.58)],
        },
    },

    # Mid-size SUV: huge upright grille with dashed bars, chrome bar lamp to lamp, slim lamps,
    # triangular corner intakes, silver skid plate, black roof, cladding, silver rails.
    "honda-elevate": {
        "length": 4.312, "width": 1.79, "wheelbase": 2.65, "front_overhang": 0.87,
        "tyre_radius": 0.336, "tyre_width": 0.215, "rim_radius": 0.216, "spokes": 8,
        "ground_clearance": 0.22,
        "bottom": [(-0.5, 0.48), (-0.45, 0.28), (-0.38, 0.22), (0.38, 0.22), (0.45, 0.3), (0.5, 0.36)],
        "belt": [(-0.5, 1.02), (-0.47, 1.12), (-0.4, 1.14), (-0.2, 1.12), (0.0, 1.1), (0.2, 1.07), (0.32, 1.03),
                 (0.44, 1.0), (0.49, 0.97), (0.5, 0.93)],
        "roof": [(-0.485, 1.14), (-0.465, 1.48), (-0.43, 1.58), (-0.25, 1.62), (0.0, 1.62), (0.06, 1.6), (0.22, 1.08)],
        "glass_front": 0.22, "glass_rear": -0.485, "roof_front": 0.04, "roof_rear": -0.44,
        "b_pillar": -0.08, "c_pillar": -0.3, "quarter_end": -0.42,
        "glass_inset": 0.05, "tumblehome": 0.12,
        "nose_start": 0.36, "nose_taper": 0.36, "tail_start": 0.42, "tail_taper": 0.3,
        "nose_rake": 0.04, "tail_rake": 0.04, "shoulder_drop": 0.11, "nose_sweep": 0.06, "tail_sweep": 0.03,
        "door_lines": [0.16, -0.075, -0.3], "handles": [-0.03, -0.27], "dlo_taper": (-0.26, -0.43, 0.08),
        "paint": (0.75, 0.22, 0.06), "mirror": "GlossBlack", "black_roof": True, "cladding": True, "roof_rails": "silver",
        "aerial_u": -0.36,
        "front": {
            "grille": [(0.0, 0.82), (0.4, 0.82), (0.44, 0.78), (0.44, 0.6), (0.4, 0.55), (0.0, 0.55)],
            "pattern": {"kind": "dashes", "dash": 0.09, "pitch": 0.12, "thick": 0.012, "row": 0.034, "material": "Trim"},
            "chrome": [[(0.0, 0.832), (0.5, 0.838), (0.62, 0.858), (0.62, 0.874), (0.5, 0.854), (0.0, 0.848)]],
            "silver": [[(0.0, 0.36), (0.55, 0.37), (0.62, 0.44), (0.6, 0.45), (0.53, 0.39), (0.0, 0.385)]],
            "lamp": [(0.46, 0.83), (0.62, 0.85), (0.8, 0.855), (0.84, 0.82), (0.8, 0.79), (0.6, 0.79), (0.47, 0.8)],
            "drl": [[(0.52, 0.826), (0.8, 0.84), (0.8, 0.85), (0.52, 0.837)]],
            "intake": [(0.0, 0.52), (0.5, 0.52), (0.55, 0.46), (0.5, 0.41), (0.0, 0.41)],
            "fog_pod": [(0.6, 0.62), (0.78, 0.66), (0.78, 0.5), (0.68, 0.5)],
            "fog": (0.71, 0.57, 0.024),
            "plate": [(0.0, 0.44), (0.26, 0.44), (0.26, 0.545), (0.0, 0.545)],
        },
        "rear": {
            "lamp": [(0.5, 1.03), (0.8, 1.04), (0.84, 0.98), (0.82, 0.94), (0.6, 0.96), (0.5, 0.98)],
            "lamp_inner": [(0.6, 1.015), (0.79, 1.022), (0.8, 1.0), (0.6, 0.995)],
            "bar": [(0.0, 1.0), (0.5, 1.0), (0.5, 1.014), (0.0, 1.014)],
            "silver": [[(0.0, 0.48), (0.5, 0.49), (0.5, 0.51), (0.0, 0.505)]],
            "plate": [(0.0, 0.65), (0.26, 0.65), (0.26, 0.76), (0.0, 0.76)],
            "bumper": [(0.0, 0.48), (0.8, 0.5), (0.84, 0.62), (0.0, 0.6)],
        },
    },

    # Large SUV: grille full of vertical chrome slats, angular lamps at its corners, "dagger" lights
    # dropping down the bumper, floating black rear pillar, chrome window line.
    "mahindra-xuv700": {
        "length": 4.695, "width": 1.89, "wheelbase": 2.75, "front_overhang": 0.95,
        "tyre_radius": 0.37, "tyre_width": 0.235, "rim_radius": 0.229, "spokes": 5,
        "ground_clearance": 0.2,
        "bottom": [(-0.5, 0.5), (-0.45, 0.28), (-0.38, 0.2), (0.38, 0.2), (0.45, 0.3), (0.5, 0.36)],
        "belt": [(-0.5, 1.06), (-0.47, 1.16), (-0.4, 1.19), (-0.2, 1.17), (0.0, 1.15), (0.2, 1.11), (0.32, 1.07),
                 (0.44, 1.03), (0.49, 1.0), (0.5, 0.96)],
        "roof": [(-0.485, 1.2), (-0.465, 1.56), (-0.43, 1.66), (-0.25, 1.71), (-0.05, 1.72), (0.04, 1.7), (0.22, 1.12)],
        "glass_front": 0.22, "glass_rear": -0.485, "roof_front": 0.02, "roof_rear": -0.44,
        "b_pillar": -0.07, "c_pillar": -0.29, "quarter_end": -0.43,
        "glass_inset": 0.05, "tumblehome": 0.12,
        "nose_start": 0.36, "nose_taper": 0.36, "tail_start": 0.42, "tail_taper": 0.32,
        "nose_rake": 0.06, "tail_rake": 0.04, "shoulder_drop": 0.11, "nose_sweep": 0.07, "tail_sweep": 0.03,
        "door_lines": [0.15, -0.065, -0.29], "handles": [-0.02, -0.26], "dlo_taper": (-0.26, -0.44, 0.09),
        "paint": (0.06, 0.08, 0.2), "mirror": "GlossBlack", "handle": "Paint", "black_rear_pillar": True,
        "chrome_belt": True, "cladding": True, "roof_rails": "black", "aerial_u": -0.36,
        "front": {
            "grille": [(0.0, 0.86), (0.42, 0.86), (0.46, 0.82), (0.44, 0.58), (0.38, 0.54), (0.0, 0.54)],
            # Satin, not mirror chrome: a mirror reflects the dark studio and the slats vanish.
            "pattern": {"kind": "vbars", "pitch": 0.058, "thick": 0.02, "material": "Silver"},
            "silver": [[(0.0, 0.37), (0.5, 0.375), (0.56, 0.41), (0.0, 0.41)]],
            "lamp": [(0.46, 0.86), (0.62, 0.88), (0.8, 0.88), (0.86, 0.85), (0.84, 0.81), (0.62, 0.8), (0.47, 0.81)],
            "drl": [[(0.79, 0.56), (0.82, 0.56), (0.83, 0.82), (0.8, 0.82)],
                    [(0.72, 0.552), (0.82, 0.552), (0.82, 0.565), (0.72, 0.565)],
                    [(0.5, 0.815), (0.8, 0.826), (0.8, 0.836), (0.5, 0.825)]],
            "intake": [(0.0, 0.5), (0.55, 0.5), (0.6, 0.42), (0.0, 0.42)],
            "fog_pod": [(0.62, 0.52), (0.78, 0.52), (0.78, 0.43), (0.62, 0.43)],
            "fog": (0.7, 0.475, 0.024),
            "plate": [(0.0, 0.43), (0.26, 0.43), (0.26, 0.535), (0.0, 0.535)],
        },
        "rear": {
            "lamp": [(0.6, 1.08), (0.82, 1.08), (0.86, 1.02), (0.85, 0.94), (0.7, 0.94), (0.6, 1.0)],
            "lamp_inner": [(0.66, 1.06), (0.82, 1.062), (0.84, 1.02), (0.8, 1.02), (0.79, 1.045), (0.66, 1.045)],
            "chrome": [[(0.0, 1.0), (0.6, 1.0), (0.6, 1.016), (0.0, 1.016)]],
            "silver": [[(0.0, 0.5), (0.5, 0.51), (0.5, 0.53), (0.0, 0.525)]],
            "plate": [(0.0, 0.68), (0.26, 0.68), (0.26, 0.79), (0.0, 0.79)],
            "bumper": [(0.0, 0.5), (0.84, 0.52), (0.88, 0.64), (0.0, 0.62)],
        },
    },

    # Sedan: long flat bonnet, slim chrome grille joining sleek lamps, wide lower intake with chrome
    # flank lines and fog lamps, fast rear glass to a short high boot, chrome window line.
    "vw-virtus": {
        "length": 4.561, "width": 1.752, "wheelbase": 2.651, "front_overhang": 0.88,
        "tyre_radius": 0.316, "tyre_width": 0.205, "rim_radius": 0.203, "spokes": 5,
        "ground_clearance": 0.179,
        "bottom": [(-0.5, 0.38), (-0.45, 0.22), (-0.38, 0.179), (0.38, 0.179), (0.45, 0.21), (0.5, 0.25)],
        "belt": [(-0.5, 0.94), (-0.46, 1.0), (-0.38, 1.01), (-0.3, 1.0), (-0.15, 0.98), (0.0, 0.96), (0.2, 0.92),
                 (0.32, 0.88), (0.44, 0.81), (0.48, 0.77), (0.5, 0.74)],
        "roof": [(-0.335, 1.0), (-0.24, 1.3), (-0.14, 1.44), (-0.02, 1.5), (0.06, 1.49), (0.12, 1.43), (0.25, 0.93)],
        "glass_front": 0.25, "glass_rear": -0.335, "roof_front": 0.06, "roof_rear": -0.16,
        "b_pillar": -0.06, "c_pillar": -0.25, "quarter_end": -0.28,
        "glass_inset": 0.06, "tumblehome": 0.18,
        "nose_start": 0.33, "nose_taper": 0.6, "tail_start": 0.4, "tail_taper": 0.45,
        "nose_rake": 0.1, "tail_rake": 0.06, "shoulder_drop": 0.11, "nose_sweep": 0.12, "tail_sweep": 0.05,
        "door_lines": [0.2, -0.055, -0.255], "handles": [-0.01, -0.21],
        "sedan": True, "paint": (0.12, 0.17, 0.35), "chrome_belt": True, "spoiler": False, "aerial_u": -0.08,
        "front": {
            "grille": [(0.0, 0.66), (0.32, 0.66), (0.34, 0.63), (0.3, 0.61), (0.0, 0.61)],
            "chrome": [[(0.0, 0.642), (0.74, 0.655), (0.74, 0.667), (0.0, 0.654)],
                       [(0.6, 0.345), (0.64, 0.345), (0.58, 0.46), (0.54, 0.46)]],
            "lamp": [(0.34, 0.67), (0.5, 0.685), (0.68, 0.69), (0.8, 0.67), (0.8, 0.63), (0.66, 0.615), (0.48, 0.61), (0.34, 0.62)],
            "projectors": [(0.5, 0.652, 0.021), (0.62, 0.655, 0.021)],
            "drl": [[(0.36, 0.61), (0.66, 0.612), (0.78, 0.625), (0.78, 0.635), (0.66, 0.622), (0.36, 0.62)]],
            "intake": [(0.0, 0.47), (0.5, 0.47), (0.56, 0.42), (0.52, 0.3), (0.0, 0.3)],
            "intake_pattern": {"kind": "mesh", "dash": 0.04, "pitch": 0.055, "thick": 0.01, "row": 0.022, "material": "Trim"},
            "fog_pod": [(0.6, 0.46), (0.72, 0.47), (0.72, 0.34), (0.6, 0.34)],
            "fog": (0.66, 0.4, 0.023),
            "plate": [(0.0, 0.48), (0.26, 0.48), (0.26, 0.585), (0.0, 0.585)],
        },
        "rear": {
            "lamp": [(0.44, 0.98), (0.62, 0.99), (0.8, 0.97), (0.82, 0.92), (0.62, 0.91), (0.44, 0.93)],
            "lamp_inner": [(0.5, 0.965), (0.78, 0.958), (0.79, 0.94), (0.5, 0.948)],
            "chrome": [[(0.0, 0.945), (0.44, 0.945), (0.44, 0.958), (0.0, 0.958)]],
            "plate": [(0.0, 0.6), (0.26, 0.6), (0.26, 0.71), (0.0, 0.71)],
            "bumper": [(0.0, 0.38), (0.78, 0.4), (0.82, 0.48), (0.0, 0.46)],
        },
    },

    # Compact sedan: big octagonal mesh grille under a thick chrome bar into slim LED lamps, black
    # corner intakes, fairly upright nose, short boot.
    "honda-amaze": {
        "length": 3.995, "width": 1.733, "wheelbase": 2.47, "front_overhang": 0.8,
        "tyre_radius": 0.302, "tyre_width": 0.185, "rim_radius": 0.19, "spokes": 6,
        "ground_clearance": 0.172,
        "bottom": [(-0.5, 0.38), (-0.45, 0.22), (-0.38, 0.172), (0.38, 0.172), (0.45, 0.21), (0.5, 0.25)],
        "belt": [(-0.5, 0.94), (-0.46, 1.0), (-0.38, 1.01), (-0.3, 1.0), (-0.15, 0.98), (0.0, 0.96), (0.2, 0.93),
                 (0.32, 0.9), (0.44, 0.85), (0.48, 0.81), (0.5, 0.78)],
        "roof": [(-0.335, 1.0), (-0.25, 1.28), (-0.14, 1.44), (-0.02, 1.49), (0.05, 1.48), (0.11, 1.43), (0.24, 0.94)],
        "glass_front": 0.24, "glass_rear": -0.335, "roof_front": 0.05, "roof_rear": -0.15,
        "b_pillar": -0.05, "c_pillar": -0.24, "quarter_end": -0.27,
        "glass_inset": 0.06, "tumblehome": 0.18,
        "nose_start": 0.34, "nose_taper": 0.5, "tail_start": 0.4, "tail_taper": 0.42,
        "nose_rake": 0.07, "tail_rake": 0.06, "shoulder_drop": 0.1, "nose_sweep": 0.1, "tail_sweep": 0.05,
        "door_lines": [0.19, -0.045, -0.245], "handles": [0.0, -0.2],
        "sedan": True, "paint": (0.55, 0.08, 0.1), "spoiler": False, "aerial_u": -0.07,
        "front": {
            "grille": [(0.0, 0.7), (0.3, 0.7), (0.36, 0.66), (0.36, 0.52), (0.3, 0.47), (0.0, 0.47)],
            "pattern": {"kind": "mesh", "dash": 0.035, "pitch": 0.05, "thick": 0.012, "row": 0.024, "material": "Trim"},
            "chrome": [[(0.0, 0.715), (0.42, 0.72), (0.5, 0.735), (0.5, 0.75), (0.42, 0.737), (0.0, 0.732)]],
            "lamp": [(0.42, 0.74), (0.58, 0.765), (0.76, 0.77), (0.82, 0.74), (0.78, 0.7), (0.6, 0.695), (0.44, 0.71)],
            "drl": [[(0.5, 0.735), (0.76, 0.75), (0.76, 0.76), (0.5, 0.745)]],
            "intake": [(0.0, 0.4), (0.4, 0.4), (0.45, 0.33), (0.0, 0.32)],
            "fog_pod": [(0.56, 0.48), (0.7, 0.5), (0.7, 0.36), (0.58, 0.34)],
            "fog": (0.63, 0.42, 0.022),
            "plate": [(0.0, 0.38), (0.26, 0.38), (0.26, 0.485), (0.0, 0.485)],
        },
        "rear": {
            "lamp": [(0.44, 0.99), (0.64, 1.0), (0.8, 0.98), (0.82, 0.92), (0.66, 0.91), (0.46, 0.94)],
            "lamp_inner": [(0.52, 0.975), (0.76, 0.975), (0.78, 0.93), (0.74, 0.93), (0.73, 0.96), (0.52, 0.96)],
            "chrome": [[(0.0, 0.955), (0.44, 0.955), (0.44, 0.968), (0.0, 0.968)]],
            "plate": [(0.0, 0.6), (0.26, 0.6), (0.26, 0.71), (0.0, 0.71)],
            "bumper": [(0.0, 0.38), (0.78, 0.4), (0.82, 0.48), (0.0, 0.46)],
        },
    },
}

# --------------------------------------------------------------------------------------------


def smooth_curve(points):
    """Monotone cubic through (u, value) points: never overshoots."""
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    n = len(xs)
    d = [(ys[k + 1] - ys[k]) / (xs[k + 1] - xs[k]) for k in range(n - 1)]
    m = [d[0]] + [0 if d[k - 1] * d[k] <= 0 else (d[k - 1] + d[k]) / 2 for k in range(1, n - 1)] + [d[-1]]
    for k in range(n - 1):
        if d[k] == 0:
            m[k] = m[k + 1] = 0
            continue
        a, b = m[k] / d[k], m[k + 1] / d[k]
        s = a * a + b * b
        if s > 9:
            t = 3 / math.sqrt(s)
            m[k], m[k + 1] = t * a * d[k], t * b * d[k]

    def f(x):
        if x <= xs[0]:
            return ys[0]
        if x >= xs[-1]:
            return ys[-1]
        k = 0
        while x > xs[k + 1]:
            k += 1
        h = xs[k + 1] - xs[k]
        t = (x - xs[k]) / h
        t2, t3 = t * t, t * t * t
        return ((2 * t3 - 3 * t2 + 1) * ys[k] + (t3 - 2 * t2 + t) * h * m[k]
                + (-2 * t3 + 3 * t2) * ys[k + 1] + (t3 - t2) * h * m[k + 1])
    return f


def smoothstep(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def lerp(a, b, t):
    return a + (b - a) * t


# --------------------------------------------------------------------------------------------
# Materials, named as the model spec requires.

def principled(name, color, metallic=0.0, roughness=0.5, coat=0.0, emission=None, strength=0.0, alpha=1.0):
    mat = bpy.data.materials.new(name)
    try:
        mat.use_nodes = True
    except AttributeError:
        pass
    bsdf = next(node for node in mat.node_tree.nodes if node.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    if coat:
        bsdf.inputs["Coat Weight"].default_value = coat
        bsdf.inputs["Coat Roughness"].default_value = 0.05
    if emission:
        bsdf.inputs["Emission Color"].default_value = (*emission, 1)
        bsdf.inputs["Emission Strength"].default_value = strength
    if alpha < 1:
        bsdf.inputs["Alpha"].default_value = alpha
        try:
            mat.surface_render_method = "BLENDED"
        except AttributeError:
            mat.blend_method = "BLEND"
    return mat


def make_materials(spec):
    return {
        "Paint": principled("Paint", spec["paint"], metallic=0.6, roughness=0.32, coat=1.0),
        "Glass": principled("Glass", (0.008, 0.011, 0.014), metallic=0.0, roughness=0.03, alpha=0.82),
        "Trim": principled("Trim", (0.025, 0.027, 0.03), roughness=0.6),
        "GlossBlack": principled("GlossBlack", (0.008, 0.009, 0.01), roughness=0.12, coat=1.0),
        "Chrome": principled("Chrome", (0.9, 0.91, 0.93), metallic=1.0, roughness=0.12),
        "Silver": principled("Silver", (0.72, 0.74, 0.76), metallic=0.7, roughness=0.32),
        "Tyre": principled("Tyre", (0.03, 0.03, 0.032), roughness=0.9),
        # Machined alloy: not a mirror, so it stays bright in a dark studio.
        "Rim": principled("Rim", (0.9, 0.91, 0.92), metallic=0.65, roughness=0.3),
        "RimDark": principled("RimDark", (0.06, 0.065, 0.07), metallic=0.6, roughness=0.35),
        "Disc": principled("Disc", (0.35, 0.36, 0.37), metallic=0.9, roughness=0.45),
        "Headlamp": principled("Headlamp", (0.12, 0.13, 0.15), metallic=0.8, roughness=0.08, coat=1.0),
        "DRL": principled("DRL", (1, 1, 1), emission=(0.92, 0.95, 1.0), strength=6.0),
        # A dark red lens, and the brighter LED signature inside it.
        "Taillamp": principled("Taillamp", (0.22, 0.01, 0.015), roughness=0.1, coat=1.0, emission=(1.0, 0.05, 0.06), strength=0.6),
        "TaillampLED": principled("TaillampLED", (1.0, 0.1, 0.1), emission=(1.0, 0.08, 0.08), strength=5.0),
        "Plate": principled("Plate", (0.85, 0.85, 0.82), roughness=0.6),
        "Interior": principled("Interior", (0.05, 0.05, 0.055), roughness=0.8),
    }


def link(obj):
    bpy.context.scene.collection.objects.link(obj)
    return obj


def mesh_object(name, bm, material):
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = link(bpy.data.objects.new(name, mesh))
    obj.data.materials.append(material)
    return obj


# --------------------------------------------------------------------------------------------
# Body.

def build_body(spec, mats, level):
    L, W = spec["length"], spec["width"]
    bottom, belt, roof = (smooth_curve(spec[key]) for key in ("bottom", "belt", "roof"))
    gf, gr = spec["glass_front"], spec["glass_rear"]

    def half_width(u):
        if u > spec["nose_start"]:
            e = (u - spec["nose_start"]) / (0.5 - spec["nose_start"])
            return W / 2 * math.sqrt(max(0.05, 1 - e * e * spec["nose_taper"]))
        if u < -spec["tail_start"]:
            e = (-u - spec["tail_start"]) / (0.5 - spec["tail_start"])
            return W / 2 * math.sqrt(max(0.05, 1 - e * e * spec["tail_taper"]))
        return W / 2

    # Sections along the car: dense where the shape changes fast.
    us = sorted(set([round(-0.5 + i / 64, 5) for i in range(65)]
                    # Extra sections at the nose and tail, where the shape turns fastest.
                    + [round(0.42 + i * 0.08 / 10, 5) for i in range(11)]
                    + [round(-0.5 + i * 0.06 / 6, 5) for i in range(7)]))

    def dlo_drop(u):
        """How far the window's top edge drops below the roof towards the rear: a tapering quarter
        window under a thick rear pillar. (start, end, drop) in the spec; none by default."""
        if "dlo_taper" not in spec:
            return 0.0
        start, end, drop = spec["dlo_taper"]
        return drop * smoothstep((start - u) / (start - end))

    def ring(u):
        w = half_width(u)
        b, t = bottom(u), belt(u)
        inside = gr <= u <= gf
        gh = max(0.0, roof(u) - t) if inside else 0.0
        s = smoothstep(gh / 0.12)             # 0 over the bonnet and tail, 1 under a full glasshouse
        gw = w - spec["glass_inset"]
        top = gw * (1 - spec["tumblehome"])
        sh = t - spec["shoulder_drop"]
        crown = 0.025 * (1 - s)               # a little crown on the bonnet and tailgate
        pts = [
            (0.0, b),                          # 0 underbody centre
            (w * 0.8, b),                      # 1 underbody edge
            (w * 0.965, b + 0.05),             # 2 rocker
            (w, lerp(b, sh, 0.4)),             # 3 lower door
            (w * 1.005, sh),                   # 4 shoulder crease
            (w * 0.955, t - 0.012),            # 5 belt edge
            (lerp(w * 0.86, gw, s), t + 0.004),                          # 6 glass base / bonnet edge
            (lerp(w * 0.62, top + 0.01, s), t + lerp(0.012, gh * 0.9 - dlo_drop(u), s)),  # 7 glass top
            (lerp(w * 0.35, top * 0.96, s), t + lerp(0.02, gh * 0.985, s)),  # 8 roof edge
            (lerp(w * 0.15, top * 0.62, s), t + lerp(0.024, gh + 0.008, s) + crown * 0.3),  # 9 roof side
            (0.0, t + lerp(0.025, gh + 0.012, s) + crown),               # 10 roof centre
        ]
        return pts

    beltf = belt(0.5)
    beltr = belt(-0.5)
    fb, rb = bottom(0.5), bottom(-0.5)

    def rake(x, z, y=0.0):
        """Leans the nose and tail back from the bumper, and sweeps their corners back (a V in plan)."""
        u = x / L
        tf = max(0.0, min(1.0, (z - fb) / (beltf - fb)))
        tr = max(0.0, min(1.0, (z - rb) / (beltr - rb)))
        wf = smoothstep((u - 0.36) / 0.14)
        wr = smoothstep((-0.4 - u) / 0.1)
        across = min(1.0, abs(y) / (W / 2)) ** 2
        return (x - spec["nose_rake"] * tf ** 1.2 * wf - 0.05 * (1 - min(1, tf * 3)) ** 2 * wf
                - spec.get("nose_sweep", 0.0) * across * smoothstep((u - 0.33) / 0.17)
                + spec["tail_rake"] * tr ** 1.2 * wr + 0.04 * (1 - min(1, tr * 3)) ** 2 * wr
                + spec.get("tail_sweep", 0.0) * across * smoothstep((-0.42 - u) / 0.08))

    bm = bmesh.new()
    crease = bm.edges.layers.float.new("crease_edge")
    rings = []
    for u in us:
        x = u * L
        rings.append([bm.verts.new((rake(x, z, y), y, z)) for (y, z) in ring(u)])
    n = len(rings[0])

    def region(u):
        if u > gf or u < gr:
            return "body"
        if u > spec["roof_front"]:
            return "windscreen"
        if u < spec["roof_rear"]:
            return "hatch"
        return "roof"

    def face_material(band, u):
        r = region(u)
        if band <= 1:
            return "Trim"                                           # underbody and sill
        if band == 5:
            return "Paint" if r == "body" else "GlossBlack"         # window seal
        sedan = spec.get("sedan", False)
        if band == 6:
            if r == "body":
                return "Paint"
            if r == "windscreen":
                return "GlossBlack"                                  # A-pillar
            # A hatch or SUV has its rear pillar over the tailgate glass; a sedan's rear doors
            # carry on under the rear window, up to the C-pillar.
            if (r == "hatch" and not sedan) or u < spec["quarter_end"]:
                return "GlossBlack" if spec.get("black_rear_pillar") else "Paint"   # C/D-pillar
            if abs(u - spec["b_pillar"]) < 0.012 or abs(u - spec["c_pillar"]) < 0.008:
                return "GlossBlack"                                  # B- and C-pillars
            return "Glass"
        if band >= 7:
            if r == "hatch" and sedan and band == 7:
                return "Paint"                                       # C-pillar sail beside the rear window
            if r in ("windscreen", "hatch"):
                return "Glass"
            if r == "roof" and spec.get("black_roof"):
                return "GlossBlack"
            return "Paint"
        return "Paint"

    names = list(mats)
    for i in range(len(rings) - 1):
        u = (us[i] + us[i + 1]) / 2
        for j in range(n - 1):
            face = bm.faces.new((rings[i][j], rings[i + 1][j], rings[i + 1][j + 1], rings[i][j + 1]))
            face.material_index = names.index(face_material(j, u))
    # Ends: a ring pulled in a little, then a fan to the middle. Kept close to the outline, so the
    # fascia and tail panel stay fairly flat with a tight edge rather than ballooning out.
    for ring_verts, sign in ((rings[-1], 1), (rings[0], -1)):
        cy = sum(v.co.z for v in ring_verts) / n
        inner = [bm.verts.new((v.co.x + sign * 0.006, v.co.y * 0.86, cy + (v.co.z - cy) * 0.9)) for v in ring_verts]
        centre = bm.verts.new((ring_verts[0].co.x + sign * 0.016, 0.0, cy))
        for j in range(n - 1):
            quad = (ring_verts[j], ring_verts[j + 1], inner[j + 1], inner[j]) if sign > 0 else (ring_verts[j], inner[j], inner[j + 1], ring_verts[j + 1])
            bm.faces.new(quad).material_index = names.index("Paint" if 2 <= j else "Trim")
            tri = (inner[j], inner[j + 1], centre) if sign > 0 else (inner[j], centre, inner[j + 1])
            bm.faces.new(tri).material_index = names.index("Paint" if 2 <= j else "Trim")
    # Crisp shoulder and belt lines, and a defined edge where the bonnet and tailgate meet the ends.
    for i in range(len(rings) - 1):
        # Lower door crease, shoulder line, belt edge.
        for j, value in ((3, 0.3), (4, 0.55), (5, 0.85)):
            edge = bm.edges.get((rings[i][j], rings[i + 1][j]))
            if edge:
                edge[crease] = value
    for ring_verts in (rings[0], rings[-1]):
        for j in range(3, n - 1):
            edge = bm.edges.get((ring_verts[j], ring_verts[j + 1]))
            if edge:
                edge[crease] = 0.8
    # Faces point outward; make sure.
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    # Material slots go on before the faces: clearing slots afterwards would reset every face to slot 0.
    mesh = bpy.data.meshes.new("Body")
    for name in names:
        mesh.materials.append(mats[name])
    bm.to_mesh(mesh)
    bm.free()
    obj = link(bpy.data.objects.new("Body", mesh))

    mirror = obj.modifiers.new("Mirror", "MIRROR")
    mirror.use_axis = (False, True, False)
    mirror.use_clip = True
    mirror.use_mirror_merge = True
    sub = obj.modifiers.new("Subdivision", "SUBSURF")
    sub.levels = sub.render_levels = level
    sub.use_creases = True

    # Boolean cutters: wheel arches and door shut lines.
    cutters = []
    R = spec["tyre_radius"]
    arch_r = R + 0.04
    axle_f = L / 2 - spec["front_overhang"]
    axle_r = axle_f - spec["wheelbase"]
    for ax in (axle_f, axle_r):
        bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=arch_r, depth=W + 0.4, location=(ax, 0, R), rotation=(math.pi / 2, 0, 0))
        cutters.append(bpy.context.active_object)
    for u in spec["door_lines"]:
        x = rake(u * L, 0.6)
        top = belt(u) - 0.02
        z0 = spec["ground_clearance"] + 0.08
        for side in (1, -1):
            bpy.ops.mesh.primitive_cube_add(size=1, location=(x, side * (W / 2 + 0.02), (top + z0) / 2))
            cube = bpy.context.active_object
            cube.scale = (0.004, 0.1, top - z0)
            cutters.append(cube)
    collection = bpy.data.collections.new("Cutters")
    bpy.context.scene.collection.children.link(collection)
    for c in cutters:
        for col in c.users_collection:
            col.objects.unlink(c)
        collection.objects.link(c)
        c.data.materials.append(mats["GlossBlack"])
    boolean = obj.modifiers.new("Cuts", "BOOLEAN")
    boolean.operation = "DIFFERENCE"
    boolean.operand_type = "COLLECTION"
    boolean.collection = collection
    boolean.solver = "EXACT"
    boolean.material_mode = "TRANSFER"

    # Bake the modifiers into the mesh, so later steps (ray casts) see the finished surface.
    depsgraph = bpy.context.evaluated_depsgraph_get()
    final = bpy.data.meshes.new_from_object(obj.evaluated_get(depsgraph))
    obj.modifiers.clear()
    obj.data = final
    for poly in obj.data.polygons:
        poly.use_smooth = True
    for c in cutters:
        bpy.data.objects.remove(c)
    bpy.data.collections.remove(collection)
    return obj, {"axle_f": axle_f, "axle_r": axle_r, "arch_r": arch_r, "belt": belt, "roof": roof, "half_width": half_width, "rake": rake}


# --------------------------------------------------------------------------------------------
# Parts traced onto the body.

class Surface:
    def __init__(self, body):
        depsgraph = bpy.context.evaluated_depsgraph_get()
        self.tree = BVHTree.FromObject(body, depsgraph)

    def hit(self, origin, direction):
        location, normal, _, _ = self.tree.ray_cast(Vector(origin), Vector(direction))
        return (location, normal) if location is not None else None


DETAIL = {"level": 2}   # set by main(); the light model traces its panels more coarsely


def traced(name, surface, outline, material, *, view="front", length=4.0, offset=0.003, mirror=True, cuts=10):
    """A thin panel in the shape of `outline` (y, z), projected onto the body from the front or back."""
    if DETAIL["level"] < 2:
        cuts = max(1, round(cuts * 0.6))
    bm = bmesh.new()
    sides = [1, -1] if mirror else [1]
    for side in sides:
        pts = list(outline)
        if not mirror and pts[0][0] == 0.0:
            # A centred part given as its left half: complete it across the centre line.
            pts = [(-y, z) for (y, z) in reversed(pts) if y != 0.0] + pts
        verts = [bm.verts.new((0, side * y, z)) for (y, z) in pts]
        if side < 0:
            verts.reverse()
        try:
            bm.faces.new(verts)
        except ValueError:
            pass
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=cuts, use_grid_fill=True)
    sign = 1 if view == "front" else -1
    direction = (-sign, 0, 0)
    missed = []
    for v in bm.verts:
        h = surface.hit((sign * (length / 2 + 1), v.co.y, v.co.z), direction)
        if h is None:
            missed.append(v)
            continue
        location, normal = h
        if normal.x * sign < 0:
            normal = -normal
        v.co = location + normal * offset
    if missed:
        bmesh.ops.delete(bm, geom=missed, context="VERTS")
    if view == "rear":
        bmesh.ops.reverse_faces(bm, faces=bm.faces[:])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    # Normals must face away from the body, towards the viewer.
    for f in bm.faces:
        f.normal_update()
        if f.normal.x * sign < 0:
            f.normal_flip()
    obj = mesh_object(name, bm, material)
    for poly in obj.data.polygons:
        poly.use_smooth = True
    return obj


def full_outline(outline):
    """A centred part given as its left half (starting on the centre line), completed across it."""
    if outline[0][0] != 0.0:
        return list(outline)
    return [(-y, z) for (y, z) in reversed(outline) if y != 0.0] + list(outline)


def inside(point, polygon):
    y, z = point
    hit = False
    for (y1, z1), (y2, z2) in zip(polygon, polygon[1:] + polygon[:1]):
        if (z1 > z) != (z2 > z) and y < (y2 - y1) * (z - z1) / (z2 - z1) + y1:
            hit = not hit
    return hit


def grille_pattern(surface, fr, mats, L):
    """Bars or a mesh inside the grille, kept to the grille's outline. Too fine to see on a phone."""
    p = fr.get("pattern")
    if not p:
        return
    shape = full_outline(fr["grille"])
    ys = [q[0] for q in shape]
    zs = [q[1] for q in shape]
    material = mats[p.get("material", "Trim")]
    skip = p.get("skip", [])
    z = min(zs) + p.get("margin", 0.02)
    row = 0
    while z < max(zs) - p.get("margin", 0.02):
        if p["kind"] == "vbars":
            break
        if not any(a < z < b for a, b in skip):
            y = min(ys) + (p["pitch"] / 2 if row % 2 and p.get("stagger", True) else 0)
            while y < max(ys):
                bar = [(y, z), (y + p["dash"], z), (y + p["dash"], z + p["thick"]), (y, z + p["thick"])]
                if all(inside(q, shape) for q in bar):
                    traced("GrillePattern", surface, bar, material, mirror=False, length=L, offset=0.0045, cuts=1)
                y += p["pitch"]
        z += p["row"]
        row += 1
    if p["kind"] == "vbars":
        y = min(ys) + p["pitch"] / 2
        while y < max(ys):
            col = [q for q in [(y, zz / 100) for zz in range(int(min(zs) * 100), int(max(zs) * 100) + 1)] if inside(q, shape)]
            if len(col) > 2:
                z0, z1 = col[0][1] + 0.012, col[-1][1] - 0.012
                bar = [(y, z0), (y + p["thick"], z0), (y + p["thick"], z1), (y, z1)]
                traced("GrilleSlat", surface, bar, material, mirror=False, length=L, offset=0.005, cuts=2)
            y += p["pitch"]


def faces(spec, surface, mats, level):
    L = spec["length"]
    fr, rr = spec["front"], spec["rear"]
    traced("Grille", surface, fr["grille"], mats["GlossBlack"], mirror=False, length=L)
    # Parts drawn from the centre line span the car; parts drawn off it come in mirrored pairs.
    for i, bar in enumerate(fr.get("chrome", [])):
        traced(f"GrilleChrome{i}", surface, bar, mats["Chrome"], mirror=bar[0][0] != 0.0, length=L, offset=0.006, cuts=4)
    for i, part in enumerate(fr.get("silver", [])):
        traced(f"Silver{i}", surface, part, mats["Silver"], mirror=part[0][0] != 0.0, length=L, offset=0.006, cuts=4)
    if level >= 2:
        grille_pattern(surface, fr, mats, L)
    traced("Headlamp", surface, fr["lamp"], mats["Headlamp"], length=L)
    for i, (py, pz, pr) in enumerate(fr.get("projectors", [])):
        ring = [(py + pr * math.cos(a), pz + pr * math.sin(a)) for a in [k * math.tau / 20 for k in range(20)]]
        traced(f"Projector{i}", surface, ring, mats["Chrome"], length=L, offset=0.006, cuts=2)
        lens = [(py + pr * 0.55 * math.cos(a), pz + pr * 0.55 * math.sin(a)) for a in [k * math.tau / 16 for k in range(16)]]
        traced(f"ProjectorLens{i}", surface, lens, mats["Headlamp"], length=L, offset=0.008, cuts=1)
    for i, strip in enumerate(fr["drl"]):
        traced(f"DRL{i}", surface, strip, mats["DRL"], length=L, offset=0.006, cuts=2)
    if "intake" in fr:
        traced("Intake", surface, fr["intake"], mats["GlossBlack"], mirror=False, length=L)
        intake = fr.get("intake_pattern")
        if intake and level >= 2:
            grille_pattern(surface, {"grille": fr["intake"], "pattern": intake}, mats, L)
    if "fog_pod" in fr:
        traced("FogPod", surface, fr["fog_pod"], mats["Trim"], length=L, offset=0.004)
    if "fog_chrome" in fr:
        traced("FogChrome", surface, fr["fog_chrome"], mats["Chrome"], length=L, offset=0.006, cuts=3)
    if "fog" in fr:
        fy, fz, fr_ = fr["fog"]
        circle = [(fy + fr_ * math.cos(a), fz + fr_ * math.sin(a)) for a in [i * math.tau / 16 for i in range(16)]]
        traced("FogLamp", surface, circle, mats["DRL"], length=L, offset=0.006, cuts=2)
    traced("PlateFront", surface, fr["plate"], mats["Plate"], mirror=False, length=L, offset=0.008, cuts=4)
    traced("TailLamp", surface, rr["lamp"], mats["Taillamp"], view="rear", length=L)
    if "lamp_inner" in rr:
        traced("TailLampInner", surface, rr["lamp_inner"], mats["TaillampLED"], view="rear", length=L, offset=0.006, cuts=3)
    if "bar" in rr:
        # A light bar joining the tail lamps across the tailgate.
        traced("TailLightBar", surface, rr["bar"], mats["TaillampLED"], view="rear", mirror=False, length=L, offset=0.005, cuts=4)
    for i, part in enumerate(rr.get("silver", [])):
        traced(f"RearSilver{i}", surface, part, mats["Silver"], view="rear", mirror=False, length=L, offset=0.006, cuts=4)
    for i, bar in enumerate(rr.get("chrome", [])):
        traced(f"TailChrome{i}", surface, bar, mats["Chrome"], view="rear", mirror=False, length=L, offset=0.005, cuts=4)
    traced("PlateRear", surface, rr["plate"], mats["Plate"], view="rear", mirror=False, length=L, offset=0.006, cuts=4)
    traced("RearBumper", surface, rr["bumper"], mats["Trim"], view="rear", mirror=False, length=L, offset=0.003)


# --------------------------------------------------------------------------------------------
# Wheels.

def lathe(name, profile, material, segments, axis_y=0.0):
    """Turns an (r, y) profile about the Y axis (the axle)."""
    bm = bmesh.new()
    rings = []
    for k in range(segments):
        a = k / segments * math.tau
        rings.append([bm.verts.new((r * math.cos(a), y + axis_y, r * math.sin(a))) for (r, y) in profile])
    for k in range(segments):
        a, b = rings[k], rings[(k + 1) % segments]
        for j in range(len(profile) - 1):
            bm.faces.new((a[j], b[j], b[j + 1], a[j + 1]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    obj = mesh_object(name, bm, material)
    for poly in obj.data.polygons:
        poly.use_smooth = True
    return obj


def box(name, size, location, material, rotation=(0, 0, 0), bevel=0.004):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location, rotation=rotation)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = size
    obj.data.materials.append(material)
    if bevel:
        mod = obj.modifiers.new("Bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 2
    return obj


def wheel(spec, mats, level):
    R, tw, rr = spec["tyre_radius"], spec["tyre_width"], spec["rim_radius"]
    seg = 64 if level >= 2 else 32
    h = tw / 2
    bpy.ops.object.select_all(action="DESELECT")
    parts = []
    # Tyre: tread with three grooves, rounded shoulders, sidewalls down to the bead.
    tread = []
    for y in [-h + 0.012, -h * 0.55, -h * 0.5, -h * 0.45, -0.004, 0.004, h * 0.45, h * 0.5, h * 0.55, h - 0.012]:
        groove = any(abs(y - g) < 1e-6 for g in (-h * 0.5, 0.0, h * 0.5))
        tread.append((R - (0.008 if groove else 0), y))
    shoulder_out = [(R - 0.012 - 0.02 * (1 - math.cos(a)), h - 0.012 + 0.012 * math.sin(a)) for a in [i * math.pi / 2 / 4 for i in range(1, 5)]]
    sidewall = [(R - 0.05, h + 0.002), (rr + 0.04, h - 0.004), (rr + 0.012, h - 0.012), (rr, h - 0.02)]
    profile = list(reversed([(r, -y) for (r, y) in shoulder_out + sidewall])) + tread + shoulder_out + sidewall
    parts.append(lathe("Tyre", profile, mats["Tyre"], seg))
    # Rim barrel, the outer lip, the disc behind the spokes, the hub.
    parts.append(lathe("RimBarrel", [(rr, -h + 0.015), (rr - 0.01, -h + 0.03), (rr - 0.01, h - 0.035), (rr, h - 0.02), (rr + 0.006, h - 0.012)], mats["RimDark"], seg))
    parts.append(lathe("RimLip", [(rr + 0.006, h - 0.012), (rr - 0.004, h - 0.006), (rr - 0.02, h - 0.012)], mats["Rim"], seg))
    parts.append(lathe("Disc", [(0.04, 0.0), (rr * 0.78, 0.0), (rr * 0.78, 0.025), (0.04, 0.025)], mats["Disc"], 40))
    parts.append(lathe("Hub", [(0.0, h - 0.008), (0.05, h - 0.012), (0.06, h - 0.03)], mats["Rim"], 24))
    # A dark face behind the spokes, so the pockets between them read black, as on two-tone alloys.
    parts.append(lathe("RimFace", [(0.055, h - 0.04), (rr - 0.004, h - 0.04)], mats["RimDark"], seg))
    # Five twin spokes with machined faces, running from the hub out to the rim.
    for k in range(spec["spokes"]):
        a = k / spec["spokes"] * math.tau
        for da in (-0.11, 0.11):
            ang = a + da
            mid = rr * 0.52
            loc = (mid * math.cos(ang), h - 0.024, mid * math.sin(ang))
            parts.append(box("Spoke", (rr * 0.92, 0.022, 0.026), loc, mats["Rim"], rotation=(0, -ang, 0), bevel=0.004))
    # Join into one object.
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.convert(target="MESH")
    bpy.ops.object.join()
    obj = bpy.context.active_object
    obj.name = "Wheel"
    bpy.ops.object.select_all(action="DESELECT")
    return obj


def place_wheels(spec, mats, info, level):
    template = wheel(spec, mats, level)
    W, R, tw = spec["width"], spec["tyre_radius"], spec["tyre_width"]
    # Tyres sit almost flush with the body sides, as on the real car.
    track = W / 2 - tw / 2 - 0.015
    wheels = []
    for ax in (info["axle_f"], info["axle_r"]):
        for side in (1, -1):
            w = template.copy()
            w.data = template.data
            link(w)
            w.location = (ax, side * track, R)
            # The spokes face +Y (outboard) on the left wheels; turn the right ones round.
            if side < 0:
                w.rotation_euler = (0, 0, math.pi)
            wheels.append(w)
    bpy.data.objects.remove(template)
    return wheels


# --------------------------------------------------------------------------------------------
# Arch liners, mirrors, handles, wipers, spoiler, interior.

def traced_side(name, surface, outline, material, width, offset=0.006, cuts=6):
    """A thin panel in the shape of `outline` (x, z), projected onto both sides of the body."""
    if DETAIL["level"] < 2:
        cuts = max(1, round(cuts * 0.6))
    for side in (1, -1):
        bm = bmesh.new()
        verts = [bm.verts.new((x, 0, z)) for (x, z) in outline]
        try:
            bm.faces.new(verts)
        except ValueError:
            bm.free()
            continue
        bmesh.ops.triangulate(bm, faces=bm.faces[:])
        bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=cuts, use_grid_fill=True)
        missed = []
        for v in bm.verts:
            h = surface.hit((v.co.x, side * (width / 2 + 1), v.co.z), (0, -side, 0))
            if h is None:
                missed.append(v)
                continue
            location, normal = h
            if normal.y * side < 0:
                normal = -normal
            v.co = location + normal * offset
        if missed:
            bmesh.ops.delete(bm, geom=missed, context="VERTS")
        for f in bm.faces:
            f.normal_update()
            if f.normal.y * side < 0:
                f.normal_flip()
        obj = mesh_object(name, bm, material)
        for poly in obj.data.polygons:
            poly.use_smooth = True


def cladding(spec, mats, info, surface):
    """Black plastic round the wheel arches and along the sills, as on the SUVs."""
    R, W = spec["tyre_radius"], spec["width"]
    r1, r2 = info["arch_r"] + 0.004, info["arch_r"] + spec.get("cladding_width", 0.065)
    for ax in (info["axle_f"], info["axle_r"]):
        # The upper arc only: lower down, the body curves away and a side projection would smear.
        angles = [0.3 + (math.pi - 0.6) * k / 24 for k in range(25)]
        outer = [(ax + r2 * math.cos(a), R + r2 * math.sin(a)) for a in angles]
        inner = [(ax + r1 * math.cos(a), R + r1 * math.sin(a)) for a in reversed(angles)]
        traced_side("ArchCladding", surface, outer + inner, mats["Trim"], W, cuts=2)
    x0 = info["axle_r"] + info["arch_r"] + 0.02
    x1 = info["axle_f"] - info["arch_r"] - 0.02
    z0 = spec["ground_clearance"] + 0.01
    z1 = z0 + spec.get("sill_height", 0.12)
    traced_side("SillCladding", surface, [(x0, z0), (x1, z0), (x1, z1), (x0, z1)], mats["Trim"], W, cuts=6)


def roof_rails(spec, mats, info, surface):
    """Rails along the roof edges, on short feet, following the roof's curve."""
    L, W = spec["length"], spec["width"]
    material = mats["GlossBlack" if spec["roof_rails"] == "black" else "Silver"]
    u0, u1 = spec["roof_rear"] + 0.02, spec["roof_front"] - 0.03
    depsgraph = bpy.context.evaluated_depsgraph_get()
    for side in (1, -1):
        points = []
        for k in range(17):
            u = u0 + (u1 - u0) * k / 16
            y = side * (info["half_width"](u) - spec["glass_inset"]) * (1 - spec["tumblehome"]) * 0.8
            h = surface.hit((u * L, y, 5.0), (0, 0, -1))
            if h:
                points.append(h[0] + Vector((0, 0, 0.03)))
        if len(points) < 4:
            continue
        curve = bpy.data.curves.new("RoofRail", "CURVE")
        curve.dimensions = "3D"
        curve.bevel_depth = 0.014
        curve.bevel_resolution = 2
        spline = curve.splines.new("POLY")
        spline.points.add(len(points) - 1)
        for p, co in zip(spline.points, points):
            p.co = (co.x, co.y, co.z, 1)
        tmp = link(bpy.data.objects.new("RoofRailCurve", curve))
        mesh = bpy.data.meshes.new_from_object(tmp.evaluated_get(depsgraph))
        bpy.data.objects.remove(tmp)
        rail = link(bpy.data.objects.new("RoofRail", mesh))
        rail.data.materials.append(material)
        for p in (points[0], points[len(points) // 2], points[-1]):
            box("RailFoot", (0.07, 0.03, 0.035), (p.x, p.y, p.z - 0.017), mats["Trim"], bevel=0.008)


def details(spec, mats, info, surface):
    L, W, R = spec["length"], spec["width"], spec["tyre_radius"]
    belt = info["belt"]
    for ax in (info["axle_f"], info["axle_r"]):
        prof = [(info["arch_r"] - 0.005, -W / 2 * 0.86), (info["arch_r"] - 0.005, W / 2 * 0.86)]
        liner = lathe("ArchLiner", prof, mats["Trim"], 40)
        liner.location = (ax, 0, R)
        # Keep the upper half only.
        bm = bmesh.new()
        bm.from_mesh(liner.data)
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < -0.02], context="VERTS")
        bmesh.ops.reverse_faces(bm, faces=bm.faces[:])
        bm.to_mesh(liner.data)
        bm.free()
    # Door mirrors at the base of the A-pillar, body colour, on a black base.
    u = spec["glass_front"] - 0.045
    x = info["rake"](u * L, 1.0)
    z = belt(u) + 0.08
    for side in (1, -1):
        hit = surface.hit((x, side * (W / 2 + 0.5), belt(u) + 0.02), (0, -side, 0))
        y = (hit[0].y if hit else side * (W / 2 - 0.1))
        # Housing: an ellipsoid with its back cut open; the glass sits just inside the opening, so
        # the two surfaces never coincide (which flickers).
        size = Vector((0.075, 0.11, 0.058))
        centre = Vector((x - 0.02, y + side * 0.13, z))
        bm = bmesh.new()
        bmesh.ops.create_uvsphere(bm, u_segments=28, v_segments=14, radius=1.0)
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.x < -0.6], context="VERTS")
        for v in bm.verts:
            v.co = centre + Vector((v.co.x * size.x, v.co.y * size.y, v.co.z * size.z))
        housing = mesh_object("Mirror", bm, mats[spec.get("mirror", "Paint")])
        for poly in housing.data.polygons:
            poly.use_smooth = True
        bm = bmesh.new()
        rim = [bm.verts.new(centre + Vector((-0.6 * size.x + 0.004, 0.76 * size.y * math.cos(a), 0.76 * size.z * math.sin(a))))
               for a in [k * math.tau / 28 for k in range(28)]]
        face = bm.faces.new(rim)
        if face.normal.x > 0:
            face.normal_flip()
        mesh_object("MirrorGlass", bm, mats["Chrome"])
        box("MirrorArm", (0.06, 0.12, 0.03), (x, y + side * 0.06, z - 0.03), mats["Trim"], bevel=0.008)
    # Chrome door handles.
    for u in spec["handles"]:
        x = info["rake"](u * L, 0.8)
        z = belt(u) - 0.085
        for side in (1, -1):
            hit = surface.hit((x, side * (W / 2 + 0.5), z), (0, -side, 0))
            if not hit:
                continue
            box("Handle", (0.13, 0.016, 0.022), (x, hit[0].y + side * 0.006, z), mats[spec.get("handle", "Chrome")], bevel=0.007)
    # Wipers lying at the foot of the windscreen.
    u = spec["glass_front"] - 0.01
    x = info["rake"](u * L, 1.0)
    for y0, ang in ((0.05, 0.12), (-0.55, 0.1)):
        box("Wiper", (0.012, 0.6, 0.01), (x - 0.03, y0 + 0.25, belt(u) + 0.035), mats["Trim"], rotation=(0, -0.55, ang), bevel=0.002)
    # Roof spoiler over the hatch glass, and a shark-fin aerial.
    # The spoiler matches the roof's width where it ends, and sits on its trailing edge.
    u = spec["roof_rear"]
    roof = info["roof"]
    roof_material = mats["GlossBlack" if spec.get("black_roof") else "Paint"]
    if spec.get("spoiler", True):
        roof_half = (info["half_width"](u) - spec["glass_inset"]) * (1 - spec["tumblehome"]) * 0.82
        bpy.ops.mesh.primitive_cube_add(size=1, location=(u * L - 0.03, 0, roof(u) - 0.006))
        sp = bpy.context.active_object
        sp.name = "Spoiler"
        sp.scale = (0.12, roof_half * 2, 0.03)
        sp.rotation_euler = (0, 0.06, 0)
        sp.data.materials.append(roof_material)
        mod = sp.modifiers.new("Bevel", "BEVEL")
        mod.width = 0.009
        mod.segments = 3
    ua = spec.get("aerial_u", -0.3)
    bpy.ops.mesh.primitive_cone_add(vertices=12, radius1=0.04, radius2=0.004, depth=0.07, location=(ua * L, 0, roof(ua) + 0.03))
    fin = bpy.context.active_object
    fin.name = "Aerial"
    fin.scale = (2.0, 0.6, 1.0)
    fin.rotation_euler = (0, -0.5, 0)
    fin.data.materials.append(roof_material)
    if spec.get("cladding"):
        cladding(spec, mats, info, surface)
    if spec.get("roof_rails"):
        roof_rails(spec, mats, info, surface)
    if spec.get("chrome_belt"):
        # A thin chrome line along the foot of the side windows, following the belt.
        us = [spec["glass_rear"] + 0.03 + (spec["glass_front"] - 0.05 - spec["glass_rear"] - 0.03) * k / 40 for k in range(41)]
        top = [(info["rake"](u * L, belt(u)), belt(u) + 0.006) for u in us]
        bottom = [(info["rake"](u * L, belt(u)), belt(u) - 0.008) for u in reversed(us)]
        traced_side("WindowChrome", surface, top + bottom, mats["Chrome"], W, offset=0.004, cuts=2)
    # Interior seen through the glass: dashboard, two rows of seats, steering wheel.
    # The dashboard sits back from the foot of the windscreen; the seats are placed from the
    # B-pillar, and their backs never reach above the roof.
    zb = belt(0.0)
    xw = info["rake"](spec["glass_front"] * L, zb)
    xb = spec["b_pillar"] * L
    box("Dashboard", (0.4, W * 0.78, 0.2), (xw - 0.36, 0, zb - 0.1), mats["Interior"], bevel=0.04)
    for seat_x, sides, width in ((xb + 0.05, (1, -1), 0.5), (xb - 0.75, (0,), W * 0.7)):
        floor = zb - 0.28
        height = min(0.6, roof(seat_x / L) - 0.12 - floor)
        for side in sides:
            box("SeatBack", (0.12, width, height), (seat_x, side * 0.38, floor + height / 2), mats["Interior"], rotation=(0, -0.2, 0), bevel=0.05)
            box("SeatBase", (0.5, width, 0.14), (seat_x + 0.25, side * 0.38, zb - 0.32), mats["Interior"], bevel=0.04)
    # Right-hand drive: the driver sits on the car's right, which is -Y here.
    bpy.ops.mesh.primitive_torus_add(major_radius=0.18, minor_radius=0.02, location=(xw - 0.66, -0.38, zb + 0.02), rotation=(0, math.pi / 2 - 0.4, 0))
    sw = bpy.context.active_object
    sw.name = "SteeringWheel"
    sw.data.materials.append(mats["Interior"])


# --------------------------------------------------------------------------------------------

def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    car_id, out = argv[0], argv[1]
    level = int(argv[argv.index("--level") + 1]) if "--level" in argv else 2
    blend = argv[argv.index("--blend") + 1] if "--blend" in argv else None
    spec = SPECS[car_id]
    DETAIL["level"] = level

    bpy.ops.wm.read_factory_settings(use_empty=True)
    mats = make_materials(spec)
    body, info = build_body(spec, mats, level)
    surface = Surface(body)
    faces(spec, surface, mats, level)
    place_wheels(spec, mats, info, level)
    details(spec, mats, info, surface)

    bpy.ops.object.select_all(action="SELECT")
    if blend:
        bpy.ops.wm.save_as_mainfile(filepath=blend)
    bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", export_apply=True, use_selection=True, export_yup=True)
    tris = 0
    depsgraph = bpy.context.evaluated_depsgraph_get()
    for obj in bpy.context.scene.objects:
        if obj.type == "MESH":
            mesh = obj.evaluated_get(depsgraph).to_mesh()
            mesh.calc_loop_triangles()
            tris += len(mesh.loop_triangles)
    print(f"BUILT {car_id} level {level}: {tris} triangles -> {out}")


main()
