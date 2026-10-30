"""
Miniaturas de cada pieza (Blender 4.5, Workbench, fondo transparente) para la guía «Dónde va cada pieza».
Cada pieza se muestra sola, en su posición de montaje (valvas a 40°), con la cámara ajustada a su tamaño.
Uso: /opt/bpy45/bin/python guia_thumbs4.py      Salida: out_v4/Guia/mini_<pieza>.png
"""
from __future__ import annotations
import os
import sys

import bpy
import numpy as np
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import blender4 as B        # noqa: E402
import assembly4 as A       # noqa: E402
import kin4 as K            # noqa: E402

OUT = os.path.join(B.OUT, 'Guia')
SHOW = {   # miniatura → instancias visibles
    'Cuerpo': ['Cuerpo'], 'Valva': ['Valva_1', 'Iman_1'], 'Piston': ['Piston'], 'Yugo': ['Yugo'], 'Manivela': ['Manivela', 'Pasador_manivela'],
    'Portasensor': ['Portasensor_1', 'Hall_1'], 'Pasadores': ['Pasador_bisagra_1', 'Pasadores_horquilla', 'Pasador_traba'],
    'Servo': ['Servo', 'Horn', 'Manivela', 'Pasador_manivela'], 'Conjunto_valvas_piston': ['Valva_1', 'Valva_2', 'Valva_3', 'Piston', 'Yugo',
                                                                                       'Pasadores_horquilla', 'Pasador_traba', 'Iman_1', 'Iman_2', 'Iman_3'],
}
VIEW = np.array([0.62, -0.78, 0.55])
_c, _s = np.cos(np.radians(30)), np.sin(np.radians(30))
_INSIDE = np.array([[_c, -_s, 0], [_s, _c, 0], [0, 0, 1]]) @ np.array([-0.55, 0.55, 0.62])   # valva 1 vista desde adentro (imán y Hall a la vista)
VIEWS = {'Portasensor': _INSIDE}


def main():
    os.makedirs(OUT, exist_ok=True)
    sc, objs, cam = B.build_scene()
    sc.render.film_transparent = True
    sc.render.resolution_x, sc.render.resolution_y = 900, 700
    sc.display.shading.show_object_outline = True
    B.apply(objs, A.pose(K.beta_for_theta(40.0)))
    for name, insts in SHOW.items():
        for o in sc.objects:
            if o.type == 'MESH':
                o.hide_render = o.name not in insts
        pts = np.array([list(objs[i].matrix_world @ Vector(c)) for i in insts for c in objs[i].bound_box])
        ctr = (pts.min(0) + pts.max(0)) / 2
        r = np.linalg.norm(pts.max(0) - pts.min(0)) / 2
        v = VIEWS.get(name, VIEW); v = v / np.linalg.norm(v)
        B.camera(cam, tuple(ctr + v * r * 3.0), tuple(ctr), 50)
        sc.render.filepath = os.path.join(OUT, f'mini_{name}.png')
        bpy.ops.render.render(write_still=True)
        print('mini', name, flush=True)


if __name__ == '__main__':
    main()
