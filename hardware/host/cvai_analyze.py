"""
CardioValveAI v3 — análisis por ciclo de la apertura y el cierre MEDIDOS con los 3 sensores Hall (uno por valva).

  python cvai_analyze.py <sesión> [--calib calib_hall.json] [--umbrales umbrales.json]
  python cvai_analyze.py --crear-umbrales <sesión1> <sesión2> <sesión3> --calib calib_hall.json --salida umbrales.json

Salida en <sesión>/analisis/: ciclos.csv, resumen.json, vista_general.png, ciclos_superpuestos.png, metricas.png

Reglas:
  - SIN calibración válida: se trabaja con la LECTURA CRUDA (cuentas). No se muestran grados. Los tiempos de evento se calculan sobre la
    lectura cruda y se rotulan así (la relación lectura–ángulo no es lineal: un 10 % de la lectura no es un 10 % del ángulo).
  - CON calibración: ángulo ESTIMADO por la curva medida de cada sensor (fuera del rango calibrado → sin valor).
  - El ángulo ORDENADO al servo se muestra aparte y nunca se usa como posición.
  - Eventos (propuestos): base = mediana 20–200 ms antes de la orden de apertura; meseta = mediana del 60 % final de la espera abierta;
    residual = mediana del 40 % final de la espera cerrada. Inicio de apertura = cruce de base + 10 % de la amplitud de referencia;
    fin = cruce de base + 90 % de la amplitud del ciclo. Cierre: simétrico.
  - Umbrales de anomalía: se calculan con --crear-umbrales a partir de sesiones NORMALES REALES repetidas (mediana y MAD por métrica).
    Sin ese archivo, la comparación es solo dentro de la sesión y se rotula «provisional».
"""
from __future__ import annotations
import argparse
import csv
import json
import os
import sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import cvai_proto as P   # noqa: E402

EXPECTED = {'NORMAL': (80, 80, 80), 'RESTRINGIDA_60': (60, 80, 80), 'RESTRINGIDA_45': (45, 80, 80),
            'CIERRE_INCOMPLETO': (84, 80, 80), 'ASIMETRICO': (60, 45, 80)}
EXPECTED_CLOSED = {'CIERRE_INCOMPLETO': (12, 0, 0)}
Z_LIM = 3.5
ATASCO_REL = 0.6          # propuesto: amplitud < 60 % de la de referencia = posible atasco (incompleta: < 90 %)
METRIC_FLOORS_DEG = {'retardo_apertura_ms': 5.0, 'duracion_apertura_ms': 5.0, 'retardo_cierre_ms': 5.0, 'duracion_cierre_ms': 5.0,
                     'meseta': 1.0, 'residual': 1.0, 'amplitud': 1.0}


# ───────────────────────────── carga y calibración ─────────────────────────────

def load_session(path):
    meta = json.load(open(os.path.join(path, 'session.json')))
    z = np.load(os.path.join(path, 'session.npz'), allow_pickle=False)
    d = {k: z[k] for k in z.files}
    d['info'] = json.loads(str(d['info']))
    d['events'] = [(float(t), int(c), P.EVENT_NAMES.get(int(c), str(c)), int(a)) for t, c, a in zip(d['ev_t'], d['ev_code'], d['ev_arg'])]
    return meta, d


def hall_to_angles(hall_sum8: np.ndarray, calib: dict) -> np.ndarray:
    """H1–H3 (suma de 8) → ángulo ESTIMADO (°) con la curva monótona medida de cada sensor. Fuera del rango calibrado → NaN."""
    from scipy.interpolate import PchipInterpolator
    out = np.full((len(hall_sum8), 3), np.nan)
    for i, c in enumerate(calib['sensores']):
        if not c.get('valida', True):
            continue
        r = np.asarray(c['raw_sum8'], float); th = np.asarray(c['theta_deg'], float)
        o = np.argsort(r)
        out[:, i] = PchipInterpolator(r[o], th[o], extrapolate=False)(hall_sum8[:, i].astype(float))
    return out


def calibration_matches_device(calib, info):
    """La calibración del archivo debe coincidir con la guardada en el ESP32 (cantidad de puntos y rango de cada sensor)."""
    if not calib:
        return False, 'sin archivo de calibración'
    if not info or 'calibracion' not in info:
        return False, 'el firmware no informó su calibración'
    for i, (c, dev) in enumerate(zip(calib['sensores'], info['calibracion'])):
        if not dev.get('valida'):
            return False, f'H{i+1}: calibración del ESP32 {dev.get("estado", "inválida")}'
        th = c['theta_deg']
        if dev.get('puntos') != len(th) or abs(dev.get('min', 0) - min(th)) > 0.05 or abs(dev.get('max', 0) - max(th)) > 0.05:
            return False, f'H{i+1}: el archivo no coincide con lo guardado en el ESP32'
    return True, 'coincide'


