"""
Renders del modelo CardioValveAI v4 para el pendón (Blender 4.5 / Cycles, fondo transparente).
La geometría y las posiciones salen del CAD v4 (hardware/out_v4/_canon/*.stl + assembly4/kin4): no se modifica nada.
Los colores son de presentación (el color real depende del filamento).
Uso: /opt/bpy45/bin/python renders_pendon.py [--prueba]
Salida: pendon/imagenes/*.png
"""
from __future__ import annotations
import math
import os
import sys

import bpy
import numpy as np
from mathutils import Matrix

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'hardware', 'v4'))
import blender4 as B        # noqa: E402
import config4 as C         # noqa: E402
import kin4 as K            # noqa: E402
import assembly4 as A       # noqa: E402

OUT = os.path.join(HERE, 'imagenes')
TEST = '--prueba' in sys.argv

# material: (color base sRGB, rugosidad, metálico)
MATS = {
    'Cuerpo': ((0.93, 0.93, 0.92), 0.45, 0.0),
    'Valva': ((0.07, 0.62, 0.66), 0.35, 0.0),
    'Piston': ((0.09, 0.21, 0.40), 0.4, 0.0),
    'Yugo': ((0.09, 0.21, 0.40), 0.4, 0.0),
    'Manivela': ((0.09, 0.21, 0.40), 0.4, 0.0),
    'Portasensor': ((0.20, 0.24, 0.30), 0.4, 0.0),
    'Hall_': ((0.03, 0.03, 0.03), 0.3, 0.0),
    'Iman': ((0.75, 0.76, 0.78), 0.18, 1.0),
    'Pasador': ((0.85, 0.66, 0.32), 0.22, 1.0),
    'Servo': ((0.12, 0.12, 0.13), 0.5, 0.0),
    'Horn': ((0.95, 0.95, 0.95), 0.4, 0.0),
    'Tornillos': ((0.6, 0.6, 0.62), 0.3, 1.0),
}


def srgb_to_lin(c):
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c)


def material(key, accent=None):
    col, rough, metal = MATS[key]
    m = bpy.data.materials.new(key if accent is None else key + '_acento')
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (*srgb_to_lin(accent or col), 1)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    return m


def setup(sc, objs, res):
    mats = {k: material(k) for k in MATS}
    for name, o in objs.items():
        key = next((k for k in MATS if name.startswith(k)), 'Cuerpo')
        o.data = o.data.copy() if name.startswith('Iman') else o.data
        o.active_material = mats[key]
    sc.render.engine = 'CYCLES'
    cy = sc.cycles
    cy.device = 'CPU'
    cy.samples = 24 if TEST else 96
    cy.use_denoising = True
    try:
        cy.denoiser = 'OPENIMAGEDENOISE'
    except Exception:
        pass
    cy.max_bounces = 6
    sc.render.film_transparent = True
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGBA'
    sc.render.image_settings.color_depth = '8'
    sc.view_settings.view_transform = 'AgX'
    sc.view_settings.look = 'AgX - Base Contrast'
    # estudio: cielo suave + luz principal + contraluz
    w = sc.world
    w.use_nodes = True
    bg = w.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (1, 1, 1, 1)
    bg.inputs['Strength'].default_value = 0.55
    for name, loc, energy, size in (('Principal', (260, -320, 420), 2.6e6, 260), ('Relleno', (-380, -120, 160), 7e5, 300),
                                    ('Contraluz', (60, 380, 300), 1.3e6, 200)):
        L = bpy.data.lights.new(name, 'AREA')
        L.energy, L.size = energy, size
        o = bpy.data.objects.new(name, L)
        sc.collection.objects.link(o)
        o.matrix_world = Matrix(B.look_at(loc, (0, 0, 30)).tolist())
    # sombra suave de contacto
    sc.render.film_transparent = True


SOLO = next((a.split('=')[1] for a in sys.argv if a.startswith('--solo=')), None)
EXPLODE_V = 12.0
ACCENT = (0.91, 0.34, 0.24)     # coral: el mismo acento del pendón
DET_EV = [float(x) for x in os.environ.get('DET_EV', '-0.55,0.55,0.62').split(',')]      # detalle: el portasensor se muestra separado 12 mm a lo largo de su eje para ver el imán


