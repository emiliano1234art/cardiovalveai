"""
Genera TODO el paquete de CardioVal AI:
  out/CardioValAI_STL/*.stl              piezas imprimibles, ya orientadas para la cama
  out/CardioValAI_STEP/*.step            sólidos B-rep editables (marco de ensamblaje)
  out/CardioValAI_Assembly.step          ensamblaje completo (válvula cerrada)
  out/Referencia_NO_IMPRIMIR/*.stl       servo, horn, ESP32, MEMS, piezo, ejes
  out/_canon/*.stl                       mallas en marco canónico (verificación y animación)

Uso:  python build_all.py
"""
from __future__ import annotations
import json
import os
import sys
import time
import numpy as np
import trimesh
from build123d import Compound, export_step, export_stl

import config as C
import registry as R
import assembly as A

OUT = os.path.join(os.path.dirname(__file__), '..', 'out')

def path(*p):
    full = os.path.join(OUT, *p)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    return full

def to_location(M):
    from build123d import Location
    from OCP.gp import gp_Trsf
    from OCP.TopLoc import TopLoc_Location
    U, _, Vt = np.linalg.svd(M[:3, :3])
    Rm = U @ Vt                      # ortonormaliza (redondeo numérico)
    t = gp_Trsf()
    t.SetValues(*[float(v) for v in Rm[0]], float(M[0, 3]), *[float(v) for v in Rm[1]], float(M[1, 3]), *[float(v) for v in Rm[2]], float(M[2, 3]))
    return Location(TopLoc_Location(t))

def main():
    t0 = time.time()
    meta = {}
    shapes = {}
    for it in R.ITEMS:
        t = time.time()
        shape = it.build()
        shapes[it.name] = shape
        canon = path('_canon', f'{it.name}.stl')
        export_stl(shape, canon, tolerance=0.01, angular_tolerance=0.08)
        if it.printable:
            export_step(shape, path(f'{C.PREFIX}_STEP', f'{C.PREFIX}_{it.name}.step'))
            m = trimesh.load(canon, process=True)
            m.apply_transform(it.print_tf)
            m.apply_translation([-m.bounds[0][0] - (m.extents[0] / 2), -m.bounds[0][1] - (m.extents[1] / 2), -m.bounds[0][2]])
            m.export(path(f'{C.PREFIX}_STL', f'{C.PREFIX}_{it.name}.stl'))
        else:
            m = trimesh.load(canon, process=True)
            m.export(path('Referencia_NO_IMPRIMIR', f'{C.PREFIX}_{it.name}.stl'))
        meta[it.name] = {'qty': it.qty, 'printable': it.printable, 'seconds': round(time.time() - t, 1)}
        print(f'  {it.name:24s} {time.time() - t:5.1f} s', flush=True)

    # ensamblaje STEP (válvula cerrada, servo arriba)
    from build123d import Location, Matrix
    beta_closed = C.SERVO_SWEEP
    tf = A.pose_transforms(beta_closed, 'NORMAL')
    placed = []
    for it in R.ITEMS:
        for inst in it.instances:
            M = tf[inst]
            s = shapes[it.name].moved(to_location(M))
            s.label = inst
            placed.append(s)
    asm = Compound(children=placed, label=f'{C.PREFIX}_Assembly')
    export_step(asm, path(f'{C.PREFIX}_Assembly_Cerrada.step'))
    with open(path('_canon', 'meta.json'), 'w') as f:
        json.dump(meta, f, indent=1)
    print(f'Listo en {time.time() - t0:.0f} s → {os.path.abspath(OUT)}')

if __name__ == '__main__':
    main()
