"""
CardioValveAI v4 en Blender 4.5 LTS (bpy como módulo): conjunto armado con animación (la MISMA cinemática que el CAD) y vistas.
Uso: /opt/bpy45/bin/python blender4.py
Salida: out_v4/CardioValveAI_v4.blend y out_v4/Vistas/*.png (Despiece_numerado, armado cerrado/abierto, interior, Hall, servo).
"""
from __future__ import annotations
import math
import os
import sys

import bpy
import numpy as np
import trimesh
from mathutils import Matrix, Vector
from bpy_extras.object_utils import world_to_camera_view
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import config4 as C        # noqa: E402
import kin4 as K           # noqa: E402
import parts4 as P         # noqa: E402
import registry4 as R      # noqa: E402
import assembly4 as A      # noqa: E402

OUT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', C.OUT_DIR))
CANON = os.path.join(OUT, '_canon')
VIEWS = os.path.join(OUT, 'Vistas')
FONT = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 22)
FONT_S = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 18)
FONT_N = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 20)
FPS, CYCLE = 24, 96
COLORS = {'Cuerpo': (0.88, 0.91, 0.94), 'Valva': (0.13, 0.70, 0.84), 'Piston': (0.12, 0.27, 0.48), 'Yugo': (0.95, 0.56, 0.12),
          'Manivela': (0.95, 0.56, 0.12), 'Portasensor': (0.95, 0.45, 0.10), 'Hall_': (0.05, 0.05, 0.05), 'Iman': (0.78, 0.10, 0.12),
          'Pasador': (0.83, 0.67, 0.28), 'Servo': (0.12, 0.30, 0.85), 'Horn': (0.97, 0.97, 0.97), 'Tornillos': (0.4, 0.4, 0.42)}


def color(inst):
    for k, v in COLORS.items():
        if inst.startswith(k):
            return v
    return (0.7, 0.7, 0.7)


def mesh_from_stl(name):
    m = trimesh.load(os.path.join(CANON, f'{name}.stl'), process=True)
    me = bpy.data.meshes.new(name)
    me.from_pydata(m.vertices.tolist(), [], m.faces.tolist())
    me.update()
    try:
        me.shade_smooth(); me.set_sharp_from_angle(angle=math.radians(32))
    except Exception:
        pass
    return me


def build_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.name = C.PREFIX
    sc.unit_settings.system = 'METRIC'; sc.unit_settings.scale_length = 0.001; sc.unit_settings.length_unit = 'MILLIMETERS'
    sc.render.fps = FPS
    cols = {}
    for k in ('Imprimir', 'Comprar_o_del_servo'):
        cols[k] = bpy.data.collections.new(k); sc.collection.children.link(cols[k])
    objs, meshes = {}, {}
    for it in R.ITEMS:
        if it.name not in meshes:
            meshes[it.name] = mesh_from_stl(it.name)
        for inst in it.instances:
            o = bpy.data.objects.new(inst, meshes[it.name])
            o.color = (*color(inst), 1.0)
            o.rotation_mode = 'QUATERNION'
            cols['Imprimir' if it.kind != 'referencia' else 'Comprar_o_del_servo'].objects.link(o)
            objs[inst] = o
    cam = bpy.data.objects.new('Camara', bpy.data.cameras.new('Camara'))
    cam.data.clip_start, cam.data.clip_end = 1, 5000
    sc.collection.objects.link(cam); sc.camera = cam
    sc.render.engine = 'BLENDER_WORKBENCH'
    sh = sc.display.shading
    sh.light = 'STUDIO'; sh.color_type = 'OBJECT'; sh.show_shadows = True; sh.shadow_intensity = 0.3
    sh.show_cavity = True; sh.cavity_type = 'BOTH'; sh.show_object_outline = True; sh.object_outline_color = (0.15, 0.2, 0.28)
    sh.background_type = 'VIEWPORT'; sh.background_color = (0.965, 0.975, 0.985)
    sc.display.render_aa = '8'; sc.view_settings.view_transform = 'Standard'
    w = bpy.data.worlds.new('Mundo'); sc.world = w; w.color = (0.965, 0.975, 0.985)
    sc.render.resolution_x, sc.render.resolution_y = 1600, 1000
    return sc, objs, cam


