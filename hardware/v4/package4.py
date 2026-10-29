"""
Empaqueta CardioValveAI v4 en entrega/CardioValveAI_v4_Imprimir_y_Armar.zip con un manifiesto REVISION.json
(commit de git, fecha, SHA-256 de cada archivo). Las entregas anteriores no se tocan.
Uso: python package4.py   (después de build4, verify4, plates4, esquema4, blender4 y docs4)
"""
from __future__ import annotations
import glob
import hashlib
import json
import os
import subprocess
import time
import zipfile

import config4 as C

HERE = os.path.dirname(os.path.abspath(__file__))
HW = os.path.abspath(os.path.join(HERE, '..'))
REPO = os.path.abspath(os.path.join(HW, '..'))
OUT = os.path.join(HW, C.OUT_DIR)
ZIP = os.path.join(REPO, 'entrega', f'{C.PREFIX}_Imprimir_y_Armar.zip')
ROOT = C.PREFIX
FW = 'CardioValveAI_v3_Adquisicion'      # mismo firmware que la v3 (mismos pines); el micrófono queda sin conectar


def files():
    it = []
    add = lambda src, arc: it.append((src, f'{ROOT}/{arc}'))
    add(os.path.join(OUT, 'LEEME_PRIMERO.md'), 'LEEME_PRIMERO.md')
    for sub in ('STL/01_Imprimir_Obligatorio', 'STL/02_Opcional', 'STL/03_Referencia_NO_IMPRIMIR', '3MF', 'Documentacion', 'Vistas', 'Electronica'):
        for f in sorted(glob.glob(os.path.join(OUT, sub, '*'))):
            if not f.endswith('.json'):
                add(f, f'{sub}/{os.path.basename(f)}')
    for f in sorted(glob.glob(os.path.join(OUT, 'STEP', '*.step'))):
        add(f, f'CAD/STEP/{os.path.basename(f)}')
    add(os.path.join(OUT, f'{C.PREFIX}_Ensamblaje.step'), f'CAD/{C.PREFIX}_Ensamblaje.step')
    for f in sorted(glob.glob(os.path.join(HERE, '*.py'))):
        add(f, f'CAD/fuente/{os.path.basename(f)}')
    add(os.path.join(OUT, '_canon', 'verify.json'), 'Documentacion/verify.json')
    add(os.path.join(OUT, f'{C.PREFIX}.blend'), f'Blender/{C.PREFIX}.blend')
    fw = os.path.join(HW, 'firmware', FW)
    for f in sorted(glob.glob(os.path.join(fw, '**', '*'), recursive=True)):
        rel = os.path.relpath(f, fw)
        if os.path.isfile(f) and not rel.startswith(('build', 'managed_components')) and rel not in ('sdkconfig', 'sdkconfig.old'):
            add(f, f'Firmware/{FW}/{rel}')
    host = os.path.join(HW, 'host')
    for f in sorted(glob.glob(os.path.join(host, '**', '*'), recursive=True)):
        rel = os.path.relpath(f, host)
        if os.path.isfile(f) and '__pycache__' not in rel and not rel.startswith(('sesiones', '.pytest_cache')):
            add(f, f'Herramientas_Mac/{rel}')
    return it


def main():
    commit = subprocess.run(['git', 'rev-parse', 'HEAD'], cwd=REPO, capture_output=True, text=True).stdout.strip()
    dirty = bool(subprocess.run(['git', 'status', '--porcelain', '--', 'hardware'], cwd=REPO, capture_output=True, text=True).stdout.strip())
    items = files()
    missing = [s for s, _ in items if not os.path.exists(s)]
    if missing:
        raise SystemExit(f'faltan archivos: {missing}')
    man = {'proyecto': C.PROJECT, 'revision': C.REVISION, 'generado': time.strftime('%Y-%m-%d %H:%M:%S'),
           'commit_base': commit, 'cambios_sin_commit_al_empaquetar': dirty, 'archivos': {}}
    for src, arc in items:
        man['archivos'][arc] = {'bytes': os.path.getsize(src), 'sha256': hashlib.sha256(open(src, 'rb').read()).hexdigest()}
    with zipfile.ZipFile(ZIP, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for src, arc in items:
            z.write(src, arc)
        z.writestr(f'{ROOT}/REVISION.json', json.dumps(man, indent=1, ensure_ascii=False))
    print(f'ZIP {ZIP}: {len(items) + 1} archivos, {os.path.getsize(ZIP) / 1e6:.1f} MB · commit base {commit[:9]}{" (+cambios)" if dirty else ""}')


if __name__ == '__main__':
    main()
