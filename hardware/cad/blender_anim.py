"""
Escena de Blender de CardioValveAI con la animación del mecanismo (bpy como módulo de Python).

Cada cuadro se calcula con la MISMA cinemática que el CAD (kinematics.py / assembly.py):
el servo mueve la palanca → empujador → plato → bielas → valvas. Nada se anima "a mano".

Uso:  python blender_anim.py [--render] [--fps 24] [--res 1280x720]
Salida: out_v3/CardioValveAI_v3_Final.blend (guardado con el bpy del Blender que lo ejecuta: usar Blender 4.5 LTS),
        out_v3/anim_frames/*.png, out_v3/CardioValveAI_v3_Animacion.mp4
"""
from __future__ import annotations
import argparse
import math
import os
import subprocess
import sys

import bpy
import numpy as np
import trimesh
from mathutils import Matrix

sys.path.insert(0, os.path.dirname(__file__))
import config as C          # noqa: E402
import kinematics as K      # noqa: E402
import assembly as A        # noqa: E402
import registry as R        # noqa: E402

OUT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', C.OUT_DIR))
CANON = os.path.join(OUT, '_canon')
FPS = 24

COLORS = {
    'Valve_Ring': (0.93, 0.95, 0.97), 'Leaflet': (0.13, 0.74, 0.86), 'Link': (0.96, 0.58, 0.12), 'Stop': (0.85, 0.2, 0.25),
    'Actuator_Plate': (0.11, 0.25, 0.45), 'Pushrod': (0.96, 0.58, 0.12), 'Column': (0.78, 0.82, 0.87), 'Pin': (0.55, 0.58, 0.62),
    'MEMS_Board_Reference': (0.45, 0.25, 0.75), 'Servo_MG90S_Reference': (0.12, 0.3, 0.85),
    'Servo_Horn_Reference': (0.95, 0.95, 0.95), 'Servo_Mount': (0.6, 0.65, 0.72),
    'ESP32_Board_Reference': (0.08, 0.1, 0.14), 'Angle_Scale': (0.97, 0.97, 0.97), 'Base': (0.88, 0.9, 0.93),
    # v2
    'Magnet': (0.75, 0.1, 0.12), 'Tail_Pin': (0.82, 0.66, 0.28), 'Hall_Carrier': (0.95, 0.55, 0.1), 'Hall_': (0.05, 0.05, 0.05),
    'Calib_Gauge': (0.55, 0.2, 0.75), 'Cable_Clip': (0.3, 0.32, 0.38),
    'MEMS_Stand': (0.45, 0.47, 0.55), 'Electronics_Tray': (0.6, 0.65, 0.72), 'Tray_Clamp': (0.45, 0.47, 0.55),
    'Perfboard_ESP32_Reference': (0.1, 0.42, 0.2), 'Cable_Routes_Reference': (0.98, 0.78, 0.1),
    'Plate_Fasteners_Reference': (0.5, 0.52, 0.56), 'Ring_Fasteners_Reference': (0.82, 0.66, 0.28),
}
COLORS['Pin'] = (0.82, 0.66, 0.28)      # v2: ejes de latón

def color_for(inst: str):
    for k, v in COLORS.items():
        if inst.startswith(k):
            return v
    return (0.7, 0.7, 0.7)

# ───────────────────────────── guion (segmentos) ─────────────────────────────
SEGMENTS = [
    # (clave, segundos, título del rótulo)
    ('cerrada', 1.5, '1 · Válvula completamente cerrada'),
    ('apertura', 2.5, '2 · Apertura progresiva (servo 130° → 50°)'),
    ('abierta', 1.5, '3 · Válvula completamente abierta (80°)'),
    ('cierre', 2.5, '4 · Cierre progresivo'),
    ('restringida', 5.0, '5 · Apertura restringida: valva 1 limitada a 60°'),
    ('incompleto', 5.0, f'6 · Cierre incompleto: valva 1 queda en {C.IC_RESIDUAL:.0f}°'),
    ('explotada', 4.0, '7 · Vista explotada'),
    ('carrier', 4.0, '8 · Portasensor Hall: se retira y se vuelve a colocar sin desarmar'),
    ('mems', 3.5, '9 · Micrófono M1 (INMP441) en soporte independiente y ajustable'),
    ('mecanismo', 6.0, '10 · Servo → empujador → plato → 3 bielas → 3 valvas'),
    ('hall', 5.0, '11 · Posición medida: imán en la cola + sensor Hall en el anillo (H1–H3)'),
    ('cables', 5.0, '12 · Recorrido de cables (amarillo) durante el ciclo'),
    ('galga', 4.0, '13 · Calibración: galga de 40° — la valva se detiene al tocarla'),
]