def apply(objs, tf):
    for inst, o in objs.items():
        if inst in tf:
            o.matrix_world = Matrix(np.asarray(tf[inst]).tolist())


def animate(sc, objs):
    """Ciclo: cerrada (comando 130°) → abierta (50°) → cerrada, con la cinemática del CAD. 2 ciclos."""
    sc.frame_start, sc.frame_end = 1, 2 * CYCLE
    for f in range(sc.frame_start, sc.frame_end + 1):
        u = ((f - 1) % CYCLE) / CYCLE
        beta = -C.BETA_WORK * math.cos(2 * math.pi * u)
        apply(objs, A.pose(beta))
        for o in objs.values():
            o.keyframe_insert('location', frame=f); o.keyframe_insert('rotation_quaternion', frame=f)


def look_at(eye, tgt):
    eye, tgt = np.array(eye, float), np.array(tgt, float)
    f = tgt - eye; f /= np.linalg.norm(f)
    r = np.cross(f, [0, 0, 1.0]); r /= np.linalg.norm(r)
    u = np.cross(r, f)
    M = np.eye(4); M[:3, 0], M[:3, 1], M[:3, 2], M[:3, 3] = r, u, -f, eye
    return M


def camera(cam, eye, tgt, lens=40):
    cam.animation_data_clear()
    cam.matrix_world = Matrix(look_at(eye, tgt).tolist())
    cam.data.type = 'PERSP'; cam.data.lens = lens


def render(sc, name, title, labels=(), legend=(), xray=False, hide=()):
    for o in sc.objects:
        if o.type == 'MESH':
            o.hide_render = o.name in hide
    sc.display.shading.show_xray = xray; sc.display.shading.xray_alpha = 0.4
    path = os.path.join(VIEWS, name)
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    im = Image.open(path).convert('RGB'); dr = ImageDraw.Draw(im); W, H = im.size
    bpy.context.view_layer.update()
    for txt, p, off, circle in labels:
        v = world_to_camera_view(sc, sc.camera, Vector(p))
        x, y = v.x * W, (1 - v.y) * H
        tx, ty = x + off[0], y + off[1]
        dr.line([(x, y), (tx, ty)], fill=(200, 30, 40), width=2)
        dr.ellipse([x - 4, y - 4, x + 4, y + 4], fill=(200, 30, 40))
        if circle:
            dr.ellipse([tx - 17, ty - 17, tx + 17, ty + 17], fill=(255, 255, 255), outline=(200, 30, 40), width=3)
            bb = dr.textbbox((0, 0), txt, font=FONT_N)
            dr.text((tx - (bb[2] - bb[0]) / 2, ty - (bb[3] - bb[1]) / 2 - 3), txt, fill=(20, 30, 50), font=FONT_N)
        else:
            bb = dr.textbbox((tx, ty), txt, font=FONT_S)
            dr.rectangle([bb[0] - 5, bb[1] - 3, bb[2] + 5, bb[3] + 3], fill=(255, 255, 255), outline=(200, 30, 40))
            dr.text((tx, ty), txt, fill=(20, 30, 50), font=FONT_S)
    if legend:
        y0 = 60
        for line in legend:
            dr.text((W - 470, y0), line, fill=(20, 30, 50), font=FONT_S); y0 += 25
    dr.rectangle([0, 0, W, 44], fill=(11, 37, 69)); dr.text((16, 9), title, fill=(255, 255, 255), font=FONT)
    dr.text((16, H - 30), f'{C.PROJECT} {C.REVISION} · geometría del CAD (no es un ensayo físico)', fill=(60, 80, 100), font=FONT_S)
    im.save(path); print('vista', path)


def center_of(inst, tf):
    it = next(i for i in R.ITEMS if inst in i.instances)
    m = trimesh.load(os.path.join(CANON, f'{it.name}.stl'))
    c = m.bounds.mean(axis=0)
    return tuple((np.asarray(tf[inst]) @ np.array([*c, 1.0]))[:3])