def shot(sc, cam, name, eye, tgt, lens, res, hide=()):
    if SOLO and SOLO != name:      # --solo=ninguno: solo calcula las anclas
        return
    sc.render.resolution_x, sc.render.resolution_y = res
    for o in sc.objects:
        if o.type == 'MESH':
            o.hide_render = o.name in hide
    B.camera(cam, eye, tgt, lens)
    p = os.path.join(OUT, name + ('_prueba' if TEST else '') + '.png')
    sc.render.filepath = p
    bpy.ops.render.render(write_still=True)
    print('render', p, flush=True)


def main():
    os.makedirs(OUT, exist_ok=True)
    sc, objs, cam = B.build_scene()
    k = 0.25 if TEST else 1.0
    R = lambda w, h: (int(w * k), int(h * k))
    setup(sc, objs, R(4400, 4000))
    th_open = 62.0
    beta = K.beta_for_theta(th_open)
    pose = A.pose(beta)
    B.apply(objs, pose)
    ref_hidden = ('Tornillos_servo',)
    # 1) protagonista: perspectiva 3/4 alta desde el lado de la ventana del servo
    shot(sc, cam, 'protagonista', (205, -255, 205), (0, -4, 30), 100, R(4400, 4000), ref_hidden)
    # 2) mecanismo con el cuerpo oculto (misma pose)
    shot(sc, cam, 'mecanismo', (170, -215, 110), (0, -8, 36), 72, R(2400, 2400), ('Cuerpo',) + ref_hidden)
    # 3) detalle Hall–imán: solo la valva 1 y su sensor
    keep = {'Valva_1', 'Iman_1', 'Portasensor_1', 'Hall_1', 'Pasador_bisagra_1'}
    a = C.LEAF_DIR[0]
    M = A.Rz(a)
    import parts4 as P
    hall = (M @ np.array([*P.hall_element(), 1.0]))[:3]
    mag = (A.leaf_tf(0, th_open) @ np.array([*P.magnet_center(), 1.0]))[:3]
    th_det = 35.0
    for inst in ('Valva_1', 'Iman_1'):
        objs[inst].matrix_world = Matrix(A.leaf_tf(0, th_det).tolist())
    objs['Iman_1'].active_material = material('Iman', accent=ACCENT)
    mag = (A.leaf_tf(0, th_det) @ np.array([*P.magnet_center(), 1.0]))[:3]
    for inst in ('Portasensor_1', 'Hall_1'):
        objs[inst].matrix_world = Matrix((M @ A.T(0, EXPLODE_V, 0)).tolist())
    hall = hall + M[:3, :3] @ np.array([0, EXPLODE_V, 0])
    ev = M[:3, :3] @ np.array(DET_EV); ev /= np.linalg.norm(ev)
    tgt = (hall + mag) / 2 + M[:3, :3] @ np.array([-6.0, -8.0, -2.0])
    shot(sc, cam, 'detalle_hall_iman', tuple(tgt + ev * 150), tuple(tgt), 80, R(2400, 2000),
         tuple(o.name for o in sc.objects if o.type == 'MESH' and o.name not in keep))
    # 4) vista superior cerrada y abierta (misma cámara)
    for nm, th in (('superior_cerrada', 0.0), ('superior_abierta', 80.0)):
        B.apply(objs, A.pose(K.beta_for_theta(th)))
        shot(sc, cam, nm, (0.01, -0.02, 330), (0, 0, 40), 50, R(1800, 1800), ref_hidden)
    anchors(sc, objs, cam, pose, th_open)


def project(sc, cam, objs, wp, expect):
    """Proyección normalizada (u, v desde arriba-izquierda) y si el primer objeto que ve la cámara en ese punto es `expect`."""
    from bpy_extras.object_utils import world_to_camera_view
    from mathutils import Vector
    bpy.context.view_layer.update()
    p = Vector([float(x) for x in wp])
    o = cam.matrix_world.translation
    d = (p - o).normalized()
    hit, loc, _, _, obj, _ = sc.ray_cast(bpy.context.evaluated_depsgraph_get(), o, d)
    vis = bool(hit and obj is not None and obj.name == expect and (loc - p).length < 3.0)
    v = world_to_camera_view(sc, cam, p)
    return [v.x, 1 - v.y], vis, (obj.name if hit and obj else None)