def seg_frames():
    out, f = [], 1
    for key, sec, title in SEGMENTS:
        n = int(round(sec * FPS))
        out.append((key, f, f + n - 1, title))
        f += n
    return out

def smooth(u):
    u = min(1.0, max(0.0, u))
    return u * u * (3 - 2 * u)

def cycle_beta(u):
    """Ciclo completo cerrado → abierto → cerrado con perfil suave."""
    return K.SWEEP * math.cos(2 * math.pi * u)

def state(frame: int) -> dict:
    for key, f0, f1, title in seg_frames():
        if f0 <= frame <= f1:
            u = (frame - f0) / max(1, f1 - f0)
            s = {'seg': key, 'beta': K.SWEEP, 'mode': 'NORMAL', 'explode': 0.0, 'carrier': 0.0, 'gauge': 0.0, 'theta1': None, 'mems': 0.0}
            if key == 'apertura':
                s['beta'] = K.SWEEP - 2 * K.SWEEP * smooth(u)
            elif key == 'abierta':
                s['beta'] = -K.SWEEP
            elif key == 'cierre':
                s['beta'] = -K.SWEEP + 2 * K.SWEEP * smooth(u)
            elif key == 'restringida':
                s['mode'] = 'RESTRINGIDA_60'; s['beta'] = cycle_beta(u)
            elif key == 'incompleto':
                s['mode'] = 'CIERRE_INCOMPLETO'; s['beta'] = cycle_beta(u)
            elif key == 'explotada':
                s['explode'] = math.sin(math.pi * smooth(u))
            elif key == 'carrier':
                s['carrier'] = math.sin(math.pi * smooth(u))
            elif key == 'galga':
                s['gauge'] = 1.0
                th = 40.0 * smooth(min(1.0, u * 1.6))
                s['beta'] = K.servo_from_zp(K.zp_rigid(th, C.LINK_L)); s['theta1'] = th
            elif key == 'mems':
                s['mems'] = 1 - smooth(u * 1.25)
            elif key in ('mecanismo', 'cables'):
                s['beta'] = K.SWEEP * math.cos(4 * math.pi * u)
            elif key == 'hall':
                s['beta'] = K.SWEEP * math.cos(2 * math.pi * u)
            return s
    return {'seg': 'mecanismo', 'beta': K.SWEEP, 'mode': 'NORMAL', 'explode': 0.0, 'carrier': 0.0, 'gauge': 0.0, 'theta1': None, 'mems': 0.0}

# ───────────────────────────── cámaras por segmento ─────────────────────────────
VX, VY, ZR = A.VX, A.VY, A.Z_RING

def camera_for(seg):
    tgt = np.array([VX, VY, ZR + 10])
    if seg in ('cerrada', 'apertura', 'abierta', 'cierre', 'restringida', 'incompleto'):
        return np.array([VX + 95, VY - 125, ZR + 135]), tgt, 42
    if seg == 'explotada':
        return np.array([VX + 260, VY - 330, ZR + 210]), np.array([VX + 10, VY, ZR - 5]), 40
    if seg == 'carrier':
        h = A.ring_local(1, *C.HALL_XYZ)
        return np.array(h) + np.array([-75, -100, 75]), np.array(h) + np.array([0, 0, 14]), 50
    if seg == 'galga':
        g = A.ring_local(0, 22.0, 0.0, 18.0)
        return np.array(g) + np.array([115, 35, 70]), np.array(g) + np.array([0, 0, -2]), 38
    if seg == 'mems':
        c = A.stand_holder_frame()[:3, 3]
        return c + np.array([95, -100, 45]), c + np.array([-20, 15, -20]), 38
    if seg == 'hall':
        h = A.ring_local(0, *C.HALL_XYZ)
        return np.array(h) + np.array([45, 85, 55]), np.array(h) + np.array([-4, -8, -4]), 45
    if seg == 'cables':
        return np.array([VX + 150, VY - 260, ZR + 190]), np.array([VX + 35, VY - 10, 15]), 34
    return np.array([VX + 185, VY - 175, ZR + 25]), np.array([VX, VY, ZR - 28]), 40

def look_at(cam, tgt):
    f = tgt - cam; f /= np.linalg.norm(f)
    up = np.array([0, 0, 1.0])
    r = np.cross(f, up); r /= np.linalg.norm(r)
    u = np.cross(r, f)
    M = np.eye(4)
    M[:3, 0], M[:3, 1], M[:3, 2], M[:3, 3] = r, u, -f, cam
    return M

# ───────────────────────────── construcción de la escena ─────────────────────────────

