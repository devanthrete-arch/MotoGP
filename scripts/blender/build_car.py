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
        "nose_rake": 0.18, "tail_rake": 0.06, "shoulder_drop": 0.1,
        "door_lines": [0.17, -0.105, -0.32],           # front of front door, B-pillar, back of rear door
        "handles": [-0.06, -0.28],                     # near the back of each door
        "paint": (0.12, 0.24, 0.55),                   # Nexa Blue
        "front": {
            # Swept back and up along the bonnet's edge.
            "lamp": [(0.35, 0.665), (0.46, 0.705), (0.6, 0.73), (0.72, 0.735), (0.8, 0.715), (0.8, 0.665),
                     (0.66, 0.635), (0.5, 0.628), (0.38, 0.64)],
            "drl": [[(0.44, 0.636), (0.52, 0.634), (0.52, 0.645), (0.44, 0.647)],
                    [(0.55, 0.636), (0.63, 0.638), (0.63, 0.649), (0.55, 0.647)],
                    [(0.66, 0.642), (0.74, 0.652), (0.74, 0.663), (0.66, 0.653)]],
            "grille": [(0.0, 0.605), (0.33, 0.605), (0.375, 0.575), (0.34, 0.47), (0.24, 0.445), (0.0, 0.44)],
            "chrome": [[(0.0, 0.592), (0.42, 0.592), (0.43, 0.605), (0.0, 0.605)],
                       [(0.0, 0.548), (0.35, 0.548), (0.35, 0.558), (0.0, 0.558)]],
            "intake": [(0.0, 0.37), (0.46, 0.37), (0.52, 0.33), (0.47, 0.27), (0.0, 0.27)],
            "fog_pod": [(0.54, 0.38), (0.66, 0.4), (0.67, 0.31), (0.56, 0.29)],
            "fog": (0.605, 0.345, 0.028),
            "plate": [(0.0, 0.34), (0.26, 0.34), (0.26, 0.45), (0.0, 0.45)],
        },
        "rear": {
            "lamp": [(0.46, 0.94), (0.62, 0.96), (0.76, 0.955), (0.8, 0.92), (0.79, 0.85), (0.64, 0.84), (0.5, 0.87)],
            "lamp_inner": [(0.55, 0.915), (0.72, 0.925), (0.74, 0.9), (0.57, 0.89)],
            "chrome": [[(0.0, 0.875), (0.46, 0.875), (0.46, 0.89), (0.0, 0.89)]],
            "plate": [(0.0, 0.6), (0.26, 0.6), (0.26, 0.71), (0.0, 0.71)],
            "bumper": [(0.0, 0.36), (0.74, 0.37), (0.8, 0.45), (0.0, 0.43)],
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
        "Tyre": principled("Tyre", (0.03, 0.03, 0.032), roughness=0.9),
        # Machined alloy: not a mirror, so it stays bright in a dark studio.
        "Rim": principled("Rim", (0.9, 0.91, 0.92), metallic=0.65, roughness=0.3),
        "RimDark": principled("RimDark", (0.06, 0.065, 0.07), metallic=0.6, roughness=0.35),
        "Disc": principled("Disc", (0.35, 0.36, 0.37), metallic=0.9, roughness=0.45),
        "Headlamp": principled("Headlamp", (0.12, 0.13, 0.15), metallic=0.8, roughness=0.08, coat=1.0),
        "DRL": principled("DRL", (1, 1, 1), emission=(0.92, 0.95, 1.0), strength=6.0),
        "Taillamp": principled("Taillamp", (0.35, 0.02, 0.03), roughness=0.15, coat=1.0, emission=(1.0, 0.06, 0.08), strength=1.6),
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
    us = sorted(set([round(-0.5 + i / 64, 5) for i in range(65)]))

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
            (lerp(w * 0.62, top + 0.01, s), t + lerp(0.012, gh * 0.9, s)),  # 7 glass top
            (lerp(w * 0.35, top * 0.96, s), t + lerp(0.02, gh * 0.985, s)),  # 8 roof edge
            (lerp(w * 0.15, top * 0.62, s), t + lerp(0.024, gh + 0.008, s) + crown * 0.3),  # 9 roof side
            (0.0, t + lerp(0.025, gh + 0.012, s) + crown),               # 10 roof centre
        ]
        return pts

    beltf = belt(0.5)
    beltr = belt(-0.5)
    fb, rb = bottom(0.5), bottom(-0.5)

    def rake(x, z):
        u = x / L
        tf = max(0.0, min(1.0, (z - fb) / (beltf - fb)))
        tr = max(0.0, min(1.0, (z - rb) / (beltr - rb)))
        wf = smoothstep((u - 0.36) / 0.14)
        wr = smoothstep((-0.4 - u) / 0.1)
        return (x - spec["nose_rake"] * tf ** 1.2 * wf - 0.05 * (1 - min(1, tf * 3)) ** 2 * wf
                + spec["tail_rake"] * tr ** 1.2 * wr + 0.04 * (1 - min(1, tr * 3)) ** 2 * wr)

    bm = bmesh.new()
    crease = bm.edges.layers.float.new("crease_edge")
    rings = []
    for u in us:
        x = u * L
        rings.append([bm.verts.new((rake(x, z), y, z)) for (y, z) in ring(u)])
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
        if band == 6:
            if r == "body":
                return "Paint"
            if r == "windscreen":
                return "GlossBlack"                                  # A-pillar
            if r == "hatch" or u < spec["quarter_end"]:
                return "Paint"                                       # D-pillar
            if abs(u - spec["b_pillar"]) < 0.012 or abs(u - spec["c_pillar"]) < 0.008:
                return "GlossBlack"                                  # B- and C-pillars
            return "Glass"
        if band >= 7:
            if r in ("windscreen", "hatch"):
                return "Glass"
            return "Paint"
        return "Paint"

    names = list(mats)
    for i in range(len(rings) - 1):
        u = (us[i] + us[i + 1]) / 2
        for j in range(n - 1):
            face = bm.faces.new((rings[i][j], rings[i + 1][j], rings[i + 1][j + 1], rings[i][j + 1]))
            face.material_index = names.index(face_material(j, u))
    # Ends: a ring pulled inward, then a fan to the middle, so the subdivided nose and tail stay round.
    for ring_verts, sign in ((rings[-1], 1), (rings[0], -1)):
        cy = sum(v.co.z for v in ring_verts) / n
        inner = [bm.verts.new((v.co.x + sign * 0.012, v.co.y * 0.55, cy + (v.co.z - cy) * 0.7)) for v in ring_verts]
        centre = bm.verts.new((ring_verts[0].co.x + sign * 0.016, 0.0, cy))
        for j in range(n - 1):
            quad = (ring_verts[j], ring_verts[j + 1], inner[j + 1], inner[j]) if sign > 0 else (ring_verts[j], inner[j], inner[j + 1], ring_verts[j + 1])
            bm.faces.new(quad).material_index = names.index("Paint" if 2 <= j else "Trim")
            tri = (inner[j], inner[j + 1], centre) if sign > 0 else (inner[j], centre, inner[j + 1])
            bm.faces.new(tri).material_index = names.index("Paint" if 2 <= j else "Trim")
    # Crisp shoulder and belt lines, and a defined edge where the bonnet and tailgate meet the ends.
    for i in range(len(rings) - 1):
        for j, value in ((4, 0.55), (5, 0.85)):
            edge = bm.edges.get((rings[i][j], rings[i + 1][j]))
            if edge:
                edge[crease] = value
    for ring_verts in (rings[0], rings[-1]):
        for j in range(3, n - 1):
            edge = bm.edges.get((ring_verts[j], ring_verts[j + 1]))
            if edge:
                edge[crease] = 0.5
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
    arch_r = R + 0.05
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


