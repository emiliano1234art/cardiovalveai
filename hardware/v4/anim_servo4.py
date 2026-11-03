"""
Animación: cómo instalar el pistón con el yugo (lo que sube y baja) y el servo. CardioValveAI v4 (MP4).
Mismas piezas, posiciones y cinemática del CAD. El tornillo central del horn no está en el CAD: se dibuja como ilustración.
En la parte del servo el cuerpo se muestra CORTADO (sin la pared de adelante) para ver cómo entra el servo y su pasador en el yugo.
Uso: /opt/bpy45/bin/python anim_servo4.py      (PREVIEW=0.5,0.95 → solo esos puntos de cada paso, para revisar cámaras)
Salida: out_v4/CardioValveAI_v4_Instalar_servo_y_piston.mp4
"""
from __future__ import annotations
import math
import os
import shutil
import subprocess
import sys

import bpy
import numpy as np
import manifold3d as m3d
import trimesh
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import blender4 as B        # noqa: E402
import config4 as C         # noqa: E402
import kin4 as K            # noqa: E402
import parts4 as P          # noqa: E402
import assembly4 as A       # noqa: E402
import anim_armado4 as AA   # noqa: E402  (pasos del pistón/yugo ya validados)
from geom4 import T, Ry     # noqa: E402

FRAMES = os.path.join(B.OUT, '_servo_anim')
MP4 = os.path.join(B.OUT, f'{C.PREFIX}_Instalar_servo_y_piston.mp4')
W_, H_ = 1280, 800
FPS = B.FPS
PREVIEW = [float(x) for x in os.environ['PREVIEW'].split(',')] if os.environ.get('PREVIEW') else None
smooth, lerp_tf = AA.smooth, AA.lerp_tf
FAR = T(0, 0, 10000)
SHIFT = 60.0                                         # la manivela se prepara 60 mm delante de la ventana
Y_OUT = P.Y_CRANK + C.CRANK_T                         # cara exterior de la manivela
Y_SCREW = P.Y_HORN_TOP - 4.6                          # centro del tornillo del horn instalado (cabeza al ras del brazo del horn)
MOUNT = A.crank_tf(-90.0)                             # servo a 180°: manivela colgando
B_MOUNT = -90.0
CHAIN = ('Servo', 'Horn', 'Manivela', 'Pasador_manivela', 'Tornillo_horn')
PART1_FAR = ('Servo', 'Horn', 'Manivela', 'Pasador_manivela', 'Tornillos_servo', 'Portasensor_1', 'Portasensor_2', 'Portasensor_3', 'Hall_1', 'Hall_2', 'Hall_3')


def add_extras(sc, objs):
    """Tornillo del horn (ilustración) y cuerpo cortado (sin la pared de adelante, y ≥ la cara del tabique)."""
    shank = trimesh.creation.cylinder(radius=1.0, height=6.0, sections=24)
    head = trimesh.creation.cylinder(radius=2.0, height=1.6, sections=24)
    head.apply_translation([0, 0, 3.8])
    m = trimesh.util.concatenate([shank, head])
    m.apply_transform(np.array([[1, 0, 0, 0], [0, 0, -1, 0], [0, 1, 0, 0], [0, 0, 0, 1]], float))
    me = bpy.data.meshes.new('tornillo_horn')
    me.from_pydata(m.vertices.tolist(), [], m.faces.tolist()); me.update()
    o = bpy.data.objects.new('Tornillo_horn', me)
    o.color = (0.75, 0.76, 0.8, 1.0); o.rotation_mode = 'QUATERNION'
    sc.collection.objects.link(o); objs['Tornillo_horn'] = o
    # cuerpo cortado
    body = trimesh.load(os.path.join(B.CANON, 'Cuerpo.stl'))
    mf = m3d.Manifold(m3d.Mesh(vert_properties=np.asarray(body.vertices, np.float32), tri_verts=np.asarray(body.faces, np.uint32)))
    cut = mf.trim_by_plane((0, 1, 0), P.Y_EAR1 - 0.2).to_mesh()
    me2 = bpy.data.meshes.new('cuerpo_corte')
    me2.from_pydata(np.asarray(cut.vert_properties)[:, :3].tolist(), [], np.asarray(cut.tri_verts).tolist()); me2.update()
    try:
        me2.shade_smooth(); me2.set_sharp_from_angle(angle=math.radians(32))
    except Exception:
        pass
    o2 = bpy.data.objects.new('Cuerpo_corte', me2)
    o2.color = objs['Cuerpo'].color; o2.rotation_mode = 'QUATERNION'
    sc.collection.objects.link(o2); objs['Cuerpo_corte'] = o2


