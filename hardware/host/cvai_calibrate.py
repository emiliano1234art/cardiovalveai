"""
CardioValveAI v3 — calibración angular de cada sensor Hall (lectura cruda → ángulo de SU valva).

El Hall mide campo magnético, no grados: la relación se MIDE para cada montaje en posiciones angulares conocidas.

1) galgas  (posiciones conocidas con las galgas impresas Calib_Gauge_00…80; empujador DESCONECTADO del horn, valvas movidas a mano)
     python cvai_calibrate.py galgas --port /dev/cu.usbserial-0001 --valva 1 --repeticiones 3 --salida cal_v1.csv
   Para cada galga: colocarla sobre la valva indicada, subir el plato a mano hasta que la valva toque la galga, sostener y Enter.
   Se registran 0,5 s de los 3 sensores (media y desvío). Repetir para las valvas 2 y 3 (mismo archivo con --agregar).
2) video   (comprobación y HISTÉRESIS: el servo va a posiciones fijas abriendo y luego cerrando; se escriben los ángulos medidos en el
            video con el Angle_Scale / marcas ópticas)
     python cvai_calibrate.py video --port … --salida cal_video.csv
3) ajustar (curva por sensor + ruido, repetibilidad, histéresis, ambigüedad, validación cruzada)
     python cvai_calibrate.py ajustar cal_valva1.csv cal_valva2.csv cal_valva3.csv [cal_video.csv] --salida calib_hall.json
4) subir   (guarda la calibración validada en el ESP32: NVS, una por sensor)
     python cvai_calibrate.py subir calib_hall.json --port …
5) comparar (después de desmontar/montar o cambiar de modo: diferencia angular entre dos calibraciones)
     python cvai_calibrate.py comparar calib_antes.json calib_despues.json

Cero mecánico: 0° = cara superior de la valva paralela a la cara inferior del anillo, materializado por la galga de 0°.
No se convierte mín./máx. en un ángulo lineal: se interpola (PCHIP) entre puntos MEDIDOS y no se extrapola.
"""
from __future__ import annotations
import argparse
import csv
import json
import os
import sys
import threading
import time
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

GAUGES = [0, 5, 10, 15, 20, 30, 40, 50, 60, 70, 80]      # = config.CALIB_ANGLES del CAD (galgas impresas)
VIDEO_STEPS = [130, 120, 110, 100, 90, 80, 70, 60, 50]
FIELDS = ['metodo', 'valva', 'direccion', 'repeticion', 'theta1', 'theta2', 'theta3', 'h1', 'h2', 'h3', 'h1_sd', 'h2_sd', 'h3_sd', 'fuente']
NOISE_FLOOR = 4.0        # cuentas (suma de 8): piso del ruido si la medición no lo informa
AMBIG_K = 4.0            # dos puntos vecinos se consideran distinguibles si difieren ≥ 4 σ de ruido


def _open(port, baud):
    import cvai_record as R
    link = R.Link(port, baud)
    rec = R.Recorder(link, os.devnull)
    threading.Thread(target=rec.rx_loop, daemon=True).start()
    threading.Thread(target=rec.hb_loop, daemon=True).start()
    link.send('INFO'); link.send('STREAM ON'); time.sleep(0.6)
    return link, rec


def _capture(rec, secs=0.5):
    with rec.lock:
        hv = np.concatenate(rec.live['hall'][-40:]) if rec.live['hall'] else np.zeros((0, 3))
    hv = hv[-int(secs * 1000):]
    if len(hv) < 0.8 * secs * 1000:
        raise SystemExit('Pocos datos Hall: ¿STREAM activo y firmware v3?')
    return hv.mean(0), hv.std(0)


def _write(path, rows, append):
    new = not (append and os.path.exists(path))
    with open(path, 'a' if append else 'w', newline='') as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        if new:
            w.writeheader()
        w.writerows(rows)


def gauges(a):
    link, rec = _open(a.port, a.baud)
    src = (rec.info or {}).get('fuente', 'ESP32')
    link.send('DETACH')
    print(f'Fuente: {src}. Servo SIN pulsos. Desconectar el empujador del horn antes de seguir.')
    rows = []
    try:
        for rep in range(1, a.repeticiones + 1):
            for g in (a.galgas or GAUGES):
                input(f'[rep {rep}] Galga {g}° sobre la valva {a.valva}: mover la valva a mano (v3: subir el plato; v4: empujar el yugo por la ventana) '
                      'hasta tocarla, sostener y pulsar Enter… ')
                m, sd = _capture(rec)
                th = ['', '', '']; th[a.valva - 1] = g
                rows.append(dict(metodo='galga', valva=a.valva, direccion='abrir', repeticion=rep, theta1=th[0], theta2=th[1], theta3=th[2],
                                 h1=round(m[0], 1), h2=round(m[1], 1), h3=round(m[2], 1), h1_sd=round(sd[0], 2), h2_sd=round(sd[1], 2), h3_sd=round(sd[2], 2), fuente=src))
                print(f'   H1..H3 = {np.round(m).astype(int)}  (σ {np.round(sd, 1)})')
    finally:
        link.send('STREAM OFF'); rec.stop.set(); link.close()
    _write(a.salida, rows, a.agregar)
    print('Puntos guardados en', a.salida)