def mesh_from_stl(name):
    m = trimesh.load(os.path.join(CANON, f'{name}.stl'), process=True)
    me = bpy.data.meshes.new(name)
    me.from_pydata(m.vertices.tolist(), [], m.faces.tolist())
    me.update()
    try:
        me.shade_smooth()
        me.set_sharp_from_angle(angle=math.radians(32))
    except Exception:
        pass
    return me

def build_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.name = C.PREFIX
    sc.unit_settings.system = 'METRIC'
    sc.unit_settings.scale_length = 0.001
    sc.unit_settings.length_unit = 'MILLIMETERS'
    sc.render.fps = FPS
    meshes = {}
    def mesh(n):
        if n not in meshes:
            meshes[n] = mesh_from_stl(n)
        return meshes[n]
    objs = {}
    col_print = bpy.data.collections.new('Piezas_imprimibles'); sc.collection.children.link(col_print)
    col_ref = bpy.data.collections.new('Referencia_NO_IMPRIMIR'); sc.collection.children.link(col_ref)
    col_alt = bpy.data.collections.new('Modulos_alterados'); sc.collection.children.link(col_alt)
    for it in R.ITEMS:
        for inst in it.instances:
            o = bpy.data.objects.new(inst, mesh(it.name))
            o.color = (*color_for(inst), 1.0)
            o.rotation_mode = 'QUATERNION'
            (col_print if it.printable else col_ref).objects.link(o)
            objs[inst] = o
    # módulos alternativos de la valva 1 (se muestran solo en su segmento)
    for inst, part in (('Link_1_LostMotion', 'Link_LostMotion'), ('Link_1_LostMotion_IC', 'Link_LostMotion_IC'), ('Stop_1_60', 'Opening_Stop_60'),
                       ('Calib_Gauge_40', 'Calib_Gauge_40')):
        o = bpy.data.objects.new(inst, mesh(part))
        o.color = (*color_for(inst if inst.startswith('Calib') else inst.split('_1')[0]), 1.0)
        o.rotation_mode = 'QUATERNION'
        col_alt.objects.link(o)
        objs[inst] = o
    # cámara y luces
    cam = bpy.data.objects.new('Camara', bpy.data.cameras.new('Camara'))
    cam.data.clip_start, cam.data.clip_end = 1, 5000
    cam.rotation_mode = 'QUATERNION'
    sc.collection.objects.link(cam)
    sc.camera = cam
    # render Workbench (aspecto técnico) con sombras y cavidades
    sc.render.engine = 'BLENDER_WORKBENCH'
    sh = sc.display.shading
    sh.light = 'STUDIO'
    sh.color_type = 'OBJECT'
    sh.show_shadows = True
    sh.shadow_intensity = 0.35
    sh.show_cavity = True
    sh.cavity_type = 'BOTH'
    sh.show_object_outline = True
    sh.object_outline_color = (0.15, 0.2, 0.28)
    sh.background_type = 'VIEWPORT'
    sh.background_color = (0.965, 0.975, 0.985)
    sc.display.render_aa = '8'
    sc.render.film_transparent = False
    sc.view_settings.view_transform = 'Standard'
    world = bpy.data.worlds.new('Mundo'); sc.world = world
    world.color = (0.965, 0.975, 0.985)
    return sc, objs, cam

def frame_transforms(s):
    tf = A.pose_transforms(s['beta'], s['mode'], s['explode'])
    if s['carrier'] > 0:
        for name in ('Hall_Carrier_2', 'Hall_2'):          # el de la valva 2 (en cuadro); los otros dos son iguales
            tf[name] = A.T(0, 0, 24 * s['carrier']) @ tf[name]
    tf['Calib_Gauge_40'] = A.RING @ A.Rz(K.leaf_dir(0))
    if s['mems'] > 0:
        u = s['mems']
        tf['MEMS_Stand_Holder'] = A.T(0, 0, 45 * u) @ tf['MEMS_Stand_Holder']
        tf['MEMS_Board_Reference'] = A.T(0, 0, 80 * u) @ tf['MEMS_Board_Reference']
    # módulos alternativos de la valva 1
    tf['Link_1_LostMotion'] = tf['Link_1']
    tf['Link_1_LostMotion_IC'] = tf['Link_1']
    tf['Stop_1_60'] = tf['Stop_1']
    return tf

VISIBLE_IN = {
    'Link_1': lambda s: s['mode'] == 'NORMAL',
    'Link_1_LostMotion': lambda s: s['mode'] == 'RESTRINGIDA_60',
    'Link_1_LostMotion_IC': lambda s: s['mode'] == 'CIERRE_INCOMPLETO',
    'Stop_1': lambda s: s['mode'] != 'RESTRINGIDA_60',
    'Stop_1_60': lambda s: s['mode'] == 'RESTRINGIDA_60',
    'Calib_Gauge_40': lambda s: s['gauge'] > 0,
}