# ───────────────────────────── utilidades ─────────────────────────────

def median_in(t, x, a, b):
    m = (t >= a) & (t <= b)
    return float(np.nanmedian(x[m])) if np.any(m) and np.any(np.isfinite(x[m])) else np.nan


def crossing(t, x, t_from, t_to, level, rising):
    m = (t >= t_from) & (t <= t_to)
    tt, xx = t[m], x[m]
    if len(tt) < 2 or not np.isfinite(level):
        return np.nan
    s = (xx >= level) if rising else (xx <= level)
    idx = np.nonzero(s)[0]
    if len(idx) == 0:
        return np.nan
    k = idx[0]
    if k == 0:
        return float(tt[0])
    x0, x1 = xx[k - 1], xx[k]
    return float(tt[k]) if x1 == x0 else float(tt[k - 1] + (level - x0) / (x1 - x0) * (tt[k] - tt[k - 1]))


def robust_stats(v):
    v = np.asarray(v, float)
    med = float(np.nanmedian(v))
    return med, float(np.nanmedian(np.abs(v - med)) * 1.4826)


def band_rms(t, x, a, b):
    m = (t >= a) & (t <= b)
    if np.sum(m) < 8:
        return np.nan
    y = x[m].astype(float) - np.mean(x[m])
    return float(np.sqrt(np.mean(y ** 2)) + 1e-9)


# ───────────────────────────── análisis ─────────────────────────────

