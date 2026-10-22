"""
Vistas de ubicación de sensores y recorrido de cables (Blender Workbench + rótulos con Pillow).
Uso: /opt/bpy45/bin/python blender_views.py   →   out_v2/Vistas/*.png
Las etiquetas se ubican proyectando la posición 3D real de cada sensor (assembly.py) sobre la imagen.
"""
from __future__ import annotations
import math
import os
import sys

import bpy
import numpy as np
from mathutils import Matrix, Vector
from bpy_extras.object_utils import world_to_camera_view
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, os.path.dirname(__file__))
import config as C          # noqa: E402
import kinematics as K      # noqa: E402
import assembly as A        # noqa: E402
import blender_anim as BA   # noqa: E402
import make_docs_v2 as D    # noqa: E402
import parts as P           # noqa: E402

OUT = os.path.join(BA.OUT, 'Vistas')
FONT = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 22)
FONT_S = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 18)


def pose(objs, beta):
    tf = BA.frame_transforms({'beta': beta, 'mode': 'NORMAL', 'explode': 0.0, 'piezo': 0.0, 'mems': 0.0})
    for inst, o in objs.items():
        if inst in tf:
            o.animation_data_clear()
            o.matrix_world = Matrix(tf[inst].tolist())
    for alt in ('Link_1_LostMotion', 'Link_1_LostMotion_IC', 'Stop_1_60'):
        objs[alt].hide_render = True


def camera(cam, eye, tgt, lens=40, ortho=None):
    cam.animation_data_clear()
    cam.data.animation_data_clear()
    cam.matrix_world = Matrix(BA.look_at(np.array(eye, float), np.array(tgt, float)).tolist())
    if ortho:
        cam.data.type = 'ORTHO'; cam.data.ortho_scale = ortho
    else:
        cam.data.type = 'PERSP'; cam.data.lens = lens


def render(sc, name, labels, title, xray=False, hide=()):
    for o in sc.objects:
        if o.type == 'MESH':
            o.hide_render = o.name in hide or o.name in ('Link_1_LostMotion', 'Link_1_LostMotion_IC', 'Stop_1_60')
    sc.display.shading.show_xray = xray
    sc.display.shading.xray_alpha = 0.45
    path = os.path.join(OUT, name)
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    im = Image.open(path).convert('RGB')
    dr = ImageDraw.Draw(im)
    W, H = im.size
    bpy.context.view_layer.update()
    for txt, p, off in labels:
        v = world_to_camera_view(sc, sc.camera, Vector(p))
        x, y = v.x * W, (1 - v.y) * H
        tx, ty = x + off[0], y + off[1]
        dr.line([(x, y), (tx, ty)], fill=(200, 30, 40), width=3)
        dr.ellipse([x - 6, y - 6, x + 6, y + 6], outline=(200, 30, 40), width=3)
        bb = dr.textbbox((tx, ty), txt, font=FONT_S)
        dr.rectangle([bb[0] - 5, bb[1] - 3, bb[2] + 5, bb[3] + 3], fill=(255, 255, 255), outline=(200, 30, 40))
        dr.text((tx, ty), txt, fill=(20, 30, 50), font=FONT_S)
    dr.rectangle([0, 0, W, 44], fill=(11, 37, 69))
    dr.text((16, 9), title, fill=(255, 255, 255), font=FONT)
    dr.text((16, H - 30), f'{C.PROJECT} {C.REVISION} · geometría del CAD (no es una medición) · coordenadas en mm desde la esquina de la base', fill=(60, 80, 100), font=FONT_S)
    im.save(path)
    print('vista', path)


def main():
    os.makedirs(OUT, exist_ok=True)
    sc, objs, cam = BA.build_scene()
    sc.render.resolution_x, sc.render.resolution_y = 1600, 1000
    sc.display.render_aa = '8'
    co = D.sensor_coords()
    lab = lambda k, off: (f"{k}  {D.P3(co[k]['global'])}", co[k]['global'], off)
    VX, VY, ZR = A.VX, A.VY, A.Z_RING
    pose(objs, K.SWEEP)
    camera(cam, (VX, VY - 0.01, 400), (VX, VY, 0), ortho=230)
    render(sc, 'Vista_Sensores_Superior.png',
           [lab('H1', (40, -80)), lab('H2', (-330, -60)), lab('H3', (60, 40)), lab('H0', (-360, -120)), lab('P1', (-330, 60)), lab('P2', (60, 30)),
            lab('M1', (40, 40)), lab('M1_alt', (-380, -40))],
           'Ubicación de sensores (vista superior, válvula cerrada) · H = Hall de posición · P = piezo · M = micrófono')
    camera(cam, (VX + 250, VY - 300, ZR + 230), (VX + 30, VY - 5, 20), lens=32)
    cab = A.cable_routes()
    render(sc, 'Vista_Cables_Isometrica_Cerrada.png',
           [(f'{k}', pts[min(2, len(pts) - 1)], (30, -30 - 22 * i)) for i, (k, pts) in enumerate(cab.items())],
           'Recorrido de cables (amarillo) · válvula CERRADA · señales por el sur, servo/5 V por el norte')
    pose(objs, -K.SWEEP)
    render(sc, 'Vista_Cables_Isometrica_Abierta.png', [], 'Recorrido de cables (amarillo) · válvula ABIERTA (plato abajo): sin interferencias en el barrido de 125 poses')
    pose(objs, K.SWEEP)
    h = np.array(A.ring_local(0, *C.HALL_XYZ))
    camera(cam, h + np.array([-25, -90, 55]), h + np.array([-3, 0, -3]), lens=55)
    mx, mz = P.tail_point(C.MAG_LEAF_S)
    render(sc, 'Vista_Hall_H1_Detalle.png', [lab('H1', (60, -90)), ('imán Ø4×2 en la cola (valva 1)', A.ring_local(0, mx, C.TAIL_Y[0] + 1.0, mz), (-420, 80))],
           'Medición de posición: imán en la cola + DRV5055 en el anillo (vista con transparencia)', xray=True)
    M2 = A.p2_frame()
    camera(cam, M2[:3, 3] + np.array([95, 120, 60]), M2[:3, 3] + np.array([-10, 0, 0]), lens=38)
    render(sc, 'Vista_P2_Servo.png', [lab('P2', (60, -60))], 'P2: piezo en la almohadilla del soporte del servo (lado aislado por las gomas)')
    st = A.stand_holder_frame()[:3, 3]
    camera(cam, st + np.array([110, -120, 30]), np.array([VX, VY, ZR + 5]), lens=34)
    render(sc, 'Vista_M1_Soporte.png', [lab('M1', (50, -70)), lab('M1_alt', (50, 40))], 'M1: soporte independiente (recomendado al inicio) y escuadra alternativa en el anillo')
    camera(cam, (C.TRAY_XY[0] + 40, C.TRAY_XY[1] - 140, 190), (C.TRAY_XY[0] + 40, C.TRAY_XY[1] + 50, 10), lens=40)
    render(sc, 'Vista_Bandeja_Electronica.png', [], 'Bandeja: placa perforada 70×90, ESP32 en zócalos (antena hacia −y fuera de la placa, USB hacia +y) · NO DEFINITIVA')


if __name__ == '__main__':
    main()
