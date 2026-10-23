"""
Prueba de extremo a extremo del SOFTWARE con el emulador (datos SINTÉTICOS):
puntos de calibración sintéticos → ajuste → subida al «ESP32» emulado (CAL/NVS simulado) → registro de una sesión con fallas
inyectadas → análisis con y sin calibración → creación de umbrales (debe rechazar sesiones sintéticas). No prueba hardware.
"""
import csv
import json
import os
import subprocess
import sys
import numpy as np
import pytest

HERE = os.path.dirname(os.path.abspath(__file__))
HOST = os.path.dirname(HERE)
sys.path.insert(0, HOST)
sys.path.insert(0, os.path.join(HOST, '..', 'cad'))


def synthetic_points(tmp, seed):
    """Puntos como los que daría la calibración con galgas (3 repeticiones, ruido) con el MISMO modelo del emulador."""
    import cvai_emulator as E
    import cvai_calibrate as Cal
    m = E.Model('NORMAL', {}, seed)
    rng = np.random.default_rng(7)
    paths = []
    for v in (1, 2, 3):
        rows = []
        for rep in (1, 2, 3):
            for g in Cal.GAUGES:
                raw = m.raw_for_theta([g, g, g]) * 8 + rng.normal(0, 3, 3)
                th = ['', '', '']; th[v - 1] = g
                rows.append(dict(metodo='galga', valva=v, direccion='abrir', repeticion=rep, theta1=th[0], theta2=th[1], theta3=th[2],
                                 h1=round(raw[0], 1), h2=round(raw[1], 1), h3=round(raw[2], 1), h1_sd=7, h2_sd=7, h3_sd=7, fuente=E.SOURCE))
        p = os.path.join(tmp, f'cal_v{v}.csv')
        with open(p, 'w', newline='') as f:
            w = csv.DictWriter(f, fieldnames=Cal.FIELDS); w.writeheader(); w.writerows(rows)
        paths.append(p)
    return Cal.fit(paths, os.path.join(tmp, 'calib.json'))


def start_emulator(tmp, faults, seed=3):
    link = os.path.join(tmp, 'tty_emu')
    args = [sys.executable, os.path.join(HOST, 'cvai_emulator.py'), '--seed', str(seed), '--link', link]
    for f in faults:
        args += ['--falla', f]
    emu = subprocess.Popen(args, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)
    emu.stdout.readline()
    return emu, link


@pytest.mark.timeout(400)
def test_v3_pipeline(tmp_path):
    import cvai_analyze as A
    import cvai_calibrate as Cal
    import config as C
    assert Cal.GAUGES == list(C.CALIB_ANGLES), 'las galgas del software deben coincidir con las impresas'
    tmp = str(tmp_path)
    cal = synthetic_points(tmp, seed=3)
    assert all(s['valida'] for s in cal['sensores']), [s.get('motivo') for s in cal['sensores']]
    for s in cal['sensores']:
        assert s['monotona'] and s['distinguible'] and s['resolucion_peor_deg'] < 2.0
    emu, link = start_emulator(tmp, ['atasco:3', 'asimetria:5', 'cierre:6'])
    try:
        r = subprocess.run([sys.executable, os.path.join(HOST, 'cvai_calibrate.py'), 'subir', os.path.join(tmp, 'calib.json'), '--port', link],
                           capture_output=True, text=True, timeout=60)
        assert r.returncode == 0 and sum(1 for l in r.stdout.splitlines() if l.startswith('ESP32 H') and ': válida' in l) == 3, r.stdout + r.stderr
        out = os.path.join(tmp, 'ses')
        r = subprocess.run([sys.executable, os.path.join(HOST, 'cvai_record.py'), '--port', link, '--ciclos', '8', '--salida', out,
                            '--t-dwell-closed', '700', '--duracion', '60', '--sensor', 'DRV5055A1QLPG (emulado)'], capture_output=True, text=True, timeout=120)
        assert r.returncode == 0, r.stdout + r.stderr
    finally:
        emu.terminate()
    ses = os.path.join(out, sorted(os.listdir(out))[-1])
    meta = json.load(open(os.path.join(ses, 'session.json')))
    assert meta['sintetico'] is True and meta['enlace']['crc_errors'] == 0
    # con calibración
    s, rows = A.analyze(ses, os.path.join(tmp, 'calib.json'), None, plots=True)
    assert s['calibracion']['usada'] and s['ciclos'] == 8
    by = {r['ciclo']: r for r in rows}
    for k in (0, 1, 2, 4):
        assert by[k]['clasificacion'] == 'equivalente', (k, by[k]['motivos'])
    assert 'atasco' in by[3]['motivos'] and 'incompleta' in by[3]['motivos']
    assert 'asimetría' in by[5]['motivos'] or 'menor a la esperada' in by[5]['motivos']
    assert 'cierre incompleto' in by[6]['motivos'] or 'residual' in by[6]['motivos']
    for i in range(3):
        assert abs(by[0][f'v{i+1}_meseta'] - 80) < 2.0 and abs(by[0][f'v{i+1}_base']) < 2.0
    # sin calibración: no hay grados
    s2, rows2 = A.analyze(ses, None, None, plots=False)
    assert not s2['calibracion']['usada'] and 'CRUDA' in s2['posicion'] and s2['unidad'] == 'cuentas'
    assert 'atasco' in {r['ciclo']: r for r in rows2}[3]['motivos'] or 'incompleta' in {r['ciclo']: r for r in rows2}[3]['motivos']
    # umbrales: sesiones sintéticas rechazadas
    with pytest.raises(SystemExit):
        A.create_thresholds([ses], os.path.join(tmp, 'calib.json'), os.path.join(tmp, 'u.json'))
    for f in ('ciclos.csv', 'resumen.json', 'vista_general.png', 'ciclos_superpuestos.png', 'metricas.png'):
        assert os.path.exists(os.path.join(ses, 'analisis', f))