def all_far(keys):
    return {k: FAR for k in keys}


# ───────────────────────────── parte 1: pistón + yugo ─────────────────────────────
def base1():
    s = dict(AA.EXP)                                           # piezas separadas (despiece)
    lift = AA.assembled(AA.B_OPEN, AA.LIFT)
    for k in lift:                                             # valvas, imanes, pistón y pasadores R2 ya unidos, 100 mm sobre el cuerpo
        if k.startswith(('Valva', 'Iman')) or k in ('Piston', 'Pasadores_horquilla'):
            s[k] = lift[k]
    s.update(all_far(PART1_FAR)); s['Tornillo_horn'] = FAR; s['Cuerpo_corte'] = FAR
    return s


def p1_yoke(t, s):   return AA.step_yoke(t, s), None
def p1_lower(t, s):  return AA.step_lower(t, s), None
def p1_pins(t, s):   return AA.step_hinge_pins(t, s), None
def p1_hand(t, s):   return AA.step_hand_test(t, s)


def p1_down(t, s):
    beta = -C.BETA_WORK + (B_MOUNT + C.BETA_WORK) * smooth(t)
    return AA.moving(beta, s), beta


# ───────────────────────────── parte 2: servo ─────────────────────────────
def mount_base(s):
    """Estado de montaje: todo el conjunto armado con el pistón abajo del todo; las piezas del servo se mueven en cada paso."""
    out = dict(s)
    p = A.pose(B_MOUNT)
    for k, v in p.items():
        if k not in CHAIN and k != 'Tornillos_servo' and k != 'Pasador_manivela':
            out[k] = v
    out['Cuerpo'] = FAR
    return out


def chain_state(shift_y, off_h=0.0, off_s=0.0, spin=0.0, off_c=0.0, off_p=0.0, show=('Servo', 'Horn', 'Tornillo_horn', 'Manivela', 'Pasador_manivela')):
    sh = T(0, shift_y, 0)
    o = {}
    o['Servo'] = sh if 'Servo' in show else FAR
    o['Horn'] = sh @ T(0, off_h, 0) @ MOUNT if 'Horn' in show else FAR
    o['Tornillo_horn'] = sh @ T(0, Y_SCREW + off_s, C.Z_SERVO) @ Ry(spin) if 'Tornillo_horn' in show else FAR
    o['Manivela'] = sh @ T(0, off_c, 0) @ MOUNT if 'Manivela' in show else FAR
    o['Pasador_manivela'] = sh @ T(0, off_p, 0) @ MOUNT if 'Pasador_manivela' in show else FAR
    return o


def p2_prepare(t, s):
    out = dict(s)
    s_h = smooth(t / 0.20)
    s_s = smooth((t - 0.20) / 0.22)
    s_c = smooth((t - 0.45) / 0.22)
    s_p = smooth((t - 0.72) / 0.20)
    show = ['Servo']
    if True: show += ['Horn']
    if t > 0.18: show += ['Tornillo_horn']
    if t > 0.43: show += ['Manivela']
    if t > 0.70: show += ['Pasador_manivela']
    out.update(chain_state(-SHIFT, off_h=34 * (1 - s_h), off_s=34 * (1 - s_s), spin=-720 * (1 - s_s), off_c=34 * (1 - s_c), off_p=28 * (1 - s_p), show=tuple(show)))
    return out, None


def p2_insert(t, s):
    out = dict(s)
    out.update(chain_state(-SHIFT * (1 - smooth(t))))
    return out, None


def p2_screws(t, s):
    out = dict(s)
    out.update(chain_state(0.0))
    out['Tornillos_servo'] = T(0, -40 * (1 - smooth(t)), 0)
    return out, None


def p2_test(t, s):
    out = dict(s)
    if t < 0.22:                                           # el yugo sube desde el fondo hasta «cerrado» (comando 130°)
        beta = B_MOUNT + (-C.BETA_WORK - B_MOUNT) * smooth(t / 0.22)
    else:                                                  # dos ciclos abrir y cerrar
        u = (t - 0.22) / 0.78
        beta = -C.BETA_WORK * math.cos(2 * math.pi * 2 * u)
    p = AA.full_moving(beta, out)
    out.update(p)
    out['Tornillos_servo'] = T(0, 0, 0)
    return out, beta


