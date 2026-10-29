"""
Vistas de ubicación de sensores y recorrido de cables (Blender Workbench + rótulos con Pillow).
Uso: /opt/bpy45/bin/python blender_views.py   →   out_<REVISION>/Vistas/*.png
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
import make_docs_v3 as D    # noqa: E402
import parts as P           # noqa: E402

OUT = os.path.join(BA.OUT, 'Vistas')
FONT = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 22)
FONT_S = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 18)


def pose(objs, beta):
    tf = BA.frame_transforms({'beta': beta, 'mode': 'NORMAL', 'explode': 0.0, 'carrier': 0.0, 'gauge': 0.0, 'theta1': None, 'mems': 0.0})
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
    co = {r['id']: {'global': tuple(r['xyz'])} for r in D.sensor_coords()}
    lab = lambda k, off: (f"{k}  {D.P3(co[k]['global'])}", co[k]['global'], off)
    VX, VY, ZR = A.VX, A.VY, A.Z_RING
    hide_gauge = ('Calib_Gauge_40', 'Link_1_LostMotion', 'Link_1_LostMotion_IC', 'Stop_1_60')
    pose(objs, K.SWEEP)
    camera(cam, (VX, VY - 0.01, 400), (VX, VY, 0), ortho=230)
    render(sc, 'Vista_Sensores_Superior.png', [lab('H1', (40, -80)), lab('H2', (-330, -60)), lab('H3', (60, 40)), lab('M1', (40, 40))],
           'Ubicación de sensores (vista superior, válvula cerrada) · H1–H3 = Hall de posición · M1 = micrófono INMP441', hide=hide_gauge)
    mx, mz = P.tail_point(C.MAG_LEAF_S)
    for i in range(3):
        h = np.array(A.ring_local(i, *C.HALL_XYZ))
        mag = A.ring_local(i, mx, C.TAIL_Y[0] + 1.0, mz)
        out = h - np.array([VX, VY, h[2]]); out /= np.linalg.norm(out)
        tang = np.array([-out[1], out[0], 0.0])
        for beta, tag in ((K.SWEEP, 'cerrada'), (-K.SWEEP, 'abierta')):
            pose(objs, beta)
            camera(cam, h + out * 55 - tang * 40 + np.array([0, 0, 38]), h + np.array([0, 0, -2]), lens=60)
            th = K.pose(beta, 'NORMAL')['leaves'][i]['theta']
            magw = A.pose_transforms(beta, 'NORMAL')[f'Leaflet_{i+1}'] @ np.array([mx, C.TAIL_Y[0] + 1.0, mz, 1.0])
            render(sc, f'Vista_Hall_Iman_Valva{i+1}_{tag}.png',
                   [lab(f'H{i+1}', (60, -90)), (f'imán Ø{C.MAG_LEAF[0]:.0f}×{C.MAG_LEAF[1]:.0f} (θ = {int(round(th))}°)  {D.P3(magw[:3])}', tuple(magw[:3]), (-560, 90))],
                   f'Valva {i+1} · pareja Hall–imán · válvula {tag} (transparencia) · sensor fijo en el portasensor, imán en la cola', xray=True, hide=hide_gauge)
    pose(objs, K.SWEEP)
    tf = A.pose_transforms(K.SWEEP, 'NORMAL')
    for name in ('Hall_Carrier_2', 'Hall_2'):          # solo el de la valva 2 (en cuadro); los otros son iguales
        objs[name].matrix_world = Matrix((A.T(0, 0, 22) @ tf[name]).tolist())
    h = np.array(A.ring_local(1, *C.HALL_XYZ))
    camera(cam, h + np.array([-85, -110, 95]), h + np.array([0, 0, 14]), lens=42)
    render(sc, 'Vista_Portasensor_Retirado.png', [lab('H2', (60, -60))], 'Portasensor Hall retirado hacia arriba (sin desarmar el mecanismo) · bolsillo con ventana al interior', hide=hide_gauge)
    pose(objs, K.servo_from_zp(K.zp_rigid(40.0, C.LINK_L)))
    objs['Calib_Gauge_40'].matrix_world = Matrix((A.RING @ A.Rz(K.leaf_dir(0))).tolist())
    g = np.array(A.ring_local(0, 22.0, 0.0, 18.0))
    camera(cam, g + np.array([115, 35, 70]), g + np.array([0, 0, -2]), lens=38)
    render(sc, 'Vista_Galga_Calibracion_40.png', [], 'Galga de calibración de 40° sobre la valva 1: la cara superior de la valva la toca exactamente a 40°',
           hide=('Link_1_LostMotion', 'Link_1_LostMotion_IC', 'Stop_1_60', 'Angle_Scale'))
    pose(objs, K.SWEEP)
    camera(cam, (VX + 250, VY - 300, ZR + 230), (VX + 30, VY - 5, 20), lens=32)
    cab = A.cable_routes()
    render(sc, 'Vista_Cables_Isometrica_Cerrada.png', [(f'{k}', pts[min(2, len(pts) - 1)], (30, -30 - 22 * i)) for i, (k, pts) in enumerate(cab.items())],
           'Recorrido de cables (amarillo) · válvula CERRADA · señales por el sur, servo/5 V por el norte', hide=hide_gauge)
    pose(objs, -K.SWEEP)
    render(sc, 'Vista_Cables_Isometrica_Abierta.png', [], 'Recorrido de cables (amarillo) · válvula ABIERTA (plato abajo)', hide=hide_gauge)
    pose(objs, K.SWEEP)
    st = A.stand_holder_frame()[:3, 3]
    camera(cam, st + np.array([110, -120, 30]), np.array([VX, VY, ZR + 5]), lens=34)
    render(sc, 'Vista_M1_Soporte.png', [lab('M1', (50, -70))], 'M1: INMP441 en soporte independiente (ranura radial ±8 mm, pivote) · puerto acústico libre', hide=hide_gauge)
    camera(cam, (C.TRAY_XY[0] + 40, C.TRAY_XY[1] - 140, 190), (C.TRAY_XY[0] + 40, C.TRAY_XY[1] + 50, 10), lens=40)
    render(sc, 'Vista_Bandeja_Electronica.png', [], 'Bandeja: placa perforada 70×90, ESP32 en zócalos (antena hacia −y, USB hacia +y) · NO DEFINITIVA', hide=hide_gauge)

    fastener_views(sc, objs, cam, hide_gauge)


def fastener_views(sc, objs, cam, hide_gauge):
    """v3.1: fijaciones impresas montadas y sueltas."""
    VX, VY, ZR = A.VX, A.VY, A.Z_RING
    pose(objs, K.SWEEP)
    a = (K.leaf_dir(0) + 60) * math.pi / 180
    nut = np.array([VX + C.COLUMN_R * math.cos(a), VY + C.COLUMN_R * math.sin(a), ZR + C.RING_H + C.POST_H + C.KNURL_NUT[1]])
    head = np.array(A.ring_local(0, *P.STOP_SCREW, C.RING_H))
    camera(cam, np.array([VX, VY, ZR]) + np.array([95, -110, 120]), np.array([VX, VY, ZR + 16]), lens=50)
    render(sc, 'Vista_Fijaciones_Anillo.png', [(f'tuerca moleteada M6 impresa', tuple(nut), (40, -80)), ('cabeza impresa del pasador del tope', tuple(head), (-420, -90))],
           'Anillo: tuercas M6 moleteadas impresas sobre los espárragos de las columnas · pasadores de latón con cabeza impresa en los topes', hide=hide_gauge)
    sh = A.servo_mount_holes()
    camera(cam, (sh[0][0] - 60, sh[0][1] - 120, 140), (sh[0][0] + 20, sh[0][1] + 15, C.BASE_T + 4), lens=45)
    render(sc, 'Vista_Fijaciones_Servo.png', [(f'perno M6×8 impreso {k+1}', (x, y, C.BASE_T + 3 + C.BOLT_HEAD[1]), (30, -40 - 26 * k)) for k, (x, y) in enumerate(sh)],
           'Soporte del servo: 4 pernos M6×8 impresos (cabeza moleteada, se aprietan con los dedos) fuera de la huella del servo', hide=hide_gauge)
    # fijaciones sueltas (STL imprimibles en su marco canónico), en fila, lejos del banco
    items = [('Bolt_M6x8', 'Perno M6×8 · 9'), ('Knurled_Nut_M6', 'Tuerca moleteada M6 · 4'), ('Pin_Head', 'Cabeza de pasador · 10'),
             ('Push_Nut', 'Tuerca a presión · 10'), ('Turn_Button', 'Pestillo · 5'), ('Thread_Coupon', 'Probeta de roscas · 1')]
    x0, y0 = -400.0, -400.0
    labels, xs = [], x0
    for name, txt in items:
        o = bpy.data.objects.new(f'Suelta_{name}', BA.mesh_from_stl(name))
        o.color = (0.1, 0.55, 0.55, 1.0)
        sc.collection.objects.link(o)
        bb = np.array(o.bound_box)
        w = bb[:, 0].max() - bb[:, 0].min()
        o.location = (xs - bb[:, 0].min(), y0, 0.0)
        labels.append((txt, (xs + w / 2, y0, bb[:, 2].min()), (-60, 70)))
        xs += w + 9.0
    pin = bpy.data.objects.new('Suelta_Pasador', bpy.data.meshes.new('pasador'))
    import bmesh
    bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=True, segments=24, radius1=1.0, radius2=1.0, depth=18.0); bm.to_mesh(pin.data); bm.free()
    pin.color = (0.82, 0.66, 0.28, 1.0); sc.collection.objects.link(pin)
    pin.location = (xs + 2, y0, 9.0)
    labels.append(('Pasador de latón Ø2 (varilla cortada)', (xs + 2, y0, 0.0), (-160, 110)))
    xm = (x0 + xs) / 2
    camera(cam, (xm, y0 - 150, 110), (xm, y0, 2), lens=55)
    only = tuple(o.name for o in sc.objects if o.type == 'MESH' and not o.name.startswith('Suelta_'))
    render(sc, 'Vista_Fijaciones_Impresas.png', labels, f'Fijaciones impresas en PETG (v3.1) + pasador de latón · rosca M6 con compensación {C.THREAD_COMP:.2f} mm por lado'.replace('.', ','), hide=only)


if __name__ == '__main__':
    main()