def video(a):
    link, rec = _open(a.port, a.baud)
    src = (rec.info or {}).get('fuente', 'ESP32')
    rows = []
    try:
        for rep in range(1, a.repeticiones + 1):
            for direction, steps in (('abrir', VIDEO_STEPS), ('cerrar', VIDEO_STEPS[::-1])):
                for cmd in steps:
                    link.send(f'MOVE {cmd} 1200'); time.sleep(a.espera)
                    m, sd = _capture(rec)
                    print(f'[rep {rep}, {direction}] orden {cmd}° → H1..H3 = {np.round(m).astype(int)} (σ {np.round(sd, 1)})')
                    ans = input('   ángulos medidos en el video θ1 θ2 θ3 (vacío = no medido): ').strip()
                    th = (ans.replace(',', ' ').split() + ['', '', ''])[:3]
                    rows.append(dict(metodo='video', valva='', direccion=direction, repeticion=rep, theta1=th[0], theta2=th[1], theta3=th[2],
                                     h1=round(m[0], 1), h2=round(m[1], 1), h3=round(m[2], 1), h1_sd=round(sd[0], 2), h2_sd=round(sd[1], 2), h3_sd=round(sd[2], 2), fuente=src))
    finally:
        link.send('STOP'); time.sleep(1.0); link.send('STREAM OFF'); rec.stop.set(); link.close()
    _write(a.salida, rows, a.agregar)
    print('Puntos guardados en', a.salida)


def fit(csv_paths, out_json, min_points=5):
    """Ajuste por sensor. Devuelve el diccionario de calibración y lo guarda."""
    from scipy.interpolate import PchipInterpolator
    rows = [r for p in csv_paths for r in csv.DictReader(open(p))]
    src = sorted({r.get('fuente', '') for r in rows})
    cal = {'tipo': 'CardioValveAI v3 · Hall → ángulo', 'fecha': time.strftime('%Y-%m-%d %H:%M'), 'archivos': [os.path.basename(p) for p in csv_paths],
           'fuente': src, 'sintetico': any('EMULADOR' in s for s in src), 'cero_mecanico': 'cara superior de la valva paralela a la cara inferior del anillo (galga 0°)',
           'sensores': []}
    for i in range(3):
        pts = [(float(r[f'theta{i+1}']), float(r[f'h{i+1}']), float(r.get(f'h{i+1}_sd') or 0), r.get('direccion', 'abrir'))
               for r in rows if str(r.get(f'theta{i+1}', '')).strip() not in ('', 'nan')]
        res = {'sensor': f'H{i+1}', 'valida': False}
        if len(set(p[0] for p in pts)) < min_points:
            res['motivo'] = f'menos de {min_points} ángulos medidos'; cal['sensores'].append(res); continue
        th_u = sorted(set(p[0] for p in pts))
        raw_m = np.array([np.mean([p[1] for p in pts if p[0] == t]) for t in th_u])
        noise = max(NOISE_FLOOR, float(np.median([p[2] for p in pts]) if pts else 0))
        rep = [np.std([p[1] for p in pts if p[0] == t and p[3] == d], ddof=1) for t in th_u for d in ('abrir', 'cerrar')
               if sum(1 for p in pts if p[0] == t and p[3] == d) >= 2]
        hyst = [abs(np.mean([p[1] for p in pts if p[0] == t and p[3] == 'abrir']) - np.mean([p[1] for p in pts if p[0] == t and p[3] == 'cerrar']))
                for t in th_u if any(p[0] == t and p[3] == 'abrir' for p in pts) and any(p[0] == t and p[3] == 'cerrar' for p in pts)]
        th = np.array(th_u, float)
        d = np.diff(raw_m)
        mono = bool(np.all(d > 0) or np.all(d < 0))
        slope = np.abs(d / np.diff(th))                                   # cuentas/° entre puntos vecinos
        distinguible = bool(np.all(np.abs(d) >= AMBIG_K * noise))
        res.update({'theta_deg': th.tolist(), 'raw_sum8': raw_m.round(1).tolist(), 'monotona': mono, 'distinguible': distinguible,
                    'ruido_cuentas': round(noise, 2), 'resolucion_peor_deg': round(float(2 * noise / slope.min()), 2) if mono else None,
                    'repetibilidad_deg': round(float(np.max(rep) / slope.min()), 2) if rep and mono else None,
                    'histeresis_deg': round(float(np.max(hyst) / slope.min()), 2) if hyst and mono else None,
                    'rango_deg': [float(th.min()), float(th.max())]})
        if not mono:
            res['motivo'] = 'NO monótona: dos ángulos dan la misma lectura → corregir geometría (ver doc 03) o polaridad del imán'
        elif not distinguible:
            res['motivo'] = f'posiciones vecinas indistinguibles (diferencia < {AMBIG_K:.0f} σ de ruido) → acercar el sensor o cambiar el modelo'
        elif th.max() - th.min() < 30:
            res['motivo'] = 'rango calibrado < 30°'
        else:
            o = np.argsort(raw_m)
            loo = []
            for k in range(1, len(th) - 1):
                m = np.ones(len(th), bool); m[k] = False
                oo = np.argsort(raw_m[m])
                loo.append(float(PchipInterpolator(raw_m[m][oo], th[m][oo])(raw_m[k]) - th[k]))
            res.update({'valida': True, 'motivo': 'válida', 'loo_error_max_deg': round(float(np.max(np.abs(loo))), 2) if loo else None})
        cal['sensores'].append(res)
    json.dump(cal, open(out_json, 'w'), indent=1, ensure_ascii=False)
    for s in cal['sensores']:
        print(f"{s['sensor']}: {s['motivo']}" + (f" · resolución ≤ {s['resolucion_peor_deg']}° · repetibilidad {s.get('repetibilidad_deg')}° · histéresis {s.get('histeresis_deg')}° · LOO {s.get('loo_error_max_deg')}°" if s['valida'] else ''))
    return cal