def analyze(path, calib_path=None, thresholds_path=None, plots=True):
    meta, d = load_session(path)
    mode = meta.get('modo_declarado', 'NORMAL')
    synthetic = bool(meta.get('sintetico'))
    calib = json.load(open(calib_path)) if calib_path else None
    cal_ok, cal_reason = calibration_matches_device(calib, d['info']) if calib else (False, 'sin archivo de calibración')
    thr = json.load(open(thresholds_path)) if thresholds_path else None
    ht, hall = d['hall_t'], d['hall'].astype(float)
    ev = d['events']
    t_os = [e[0] for e in ev if e[2] == 'OPEN_CMD_START']
    t_oe = [e[0] for e in ev if e[2] == 'OPEN_CMD_END']
    t_cs = [e[0] for e in ev if e[2] == 'CLOSE_CMD_START']
    t_ce = [e[0] for e in ev if e[2] == 'CLOSE_CMD_END']
    stops = [e for e in ev if e[2].startswith('STOP_')]
    losses = [e for e in ev if e[2] in ('ADC_POOL_OVF', 'I2S_OVF')]
    n = min(len(t_os), len(t_oe), len(t_cs), len(t_ce))
    if n == 0 or len(ht) == 0:
        raise SystemExit('No hay ciclos completos o no hay datos Hall en la sesión.')
    if cal_ok:
        X, unit, label = hall_to_angles(hall, calib), '°', 'ángulo ESTIMADO (calibración del sensor)'
    else:
        X, unit, label = hall / 8.0, 'cuentas', 'lectura CRUDA (cuentas, NO lineal con el ángulo)'
    sat_flags = d['status'][:, 9:12].max(0) if len(d['status']) else np.zeros(3)

    rows = []
    for k in range(n):
        t_next = t_os[k + 1] if k + 1 < len(t_os) else ht[-1]
        dwo, dwc = t_cs[k] - t_oe[k], t_next - t_ce[k]
        r = {'ciclo': k, 't_orden_apertura_s': round(t_os[k], 4), 'periodo_s': round(t_next - t_os[k], 4) if k + 1 < len(t_os) else np.nan}
        for i in range(3):
            x = X[:, i]
            r[f'v{i+1}_base'] = median_in(ht, x, t_os[k] - 0.2, t_os[k] - 0.02)
            r[f'v{i+1}_meseta'] = median_in(ht, x, t_oe[k] + 0.4 * dwo, t_cs[k] - 0.005)
            r[f'v{i+1}_residual'] = median_in(ht, x, t_ce[k] + 0.6 * dwc, t_next - 0.02)
        rows.append(r)
    ref = {}
    for i in range(3):
        amp = np.array([r[f'v{i+1}_meseta'] - r[f'v{i+1}_base'] for r in rows])
        A_ref = float(np.nanmedian(amp))
        base_ref = float(np.nanmedian([r[f'v{i+1}_base'] for r in rows]))
        ref[i] = (A_ref, base_ref)
        up = A_ref > 0                       # con ángulo la amplitud es positiva; con lectura cruda suele ser negativa
        for k, r in enumerate(rows):
            x = X[:, i]
            t_next = t_os[k + 1] if k + 1 < len(t_os) else ht[-1]
            b, p, res = r[f'v{i+1}_base'], r[f'v{i+1}_meseta'], r[f'v{i+1}_residual']
            tos = crossing(ht, x, t_os[k] - 0.05, t_cs[k], b + 0.1 * A_ref, up)
            toe = crossing(ht, x, tos if np.isfinite(tos) else t_os[k], t_cs[k], b + 0.9 * (p - b), up)
            tcs = crossing(ht, x, t_cs[k] - 0.05, t_next, p - 0.1 * A_ref, not up)
            tce = crossing(ht, x, tcs if np.isfinite(tcs) else t_cs[k], t_next, res + 0.1 * (p - res), not up)
            r.update({f'v{i+1}_amplitud': p - b, f'v{i+1}_retardo_apertura_ms': (tos - t_os[k]) * 1e3, f'v{i+1}_duracion_apertura_ms': (toe - tos) * 1e3,
                      f'v{i+1}_retardo_cierre_ms': (tcs - t_cs[k]) * 1e3, f'v{i+1}_duracion_cierre_ms': (tce - tcs) * 1e3,
                      f'v{i+1}_t_inicio_apertura_s': tos, f'v{i+1}_t_fin_apertura_s': toe, f'v{i+1}_t_inicio_cierre_s': tcs, f'v{i+1}_t_fin_cierre_s': tce})
            fl = []
            rel = (p - b) / A_ref if A_ref else np.nan
            if not np.isfinite(tos):
                fl.append('no abrió')
            if np.isfinite(rel) and rel < 0.9:
                fl.append(f'apertura incompleta ({100 * rel:.0f} % de la amplitud de referencia)')
            if np.isfinite(rel) and rel < ATASCO_REL:
                fl.append('posible atasco de la valva')
            back = (res - base_ref) / A_ref if A_ref else np.nan
            if np.isfinite(back) and back > max(0.05, (2.0 / abs(A_ref)) if cal_ok else 0.05):
                fl.append('cierre incompleto (no vuelve a la base)')
            if cal_ok and mode in EXPECTED and np.isfinite(p) and p < EXPECTED[mode][i] - 5:
                fl.append(f'apertura menor a la esperada ({p:.1f}° < {EXPECTED[mode][i]}°)')
            if cal_ok and np.isfinite(res) and res > EXPECTED_CLOSED.get(mode, (0, 0, 0))[i] + 3.0:
                fl.append(f'residual cerrado {res:.1f}°')
            if sat_flags[i] > 0:
                fl.append('lectura saturada en la sesión: revisar distancia/portasensor')
            r[f'v{i+1}_banderas'] = '; '.join(fl)
    for k, r in enumerate(rows):
        t_next = t_os[k + 1] if k + 1 < len(t_os) else ht[-1] + 1
        fl = []
        rels = [(r[f'v{i+1}_amplitud'] / ref[i][0]) if ref[i][0] else np.nan for i in range(3)]
        if all(np.isfinite(v) and v < ATASCO_REL for v in rels):
            fl.append('las 3 valvas se detuvieron antes de lo normal (atasco del mecanismo)')
        for e in stops:
            if t_os[k] - 0.1 <= e[0] < t_next:
                fl.append(f'firmware: {e[2]}')
        for e in losses:
            if t_os[k] - 0.1 <= e[0] < t_next:
                fl.append(f'pérdida de datos: {e[2]}')
        starts = [r[f'v{i+1}_t_inicio_apertura_s'] for i in range(3)]
        if all(np.isfinite(starts)):
            r['dispersion_inicio_apertura_ms'] = (max(starts) - min(starts)) * 1e3
        if cal_ok:
            pl = [r[f'v{i+1}_meseta'] for i in range(3)]
            exp = EXPECTED.get(mode, (80, 80, 80))
            dev = [pl[i] - exp[i] for i in range(3)]
            r['asimetria_mesetas_deg'] = float(np.nanmax(pl) - np.nanmin(pl))
            r['asimetria_vs_modo_deg'] = float(np.nanmax(dev) - np.nanmin(dev))
            if r['asimetria_vs_modo_deg'] > 5.0:
                fl.append(f"asimetría {r['asimetria_vs_modo_deg']:.1f}° respecto del modo declarado")
        r['mecanismo_banderas'] = '; '.join(fl)
    # comparación con umbrales de referencia (o provisional dentro de la sesión)
    metrics = [f'v{i+1}_{m}' for i in range(3) for m in METRIC_FLOORS_DEG] + ['periodo_s']
    stats = {}
    for m in metrics:
        base = m.split('_', 1)[1] if m.startswith('v') else m
        floor = METRIC_FLOORS_DEG.get(base, 0.005) if (cal_ok or 'ms' in base) else (20.0 if base in ('meseta', 'residual', 'amplitud') else METRIC_FLOORS_DEG.get(base, 0.005))
        if thr and m in thr.get('metricas', {}) and cal_ok:
            med, mad = thr['metricas'][m]['mediana'], thr['metricas'][m]['mad']; src = 'referencia'
        else:
            med, mad = robust_stats([r.get(m, np.nan) for r in rows]); src = 'provisional (dentro de la sesión)'
        stats[m] = {'mediana': med, 'mad': mad, 'piso': floor, 'origen': src}
        for r in rows:
            r[f'z_{m}'] = (r.get(m, np.nan) - med) / max(mad, floor)
    for r in rows:
        incons = [m for m in metrics if np.isfinite(r.get(f'z_{m}', np.nan)) and abs(r[f'z_{m}']) > Z_LIM]
        fl = [r[f'v{i+1}_banderas'] for i in range(3) if r[f'v{i+1}_banderas']] + ([r['mecanismo_banderas']] if r['mecanismo_banderas'] else [])
        if incons:
            fl.append('variación respecto de ' + ('la referencia' if thr and cal_ok else 'la sesión (provisional)') + ': ' + ', '.join(incons))
        r['clasificacion'] = 'inconsistente' if fl else 'equivalente'
        r['motivos'] = ' | '.join(fl)
    summary = {
        'sesion': os.path.basename(os.path.normpath(path)), 'fuente': meta.get('fuente'), 'SINTETICO': synthetic,
        'modo_declarado': mode, 'sensor_hall': meta.get('sensor_hall'), 'calibracion': {'usada': cal_ok, 'motivo': cal_reason},
        'posicion': label, 'unidad': unit, 'umbrales': 'referencia' if (thr and cal_ok) else 'provisional', 'ciclos': n,
        'equivalentes': sum(r['clasificacion'] == 'equivalente' for r in rows),
        'inconsistentes': [r['ciclo'] for r in rows if r['clasificacion'] == 'inconsistente'],
        'estadisticos': stats, 'enlace': meta.get('enlace'), 'paradas_firmware': [(e[0], e[2]) for e in stops],
        'perdidas': [(e[0], e[2]) for e in losses], 'audio_complementario': audio_contrast(d, rows),
        'nota': 'Detectar cambios en el banco NO equivale a diagnosticar una válvula implantada. Umbrales propuestos hasta validarlos con ensayos.',
    }
    out = os.path.join(path, 'analisis')
    os.makedirs(out, exist_ok=True)
    keys = sorted({k for r in rows for k in r}, key=lambda k: list(rows[0]).index(k) if k in rows[0] else 999)
    with open(os.path.join(out, 'ciclos.csv'), 'w', newline='') as f:
        w = csv.DictWriter(f, fieldnames=keys)
        w.writeheader()
        for r in rows:
            w.writerow({k: (round(v, 4) if isinstance(v, float) else v) for k, v in r.items()})
    json.dump(summary, open(os.path.join(out, 'resumen.json'), 'w'), indent=1, ensure_ascii=False, default=float)
    if plots:
        make_plots(out, d, ht, hall, X if cal_ok else None, rows, synthetic, mode, cal_reason)
    return summary, rows


