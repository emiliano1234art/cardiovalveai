"""
Animación de ARMADO de CardioValveAI v4 (MP4), paso a paso, con las mismas piezas y direcciones de montaje que la guía.
Cada pieza parte de su posición de despiece (assembly4.exploded) y entra en su dirección real de montaje.
Uso: /opt/bpy45/bin/python anim_armado4.py      Salida: out_v4/CardioValveAI_v4_Armado.mp4
"""
from __future__ import annotations
import math
import os
import shutil
import subprocess
import sys

import bpy
import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import blender4 as B        # noqa: E402
import config4 as C         # noqa: E402
import kin4 as K            # noqa: E402
import registry4 as R       # noqa: E402
import assembly4 as A       # noqa: E402
from geom4 import T, Rz     # noqa: E402

FRAMES = os.path.join(B.OUT, '_armado')
MP4 = os.path.join(B.OUT, f'{C.PREFIX}_Armado.mp4')
W_, H_ = 1280, 800
FPS = B.FPS
PREVIEW = [float(x) for x in os.environ['PREVIEW'].split(',')] if os.environ.get('PREVIEW') else None
LIFT = 100.0                                   # el subconjunto pistón + valvas se arma 100 mm sobre el cuerpo
B_OPEN = K.beta_for_theta(85.0)                # valvas bien abiertas para bajar el subconjunto
B_MOUNT = -90.0                                # servo en 180°: pasador de la manivela abajo
PISTON_SET = ('Piston', 'Yugo', 'Pasadores_horquilla', 'Pasador_traba')
CRANK_SET = ('Manivela', 'Pasador_manivela', 'Horn')


def smooth(t):
    t = min(max(t, 0.0), 1.0)
    return t * t * (3 - 2 * t)


def lerp_tf(a, b, t):
    """Interpola traslación (lineal) y rotación (por ejes, vía SVD de la mezcla) entre dos matrices 4×4."""
    m = np.eye(4)
    m[:3, 3] = a[:3, 3] + (b[:3, 3] - a[:3, 3]) * t
    r = a[:3, :3] * (1 - t) + b[:3, :3] * t
    u, _, vt = np.linalg.svd(r)
    m[:3, :3] = u @ vt
    return m


# ───────────────────────────── estados ─────────────────────────────
INST = [i for it in R.ITEMS for i in it.instances]
EXP = A.exploded(B_OPEN, 1.0)


def assembled(beta, lift=0.0):
    """Pose armada para β; el subconjunto móvil (valvas, imanes, pistón y sus pasadores) puede ir levantado."""
    p = A.pose(beta)
    out = {}
    for k, m in p.items():
        if k.startswith(('Valva', 'Iman')) or k in PISTON_SET:
            out[k] = T(0, 0, lift) @ m
        else:
            out[k] = m
    return out


def state_initial():
    s = dict(EXP)
    return s


# Pasos: (título, subtítulo, segundos, función(t ∈ 0..1, estado_base) → (estado, β para el texto o None), cámara)
# El estado al final de cada paso pasa a ser la base del siguiente.
def step_magnets(t, s):
    out = dict(s)
    for i, a in enumerate(C.LEAF_DIR):
        valve = s[f'Valva_{i + 1}']
        out[f'Iman_{i + 1}'] = valve @ T(0, 14 * (1 - smooth(t)), 0)
    return out


def step_valves_to_piston(t, s):
    out = dict(s)
    goal = assembled(B_OPEN, LIFT)
    tt = smooth(t)
    for k in ('Piston', 'Pasadores_horquilla') + tuple(f'{p}_{i}' for p in ('Valva', 'Iman') for i in (1, 2, 3)):
        out[k] = lerp_tf(s[k], goal[k], tt)
    # los pasadores R2 entran al final (a lo largo del eje de la horquilla, lado de afuera)
    t2 = smooth((t - 0.55) / 0.45)
    out['Pasadores_horquilla'] = T(0, 0, 0) @ goal['Pasadores_horquilla'] @ T(0, -25 * (1 - t2), 0) if t > 0.55 else s['Pasadores_horquilla']
    return out


def step_yoke(t, s):
    out = dict(s)
    goal = assembled(B_OPEN, LIFT)
    out['Yugo'] = lerp_tf(s['Yugo'], goal['Yugo'], smooth(t / 0.6))
    t2 = smooth((t - 0.6) / 0.4)
    out['Pasador_traba'] = goal['Pasador_traba'] @ T(0, -30 * (1 - t2), 0) if t > 0.6 else s['Pasador_traba']
    return out


def step_lower(t, s):
    out = dict(s)
    a, b = assembled(B_OPEN, LIFT), assembled(B_OPEN, 0)
    for k in a:
        if k.startswith(('Valva', 'Iman')) or k in PISTON_SET:
            out[k] = lerp_tf(a[k], b[k], smooth(t))
    return out


