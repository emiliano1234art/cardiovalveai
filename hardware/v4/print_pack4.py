"""
ZIP solo para imprimir (CardioValveAI v4): las 7 STL obligatorias con las copias YA incluidas (las piezas ×3 vienen en un
solo archivo con sus 3 copias separadas) + un 3MF con todo en una placa. Sin referencias, CAD ni documentación.
Uso: python print_pack4.py   (después de build4.py)   Salida: entrega/CardioValveAI_v4_PARA_IMPRIMIR_PETG.zip
"""
from __future__ import annotations
import os
import tempfile
import zipfile

import trimesh

import config4 as C
import plates4 as PL
import registry4 as R

HERE = os.path.dirname(os.path.abspath(__file__))
ZIP = os.path.abspath(os.path.join(HERE, '..', '..', 'entrega', f'{C.PREFIX}_PARA_IMPRIMIR_PETG.zip'))
ROOT = f'{C.PREFIX}_PARA_IMPRIMIR'
NAMES = {'Valva': 'Valvas_3_piezas', 'Portasensor_Hall': 'Portasensores_Hall_3_piezas'}
LEEME = f"""{C.PROJECT} {C.REVISION} - piezas para imprimir

Material: PETG. Sin soportes. Las piezas ya vienen orientadas: no girarlas ni escalarlas.
Todas las copias ya están incluidas (las valvas y los portasensores vienen de a 3 en su archivo).
Total: 11 piezas (10 + la probeta de ajustes), unos 200 g.

Opción rápida: abrir Todo_en_una_placa.3mf (todas las piezas ya distribuidas en una cama de {C.BED[0]:.0f} x {C.BED[1]:.0f} mm).
"""


def merged(name, n):
    m = trimesh.load(PL.stl_path(name))
    if n == 1:
        return m
    copies = [m.copy() for _ in range(n)]
    for c, t in zip(copies, PL.pack(copies)):
        c.apply_translation(t)
    out = trimesh.util.concatenate(copies)
    lo, hi = out.bounds
    out.apply_translation([-(lo[0] + hi[0]) / 2, -(lo[1] + hi[1]) / 2, -lo[2]])
    return out


def main():
    items = [i for i in R.ITEMS if i.kind in ('probeta', 'obligatoria')]
    with tempfile.TemporaryDirectory() as tmp, zipfile.ZipFile(ZIP, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        singles, total = [], 0
        for it in items:
            m = merged(it.name, it.qty)
            assert m.is_watertight and len(m.split(only_watertight=False)) == it.qty, it.name
            fname = f'{it.num}_{NAMES.get(it.name, it.name)}.stl'
            p = os.path.join(tmp, fname)
            m.export(p)
            z.write(p, f'{ROOT}/STL/{fname}')
            base = trimesh.load(PL.stl_path(it.name))
            singles += [(f'{it.num}_{it.name}' + (f'_{k + 1}' if it.qty > 1 else ''), base) for k in range(it.qty)]
            total += it.qty
        moves = PL.pack([m for _, m in singles])                   # falla si no entran en la cama
        p3 = os.path.join(tmp, 'Todo_en_una_placa.3mf')
        PL.write_3mf(p3, [(n, m, t) for (n, m), t in zip(singles, moves)])
        verts = PL.read_3mf(p3)
        assert len(verts) == total
        z.write(p3, f'{ROOT}/Todo_en_una_placa.3mf')
        pv = os.path.join(tmp, 'Todo_en_una_placa.png')
        PL.preview(pv, f'Todas las piezas ({total}) en una placa', [(n, m, t) for (n, m), t in zip(singles, moves)])
        z.write(pv, f'{ROOT}/Todo_en_una_placa_vista.png')
        z.writestr(f'{ROOT}/LEEME.txt', LEEME)
    print(f'{ZIP}: {total} piezas, {os.path.getsize(ZIP) / 1e6:.1f} MB')


if __name__ == '__main__':
    main()
