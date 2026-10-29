"""
Empaqueta la revisión actual (config.REVISION) en entrega/<PREFIX>_Modelo_y_Adquisicion.zip con un manifiesto REVISION.json
(commit de git, fecha, SHA-256 de cada archivo). Las entregas anteriores (v1, v2, v3) no se tocan.
Uso: python package_v3.py [--video]      (--video arma el MP4 rotulado a partir de out_v3/anim_frames)
"""
from __future__ import annotations
import glob
import hashlib
import json
import os
import shutil
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
FW = C.FIRMWARE
PREVIOUS = ['entrega/CardioValAI_Modelo_Final_STL.zip', 'entrega/CardioValAI_v2_Modelo_y_Adquisicion.zip',
            'entrega/CardioValveAI_v3_Modelo_y_Adquisicion.zip']
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
FONT_B = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'


def video():
    import blender_anim as BA
    frames = os.path.join(OUT, 'anim_frames', 'f%04d.png')
    tdir = os.path.join(OUT, '_canon', 'captions'); os.makedirs(tdir, exist_ok=True)
    filters = []
    for k, (key, f0, f1, title) in enumerate(BA.seg_frames()):
        tf = os.path.join(tdir, f'{k}.txt')
        open(tf, 'w', encoding='utf-8').write(title)
        a, b = (f0 - 1) / BA.FPS, f1 / BA.FPS
        filters.append(f"drawtext=fontfile={FONT_B}:textfile={tf}:x=36:y=34:fontsize=30:fontcolor=0x0b2545:box=1:boxcolor=white@0.88:boxborderw=14:enable='gte(t,{a:.3f})*lt(t,{b:.3f})'")
    foot = os.path.join(tdir, 'foot.txt')
    open(foot, 'w', encoding='utf-8').write(f'{C.PROJECT} · simulación cinemática del diseño {C.REVISION} — no es un ensayo físico ni una medición')
    filters.append(f"drawtext=fontfile={FONT}:textfile={foot}:x=36:y=h-52:fontsize=20:fontcolor=0x3a5068:box=1:boxcolor=white@0.8:boxborderw=8")
    mp4 = os.path.join(OUT, f'{C.PREFIX}_Animacion.mp4')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(BA.FPS), '-i', frames, '-vf', ','.join(filters),
                    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '22', '-preset', 'slow', '-movflags', '+faststart', mp4], check=True)
    f_open = [x for x in BA.seg_frames() if x[0] == 'abierta'][0][1] + 5
    shutil.copyfile(os.path.join(OUT, 'anim_frames', f'f{f_open:04d}.png'), os.path.join(OUT, f'{C.PREFIX}_Vista_Abierta.png'))
    return mp4


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
    fw = os.path.join(HW, 'firmware', FW)
    for f in sorted(glob.glob(os.path.join(fw, '**', '*'), recursive=True)):
        rel = os.path.relpath(f, fw)
        if os.path.isfile(f) and not rel.startswith(('build', 'managed_components')) and rel not in ('sdkconfig', 'sdkconfig.old'):
            add(f, f'Firmware/{FW}/{rel}')
    host = os.path.join(HW, 'host')
    for f in sorted(glob.glob(os.path.join(host, '**', '*'), recursive=True)):
        rel = os.path.relpath(f, host)
        if os.path.isfile(f) and '__pycache__' not in rel and not rel.startswith('sesiones') and not rel.startswith('.pytest_cache'):
            add(f, f'Herramientas_Mac/{rel}')
    add(os.path.join(HW, 'electronica', 'esquema.py'), 'Electronica_fuente/esquema.py')
    return it


def main():
    commit = subprocess.run(['git', 'rev-parse', 'HEAD'], cwd=REPO, capture_output=True, text=True).stdout.strip()
    dirty = bool(subprocess.run(['git', 'status', '--porcelain', '--', 'hardware'], cwd=REPO, capture_output=True, text=True).stdout.strip())
    items = files()
    man = {'proyecto': C.PROJECT, 'revision': C.REVISION, 'prefijo': C.PREFIX, 'generado': time.strftime('%Y-%m-%d %H:%M:%S'),
           'commit_base': commit, 'cambios_sin_commit_al_empaquetar': dirty, 'entregas_anteriores_conservadas': PREVIOUS,
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
        print('video:', video())
    main()