def step_hinge_pins(t, s):
    out = dict(s)
    goal = assembled(B_OPEN, 0)
    for i in range(3):
        ti = smooth((t - 0.22 * i) / 0.56)
        out[f'Pasador_bisagra_{i + 1}'] = lerp_tf(s[f'Pasador_bisagra_{i + 1}'], goal[f'Pasador_bisagra_{i + 1}'], ti)
    return out


def moving(beta, s):
    out = dict(s)
    p = assembled(beta, 0)
    for k in p:
        if k.startswith(('Valva', 'Iman')) or k in PISTON_SET:
            out[k] = p[k]
    return out


def step_hand_test(t, s):
    beta = B_OPEN + (-C.BETA_WORK - B_OPEN) * (0.5 - 0.5 * math.cos(2 * math.pi * 1.5 * t))
    return moving(beta, s), beta


def step_hall(t, s):
    out = dict(s)
    goal = assembled(B_OPEN, 0)
    for i, a in enumerate(C.LEAF_DIR):
        ti = smooth((t - 0.15 * i) / 0.4)          # el Hall entra al portasensor
        hall_park = Rz(a) @ T(0, 35, 0)
        out[f'Hall_{i + 1}'] = lerp_tf(s[f'Hall_{i + 1}'], hall_park, ti)
        tj = smooth((t - 0.45 - 0.12 * i) / 0.3)   # y el portasensor entra al túnel hasta tocar el barril
        if t > 0.45:
            out[f'Portasensor_{i + 1}'] = lerp_tf(Rz(a) @ T(0, 35, 0), goal[f'Portasensor_{i + 1}'], tj)
            out[f'Hall_{i + 1}'] = lerp_tf(hall_park, goal[f'Hall_{i + 1}'], tj)
    return out


def step_to_mount(t, s):
    beta = B_OPEN + (B_MOUNT - B_OPEN) * smooth(t)
    return moving(beta, s), None


def step_crank(t, s):
    out = dict(s)
    srv = T(0, -90, 0)
    goal = {k: srv @ A.crank_tf(B_MOUNT) for k in CRANK_SET}
    out['Horn'] = lerp_tf(s['Horn'], goal['Horn'], smooth(t / 0.4))
    out['Manivela'] = lerp_tf(s['Manivela'], goal['Manivela'], smooth((t - 0.3) / 0.4))
    out['Pasador_manivela'] = lerp_tf(s['Pasador_manivela'], goal['Pasador_manivela'], smooth((t - 0.6) / 0.4))
    return out


def step_servo_in(t, s):
    out = dict(s)
    dy = -90 * (1 - smooth(t))
    out['Servo'] = T(0, dy, 0)
    for k in CRANK_SET:
        out[k] = T(0, dy, 0) @ A.crank_tf(B_MOUNT)
    return out


def step_screws(t, s):
    out = dict(s)
    out['Tornillos_servo'] = T(0, -112 + 112 * smooth(t), 0)
    return out


def full_moving(beta, s):
    out = moving(beta, s)
    for k in CRANK_SET:
        out[k] = A.crank_tf(beta)
    return out


def step_to_closed(t, s):
    beta = B_MOUNT + (-C.BETA_WORK - B_MOUNT) * smooth(t)
    return full_moving(beta, s), beta


def step_run(t, s):
    beta = -C.BETA_WORK * math.cos(2 * math.pi * 2 * t)
    return full_moving(beta, s), beta


CAM_WIDE = ((300, -380, 260), (-10, -30, 60), 36)
CAM_TOP = ((225, -335, 290), (0, -5, 118), 40)
CAM_MID = ((230, -300, 220), (0, -5, 50), 40)
CAM_PIN = ((-60, -330, 160), (-15, -20, 45), 42)
CAM_SENS = ((250, 120, 150), (18, 22, 46), 46)
CAM_SERVO = ((150, -260, 100), (0, -42, 28), 46)
CAM_HERO = ((205, -255, 205), (0, -4, 30), 46)