def audio_contrast(d, rows):
    """Contraste (dB) del audio en ±30 ms del fin de apertura MEDIDO frente a la mitad del recorrido (servo en marcha) y a la espera quieta.
    Exploratorio: no se usa para marcar eventos."""
    t, x = d['audio_t'], d['audio']
    if len(t) == 0:
        return None
    vq, vm = [], []
    for r in rows:
        tos, toe = r.get('v1_t_inicio_apertura_s'), r.get('v1_t_fin_apertura_s')
        if not (np.isfinite(tos) and np.isfinite(toe)):
            continue
        q = band_rms(t, x, r['t_orden_apertura_s'] - 0.2, r['t_orden_apertura_s'] - 0.03)
        mid = band_rms(t, x, (tos + toe) / 2 - 0.03, (tos + toe) / 2 + 0.03)
        e = band_rms(t, x, toe - 0.03, toe + 0.03)
        vq.append(20 * np.log10(e / q)); vm.append(20 * np.log10(e / mid))
    med = float(np.nanmedian(vm)) if vm else None
    return {'fin_apertura_vs_quieto_dB': float(np.nanmedian(vq)) if vq else None, 'fin_apertura_vs_mitad_dB': med,
            'lectura': 'no se distingue del sonido del servo (contraste < 6 dB)' if med is None or med < 6 else 'contraste ≥ 6 dB: evaluar en más sesiones'}


