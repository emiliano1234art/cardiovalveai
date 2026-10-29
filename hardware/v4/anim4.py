"""
Animación de CardioValveAI v4 (MP4) con la MISMA cinemática que el CAD (kin4/assembly4). Blender 4.5 LTS (bpy), Workbench.
Tomas: 1) armado desde el despiece · 2) exterior girando, abriendo y cerrando · 3) mecanismo con el cuerpo oculto (servo → valvas) · 4) vista superior.
Cada cuadro lleva el comando del servo y la apertura θ calculada (no es una medición).
Uso: /opt/bpy45/bin/python anim4.py      Salida: out_v4/CardioValveAI_v4_Animacion.mp4
"""
from __future__ import annotations
import math
import os
import shutil
import subprocess
import sys

import bpy
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import blender4 as B       # noqa: E402
import config4 as C        # noqa: E402
import kin4 as K           # noqa: E402
import assembly4 as A      # noqa: E402

FRAMES = os.path.join(B.OUT, '_anim')
MP4 = os.path.join(B.OUT, f'{C.PREFIX}_Animacion.mp4')
W_, H_ = 1280, 800
CYC = B.CYCLE           # 96 cuadros = 4 s por ciclo


def smooth(t):
    t = min(max(t, 0.0), 1.0)
    return t * t * (3 - 2 * t)


def beta_at(u):
    """u ∈ [0, 1) dentro de un ciclo: cerrada → abierta → cerrada."""
    return -C.BETA_WORK * math.cos(2 * math.pi * u)


def orbit(angle_deg, r=250, z=170, tgt=(0, 0, 30)):
    a = math.radians(angle_deg)
    return (r * math.cos(a), r * math.sin(a), z), tgt


def dolly(t):
    """De la cámara del despiece (todo a la vista) a la del inicio de la toma 2."""
    (e0, g0), (e1, g1) = ((270, -350, 240), (-10, -25, 75)), orbit(-50)
    lerp = lambda a, b: tuple(x + (y - x) * t for x, y in zip(a, b))
    return lerp(e0, e1), lerp(g0, g1), 36 + 2 * t


SHOTS = [
    # (cuadros, título, función(k, n) → (transformaciones, β o None, cámara, piezas ocultas))
    (120, 'Armado: cada pieza entra en su dirección de montaje',
     lambda k, n: (A.exploded(-C.BETA_WORK, 1.0 - smooth((k - 12) / (n - 36))), None, dolly(smooth((k - 12) / (n - 24))), set())),
    (2 * CYC, 'Exterior: un servo abre y cierra las tres valvas a la vez',
     lambda k, n: (A.pose(beta_at(k / CYC)), beta_at(k / CYC), (*orbit(-50 + 70 * k / n), 38), set())),
    (2 * CYC, 'Mecanismo (cuerpo oculto): servo → manivela → yugo → pistón → colas de las valvas',
     lambda k, n: (A.pose(beta_at(k / CYC)), beta_at(k / CYC), ((150, -185, 95), (0, -8, 38), 45), {'Cuerpo'})),
    (CYC + 24, 'Vista superior: apertura de 0° a 80°',
     lambda k, n: (A.pose(beta_at(min(k, CYC) / CYC)), beta_at(min(k, CYC) / CYC), ((0.01, -60, 300), (0, 0, 40), 45), set())),
]


def overlay(path, title, beta, shot, nshots):
    im = Image.open(path).convert('RGB'); dr = ImageDraw.Draw(im); W, H = im.size
    dr.rectangle([0, 0, W, 44], fill=(11, 37, 69))
    dr.text((16, 9), f'{shot}/{nshots} · {title}', fill=(255, 255, 255), font=B.FONT)
    if beta is not None:
        th = round(K.theta(beta), 1) + 0.0
        cmd = 90 - beta
        x0, y0, bw = W - 360, 64, 330
        dr.rounded_rectangle([x0, y0, x0 + bw, y0 + 96], 10, fill=(255, 255, 255), outline=(180, 195, 210), width=2)
        dr.text((x0 + 14, y0 + 10), f'Comando del servo: {cmd:5.1f}°', fill=(20, 30, 50), font=B.FONT_S)
        dr.text((x0 + 14, y0 + 36), f'Apertura de las valvas θ: {th:4.1f}°', fill=(20, 30, 50), font=B.FONT_S)
        frac = max(0.0, min(1.0, th / C.THETA_OPEN))
        dr.rectangle([x0 + 14, y0 + 68, x0 + bw - 14, y0 + 82], fill=(225, 232, 240))
        dr.rectangle([x0 + 14, y0 + 68, x0 + 14 + (bw - 28) * frac, y0 + 82], fill=(33, 178, 214))
    dr.rectangle([0, H - 36, W, H], fill=(246, 249, 251))
    dr.text((16, H - 30), f'{C.PROJECT} {C.REVISION} · simulación cinemática del CAD (no es un ensayo físico ni una medición)',
            fill=(60, 80, 100), font=B.FONT_S)
    im.save(path)


def main():
    sc, objs, cam = B.build_scene()
    sc.render.resolution_x, sc.render.resolution_y = W_, H_
    shutil.rmtree(FRAMES, ignore_errors=True); os.makedirs(FRAMES)
    f = 0
    for s, (n, title, fn) in enumerate(SHOTS, start=1):
        for k in range(n):
            tf, beta, (eye, tgt, lens), hidden = fn(k, n)
            B.apply(objs, tf)
            B.camera(cam, eye, tgt, lens)
            for name, o in objs.items():
                o.hide_render = name in hidden
            f += 1
            p = os.path.join(FRAMES, f'f{f:04d}.png')
            sc.render.filepath = p
            bpy.ops.render.render(write_still=True)
            overlay(p, title, beta, s, len(SHOTS))
        print(f'toma {s}: {n} cuadros', flush=True)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(B.FPS), '-i', os.path.join(FRAMES, 'f%04d.png'),
                    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '21', '-preset', 'slow', '-movflags', '+faststart', MP4], check=True)
    print(f'{MP4}: {f} cuadros, {f / B.FPS:.1f} s')


if __name__ == '__main__':
    main()
