"""
Lámina «Servo · manivela · yugo: qué se atornilla y qué no» (renders de Blender sobre el modelo del CAD v4 + rótulos).
Uso: /opt/bpy45/bin/python guia_servo4.py      Salida: out_v4/Guia/Servo_manivela_yugo.png
El tornillo central del horn NO está en el CAD: se dibuja como ilustración (viene en la bolsa del servo).
"""
from __future__ import annotations
import os
import sys

import bpy
import numpy as np
import trimesh
from PIL import Image, ImageDraw
from mathutils import Matrix

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import blender4 as B        # noqa: E402
import config4 as C         # noqa: E402
import parts4 as P          # noqa: E402
import assembly4 as A       # noqa: E402
from geom4 import T         # noqa: E402

OUTD = os.path.join(B.OUT, 'Guia')
os.makedirs(OUTD, exist_ok=True)


def add_screw(sc, objs):
    """Tornillo del horn (ilustración): cabeza Ø4 × 1,6 y caña Ø2 × 6, eje a lo largo de +y; la cabeza queda en el extremo +y."""
    shank = trimesh.creation.cylinder(radius=1.0, height=6.0, sections=24)
    head = trimesh.creation.cylinder(radius=2.0, height=1.6, sections=24)
    head.apply_translation([0, 0, 3.8])
    m = trimesh.util.concatenate([shank, head])
    m.apply_transform(np.array([[1, 0, 0, 0], [0, 0, -1, 0], [0, 1, 0, 0], [0, 0, 0, 1]], float))   # eje z → eje y
    me = bpy.data.meshes.new('tornillo_horn')
    me.from_pydata(m.vertices.tolist(), [], m.faces.tolist()); me.update()
    o = bpy.data.objects.new('Tornillo_horn', me)
    o.color = (0.75, 0.76, 0.8, 1.0)
    o.rotation_mode = 'QUATERNION'
    sc.collection.objects.link(o)
    objs['Tornillo_horn'] = o
    return o


def hide_except(objs, keep):
    return tuple(n for n in objs if n not in keep)


def wp(M, x, y, z):
    return tuple((np.asarray(M) @ np.array([x, y, z, 1.0]))[:3])