def make_plots(out, d, ht, hall, ang, rows, synthetic, mode, cal_reason):
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt

    def mark(fig):
        if synthetic:
            fig.text(0.5, 0.5, 'SINTÉTICO — EMULADOR', fontsize=44, color='red', alpha=0.15, ha='center', va='center', rotation=20)
    cmd = d['cmd']
    fig, ax = plt.subplots(3, 1, figsize=(13, 9), sharex=True)
    for i in range(3):
        ax[0].plot(ht, hall[:, i] / 8, lw=0.8, label=f'H{i+1} lectura cruda')
    ax[0].set_ylabel('cuentas'); ax[0].legend(fontsize=7, loc='upper right')
    if ang is not None:
        for i in range(3):
            ax[1].plot(ht, ang[:, i], lw=0.9, label=f'valva {i+1} (estimado)')
        ax[1].set_ylabel('ángulo estimado (°)'); ax[1].legend(fontsize=7, loc='upper left')
    else:
        ax[1].text(0.5, 0.5, f'SIN CALIBRACIÓN VÁLIDA ({cal_reason}): no se muestran grados', transform=ax[1].transAxes, ha='center', color='gray')
    a2 = ax[1].twinx()
    if len(cmd):
        a2.plot(cmd[:, 0], cmd[:, 1], 'k--', lw=0.7)
    a2.set_ylabel('orden al servo (°) — no es posición')
    for r in rows:
        for i in range(3):
            for key, c in (('t_inicio_apertura_s', 'g'), ('t_fin_apertura_s', 'g'), ('t_inicio_cierre_s', 'r'), ('t_fin_cierre_s', 'r')):
                t = r.get(f'v{i+1}_{key}')
                if t is not None and np.isfinite(t):
                    ax[0].axvline(t, color=c, lw=0.3, alpha=0.5)
        if r['clasificacion'] != 'equivalente':
            ax[0].axvspan(r['t_orden_apertura_s'], r['t_orden_apertura_s'] + (r['periodo_s'] if np.isfinite(r['periodo_s']) else 1), color='red', alpha=0.07)
    if len(d['audio_t']):
        a = d['audio'].astype(float); w = 256
        env = np.sqrt(np.convolve(a ** 2, np.ones(w) / w, 'same'))
        ax[2].plot(d['audio_t'][::32], env[::32], color='tab:green'); ax[2].set_ylabel('envolvente audio')
    ax[2].set_xlabel('tiempo del ESP32 (s)')
    fig.suptitle(f'CardioValveAI v3 · modo declarado {mode} · verde/rojo = inicio/fin de apertura/cierre MEDIDOS · franjas rojas = ciclo inconsistente', fontsize=9)
    mark(fig); fig.tight_layout(); fig.savefig(os.path.join(out, 'vista_general.png'), dpi=110); plt.close(fig)
    X = ang if ang is not None else hall / 8
    fig, ax = plt.subplots(1, 3, figsize=(14, 4), sharey=True)
    for i in range(3):
        for r in rows:
            t0 = r['t_orden_apertura_s']
            m = (ht >= t0 - 0.3) & (ht <= t0 + (r['periodo_s'] if np.isfinite(r['periodo_s']) else 2.0))
            ax[i].plot((ht[m] - t0) * 1e3, X[m, i], lw=0.8, color='crimson' if r['clasificacion'] != 'equivalente' else 'tab:blue', alpha=0.7)
        ax[i].set_title(f'valva {i+1}'); ax[i].set_xlabel('ms desde la orden de apertura')
    ax[0].set_ylabel('ángulo estimado (°)' if ang is not None else 'lectura cruda (cuentas)')
    fig.suptitle('Ciclos superpuestos (azul = equivalente, rojo = inconsistente)', fontsize=9)
    mark(fig); fig.tight_layout(); fig.savefig(os.path.join(out, 'ciclos_superpuestos.png'), dpi=110); plt.close(fig)
    ms = ['v1_retardo_apertura_ms', 'v1_duracion_apertura_ms', 'v1_duracion_cierre_ms', 'v1_amplitud', 'v2_amplitud', 'v3_amplitud']
    fig, ax = plt.subplots(len(ms), 1, figsize=(10, 2 * len(ms)), sharex=True)
    k = [r['ciclo'] for r in rows]
    for a, m in zip(ax, ms):
        v = np.array([r[m] for r in rows], float)
        a.plot(k, v, 'o-', ms=3)
        bad = [j for j, r in enumerate(rows) if abs(r.get(f'z_{m}', 0) or 0) > Z_LIM]
        a.plot([k[j] for j in bad], v[bad], 'rx', ms=8)
        a.set_ylabel(m.replace('_', ' '), fontsize=7)
    ax[-1].set_xlabel('ciclo')
    mark(fig); fig.tight_layout(); fig.savefig(os.path.join(out, 'metricas.png'), dpi=110); plt.close(fig)


