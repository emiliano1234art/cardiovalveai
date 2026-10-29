"""
Proyectos 3MF de CardioValveAI v4: una placa por grupo de parámetros (misma altura de capa), con TODAS las copias.
Lee las STL ya orientadas de out_v4/STL y escribe out_v4/3MF/Placa_<n>_<...>.3mf + una vista superior de cada placa.
El 3MF se escribe a mano (formato núcleo 3MF, unidades mm): lo abren PrusaSlicer, OrcaSlicer, Bambu Studio y Cura.
Uso: python plates4.py   (después de build4.py)
"""
from __future__ import annotations
import json
import os
import zipfile
import numpy as np
import trimesh

import config4 as C
import registry4 as R

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.abspath(os.path.join(HERE, '..', C.OUT_DIR))
GAP = 8.0         # separación entre piezas en la cama
MARGIN = 10.0     # margen al borde de la cama

# (archivo de la placa, título, [(n.º de pieza, nombre, copias)], parámetros comunes)
PLATES = [
    ('Placa_0_Probeta', 'Imprimir PRIMERO: probeta de ajustes', [('00', 'Probeta', 1)], 'capa 0,2 mm'),
    ('Placa_1_Cuerpo', 'Cuerpo', [('01', 'Cuerpo', 1)], 'capa 0,2 mm · brim 4 mm'),
    ('Placa_2_Piston_Yugo', 'Pistón + yugo', [('03', 'Piston', 1), ('04', 'Yugo', 1)], 'capa 0,2 mm'),
    ('Placa_3_Valvas_Manivela', '3 valvas + manivela', [('02', 'Valva', 3), ('05', 'Manivela', 1)], 'capa 0,16 mm'),
    ('Placa_4_Portasensores', '3 portasensores Hall', [('06', 'Portasensor_Hall', 3)], 'capa 0,12 mm'),
    ('Placa_5_Galgas_OPCIONAL', 'Galgas de calibración (opcional)',
     [('07', f'Galga_{a:02d}', 1) for a in (0, 20, 40, 60, 80)], 'capa 0,16 mm'),
]


def stl_path(name):
    it = R.by_name(name)
    sub = '02_Opcional' if it.kind == 'opcional' else '01_Imprimir_Obligatorio'
    return os.path.join(OUT, 'STL', sub, f'{it.file}.stl')


def pack(meshes):
    """Filas simples (de mayor a menor), centradas en la cama. Devuelve una traslación por malla."""
    bw, bd = C.BED[0] - 2 * MARGIN, C.BED[1] - 2 * MARGIN
    order = sorted(range(len(meshes)), key=lambda i: -(meshes[i].extents[1]))
    rows, row, x, h = [], [], 0.0, 0.0
    for i in order:
        w, d = meshes[i].extents[:2]
        if row and x + w > bw:
            rows.append((row, x - GAP, h))
            row, x, h = [], 0.0, 0.0
        row.append((i, x))
        x += w + GAP
        h = max(h, d)
    rows.append((row, x - GAP, h))
    total_d = sum(r[2] for r in rows) + GAP * (len(rows) - 1)
    if total_d > bd or max(r[1] for r in rows) > bw:
        raise ValueError('las piezas no entran en la cama')
    moves = [None] * len(meshes)
    y = total_d / 2
    for row, width, h in rows:
        for i, x0 in row:
            lo, hi = meshes[i].bounds
            cx = C.BED[0] / 2 - width / 2 + x0
            moves[i] = np.array([cx - lo[0], C.BED[1] / 2 + y - h / 2 - (lo[1] + hi[1]) / 2, -lo[2]])
        y -= h + GAP
    return moves