def main():
    sc, objs, cam = B.build_scene()
    add_screw(sc, objs)
    sc.render.resolution_x, sc.render.resolution_y = 1500, 900
    V = B.VIEWS
    os.makedirs(V, exist_ok=True)

    # ── 1 · afuera, por la ventana: los 2 tornillos de las orejas ──
    tf = A.pose(-C.BETA_WORK)
    tf['Tornillo_horn'] = T(0, 500, 0)
    B.apply(objs, tf)
    B.camera(cam, (6, -215, 40), (6, -30, 27), 34)
    zs = C.Z_SERVO
    y_head = P.Y_EAR0 - 1.0
    labels = [('A', (P.EAR_HOLES_X[0], y_head, zs), (-130, -70), True), ('B', (P.EAR_HOLES_X[1], y_head, zs), (130, -70), True)]
    CAP = {}
    CAP[1] = ['A y B · los 2 tornillos que trae el servo (Phillips chico). Entran desde afuera por la ventana, atraviesan las orejas del servo',
              '     y se enroscan en los agujeros guía del tabique del cuerpo. Apriétalos de a poco, alternando, hasta que el servo quede firme.']
    B.render(sc, 'Servo_1_orejas.png', 'Dónde SÍ se atornilla (1/3) · el servo al cuerpo: 2 tornillos, A y B, desde afuera por la ventana',
             labels, (), hide=hide_except(objs, ('Cuerpo', 'Servo', 'Horn', 'Manivela', 'Pasador_manivela', 'Tornillos_servo')))

    # ── 2 · cadena servo → horn → manivela: el tornillo central y el pasador ──
    mount = A.crank_tf(-90.0)
    y0 = {}
    tf = {'Servo': T(0, -60, 0), 'Horn': T(0, -34, 0) @ mount, 'Manivela': mount, 'Pasador_manivela': T(0, 24, 0) @ mount,
          'Tornillo_horn': T(0, 0, 0)}
    # el servo no gira; la manivela y el horn cuelgan (pose de montaje, servo a 180°)
    tf['Servo'] = T(0, -60, 0)
    # tornillo del horn: eje del servo, delante de la cara exterior de la manivela
    y_out = P.Y_CRANK + C.CRANK_T
    tf['Tornillo_horn'] = T(0, y_out + 18, C.Z_SERVO) @ np.eye(4)
    B.apply(objs, tf)
    B.camera(cam, (170, -110, 120), (0, -22, C.Z_SERVO - 4), 38)
    ctr = lambda inst, M: B.center_of(inst, {inst: M})
    labels = [
        ('1', tuple(np.array([0.0, y_out + 19, C.Z_SERVO])), (60, -110), True),
        ('2', ctr('Horn', tf['Horn']), (-120, 90), True),
        ('3', ctr('Manivela', tf['Manivela']), (130, 60), True),
        ('4', ctr('Pasador_manivela', tf['Pasador_manivela']), (120, -70), True),
        ('5', ctr('Servo', tf['Servo']), (-140, -60), True),
    ]
    CAP[2] = ['1 · tornillo CENTRAL del horn (el de la bolsa del servo; dibujo ilustrativo): entra por el agujero del centro de la manivela y rosca en el eje del servo.',
              '2 · horn de un brazo: queda dentro del encastre de la manivela.     3 · manivela: se PEGA al horn con cianoacrilato (sin tornillo).',
              '4 · pasador de latón R3 (Ø3 × 9,5 mm): a presión desde la cara exterior de la manivela (sin tornillo).     5 · servo (dibujado separado para verlo).']
    B.render(sc, 'Servo_2_cadena.png', 'Dónde SÍ se atornilla (2/3) · la manivela al servo: 1 tornillo central; el resto va pegado o a presión', labels, (),
             hide=hide_except(objs, ('Servo', 'Horn', 'Manivela', 'Pasador_manivela', 'Tornillo_horn')))

    # ── 3 · dónde NO se atornilla: la manivela solo «se apoya» en el yugo por su pasador ──
    tf = A.pose(-C.BETA_WORK)
    tf['Tornillo_horn'] = T(0, 500, 0)
    B.apply(objs, tf)
    B.camera(cam, (95, 120, 78), (0, -4, C.Z_SERVO + 2), 40)
    pin_end = (C.CRANK_R * np.sin(np.radians(-C.BETA_WORK)) * 0 + 0.0, P.CRANK_PIN[1] - 0.5, 0.0)
    labels = [
        ('6', B.center_of('Yugo', tf), (-170, 40), True),
        ('7', B.center_of('Pasador_traba', tf), (-120, -80), True),
        ('4', B.center_of('Pasador_manivela', tf), (170, 70), True),
    ]
    CAP[3] = ['6 · YUGO: no lleva tornillos; cuelga del pistón (el pistón está oculto en este dibujo).     7 · pasador de latón R4 (12 mm): lo traba al pistón, a presión.',
              '4 · el pasador R3 de la manivela solo ENTRA en la ranura horizontal del yugo y corre por ella al girar el servo: sin tornillo, sin pegamento.']
    B.render(sc, 'Servo_3_yugo.png', 'Dónde NO se atornilla (3/3) · el yugo y su unión con la manivela: solo pasadores de latón', labels, (),
             hide=hide_except(objs, ('Servo', 'Horn', 'Manivela', 'Pasador_manivela', 'Yugo', 'Pasador_traba')))

    # ── lámina ──
    ims = [Image.open(os.path.join(V, n)).convert('RGB') for n in ('Servo_1_orejas.png', 'Servo_2_cadena.png', 'Servo_3_yugo.png')]
    W = 1500
    ims = [im.resize((W, int(im.height * W / im.width))) for im in ims]
    resumen = [
        'RESUMEN · en todo el conjunto servo – manivela – yugo hay solo 3 tornillos, todos los que trae el servo:',
        '   · 2 tornillos de las orejas (A y B): servo → tabique del cuerpo, desde afuera por la ventana.',
        '   · 1 tornillo central del horn: horn → eje del servo, por el agujero del centro de la manivela.',
        'Todo lo demás NO se atornilla: manivela ↔ horn se pega; el pasador R3 va a presión en la manivela;',
        'yugo ↔ pistón se traban con el pasador R4 (a presión); manivela ↔ yugo solo se tocan por el pasador en la ranura.',
    ]
    capH = [30 + 26 * len(CAP[i + 1]) for i in range(3)]
    pad = 16
    out = Image.new('RGB', (W, sum(i.height for i in ims) + sum(capH) + 40 + 30 * len(resumen) + 3 * pad), (252, 253, 254))
    y = 0
    dr = ImageDraw.Draw(out)
    for k, im in enumerate(ims):
        out.paste(im, (0, y)); y += im.height
        dr.rectangle([0, y, W, y + capH[k]], fill=(238, 243, 245))
        for j, t in enumerate(CAP[k + 1]):
            dr.text((22, y + 14 + j * 26), t, fill=(11, 37, 69), font=B.FONT_S)
        y += capH[k] + pad
    dr.rectangle([0, y, W, out.height], fill=(238, 243, 245))
    for i, t in enumerate(resumen):
        dr.text((24, y + 14 + i * 30), t, fill=(11, 37, 69), font=B.FONT if i == 0 else B.FONT_S)
    dst = os.path.join(OUTD, 'Servo_manivela_yugo.png')
    out.save(dst)
    print('lámina', dst, out.size)


if __name__ == '__main__':
    main()