STEPS = [
    ('Las piezas', 'Impresas: cuerpo, 3 valvas, pistón, yugo, manivela y 3 portasensores. Compradas: latón Ø3, imanes, sensores Hall y servo.', 3.0,
     lambda t, s: (s, None), CAM_WIDE),
    ('1 · Imanes en las valvas', 'Cada imán entra de canto en la ranura del extremo del barril, con una gota de cianoacrilato.', 3.5, lambda t, s: (step_magnets(t, s), None), CAM_TOP),
    ('2 · Valvas al pistón', 'La cola de cada valva entra en una horquilla; la fija un pasador de latón R2 (10,8 mm).', 4.5, lambda t, s: (step_valves_to_piston(t, s), None), CAM_TOP),
    ('3 · Yugo y traba', 'La espiga del yugo atraviesa el pistón desde abajo y se traba encima con el pasador R4 (12 mm).', 4.0, lambda t, s: (step_yoke(t, s), None), CAM_TOP),
    ('4 · El conjunto baja al cuerpo', 'Con las valvas abiertas, los 3 brazos del pistón entran en las 3 ranuras del cuerpo.', 4.0, lambda t, s: (step_lower(t, s), None), CAM_MID),
    ('5 · Pasadores de bisagra', 'Desde afuera, por el rebaje plano: un pasador R1 (49 mm) por valva, hasta el fondo del barril.', 4.5, lambda t, s: (step_hinge_pins(t, s), None), CAM_PIN),
    ('6 · Prueba a mano', 'Empujando el yugo por la ventana, las tres valvas abren y cierran juntas, sin roces.', 4.0, step_hand_test, CAM_MID),
    ('7 · Sensores Hall', 'Cada Hall va en su portasensor; el portasensor entra por el túnel lateral hasta tocar el barril.', 5.0, lambda t, s: (step_hall(t, s), None), CAM_SENS),
    ('8 · Preparar el servo', 'Servo en 180° (cvai_montaje.py) y horn colgando hacia abajo; la manivela se pega sobre el horn.', 4.5,
     lambda t, s: (step_crank(t, step_to_mount(min(t / 0.3, 1), s)[0]), None), CAM_SERVO),
    ('9 · Servo por la ventana', 'Entra acostado: el pasador de la manivela entra en la ranura del yugo.', 3.5, lambda t, s: (step_servo_in(t, s), None), CAM_SERVO),
    ('10 · Tornillos del servo', 'Las 2 orejas se atornillan al tabique desde afuera, por la ventana.', 2.5, lambda t, s: (step_screws(t, s), None), CAM_SERVO),
    ('Listo', 'Comando 130° = valvas cerradas · 50° = abiertas (unos 80°).', 6.0,
     lambda t, s: step_to_closed(t / 0.2, s) if t < 0.2 else step_run((t - 0.2) / 0.8, s), CAM_HERO),
]


def overlay(path, k, title, sub, beta):
    im = Image.open(path).convert('RGB'); dr = ImageDraw.Draw(im); W, H = im.size
    dr.rectangle([0, 0, W, 76], fill=(11, 37, 69))
    dr.text((22, 10), title, fill=(255, 255, 255), font=B.FONT)
    dr.text((22, 44), sub, fill=(185, 221, 224), font=B.FONT_S)
    n = len(STEPS) - 2
    for i in range(n):                       # avance por pasos
        x0 = W - 22 - (n - i) * 26
        done = 1 <= k and i < k
        dr.rounded_rectangle([x0, H - 30, x0 + 20, H - 22], 3, fill=(33, 178, 214) if done else (205, 214, 222))
    if beta is not None:
        th = round(K.theta(beta), 1) + 0.0
        dr.rounded_rectangle([W - 330, 92, W - 20, 150], 8, fill=(255, 255, 255), outline=(180, 195, 210), width=2)
        dr.text((W - 316, 100), f'Apertura de las valvas: {th:4.1f}°', fill=(20, 30, 50), font=B.FONT_S)
        frac = max(0.0, min(1.0, th / C.THETA_OPEN))
        dr.rectangle([W - 316, 128, W - 34, 140], fill=(225, 232, 240))
        dr.rectangle([W - 316, 128, W - 316 + 282 * frac, 140], fill=(33, 178, 214))
    dr.text((22, H - 32), f'{C.PROJECT} {C.REVISION} · armado (simulación del modelo 3D)', fill=(60, 80, 100), font=B.FONT_S)
    im.save(path)


def main():
    sc, objs, cam = B.build_scene()
    sc.render.resolution_x, sc.render.resolution_y = W_, H_
    shutil.rmtree(FRAMES, ignore_errors=True); os.makedirs(FRAMES)
    base = state_initial()
    cam_prev = STEPS[0][4]
    f = 0
    for k, (title, sub, secs, fn, camk) in enumerate(STEPS):
        n = int(secs * FPS)
        last = base
        picks = [int(n * q) for q in PREVIEW] if PREVIEW else range(n)
        for j in range(n):
            t = j / (n - 1)
            if PREVIEW and j not in picks:
                last = fn(1.0, base)[0] if j == n - 1 else last
                continue
            st, beta = fn(t, base)
            last = st
            B.apply(objs, st)
            tc = smooth(j / max(1, int(0.8 * FPS)))
            eye = tuple(np.array(cam_prev[0]) + (np.array(camk[0]) - np.array(cam_prev[0])) * tc)
            tgt = tuple(np.array(cam_prev[1]) + (np.array(camk[1]) - np.array(cam_prev[1])) * tc)
            lens = cam_prev[2] + (camk[2] - cam_prev[2]) * tc
            B.camera(cam, eye, tgt, lens)
            f += 1
            p = os.path.join(FRAMES, f'f{f:04d}.png')
            sc.render.filepath = p
            bpy.ops.render.render(write_still=True)
            overlay(p, k, title, sub, beta)
        base = last
        cam_prev = camk
        print(f'paso {k}: {title} ({n} cuadros)', flush=True)
    if PREVIEW:
        return
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(FPS), '-i', os.path.join(FRAMES, 'f%04d.png'),
                    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '21', '-preset', 'slow', '-movflags', '+faststart', MP4], check=True)
    print(f'{MP4}: {f} cuadros, {f / FPS:.1f} s')


if __name__ == '__main__':
    main()