CAM = {
    'wide': ((300, -380, 260), (-10, -30, 60), 36),
    'top': ((225, -335, 290), (0, -5, 118), 40),
    'mid': ((230, -300, 220), (0, -5, 50), 40),
    'pin': ((-60, -330, 160), (-15, -20, 45), 42),
    'win': ((10, -230, 70), (0, -8, 40), 40),
    'chain': ((190, -185, 105), (0, -62, C.Z_SERVO - 2), 40),
    'insert': ((150, -190, 78), (0, -22, C.Z_SERVO + 2), 42),
    'screws': ((4, -210, 52), (0, -10, C.Z_SERVO + 2), 36),
    'run': ((165, -125, 95), (0, -14, C.Z_SERVO + 4), 42),
}

# (título, subtítulo, segundos, función, cámara, parte, cuerpo, ocultar_extra)
FULL_BODY, CUT_BODY = 'full', 'cut'
STEPS = [
    ('Pistón y yugo (la pieza que sube y baja) · 1/5', 'La espiga del yugo atraviesa el pistón desde abajo y se traba arriba con el pasador R4 (12 mm). Sin tornillos.', 4.0, p1_yoke, 'top', 1, FULL_BODY),
    ('Pistón y yugo · 2/5 · bajan al cuerpo', 'Con las valvas abiertas, los 3 brazos del pistón entran en las 3 ranuras verticales del cuerpo.', 4.0, p1_lower, 'mid', 1, FULL_BODY),
    ('Pistón y yugo · 3/5 · pasadores de bisagra', 'Desde afuera: un pasador R1 (49 mm) por valva. Así quedan sujetos al cuerpo las valvas y el pistón.', 4.0, p1_pins, 'pin', 1, FULL_BODY),
    ('Pistón y yugo · 4/5 · prueba a mano', 'Empuja el yugo por la ventana: el pistón y las 3 valvas suben y bajan juntos, sin roces.', 4.0, p1_hand, 'win', 1, FULL_BODY),
    ('Pistón y yugo · 5/5 · yugo hasta el fondo', 'Antes de poner el servo, baja el yugo del todo: su ranura queda a la altura del pasador de la manivela colgando.', 2.5, p1_down, 'win', 1, FULL_BODY),
    ('Servo · 1/4 · preparar la manivela', 'Servo a 180° · horn en el eje · tornillo central del horn · manivela pegada (cianoacrilato) · pasador R3 (9,5 mm) a presión.', 6.0, p2_prepare, 'chain', 2, 'none'),
    ('Servo · 2/4 · entra por la ventana', 'Acostado, con la manivela colgando: el pasador entra en la ranura del yugo y las orejas llegan al tabique. (Cuerpo cortado para verlo.)', 4.5, p2_insert, 'insert', 2, CUT_BODY),
    ('Servo · 3/4 · tornillos A y B', 'Los 2 tornillos del servo, desde afuera por la ventana: atraviesan las orejas y roscan en el tabique.', 3.5, p2_screws, 'screws', 2, CUT_BODY),
    ('Servo · 4/4 · prueba', 'El pasador de la manivela corre por la ranura del yugo y lo sube y baja: abre y cierra las 3 valvas (comando 130° cerrado · 50° abierto).', 6.0, p2_test, 'run', 2, CUT_BODY),
]
# en el paso «preparar» solo se ve la cadena del servo
SHOW_ONLY = {5: CHAIN}


def wrap_text(text, font, width, dr):
    out, cur = [], ''
    for w in text.split(' '):
        t = (cur + ' ' + w).strip()
        if dr.textlength(t, font=font) <= width or not cur:
            cur = t
        else:
            out.append(cur); cur = w
    out.append(cur)
    return out