def views(sc, objs, cam):
    os.makedirs(VIEWS, exist_ok=True)
    ref = ('Servo', 'Horn', 'Tornillos_servo')
    apply(objs, A.pose(-C.BETA_WORK))
    camera(cam, (150, -190, 170), (0, 0, 30), 38)
    render(sc, 'Armado_cerrado.png', f'Conjunto armado · valvas cerradas (comando del servo {90 + C.BETA_WORK:.0f}°)')
    apply(objs, A.pose(C.BETA_WORK))
    render(sc, 'Armado_abierto.png', f'Conjunto armado · valvas abiertas 80° (comando {90 - C.BETA_WORK:.0f}°)')
    apply(objs, A.pose(0.0))
    camera(cam, (170, -170, 90), (0, 0, 30), 38)
    render(sc, 'Interior_transparente.png', 'Interior (transparente): servo → manivela → yugo → pistón → horquillas → colas de las valvas', xray=True)
    # despiece numerado
    tfe = A.exploded(-C.BETA_WORK, 1.0)
    apply(objs, tfe)
    camera(cam, (300, -380, 260), (-10, -30, 60), 36)
    num = {}
    for it in R.ITEMS:
        for inst in it.instances:
            num[inst] = it.num.lstrip('0') if it.num[0] != 'R' else it.num
    labels, seen = [], set()
    offs = {'Cuerpo': (110, 110), 'Valva_1': (120, -40), 'Piston': (150, 10), 'Yugo': (150, 40), 'Manivela': (-120, 40), 'Portasensor_2': (-90, -70),
            'Pasador_bisagra_1': (110, 60), 'Pasadores_horquilla': (-140, -10), 'Pasador_traba': (-120, -40), 'Pasador_manivela': (-110, -60),
            'Iman_2': (-90, -60), 'Hall_2': (-100, 50), 'Servo': (-110, 30), 'Horn': (-120, -10), 'Tornillos_servo': (-90, 60)}
    for inst, off in offs.items():
        labels.append((num[inst], center_of(inst, tfe), off, True))
    legend = ['IMPRIMIR'] + [f'{it.num.lstrip("0") or "0"}  {it.name.replace("_", " ")} × {it.qty}' for it in R.ITEMS if it.kind in ('obligatoria',)] + \
             ['', 'COMPRAR / VIENE CON EL SERVO'] + [f'{it.num}  {it.name.replace("_", " ")}' for it in R.ITEMS if it.kind == 'referencia']
    render(sc, 'Despiece_numerado.png', 'Despiece numerado · cada pieza se separa en su dirección de montaje', labels, legend)
    # detalle del Hall (transparente) y ventana del servo
    apply(objs, A.pose(-C.BETA_WORK))
    a = C.LEAF_DIR[0]
    M = A.Rz(a)
    hall = (M @ np.array([*P.hall_element(), 1.0]))[:3]
    mag = (A.leaf_tf(0, 0.0) @ np.array([*P.magnet_center(), 1.0]))[:3]
    ev = M[:3, :3] @ np.array([-0.35, 0.75, 0.55]); ev /= np.linalg.norm(ev)
    pin = (M @ np.array([C.D_HINGE, P.HINGE_PIN[0] + 2, C.Z_HINGE, 1.0]))[:3]
    tgt = (hall + mag) / 2 + M[:3, :3] @ np.array([0, -12.0, 0])
    camera(cam, tuple(tgt + ev * 150), tuple(tgt), 50)
    keep = {'Valva_1', 'Iman_1', 'Portasensor_1', 'Hall_1', 'Pasador_bisagra_1'}
    render(sc, 'Detalle_Hall_iman.png', 'Valva 1 sola: pasador de latón (entra por −v) · imán en el extremo del barril · portasensor con el Hall en el eje',
           [('imán Ø4×2 (gira con la valva)', tuple(mag), (-330, -110), False), ('Hall en el portasensor', tuple(hall), (60, -120), False),
            ('pasador de latón Ø3', tuple(pin), (-200, 90), False)], hide=tuple(o.name for o in sc.objects if o.type == 'MESH' and o.name not in keep))
    camera(cam, (10, -200, 60), (5, -20, 22), 40)
    render(sc, 'Ventana_servo.png', 'Ventana del servo: el servo entra con la manivela colgando; los 2 tornillos de las orejas se ajustan desde aquí')


def main():
    sc, objs, cam = build_scene()
    views(sc, objs, cam)
    animate(sc, objs)
    sc.frame_set(1)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, f'{C.PREFIX}.blend'), compress=True)
    print('Guardado', os.path.join(OUT, f'{C.PREFIX}.blend'))


if __name__ == '__main__':
    main()
