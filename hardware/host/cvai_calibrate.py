"""
CardioVal AI v2 — calibración de los sensores Hall (cuentas → ángulo de cada valva).

Paso 1 (guiado, con el banco):  python cvai_calibrate.py guiado --port /dev/cu.usbserial-0001 --salida calib_puntos.csv
   El servo va a posiciones fijas (MOVE). En cada una se promedian H0–H3 y se piden los ángulos REALES de las
   valvas, medidos con el transportador Angle_Scale + cámara lateral (o foto superior con las marcas ópticas).
   Dejar en blanco la valva que no se pudo medir. El archivo CSV queda como registro trazable.
Paso 2 (ajuste):                python cvai_calibrate.py ajustar calib_puntos.csv --salida calib_hall.json
   Ajusta una curva monótona (PCHIP) por valva, verifica monotonicidad e informa el error de validación
   cruzada (dejando un punto afuera). Rango válido = rango calibrado (fuera → NaN en el análisis).

La calibración depende de la posición exacta de imanes y sensores: repetirla al desarmar, cambiar un imán o
un sensor, o si la verificación diaria (posición cerrada y abierta) se aparta más de 2°.
"""
from __future__ import annotations
import argparse
import csv
import json
import os
import sys
import time
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

DEFAULT_STEPS = [130, 125, 120, 115, 110, 105, 100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50]


def guided(args):
    import threading
    import cvai_record as R
    link = R.Link(args.port, args.baud)
    os.makedirs(os.path.dirname(os.path.abspath(args.salida)) or '.', exist_ok=True)
    rec = R.Recorder(link, os.path.splitext(args.salida)[0] + '_raw.bin')
    threading.Thread(target=rec.rx_loop, daemon=True).start()
    threading.Thread(target=rec.hb_loop, daemon=True).start()
    link.send('INFO'); link.send('STREAM ON'); time.sleep(0.5)
    source = (rec.info or {}).get('fuente', 'ESP32')
    print('Fuente:', source)
    steps = [float(s) for s in args.pasos.split(',')] if args.pasos else DEFAULT_STEPS
    rows = []
    try:
        for cmd in steps:
            link.send(f'MOVE {cmd} 800')
            time.sleep(args.espera)
            with rec.lock:
                hv = np.concatenate(rec.live['hall'][-20:]) if rec.live['hall'] else np.zeros((0, 4))
            if len(hv) < 100:
                print('  pocos datos Hall: ¿STREAM activo?'); continue
            m, s = hv[-500:].mean(0), hv[-500:].std(0)
            print(f'comando {cmd:.1f}° → H0..H3 (suma de 8) = {np.round(m).astype(int)}  (σ {np.round(s, 1)})')
            ans = input('  ángulos medidos θ1 θ2 θ3 en grados (vacío = no medido, "q" = terminar): ').strip()
            if ans.lower() == 'q':
                break
            th = (ans.replace(',', ' ').split() + ['', '', ''])[:3]
            rows.append([cmd, *np.round(m, 1), *th, source])
    finally:
        link.send('STOP'); time.sleep(1.0); link.send('STREAM OFF'); rec.stop.set(); link.close()
    with open(args.salida, 'w', newline='') as f:
        w = csv.writer(f)
        w.writerow(['cmd_deg', 'h0', 'h1', 'h2', 'h3', 'theta1', 'theta2', 'theta3', 'fuente'])
        w.writerows(rows)
    print('Puntos guardados en', args.salida)


def fit(points_csv, out_json, min_points=5):
    from scipy.interpolate import PchipInterpolator
    rows = list(csv.DictReader(open(points_csv)))
    source = rows[0].get('fuente', '') if rows else ''
    calib = {'tipo': 'CardioVal AI v2 · Hall → ángulo', 'fecha': time.strftime('%Y-%m-%d %H:%M'), 'puntos': os.path.basename(points_csv),
             'fuente': source, 'sintetico': 'EMULADOR' in source, 'valvas': [], 'plato': None, 'validacion': {}}
    for i in range(3):
        pts = [(float(r[f'h{i+1}']), float(r[f'theta{i+1}'])) for r in rows if r.get(f'theta{i+1}', '').strip() not in ('', 'nan')]
        if len(pts) < min_points:
            raise SystemExit(f'valva {i+1}: hacen falta ≥ {min_points} puntos medidos (hay {len(pts)})')
        r_, th = np.array(pts).T
        o = np.argsort(r_)
        r_, th = r_[o], th[o]
        if np.any(np.diff(r_) == 0):
            raise SystemExit(f'valva {i+1}: dos posiciones con la misma lectura: aumentar el paso o revisar el sensor')
        d = np.diff(th)
        mono = bool(np.all(d > 0) or np.all(d < 0))
        loo = []
        for k in range(1, len(r_) - 1):
            m = np.ones(len(r_), bool); m[k] = False
            loo.append(float(PchipInterpolator(r_[m], th[m])(r_[k]) - th[k]))
        calib['valvas'].append({'sensor': f'H{i+1}', 'raw_sum8': r_.tolist(), 'theta_deg': th.tolist(), 'monotona': mono,
                                'rango_deg': [float(th.min()), float(th.max())]})
        calib['validacion'][f'H{i+1}'] = {'loo_error_max_deg': float(np.max(np.abs(loo))) if loo else None,
                                          'loo_error_rms_deg': float(np.sqrt(np.mean(np.square(loo)))) if loo else None}
        if not mono:
            print(f'ATENCIÓN valva {i+1}: la relación lectura–ángulo NO es monótona → revisar polaridad/posición del imán')
    calib['plato'] = {'sensor': 'H0', 'raw_sum8': [float(r['h0']) for r in rows], 'cmd_deg': [float(r['cmd_deg']) for r in rows],
                      'nota': 'H0 se relaciona con el comando estático solo como referencia; la carrera real del plato no se midió aquí'}
    json.dump(calib, open(out_json, 'w'), indent=1, ensure_ascii=False)
    print('Calibración guardada en', out_json)
    print(json.dumps(calib['validacion'], indent=1))
    return calib


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest='cmd', required=True)
    g = sub.add_parser('guiado'); g.add_argument('--port', required=True); g.add_argument('--baud', type=int, default=921600)
    g.add_argument('--salida', default='calib_puntos.csv'); g.add_argument('--pasos'); g.add_argument('--espera', type=float, default=2.0)
    f = sub.add_parser('ajustar'); f.add_argument('puntos'); f.add_argument('--salida', default='calib_hall.json')
    a = ap.parse_args(argv)
    if a.cmd == 'guiado':
        guided(a)
    else:
        fit(a.puntos, a.salida)


if __name__ == '__main__':
    main()
