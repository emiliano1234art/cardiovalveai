"""Arma el video con rótulos y el ZIP de entrega CardioValAI_Modelo_Final_STL.zip."""
from __future__ import annotations
import glob
import os
import shutil
import subprocess
import zipfile

import config as C
import blender_anim as BA

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.abspath(os.path.join(HERE, '..', C.OUT_DIR))
REPO = os.path.abspath(os.path.join(HERE, '..', '..'))
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
FONT_B = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'

def video():
    frames = os.path.join(OUT, 'anim_frames', 'f%04d.png')
    tdir = os.path.join(OUT, '_canon', 'captions'); os.makedirs(tdir, exist_ok=True)
    filters = []
    for k, (key, f0, f1, title) in enumerate(BA.seg_frames()):
        tf = os.path.join(tdir, f'{k}.txt')
        open(tf, 'w', encoding='utf-8').write(title)
        a, b = (f0 - 1) / BA.FPS, f1 / BA.FPS
        filters.append(f"drawtext=fontfile={FONT_B}:textfile={tf}:x=36:y=34:fontsize=30:fontcolor=0x0b2545:box=1:boxcolor=white@0.88:boxborderw=14:enable='gte(t,{a:.3f})*lt(t,{b:.3f})'")
    foot = os.path.join(tdir, 'foot.txt')
    open(foot, 'w', encoding='utf-8').write(f'{C.PROJECT} · simulación cinemática del diseño mecánico v1 — no es un ensayo físico')
    filters.append(f"drawtext=fontfile={FONT}:textfile={foot}:x=36:y=h-52:fontsize=20:fontcolor=0x3a5068:box=1:boxcolor=white@0.8:boxborderw=8")
    mp4 = os.path.join(OUT, f'{C.PREFIX}_Animacion.mp4')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(BA.FPS), '-i', frames, '-vf', ','.join(filters),
                    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '22', '-preset', 'slow', '-movflags', '+faststart', mp4], check=True)
    poster = os.path.join(OUT, f'{C.PREFIX}_Vista_Abierta.png')
    f_open = [x for x in BA.seg_frames() if x[0] == 'abierta'][0][1] + 5
    shutil.copyfile(os.path.join(OUT, 'anim_frames', f'f{f_open:04d}.png'), poster)
    return mp4

def package():
    root = f'{C.PREFIX}_Modelo_Final'
    zpath = os.path.join(REPO, 'entrega', f'{C.PREFIX}_Modelo_Final_STL.zip')
    os.makedirs(os.path.dirname(zpath), exist_ok=True)
    items = []
    for sub in (f'{C.PREFIX}_STL', f'{C.PREFIX}_STEP', 'Referencia_NO_IMPRIMIR', 'Documentacion'):
        for f in sorted(glob.glob(os.path.join(OUT, sub, '*'))):
            items.append((f, f'{root}/{sub}/{os.path.basename(f)}'))
    for f in (f'{C.PREFIX}_Assembly_Cerrada.step', f'{C.PREFIX}_Final.blend', f'{C.PREFIX}_Animacion.mp4', f'{C.PREFIX}_Vista_Abierta.png'):
        p = os.path.join(OUT, f)
        if os.path.exists(p):
            items.append((p, f'{root}/{f}'))
    items.append((os.path.join(OUT, 'Documentacion', 'LEEME.md'), f'{root}/LEEME.md'))
    for f in sorted(glob.glob(os.path.join(HERE, '*.py'))):
        items.append((f, f'{root}/CAD_parametrico/{os.path.basename(f)}'))
    for f in sorted(glob.glob(os.path.join(REPO, 'hardware', 'firmware', '**', '*.ino'), recursive=True)):
        items.append((f, f'{root}/Firmware_prueba/{os.path.relpath(f, os.path.join(REPO, "hardware", "firmware"))}'))
    with zipfile.ZipFile(zpath, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for src, arc in items:
            z.write(src, arc)
    return zpath, len(items)

if __name__ == '__main__':
    import sys
    if '--no-video' not in sys.argv:
        print('video:', video())
    z, n = package()
    print(f'ZIP: {z} ({n} archivos, {os.path.getsize(z) / 1e6:.1f} MB)')