def upload(a):
    cal = json.load(open(a.calib))
    link, rec = _open(a.port, a.baud)
    try:
        for i, s in enumerate(cal['sensores']):
            if not s.get('valida'):
                print(f"{s['sensor']}: no se sube ({s.get('motivo')})"); continue
            link.send(f'CAL BEGIN {i+1}'); time.sleep(0.05)
            for r, t in zip(s['raw_sum8'], s['theta_deg']):
                link.send(f'CAL PT {int(round(r))} {t:.3f}'); time.sleep(0.02)
            link.send('CAL END'); time.sleep(0.4)
        link.send('INFO'); time.sleep(0.5)
        for c in (rec.info or {}).get('calibracion', []):
            print(f"ESP32 {c['sensor']}: {c['estado']} ({c['puntos']} puntos, {c['min']}…{c['max']}°)")
    finally:
        link.send('STREAM OFF'); rec.stop.set(); link.close()


def compare(a_path, b_path):
    from scipy.interpolate import PchipInterpolator
    A, B = json.load(open(a_path)), json.load(open(b_path))
    out = {}
    for sa, sb in zip(A['sensores'], B['sensores']):
        if not (sa.get('valida') and sb.get('valida')):
            out[sa['sensor']] = 'sin calibración válida en ambas'; continue
        fa = PchipInterpolator(*map(np.array, zip(*sorted(zip(sa['raw_sum8'], sa['theta_deg'])))), extrapolate=False)
        fb = PchipInterpolator(*map(np.array, zip(*sorted(zip(sb['raw_sum8'], sb['theta_deg'])))), extrapolate=False)
        lo, hi = max(min(sa['raw_sum8']), min(sb['raw_sum8'])), min(max(sa['raw_sum8']), max(sb['raw_sum8']))
        r = np.linspace(lo, hi, 200)
        dif = np.abs(fa(r) - fb(r))
        out[sa['sensor']] = {'diferencia_max_deg': round(float(np.nanmax(dif)), 2), 'criterio_propuesto_deg': 2.0,
                             'cumple': bool(np.nanmax(dif) <= 2.0)}
    print(json.dumps(out, ensure_ascii=False, indent=1))
    return out


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest='cmd', required=True)
    for name in ('galgas', 'video'):
        g = sub.add_parser(name); g.add_argument('--port', required=True); g.add_argument('--baud', type=int, default=921600)
        g.add_argument('--salida', required=True); g.add_argument('--repeticiones', type=int, default=3); g.add_argument('--agregar', action='store_true')
        if name == 'galgas':
            g.add_argument('--valva', type=int, choices=(1, 2, 3), required=True)
            g.add_argument('--galgas', type=lambda t: [int(x) for x in t.split(',')],
                           help='ángulos de las galgas impresas, p. ej. 0,20,40,60,80 en la v4 (por omisión, las 11 de la v3)')
        else:
            g.add_argument('--espera', type=float, default=2.0)
    f = sub.add_parser('ajustar'); f.add_argument('puntos', nargs='+'); f.add_argument('--salida', default='calib_hall.json')
    u = sub.add_parser('subir'); u.add_argument('calib'); u.add_argument('--port', required=True); u.add_argument('--baud', type=int, default=921600)
    c = sub.add_parser('comparar'); c.add_argument('a'); c.add_argument('b')
    a = ap.parse_args(argv)
    {'galgas': gauges, 'video': video, 'subir': upload}.get(a.cmd, lambda a: None)(a)
    if a.cmd == 'ajustar':
        fit(a.puntos, a.salida)
    elif a.cmd == 'comparar':
        compare(a.a, a.b)


if __name__ == '__main__':
    main()