def write_3mf(path, objects):
    """objects: [(nombre, trimesh, traslación)]. Cada copia es un objeto propio (se pueden mover por separado)."""
    res, build = [], []
    for k, (name, m, t) in enumerate(objects, start=1):
        v = '\n'.join(f'<vertex x="{a:.4f}" y="{b:.4f}" z="{c:.4f}"/>' for a, b, c in m.vertices)
        f = '\n'.join(f'<triangle v1="{a}" v2="{b}" v3="{c}"/>' for a, b, c in m.faces)
        res.append(f'<object id="{k}" name="{name}" type="model"><mesh><vertices>\n{v}\n</vertices><triangles>\n{f}\n</triangles></mesh></object>')
        build.append(f'<item objectid="{k}" transform="1 0 0 0 1 0 0 0 1 {t[0]:.4f} {t[1]:.4f} {t[2]:.4f}"/>')
    model = ('<?xml version="1.0" encoding="UTF-8"?>\n'
             '<model unit="millimeter" xml:lang="es-CL" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">\n'
             f'<metadata name="Title">{os.path.splitext(os.path.basename(path))[0]}</metadata>\n'
             f'<metadata name="Designer">{C.PROJECT}</metadata>\n'
             '<resources>\n' + '\n'.join(res) + '\n</resources>\n<build>\n' + '\n'.join(build) + '\n</build>\n</model>\n')
    ctypes = ('<?xml version="1.0" encoding="UTF-8"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
              '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
              '<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>\n')
    rels = ('<?xml version="1.0" encoding="UTF-8"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>\n')
    with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('[Content_Types].xml', ctypes)
        z.writestr('_rels/.rels', rels)
        z.writestr('3D/3dmodel.model', model)


def read_3mf(path):
    """Relee el 3MF con la biblioteca estándar: vértices de cada objeto ya trasladados a su lugar en la cama."""
    import xml.etree.ElementTree as ET
    ns = {'m': 'http://schemas.microsoft.com/3dmanufacturing/core/2015/02'}
    root = ET.fromstring(zipfile.ZipFile(path).read('3D/3dmodel.model'))
    verts = {o.get('id'): np.array([[float(v.get(a)) for a in 'xyz'] for v in o.iter('{%s}vertex' % ns['m'])])
             for o in root.iter('{%s}object' % ns['m'])}
    out = []
    for it in root.iter('{%s}item' % ns['m']):
        t = np.array([float(x) for x in it.get('transform').split()])[9:]
        out.append(verts[it.get('objectid')] + t)
    return out


def preview(path, title, placed):
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    from matplotlib.patches import Rectangle
    fig, ax = plt.subplots(figsize=(5, 5), dpi=120)
    ax.add_patch(Rectangle((0, 0), C.BED[0], C.BED[1], fill=False, lw=1.5))
    for name, m, t in placed:
        mm = m.copy()
        mm.apply_translation(t)
        tri = mm.vertices[mm.faces][:, :, :2]
        ax.add_collection(matplotlib.collections.PolyCollection(tri, facecolor='#5b8bd6', edgecolor='none', alpha=0.9))
        c = mm.bounds.mean(axis=0)
        ax.text(c[0], mm.bounds[0][1] - 4, name, ha='center', va='top', fontsize=6)
    ax.set_xlim(-5, C.BED[0] + 5)
    ax.set_ylim(-5, C.BED[1] + 5)
    ax.set_aspect('equal')
    ax.set_title(f'{title}\n(cama {C.BED[0]:.0f} × {C.BED[1]:.0f} mm, vista desde arriba)', fontsize=8)
    ax.tick_params(labelsize=6)
    fig.tight_layout()
    fig.savefig(path)
    plt.close(fig)


def main():
    os.makedirs(os.path.join(OUT, '3MF'), exist_ok=True)
    summary = []
    for fname, title, content, params in PLATES:
        meshes, names = [], []
        for num, name, n in content:
            m = trimesh.load(stl_path(name))
            for k in range(n):
                meshes.append(m)
                names.append(f'{num}_{name}' + (f'_{k + 1}' if n > 1 else ''))
        moves = pack(meshes)
        placed = list(zip(names, meshes, moves))
        write_3mf(os.path.join(OUT, '3MF', f'{fname}.3mf'), placed)
        preview(os.path.join(OUT, '3MF', f'{fname}.png'), title, placed)
        # control: la placa reabre con las mismas piezas y dentro de la cama
        objs = read_3mf(os.path.join(OUT, '3MF', f'{fname}.3mf'))
        allv = np.vstack(objs)
        lo, hi = allv.min(axis=0), allv.max(axis=0)
        ok = bool(lo[0] >= 0 and lo[1] >= 0 and hi[0] <= C.BED[0] and hi[1] <= C.BED[1] and hi[2] <= C.BED[2] and abs(lo[2]) < 1e-6)
        summary.append({'placa': fname, 'piezas': names, 'parametros': params, 'objetos_releidos': len(objs), 'dentro_de_la_cama': ok})
        print(f'  {fname:28s} {len(names)} piezas  cama OK={ok}')
    json.dump(summary, open(os.path.join(OUT, '3MF', 'placas.json'), 'w'), indent=1, ensure_ascii=False)


if __name__ == '__main__':
    main()