def animate(sc, objs, cam):
    segs = seg_frames()
    sc.frame_start, sc.frame_end = 1, segs[-1][2]
    for key, f0, f1, title in segs:
        mk = sc.timeline_markers.new(title, frame=f0)
    prev_vis = {}
    for f in range(sc.frame_start, sc.frame_end + 1):
        s = state(f)
        tf = frame_transforms(s)
        for inst, o in objs.items():
            M = tf.get(inst)
            if M is None:
                continue
            o.matrix_world = Matrix(M.tolist())
            o.keyframe_insert('location', frame=f)
            o.keyframe_insert('rotation_quaternion', frame=f)
            vis = VISIBLE_IN.get(inst)
            if vis is not None:
                v = bool(vis(s))
                if prev_vis.get(inst) != v:
                    o.hide_render = not v
                    o.hide_viewport = not v
                    o.keyframe_insert('hide_render', frame=f)
                    o.keyframe_insert('hide_viewport', frame=f)
                    prev_vis[inst] = v
        # cámara con transición suave de 14 cuadros al inicio de cada segmento
        cur = [x for x in segs if x[1] <= f <= x[2]][0]
        i = segs.index(cur)
        c1, t1, l1 = camera_for(cur[0])
        if i > 0 and f - cur[1] < 14:
            c0, t0, l0 = camera_for(segs[i - 1][0])
            w = smooth((f - cur[1]) / 14)
            c, t, l = c0 + (c1 - c0) * w, t0 + (t1 - t0) * w, l0 + (l1 - l0) * w
        else:
            c, t, l = c1, t1, l1
        cam.matrix_world = Matrix(look_at(c, t).tolist())
        cam.keyframe_insert('location', frame=f)
        cam.keyframe_insert('rotation_quaternion', frame=f)
        cam.data.lens = l
        cam.data.keyframe_insert('lens', frame=f)
    # interpolación constante (los valores ya están muestreados por cuadro)
    for o in list(objs.values()) + [cam]:
        ad = o.animation_data
        if ad and ad.action:
            for fc in getattr(ad.action, 'fcurves', []):
                for kp in fc.keyframe_points:
                    kp.interpolation = 'CONSTANT'

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--render', action='store_true')
    ap.add_argument('--res', default='1280x720')
    ap.add_argument('--frames', default='')
    ap.add_argument('--aa', default='8')
    ap.add_argument('--part', default='0/1', help='k/n: renderiza solo los cuadros f con f %% n == k (para paralelizar)')
    ap.add_argument('--no-save', action='store_true')
    a = ap.parse_args()
    sc, objs, cam = build_scene()
    animate(sc, objs, cam)
    sc.frame_set(1)
    if not a.no_save:
        blend = os.path.join(OUT, f'{C.PREFIX}_Final.blend')
        bpy.ops.wm.save_as_mainfile(filepath=blend, compress=True)
        print('Guardado', blend)
    sc.display.render_aa = a.aa
    if a.render:
        w, h = map(int, a.res.split('x'))
        sc.render.resolution_x, sc.render.resolution_y = w, h
        sc.render.resolution_percentage = 100
        frames_dir = os.path.join(OUT, 'anim_frames')
        os.makedirs(frames_dir, exist_ok=True)
        sc.render.image_settings.file_format = 'PNG'
        rng = range(sc.frame_start, sc.frame_end + 1)
        if a.frames:
            rng = [int(x) for x in a.frames.split(',')]
        k, n = map(int, a.part.split('/'))
        rng = [f for f in rng if f % n == k]
        import shutil
        last_sig, last_path = None, None
        for f in rng:
            path = os.path.join(frames_dir, f'f{f:04d}.png')
            st = state(f)
            sig = (st['seg'] if f - [x for x in seg_frames() if x[1] <= f <= x[2]][0][1] >= 14 else f'{st["seg"]}{f}',
                   round(st['beta'], 4), st['mode'], round(st['explode'], 4), round(st['carrier'], 4), round(st['gauge'], 4), round(st['mems'], 4))
            if os.path.exists(path) and not a.frames:
                last_sig, last_path = sig, path
                continue
            if sig == last_sig and last_path and os.path.exists(last_path):
                shutil.copyfile(last_path, path)        # cuadro idéntico (pausa): no se vuelve a renderizar
                continue
            sc.frame_set(f)
            sc.render.filepath = path
            bpy.ops.render.render(write_still=True)
            last_sig, last_path = sig, path
        print('Cuadros listos')

if __name__ == '__main__':
    main()