def overlay(path, k, title, sub, beta, marks):
    im = Image.open(path).convert('RGB'); dr = ImageDraw.Draw(im); W, H = im.size
    lines = wrap_text(sub, B.FONT_S, W - 44, dr)
    bar = 44 + 24 * len(lines)
    dr.rectangle([0, 0, W, bar], fill=(11, 37, 69))
    dr.text((22, 9), title, fill=(255, 255, 255), font=B.FONT)
    for i, ln in enumerate(lines):
        dr.text((22, 42 + 24 * i), ln, fill=(185, 221, 224), font=B.FONT_S)
    for letter, (x, y), (dx, dy) in marks:
        dr.line([(x, y), (x + dx, y + dy)], fill=(200, 30, 40), width=3)
        dr.ellipse([x - 5, y - 5, x + 5, y + 5], fill=(200, 30, 40))
        cx, cy = x + dx, y + dy
        dr.ellipse([cx - 17, cy - 17, cx + 17, cy + 17], fill=(255, 255, 255), outline=(200, 30, 40), width=3)
        bb = dr.textbbox((0, 0), letter, font=B.FONT_N)
        dr.text((cx - (bb[2] - bb[0]) / 2, cy - (bb[3] - bb[1]) / 2 - 3), letter, fill=(20, 30, 50), font=B.FONT_N)
    n = len(STEPS)
    for i in range(n):
        x0 = W - 22 - (n - i) * 26
        dr.rounded_rectangle([x0, H - 30, x0 + 20, H - 22], 3, fill=(33, 178, 214) if i <= k else (205, 214, 222))
    if beta is not None and k != 4:
        th = round(K.theta(beta), 1) + 0.0
        dr.rounded_rectangle([W - 330, bar + 14, W - 20, bar + 72], 8, fill=(255, 255, 255), outline=(180, 195, 210), width=2)
        dr.text((W - 316, bar + 22), f'Apertura de las valvas: {th:4.1f}°', fill=(20, 30, 50), font=B.FONT_S)
        frac = max(0.0, min(1.0, th / C.THETA_OPEN))
        dr.rectangle([W - 316, bar + 50, W - 34, bar + 62], fill=(225, 232, 240))
        dr.rectangle([W - 316, bar + 50, W - 316 + 282 * frac, bar + 62], fill=(33, 178, 214))
    dr.text((22, H - 32), f'{C.PROJECT} {C.REVISION} · simulación del modelo 3D', fill=(60, 80, 100), font=B.FONT_S)
    im.save(path)


def main():
    sc, objs, cam = B.build_scene()
    add_extras(sc, objs)
    sc.render.resolution_x, sc.render.resolution_y = W_, H_
    shutil.rmtree(FRAMES, ignore_errors=True); os.makedirs(FRAMES)
    base = base1()
    prev = CAM['top']
    f = 0
    ear = [(P.EAR_HOLES_X[0], P.Y_EAR0 - 1.0, C.Z_SERVO), (P.EAR_HOLES_X[1], P.Y_EAR0 - 1.0, C.Z_SERVO)]
    for k, (title, sub, secs, fn, camk, part, body) in enumerate(STEPS):
        if k == 5:
            base = mount_base(base)                       # entra la parte 2: estado de montaje (yugo abajo del todo)
        n = int(secs * FPS)
        picks = [int(n * q) for q in PREVIEW] if PREVIEW else None
        last = base
        for j in range(n):
            t = j / (n - 1)
            st, beta = fn(t, base)
            last = st
            if picks is not None and j not in picks:
                continue
            st = dict(st)
            if body == FULL_BODY:
                st['Cuerpo'] = A.pose(0)['Cuerpo']; st['Cuerpo_corte'] = FAR
            elif body == CUT_BODY:
                st['Cuerpo'] = FAR; st['Cuerpo_corte'] = np.eye(4)
            else:
                st['Cuerpo'] = FAR; st['Cuerpo_corte'] = FAR
            B.apply(objs, st)
            c0, c1 = prev, CAM[camk]
            tc = smooth(j / max(1, int(0.9 * FPS)))
            eye = tuple(np.array(c0[0]) + (np.array(c1[0]) - np.array(c0[0])) * tc)
            tgt = tuple(np.array(c0[1]) + (np.array(c1[1]) - np.array(c0[1])) * tc)
            lens = c0[2] + (c1[2] - c0[2]) * tc
            B.camera(cam, eye, tgt, lens)
            keep = SHOW_ONLY.get(k)
            for name, o in objs.items():
                o.hide_render = bool(keep) and name not in keep
            marks = []
            if k == 7:
                bpy.context.view_layer.update()
                for letter, p, off in zip('AB', ear, ((-95, -60), (95, -60))):
                    v = world_to_camera_view(sc, cam, Vector(p))
                    marks.append((letter, (v.x * W_, (1 - v.y) * H_), off))
            f += 1
            path = os.path.join(FRAMES, f'f{f:04d}.png')
            sc.render.filepath = path
            bpy.ops.render.render(write_still=True)
            overlay(path, k, title, sub, beta, marks)
        base = last
        prev = CAM[camk]
        print(f'paso {k}: {title} ({n} cuadros)', flush=True)
    if PREVIEW:
        return
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(FPS), '-i', os.path.join(FRAMES, 'f%04d.png'),
                    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '21', '-preset', 'slow', '-movflags', '+faststart', MP4], check=True)
    print(f'{MP4}: {f} cuadros, {f / FPS:.1f} s')


if __name__ == '__main__':
    main()
