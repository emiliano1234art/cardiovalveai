"""
Empaqueta la revisión v2 en entrega/CardioValAI_v2_Modelo_y_Adquisicion.zip con un manifiesto REVISION.json
(commit de git, fecha, SHA-256 de cada archivo). La v1 (entrega/CardioValAI_Modelo_Final_STL.zip) no se toca.
Uso: python package_v2.py [--video]
"""
from __future__ import annotations
import glob
import hashlib
import json
import os
import subprocess
import sys
import time
import zipfile

import config as C

HERE = os.path.dirname(os.path.abspath(__file__))
HW = os.path.abspath(os.path.join(HERE, '..'))
REPO = os.path.abspath(os.path.join(HW, '..'))
OUT = os.path.join(HW, C.OUT_DIR)
ZIP = os.path.join(REPO, 'entrega', f'{C.PREFIX}_Modelo_y_Adquisicion.zip')
ROOT = f'{C.PREFIX}_Entrega'


def files():
    it = []
    add = lambda src, arc: it.append((src, f'{ROOT}/{arc}'))
    for sub in (f'{C.PREFIX}_STL', f'{C.PREFIX}_STEP', 'Referencia_NO_IMPRIMIR', 'Documentacion', 'Vistas', 'Electronica'):
        for f in sorted(glob.glob(os.path.join(OUT, sub, '*'))):
            add(f, f'{sub}/{os.path.basename(f)}')
    for f in (f'{C.PREFIX}_Assembly_Cerrada.step', f'{C.PREFIX}_Final.blend', f'{C.PREFIX}_Animacion.mp4', f'{C.PREFIX}_Vista_Abierta.png'):
        if os.path.exists(os.path.join(OUT, f)):
            add(os.path.join(OUT, f), f)
    add(os.path.join(OUT, 'Documentacion', 'LEEME.md'), 'LEEME.md')
    for f in sorted(glob.glob(os.path.join(HERE, '*.py'))):
        add(f, f'CAD_parametrico/{os.path.basename(f)}')
    fw = os.path.join(HW, 'firmware', 'CardioValAI_v2_Adquisicion')
    for f in sorted(glob.glob(os.path.join(fw, '**', '*'), recursive=True)):
        rel = os.path.relpath(f, fw)
        if os.path.isfile(f) and not rel.startswith(('build', 'managed_components')) and rel not in ('sdkconfig', 'sdkconfig.old'):
            add(f, f'Firmware_v2/CardioValAI_v2_Adquisicion/{rel}')
    for f in sorted(glob.glob(os.path.join(HW, 'firmware', 'CardioValAI_ServoTest', '*'))):
        add(f, f'Firmware_v1_original/CardioValAI_ServoTest/{os.path.basename(f)}')
    host = os.path.join(HW, 'host')
    for f in sorted(glob.glob(os.path.join(host, '**', '*'), recursive=True)):
        rel = os.path.relpath(f, host)
        if os.path.isfile(f) and '__pycache__' not in rel and not rel.startswith('sesiones'):
            add(f, f'Herramientas_Mac/{rel}')
    add(os.path.join(HW, 'electronica', 'esquema.py'), 'Electronica_fuente/esquema.py')
    return it


def main():
    commit = subprocess.run(['git', 'rev-parse', 'HEAD'], cwd=REPO, capture_output=True, text=True).stdout.strip()
    dirty = bool(subprocess.run(['git', 'status', '--porcelain', '--', 'hardware'], cwd=REPO, capture_output=True, text=True).stdout.strip())
    items = files()
    man = {'proyecto': C.PROJECT, 'revision': C.REVISION, 'prefijo': C.PREFIX, 'generado': time.strftime('%Y-%m-%d %H:%M:%S'),
           'commit_base': commit, 'cambios_sin_commit_al_empaquetar': dirty, 'v1_conservada': 'entrega/CardioValAI_Modelo_Final_STL.zip',
           'archivos': {}}
    for src, arc in items:
        man['archivos'][arc] = {'bytes': os.path.getsize(src), 'sha256': hashlib.sha256(open(src, 'rb').read()).hexdigest()}
    with zipfile.ZipFile(ZIP, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for src, arc in items:
            z.write(src, arc)
        z.writestr(f'{ROOT}/REVISION.json', json.dumps(man, indent=1, ensure_ascii=False))
    print(f'ZIP {ZIP}: {len(items) + 1} archivos, {os.path.getsize(ZIP) / 1e6:.1f} MB · commit base {commit[:9]}{" (+cambios)" if dirty else ""}')


if __name__ == '__main__':
    if '--video' in sys.argv:
        import package
        print('video:', package.video())
    main()