def traced(name, surface, outline, material, *, view="front", length=4.0, offset=0.003, mirror=True, cuts=10):
    """A thin panel in the shape of `outline` (y, z), projected onto the body from the front or back."""
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


def faces(spec, surface, mats):
    L = spec["length"]
    fr, rr = spec["front"], spec["rear"]
    traced("Grille", surface, fr["grille"], mats["GlossBlack"], mirror=False, length=L)
    for i, bar in enumerate(fr["chrome"]):
        traced(f"GrilleChrome{i}", surface, bar, mats["Chrome"], mirror=False, length=L, offset=0.006, cuts=4)
    # A mesh pattern inside the grille: short dark bars in staggered rows.
    ys = [p[0] for p in fr["grille"]]
    zs = [p[1] for p in fr["grille"]]
    z0, z1, ymax = min(zs) + 0.02, max(zs) - 0.02, max(ys) - 0.05
    row = 0
    z = z0
    while z < z1:
        y = -ymax + (0.03 if row % 2 else 0)
        while y < ymax - 0.05:
            if not (0.535 < z < 0.565):
                traced("GrilleMesh", surface, [(y, z), (y + 0.045, z), (y + 0.045, z + 0.009), (y, z + 0.009)], mats["Trim"], mirror=False, length=L, offset=0.0045, cuts=1)
            y += 0.06
        z += 0.022
        row += 1
    traced("Headlamp", surface, fr["lamp"], mats["Headlamp"], length=L)
    for i, strip in enumerate(fr["drl"]):
        traced(f"DRL{i}", surface, strip, mats["DRL"], length=L, offset=0.006, cuts=2)
    traced("Intake", surface, fr["intake"], mats["GlossBlack"], mirror=False, length=L)
    traced("FogPod", surface, fr["fog_pod"], mats["Trim"], length=L, offset=0.004)
    fy, fz, fr_ = fr["fog"]
    circle = [(fy + fr_ * math.cos(a), fz + fr_ * math.sin(a)) for a in [i * math.tau / 16 for i in range(16)]]
    traced("FogLamp", surface, circle, mats["DRL"], length=L, offset=0.006, cuts=2)
    traced("PlateFront", surface, fr["plate"], mats["Plate"], mirror=False, length=L, offset=0.008, cuts=4)
    traced("TailLamp", surface, rr["lamp"], mats["Taillamp"], view="rear", length=L)
    traced("TailLampInner", surface, rr["lamp_inner"], mats["DRL"], view="rear", length=L, offset=0.006, cuts=3)
    for i, bar in enumerate(rr["chrome"]):
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
    seg = 64 if level >= 2 else 40
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
    # Five twin spokes, machined faces over dark pockets.
    for k in range(spec["spokes"]):
        a = k / spec["spokes"] * math.tau
        for da in (-0.13, 0.13):
            ang = a + da
            mid = rr * 0.55
            loc = (mid * math.cos(ang), h - 0.022, mid * math.sin(ang))
            parts.append(box("Spoke", (rr * 0.86, 0.016, 0.036), loc, mats["Rim"], rotation=(0, -ang, 0), bevel=0.005))
            loc2 = (mid * math.cos(ang), h - 0.03, mid * math.sin(ang))
            parts.append(box("SpokeBack", (rr * 0.86, 0.02, 0.046), loc2, mats["RimDark"], rotation=(0, -ang, 0), bevel=0))
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
    track = W / 2 - tw / 2 - 0.03
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
        bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, radius=1, location=(x - 0.02, y + side * 0.13, z))
        m = bpy.context.active_object
        m.name = "Mirror"
        m.scale = (0.075, 0.11, 0.058)
        m.data.materials.append(mats["Paint"])
        box("MirrorArm", (0.06, 0.12, 0.03), (x, y + side * 0.06, z - 0.03), mats["Trim"], bevel=0.008)
        box("MirrorGlass", (0.005, 0.18, 0.09), (x - 0.095, y + side * 0.13, z), mats["Chrome"], bevel=0.01)
    # Chrome door handles.
    for u in spec["handles"]:
        x = info["rake"](u * L, 0.8)
        z = belt(u) - 0.085
        for side in (1, -1):
            hit = surface.hit((x, side * (W / 2 + 0.5), z), (0, -side, 0))
            if not hit:
                continue
            box("Handle", (0.13, 0.016, 0.022), (x, hit[0].y + side * 0.006, z), mats["Chrome"], bevel=0.007)
    # Wipers lying at the foot of the windscreen.
    u = spec["glass_front"] - 0.01
    x = info["rake"](u * L, 1.0)
    for y0, ang in ((0.05, 0.12), (-0.55, 0.1)):
        box("Wiper", (0.012, 0.6, 0.01), (x - 0.03, y0 + 0.25, belt(u) + 0.035), mats["Trim"], rotation=(0, -0.55, ang), bevel=0.002)
    # Roof spoiler over the hatch glass, and a shark-fin aerial.
    u = spec["roof_rear"] - 0.01
    roof = info["roof"]
    bpy.ops.mesh.primitive_cube_add(size=1, location=(u * L - 0.04, 0, roof(u) + 0.01))
    sp = bpy.context.active_object
    sp.name = "Spoiler"
    sp.scale = (0.2, (W / 2 - spec["glass_inset"]) * (1 - spec["tumblehome"]) * 2 + 0.06, 0.035)
    sp.rotation_euler = (0, 0.18, 0)
    sp.data.materials.append(mats["Paint"])
    mod = sp.modifiers.new("Bevel", "BEVEL")
    mod.width = 0.012
    mod.segments = 3
    bpy.ops.mesh.primitive_cone_add(vertices=12, radius1=0.04, radius2=0.004, depth=0.07, location=(-0.3 * L, 0, roof(-0.3) + 0.03))
    fin = bpy.context.active_object
    fin.name = "Aerial"
    fin.scale = (2.0, 0.6, 1.0)
    fin.rotation_euler = (0, -0.5, 0)
    fin.data.materials.append(mats["Paint"])
    # Interior seen through the glass: dashboard, two rows of seats, steering wheel.
    # Everything is placed back from the foot of the windscreen, so it stays inside the cabin.
    zb = belt(0.0)
    xw = info["rake"](spec["glass_front"] * L, zb)
    box("Dashboard", (0.4, W * 0.78, 0.2), (xw - 0.36, 0, zb - 0.1), mats["Interior"], bevel=0.04)
    for seat_x, sides, width in ((xw - 1.35, (1, -1), 0.5), (xw - 2.15, (0,), W * 0.7)):
        for side in sides:
            box("SeatBack", (0.12, width, 0.6), (seat_x, side * 0.38, zb + 0.02), mats["Interior"], rotation=(0, -0.2, 0), bevel=0.05)
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

    bpy.ops.wm.read_factory_settings(use_empty=True)
    mats = make_materials(spec)
    body, info = build_body(spec, mats, level)
    surface = Surface(body)
    faces(spec, surface, mats)
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
