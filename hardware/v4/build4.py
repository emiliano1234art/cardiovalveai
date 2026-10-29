"""
Genera los sólidos de CardioValveAI v4 en hardware/out_v4/:
  _canon/<nombre>.stl                           mallas en marco de ensamblaje (verificación, Blender, 3MF)
  STL/01_Imprimir_Obligatorio/<num>_<nombre>_x<cant>.stl   piezas obligatorias + probeta, ya orientadas en la cama (mm)
  STL/02_Opcional/...                           galgas de calibración
  STL/03_Referencia_NO_IMPRIMIR/...             servo, horn, pasadores de latón, imanes, Hall (para ver y medir)
  STEP/<num>_<nombre>.step                      sólidos editables (marco de ensamblaje)
  CardioValveAI_v4_Ensamblaje.step              conjunto armado (valvas cerradas, servo a 50°)
Uso: python build4.py
"""
from __future__ import annotations
import json
import os
import time
import numpy as np
import trimesh
from build123d import Compound, Location, export_step, export_stl

import config4 as C
import kin4 as K
import registry4 as R
import assembly4 as A

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.abspath(os.path.join(HERE, '..', C.OUT_DIR))
FOLDER = {'probeta': '01_Imprimir_Obligatorio', 'obligatoria': '01_Imprimir_Obligatorio', 'opcional': '02_Opcional', 'referencia': '03_Referencia_NO_IMPRIMIR'}


def path(*p):
    f = os.path.join(OUT, *p)
    os.makedirs(os.path.dirname(f), exist_ok=True)
    return f


def to_print(mesh: trimesh.Trimesh, rot: np.ndarray) -> trimesh.Trimesh:
    m = mesh.copy()
    m.apply_transform(rot)
    lo, hi = m.bounds
    m.apply_translation([-(lo[0] + hi[0]) / 2, -(lo[1] + hi[1]) / 2, -lo[2]])
    return m


def as_location(M):
    from OCP.gp import gp_Trsf
    from OCP.TopLoc import TopLoc_Location
    U, _, Vt = np.linalg.svd(M[:3, :3])
    Rm = U @ Vt
    t = gp_Trsf()
    t.SetValues(*[float(v) for v in Rm[0]], float(M[0, 3]), *[float(v) for v in Rm[1]], float(M[1, 3]), *[float(v) for v in Rm[2]], float(M[2, 3]))
    return Location(TopLoc_Location(t))


def main():
    t0 = time.time()
    shapes, meta = {}, {}
    for it in R.ITEMS:
        t = time.time()
        shp = it.build()
        shapes[it.name] = shp
        canon = path('_canon', f'{it.name}.stl')
        export_stl(shp, canon, tolerance=0.01, angular_tolerance=0.08)
        m = trimesh.load(canon, process=True)
        sub = FOLDER[it.kind]
        if it.kind == 'referencia':
            m.export(path('STL', sub, f'{it.num}_{it.name}_x{it.qty}.stl'))
        else:
            to_print(m, it.print_rot).export(path('STL', sub, f'{it.file}.stl'))
        export_step(shp, path('STEP', f'{it.num}_{it.name}.step'))
        meta[it.name] = {'num': it.num, 'qty': it.qty, 'kind': it.kind, 'seconds': round(time.time() - t, 1)}
        print(f'  {it.num} {it.name:28s} {time.time() - t:5.1f} s', flush=True)
    # ensamblaje (valvas cerradas: servo en β = −40°, comando 130°)
    tf = A.pose(-C.BETA_WORK)
    parts = []
    for it in R.ITEMS:
        for inst in it.instances:
            s = shapes[it.name].moved(as_location(tf[inst]))
            s.label = inst
            parts.append(s)
    export_step(Compound(children=parts), path(f'{C.PREFIX}_Ensamblaje.step'))
    json.dump(meta, open(path('_canon', 'meta.json'), 'w'), indent=1)
    print(f'Listo en {time.time() - t0:.0f} s → {OUT}')


if __name__ == '__main__':
    main()