def create_thresholds(sessions, calib_path, out_path, allow_synthetic=False):
    """Umbrales a partir de sesiones NORMALES repetidas: mediana y MAD de cada métrica (ciclos «equivalentes» de cada sesión)."""
    vals, used = {}, []
    for s in sessions:
        meta = json.load(open(os.path.join(s, 'session.json')))
        if meta.get('sintetico') and not allow_synthetic:
            raise SystemExit(f'{s}: sesión SINTÉTICA: no sirve para fijar umbrales reales (usar --permitir-sinteticos solo para probar el software)')
        if meta.get('modo_declarado') != 'NORMAL':
            raise SystemExit(f'{s}: los umbrales se fijan con sesiones en modo NORMAL')
        summ, rows = analyze(s, calib_path, None, plots=False)
        if not summ['calibracion']['usada']:
            raise SystemExit(f'{s}: sin calibración válida ({summ["calibracion"]["motivo"]})')
        used.append({'sesion': s, 'ciclos': len(rows), 'fuente': meta.get('fuente')})
        for r in rows:
            for k, v in r.items():
                if isinstance(v, float) and np.isfinite(v) and not k.startswith(('z_', 't_')) and '_t_' not in k:
                    vals.setdefault(k, []).append(v)
    if len(used) < 3:
        print('ATENCIÓN: se recomiendan ≥ 3 sesiones en días distintos')
    th = {'creado': __import__('time').strftime('%Y-%m-%d %H:%M'), 'sesiones': used, 'metricas': {}}
    for k, v in vals.items():
        med, mad = robust_stats(v)
        th['metricas'][k] = {'mediana': med, 'mad': mad, 'n': len(v)}
    json.dump(th, open(out_path, 'w'), indent=1, ensure_ascii=False)
    print('Umbrales guardados en', out_path, '·', sum(u['ciclos'] for u in used), 'ciclos de', len(used), 'sesiones')
    return th


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('sesion', nargs='*')
    ap.add_argument('--calib')
    ap.add_argument('--umbrales')
    ap.add_argument('--crear-umbrales', action='store_true')
    ap.add_argument('--salida', default='umbrales.json')
    ap.add_argument('--permitir-sinteticos', action='store_true')
    ap.add_argument('--sin-graficos', action='store_true')
    a = ap.parse_args(argv)
    if a.crear_umbrales:
        create_thresholds(a.sesion, a.calib, a.salida, a.permitir_sinteticos); return
    for ses in a.sesion:
        s, rows = analyze(ses, a.calib, a.umbrales, not a.sin_graficos)
        print(json.dumps({k: s[k] for k in ('fuente', 'SINTETICO', 'modo_declarado', 'calibracion', 'posicion', 'umbrales', 'ciclos', 'equivalentes', 'inconsistentes')}, ensure_ascii=False, indent=1))
        for r in rows:
            if r['clasificacion'] != 'equivalente':
                print(f"  ciclo {r['ciclo']}: {r['motivos']}")


if __name__ == '__main__':
    main()
