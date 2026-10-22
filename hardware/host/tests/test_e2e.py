"""
Prueba de extremo a extremo del SOFTWARE con el emulador (datos SINTÉTICOS):
emulador (pty) → cvai_record → session.npz → calibración sintética → cvai_analyze.
Verifica: protocolo/CRC sin errores, ciclos detectados, clasificación de ciclos normales como equivalentes y
detección de las fallas inyectadas (atasco, asimetría, cierre incompleto). No prueba hardware.
"""
import csv
import json
import os
import subprocess
import sys
import time
import numpy as np
import pytest

HERE = os.path.dirname(os.path.abspath(__file__))
HOST = os.path.dirname(HERE)
sys.path.insert(0, HOST)
sys.path.insert(0, os.path.join(HOST, '..', 'cad'))


def synthetic_calibration(tmp, seed):
    """Puntos de calibración generados con el MISMO modelo del emulador (equivale a 'medir' con un transportador perfecto)."""
    import cvai_emulator as E
    import cvai_calibrate as Cal
    import kinematics as K
    m = E.Model('NORMAL', {}, seed)
    pts = os.path.join(tmp, 'calib_puntos.csv')
    with open(pts, 'w', newline='') as f:
        w = csv.writer(f)
        w.writerow(['cmd_deg', 'h0', 'h1', 'h2', 'h3', 'theta1', 'theta2', 'theta3', 'fuente'])
        for cmd in np.linspace(130, 50, 17):
            raw, th = m.hall_raw(cmd - 90.0, 0)
            w.writerow([cmd, *(raw * 8).round(1), *np.round(th, 3), E.SOURCE])
    return Cal.fit(pts, os.path.join(tmp, 'calib.json'))


def run_session(tmp, faults, cycles=8, seed=3):
    link = os.path.join(tmp, 'tty_emu')
    args = [sys.executable, os.path.join(HOST, 'cvai_emulator.py'), '--seed', str(seed), '--link', link]
    for f in faults:
        args += ['--falla', f]
    emu = subprocess.Popen(args, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)
    try:
        emu.stdout.readline()
        out = os.path.join(tmp, 'ses')
        r = subprocess.run([sys.executable, os.path.join(HOST, 'cvai_record.py'), '--port', link, '--ciclos', str(cycles),
                            '--salida', out, '--t-dwell-closed', '700', '--duracion', '60'], capture_output=True, text=True, timeout=120)
        assert r.returncode == 0, r.stdout + r.stderr
        return os.path.join(out, sorted(os.listdir(out))[-1]), r.stdout
    finally:
        emu.terminate()


@pytest.mark.timeout(300)
def test_normal_and_faults(tmp_path):
    import cvai_analyze as A
    tmp = str(tmp_path)
    calib = synthetic_calibration(tmp, seed=3)
    assert all(v['monotona'] for v in calib['valvas'])
    ses, log = run_session(tmp, ['atasco:3', 'asimetria:5', 'cierre:6'], cycles=8, seed=3)
    meta = json.load(open(os.path.join(ses, 'session.json')))
    assert meta['sintetico'] is True and 'EMULADOR' in meta['fuente']
    assert meta['enlace']['crc_errors'] == 0
    s, rows = A.analyze(ses, os.path.join(tmp, 'calib.json'), plots=True)
    assert s['ciclos'] == 8
    by = {r['ciclo']: r for r in rows}
    for k in (0, 1, 2, 4):
        assert by[k]['clasificacion'] == 'equivalente', (k, by[k]['motivos'])
    assert 'atasco' in by[3]['motivos'] and 'incompleta' in by[3]['motivos']
    assert 'asimetría' in by[5]['motivos'] or 'menor a la esperada' in by[5]['motivos']
    assert 'cierre incompleto' in by[6]['motivos'] or 'residual' in by[6]['motivos']
    for i in range(3):
        assert abs(by[0][f'v{i+1}_meseta'] - 80) < 2.0
        assert abs(by[0][f'v{i+1}_base']) < 2.0
    for f in ('ciclos.csv', 'resumen.json', 'vista_general.png', 'ciclos_superpuestos.png', 'metricas.png'):
        assert os.path.exists(os.path.join(ses, 'analisis', f))