def anchors(sc, objs, cam, pose, th_open):
    """Puntos de anclaje de las llamadas, verificados con un rayo desde la cámara (el punto debe verse, no estar tapado)."""
    import json
    import parts4 as P
    out = {'theta_protagonista': th_open, 'protagonista': {}, 'detalle': {}}
    for o in sc.objects:
        if o.type == 'MESH':
            o.hide_render = False; o.hide_viewport = False
    B.apply(objs, pose)
    B.camera(cam, (205, -255, 205), (0, -4, 30), 100)
    sc.render.resolution_x, sc.render.resolution_y = 4400, 4000
    H = out['protagonista']
    for i, a in enumerate(C.LEAF_DIR):
        Mi = A.Rz(a)
        for nm, p, ob in ((f'portasensor{i + 1}', (C.D_HINGE, P.CARRIER_END + 1.2, C.Z_HINGE), f'Portasensor_{i + 1}'),):
            wp = (Mi @ np.array([*p, 1.0]))[:3]
            H[nm] = dict(zip(('uv', 'visible', 'golpe'), project(sc, cam, objs, wp, ob)))
        Li = A.leaf_tf(i, th_open)
        wp = (Li @ np.array([C.D_HINGE - 13, 0, C.Z_HINGE + C.BARREL_R, 1.0]))[:3]
        H[f'valva{i + 1}'] = dict(zip(('uv', 'visible', 'golpe'), project(sc, cam, objs, wp, f'Valva_{i + 1}')))
    for ang in (205, 225, 245, 290, 305, 320, 335):
        r = C.RO
        wp = (r * math.cos(math.radians(ang)), r * math.sin(math.radians(ang)), 14.0)
        H[f'cuerpo{ang}'] = dict(zip(('uv', 'visible', 'golpe'), project(sc, cam, objs, wp, 'Cuerpo')))
    so = objs['Servo']
    from mathutils import Vector
    ws = [so.matrix_world @ Vector(c) for c in so.bound_box]
    c = sum(ws, Vector((0, 0, 0))) / 8
    # punto de la cara del servo que mira a la ventana (−y)
    ymin = min(w.y for w in ws)
    H['servo'] = dict(zip(('uv', 'visible', 'golpe'), project(sc, cam, objs, (c.x, ymin + 0.3, c.z), 'Servo')))
    # detalle: misma preparación que la toma 3
    th_det = 35.0
    M = A.Rz(C.LEAF_DIR[0])
    for inst in ('Valva_1', 'Iman_1'):
        objs[inst].matrix_world = Matrix(A.leaf_tf(0, th_det).tolist())
    for inst in ('Portasensor_1', 'Hall_1'):
        objs[inst].matrix_world = Matrix((M @ A.T(0, EXPLODE_V, 0)).tolist())
    keep = {'Valva_1', 'Iman_1', 'Portasensor_1', 'Hall_1', 'Pasador_bisagra_1'}
    for o in sc.objects:
        if o.type == 'MESH':
            o.hide_viewport = o.name not in keep
    hall = (M @ np.array([*P.hall_element(), 1.0]))[:3] + M[:3, :3] @ np.array([0, EXPLODE_V, 0])
    mag = (A.leaf_tf(0, th_det) @ np.array([*P.magnet_center(), 1.0]))[:3]
    ev = M[:3, :3] @ np.array(DET_EV); ev /= np.linalg.norm(ev)
    tgt = (hall + mag) / 2 + M[:3, :3] @ np.array([-6.0, -8.0, -2.0])
    B.camera(cam, tuple(tgt + ev * 150), tuple(tgt), 80)
    sc.render.resolution_x, sc.render.resolution_y = 2400, 2000
    mag_face = mag + M[:3, :3] @ np.array([0, C.MAGNET[1] / 2 + 0.3, 0])
    out['detalle']['iman'] = dict(zip(('uv', 'visible', 'golpe'), project(sc, cam, objs, mag, 'Iman_1')))
    out['detalle']['hall'] = dict(zip(('uv', 'visible', 'golpe'), project(sc, cam, objs, hall, 'Hall_1')))
    for o in sc.objects:
        o.hide_viewport = False
    json.dump(out, open(os.path.join(OUT, 'anclas.json'), 'w'), indent=1)
    print(json.dumps(out, indent=1))


if __name__ == '__main__':
    main()
