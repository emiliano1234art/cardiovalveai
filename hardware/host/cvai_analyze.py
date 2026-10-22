"""
CardioVal AI v2 — análisis por ciclo (apertura/cierre MEDIDOS con los sensores Hall).

  python cvai_analyze.py sesiones/20261022_101500_NORMAL [--calib calib_hall.json]

Salida en <sesión>/analisis/: ciclos.csv, resumen.json, vista_general.png, ciclos_superpuestos.png, metricas.png

Definiciones (umbrales PROPUESTOS, a revisar con los ensayos físicos):
  - x(t): ángulo medido de cada valva (°) si hay calibración; si no, posición normalizada 0–1 (rotulada «sin calibrar»).
  - base (cerrada) = mediana 20–200 ms antes del comando de apertura; meseta = mediana del 60 % final de la espera abierta;
    residual = mediana del 40 % final de la espera cerrada.
  - S_ref (por valva) = mediana de (meseta − base) en la sesión.
  - inicio de apertura = cruce de base + 10 % S_ref; fin = cruce de base + 90 % (meseta − base). Cierre: simétrico.
  - apertura incompleta: (meseta − base) < 90 % de S_ref, o (calibrado) < ángulo esperado del modo − 5°.
  - cierre incompleto: residual − base_sesión > max(5 % S_ref, 2°).
  - asimetría (solo calibrado): rango de mesetas entre valvas > 5° (además de la asimetría esperada del modo declarado).
  - atasco: carrera del plato (H0) < 90 % de la de referencia, o evento STOP_STALL/STOP_OVERCURRENT del firmware.
  - inconsistencia ciclo a ciclo: |z robusto| > 3,5 con z = (x − mediana) / (1,4826·MAD), con pisos de 5 ms y 1° (0,02 sin calibrar).
Las señales piezo y de audio se analizan como COMPLEMENTARIAS: se informa su contraste en ventanas alrededor de los
eventos medidos, sin usarlas para marcar apertura/cierre.
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


# ───────────────────────────── carga y calibración ─────────────────────────────

def load_session(path):
    meta = json.load(open(os.path.join(path, 'session.json')))
    z = np.load(os.path.join(path, 'session.npz'), allow_pickle=False)
    d = {k: z[k] for k in z.files}
    d['info'] = json.loads(str(d['info']))
    d['events'] = [(float(t), int(c), P.EVENT_NAMES.get(int(c), str(c)), int(a)) for t, c, a in zip(d['ev_t'], d['ev_code'], d['ev_arg'])]
    return meta, d


def hall_to_angles(hall_sum8: np.ndarray, calib: dict) -> np.ndarray:
    """H1–H3 (suma de 8) → ángulo (°) con la curva monótona de calibración. Fuera del rango calibrado → NaN."""
    from scipy.interpolate import PchipInterpolator
    out = np.full((len(hall_sum8), 3), np.nan)
    for i, c in enumerate(calib['valvas']):
        r = np.asarray(c['raw_sum8'], float); th = np.asarray(c['theta_deg'], float)
        o = np.argsort(r)
        f = PchipInterpolator(r[o], th[o], extrapolate=False)
        out[:, i] = f(hall_sum8[:, i + 1].astype(float))
    return out


# ───────────────────────────── utilidades ─────────────────────────────

def median_in(t, x, a, b):
    m = (t >= a) & (t <= b)
    return float(np.nanmedian(x[m])) if np.any(m) else np.nan


def crossing(t, x, t_from, t_to, level, rising):
    """Primer cruce (interpolado) de x por level en [t_from, t_to]."""
    m = (t >= t_from) & (t <= t_to)
    tt, xx = t[m], x[m]
    if len(tt) < 2:
        return np.nan
    s = (xx >= level) if rising else (xx <= level)
    idx = np.nonzero(s)[0]
    if len(idx) == 0:
        return np.nan
    k = idx[0]
    if k == 0:
        return float(tt[0])
    x0, x1 = xx[k - 1], xx[k]
    if x1 == x0:
        return float(tt[k])
    return float(tt[k - 1] + (level - x0) / (x1 - x0) * (tt[k] - tt[k - 1]))


def robust_z(v, floor):
    v = np.asarray(v, float)
    med = np.nanmedian(v)
    mad = np.nanmedian(np.abs(v - med)) * 1.4826
    return (v - med) / max(mad, floor), med, mad


def band_rms(t, x, a, b):
    m = (t >= a) & (t <= b)
    if np.sum(m) < 8:
        return np.nan
    y = x[m].astype(float)
    y = y - np.mean(y)
    return float(np.sqrt(np.mean(y ** 2)) + 1e-9)


# ───────────────────────────── análisis ─────────────────────────────

def analyze(path, calib_path=None, plots=True):
    meta, d = load_session(path)
    mode = meta.get('modo_declarado', 'NORMAL')
    synthetic = bool(meta.get('sintetico'))
    calib = json.load(open(calib_path)) if calib_path else None
    ht, hall = d['hall_t'], d['hall'].astype(float)
    ev = d['events']
    t_os_cmd = [e[0] for e in ev if e[2] == 'OPEN_CMD_START']
    t_oe_cmd = [e[0] for e in ev if e[2] == 'OPEN_CMD_END']
    t_cs_cmd = [e[0] for e in ev if e[2] == 'CLOSE_CMD_START']
    t_ce_cmd = [e[0] for e in ev if e[2] == 'CLOSE_CMD_END']
    stops = [e for e in ev if e[2] in ('STOP_STALL', 'STOP_OVERCURRENT', 'STOP_ESTOP', 'STOP_HEARTBEAT', 'STOP_ACQ_FAULT')]
    losses = [e for e in ev if e[2] in ('ADC_POOL_OVF', 'I2S_OVF')]
    n = min(len(t_os_cmd), len(t_oe_cmd), len(t_cs_cmd), len(t_ce_cmd))
    if n == 0 or len(ht) == 0:
        raise SystemExit('No hay ciclos completos o no hay datos Hall en la sesión.')

    if calib:
        X = hall_to_angles(hall, calib)
        unit, floor_x, label = '°', 1.0, 'ángulo medido (calibrado)'
    else:
        X = np.zeros((len(ht), 3))
        unit, floor_x, label = 'norm', 0.02, 'posición normalizada (SIN CALIBRAR)'
    # plato (H0): normalización propia (cuentas → 0 cerrado, 1 abierto) en ambos casos
    raw = hall[:, :4]

    def refs(sig):
        b = [median_in(ht, sig, t_os_cmd[k] - 0.2, t_os_cmd[k] - 0.02) for k in range(n)]
        dw = [t_cs_cmd[k] - t_oe_cmd[k] for k in range(n)]
        p = [median_in(ht, sig, t_oe_cmd[k] + 0.4 * dw[k], t_cs_cmd[k] - 0.005) for k in range(n)]
        return np.array(b), np.array(p)

    if not calib:
        for i in range(3):
            b, p = refs(raw[:, i + 1])
            b0, p0 = np.nanmedian(b), np.nanmedian(p)
            X[:, i] = (raw[:, i + 1] - b0) / (p0 - b0) if p0 != b0 else np.nan
    if calib and calib.get('plato'):
        # H0 es muy no lineal (campo ∝ 1/d³): se linealiza con la calibración estática H0 → comando equivalente
        from scipy.interpolate import PchipInterpolator
        r0 = np.asarray(calib['plato']['raw_sum8'], float); c0 = np.asarray(calib['plato']['cmd_deg'], float)
        o = np.argsort(r0)
        eq = PchipInterpolator(r0[o], c0[o], extrapolate=False)(raw[:, 0])
        cmd_closed, cmd_open = float(np.max(c0)), float(np.min(c0))
        plate = (cmd_closed - eq) / (cmd_closed - cmd_open)
        plate_label = 'plato H0 (linealizado, 0 = cerrado, 1 = abierto)'
    else:
        b0p, p0p = refs(raw[:, 0])
        plate = (raw[:, 0] - np.nanmedian(b0p)) / (np.nanmedian(p0p) - np.nanmedian(b0p))
        plate_label = 'plato H0 (cuentas normalizadas, NO lineal)'

    rows = []
    for k in range(n):
        t_next = t_os_cmd[k + 1] if k + 1 < len(t_os_cmd) else ht[-1]
        dw_open = t_cs_cmd[k] - t_oe_cmd[k]
        dw_closed = t_next - t_ce_cmd[k]
        row = {'ciclo': k, 't_cmd_apertura_s': round(t_os_cmd[k], 4), 'periodo_s': round(t_next - t_os_cmd[k], 4) if k + 1 < len(t_os_cmd) else np.nan}
        for i in range(3):
            x = X[:, i]
            base = median_in(ht, x, t_os_cmd[k] - 0.2, t_os_cmd[k] - 0.02)
            plat = median_in(ht, x, t_oe_cmd[k] + 0.4 * dw_open, t_cs_cmd[k] - 0.005)
            resid = median_in(ht, x, t_ce_cmd[k] + 0.6 * dw_closed, t_next - 0.02)
            row.update({f'v{i+1}_base': base, f'v{i+1}_meseta': plat, f'v{i+1}_residual': resid})
        rows.append(row)
    for i in range(3):
        span = np.array([r[f'v{i+1}_meseta'] - r[f'v{i+1}_base'] for r in rows])
        S = float(np.nanmedian(span))
        base_ses = float(np.nanmedian([r[f'v{i+1}_base'] for r in rows]))
        for k, r in enumerate(rows):
            x = X[:, i]
            t_next = t_os_cmd[k + 1] if k + 1 < len(t_os_cmd) else ht[-1]
            b, p, res = r[f'v{i+1}_base'], r[f'v{i+1}_meseta'], r[f'v{i+1}_residual']
            tos = crossing(ht, x, t_os_cmd[k] - 0.05, t_cs_cmd[k], b + 0.1 * S, True)
            toe = crossing(ht, x, tos if np.isfinite(tos) else t_os_cmd[k], t_cs_cmd[k], b + 0.9 * (p - b), True)
            tcs = crossing(ht, x, t_cs_cmd[k] - 0.05, t_next, p - 0.1 * S, False)
            tce = crossing(ht, x, tcs if np.isfinite(tcs) else t_cs_cmd[k], t_next, res + 0.1 * (p - res), False)
            r[f'v{i+1}_retardo_apertura_ms'] = (tos - t_os_cmd[k]) * 1e3
            r[f'v{i+1}_duracion_apertura_ms'] = (toe - tos) * 1e3
            r[f'v{i+1}_retardo_cierre_ms'] = (tcs - t_cs_cmd[k]) * 1e3
            r[f'v{i+1}_duracion_cierre_ms'] = (tce - tcs) * 1e3
            r[f'v{i+1}_t_inicio_apertura_s'] = tos; r[f'v{i+1}_t_fin_apertura_s'] = toe
            r[f'v{i+1}_t_inicio_cierre_s'] = tcs; r[f'v{i+1}_t_fin_cierre_s'] = tce
            flags = []
            amp = p - b
            if not np.isfinite(tos):
                flags.append('no abrió')
            if np.isfinite(amp) and amp < 0.9 * S:
                flags.append('apertura incompleta (vs. sesión)')
            if calib and mode in EXPECTED and np.isfinite(p) and p < EXPECTED[mode][i] - 5:
                flags.append(f'apertura menor a la esperada ({p:.1f}° < {EXPECTED[mode][i]}°)')
            if np.isfinite(res) and res - base_ses > max(0.05 * S, 2.0 if calib else 0.05):
                flags.append('cierre incompleto')
            if calib and np.isfinite(res) and res > EXPECTED_CLOSED.get(mode, (0, 0, 0))[i] + 3.0:
                flags.append(f'residual cerrado {res:.1f}°')
            r[f'v{i+1}_banderas'] = '; '.join(flags)
    # plato / atasco
    b_p, p_p = refs(plate)
    Sp = float(np.nanmedian(p_p - b_p))
    for k, r in enumerate(rows):
        comp = (p_p[k] - b_p[k]) / Sp if Sp else np.nan
        r['plato_carrera_rel'] = comp
        fl = []
        t_next = t_os_cmd[k + 1] if k + 1 < len(t_os_cmd) else ht[-1] + 1
        if np.isfinite(comp) and comp < 0.9:
            fl.append('plato no completó la carrera (posible atasco)')
        for e in stops:
            if t_os_cmd[k] - 0.1 <= e[0] < t_next:
                fl.append(f'firmware: {e[2]}')
        for e in losses:
            if t_os_cmd[k] - 0.1 <= e[0] < t_next:
                fl.append(f'pérdida de datos: {e[2]}')
        r['plato_banderas'] = '; '.join(fl)
        if calib:
            pl = [r[f'v{i+1}_meseta'] for i in range(3)]
            exp = EXPECTED.get(mode, (80, 80, 80))
            dev = [pl[i] - exp[i] for i in range(3)]
            r['asimetria_mesetas_deg'] = float(np.nanmax(pl) - np.nanmin(pl))
            r['asimetria_vs_modo_deg'] = float(np.nanmax(dev) - np.nanmin(dev))
    # variación ciclo a ciclo
    metrics = []
    for i in range(3):
        metrics += [(f'v{i+1}_retardo_apertura_ms', 5.0), (f'v{i+1}_duracion_apertura_ms', 5.0), (f'v{i+1}_retardo_cierre_ms', 5.0),
                    (f'v{i+1}_duracion_cierre_ms', 5.0), (f'v{i+1}_meseta', floor_x), (f'v{i+1}_residual', floor_x)]
    metrics.append(('periodo_s', 0.005))
    zs = {}
    for m, fl in metrics:
        z, med, mad = robust_z([r[m] for r in rows], fl)
        zs[m] = {'mediana': med, 'mad': mad, 'piso': fl}
        for k, r in enumerate(rows):
            r[f'z_{m}'] = z[k]
    for r in rows:
        incons = [m for m, _ in metrics if np.isfinite(r[f'z_{m}']) and abs(r[f'z_{m}']) > Z_LIM]
        flags = [r[f'v{i+1}_banderas'] for i in range(3) if r[f'v{i+1}_banderas']] + ([r['plato_banderas']] if r['plato_banderas'] else [])
        if calib and r.get('asimetria_vs_modo_deg', 0) > 5.0:
            flags.append(f"asimetría {r['asimetria_vs_modo_deg']:.1f}° respecto del modo declarado")
        if incons:
            flags.append('variación ciclo a ciclo: ' + ', '.join(incons))
        r['clasificacion'] = 'inconsistente' if flags else 'equivalente'
        r['motivos'] = ' | '.join(flags)

    comp = complementary(d, rows)
    summary = {
        'sesion': os.path.basename(os.path.normpath(path)), 'fuente': meta.get('fuente'), 'SINTETICO': synthetic,
        'modo_declarado': mode, 'posicion': label, 'unidad': unit, 'plato': plate_label, 'ciclos': n,
        'equivalentes': sum(r['clasificacion'] == 'equivalente' for r in rows),
        'inconsistentes': [r['ciclo'] for r in rows if r['clasificacion'] == 'inconsistente'],
        'estadisticos': zs, 'enlace': meta.get('enlace'), 'paradas_firmware': [(e[0], e[2]) for e in stops],
        'perdidas': [(e[0], e[2]) for e in losses], 'complementarias': comp,
        'nota': 'Detectar cambios en el banco NO equivale a diagnosticar una prótesis implantada. Umbrales propuestos, no validados.',
    }
    out = os.path.join(path, 'analisis')
    os.makedirs(out, exist_ok=True)
    keys = list(rows[0].keys())
    with open(os.path.join(out, 'ciclos.csv'), 'w', newline='') as f:
        w = csv.DictWriter(f, fieldnames=keys)
        w.writeheader()
        for r in rows:
            w.writerow({k: (round(v, 4) if isinstance(v, float) else v) for k, v in r.items()})
    json.dump(summary, open(os.path.join(out, 'resumen.json'), 'w'), indent=1, ensure_ascii=False, default=float)
    if plots:
        make_plots(out, d, ht, X, plate, rows, label, unit, synthetic, mode, plate_label)
    return summary, rows


def complementary(d, rows):
    """Contraste (dB) de P1, P2 y audio en ventanas de ±30 ms alrededor de los eventos MEDIDOS, respecto de
    (a) la espera cerrada (servo quieto) y (b) la mitad de la carrera (servo moviéndose). Exploratorio."""
    ft, fv = d['fast_t'], d['fast']
    at, av = d['audio_t'], d['audio']
    res = {}
    for name, (t, x) in {'P1': (ft, fv[:, 0] if len(fv) else fv), 'P2': (ft, fv[:, 1] if len(fv) else fv), 'audio': (at, av)}.items():
        if len(t) == 0:
            continue
        vals = {'fin_apertura_vs_quieto_dB': [], 'fin_apertura_vs_mitad_dB': [], 'fin_cierre_vs_quieto_dB': [], 'fin_cierre_vs_mitad_dB': []}
        for r in rows:
            toe, tos, tce, tcs = r['v1_t_fin_apertura_s'], r['v1_t_inicio_apertura_s'], r['v1_t_fin_cierre_s'], r['v1_t_inicio_cierre_s']
            if not all(np.isfinite([toe, tos, tce, tcs])):
                continue
            q = band_rms(t, x, r['t_cmd_apertura_s'] - 0.2, r['t_cmd_apertura_s'] - 0.03)
            mid_o = band_rms(t, x, (tos + toe) / 2 - 0.03, (tos + toe) / 2 + 0.03)
            mid_c = band_rms(t, x, (tcs + tce) / 2 - 0.03, (tcs + tce) / 2 + 0.03)
            eo = band_rms(t, x, toe - 0.03, toe + 0.03)
            ec = band_rms(t, x, tce - 0.03, tce + 0.03)
            vals['fin_apertura_vs_quieto_dB'].append(20 * np.log10(eo / q))
            vals['fin_apertura_vs_mitad_dB'].append(20 * np.log10(eo / mid_o))
            vals['fin_cierre_vs_quieto_dB'].append(20 * np.log10(ec / q))
            vals['fin_cierre_vs_mitad_dB'].append(20 * np.log10(ec / mid_c))
        # relación temporal y espectro: pico de |x| en ±100 ms alrededor del fin de apertura medido y potencia por bandas
        fs = 1.0 / np.median(np.diff(t)) if len(t) > 1 else 0
        lags, bands = [], []
        for r in rows:
            toe = r['v1_t_fin_apertura_s']
            if not np.isfinite(toe):
                continue
            m = (t >= toe - 0.1) & (t <= toe + 0.1)
            if np.sum(m) < 64:
                continue
            y = x[m].astype(float) - np.mean(x[m])
            lags.append((t[m][int(np.argmax(np.abs(y)))] - toe) * 1e3)
            spec = np.abs(np.fft.rfft(y * np.hanning(len(y)))) ** 2
            f = np.fft.rfftfreq(len(y), 1 / fs)
            tot = spec.sum() + 1e-12
            bands.append([spec[(f >= lo) & (f < hi)].sum() / tot for lo, hi in ((20, 200), (200, 1000), (1000, 3000))])
        vals['_lag'] = lags
        res[name] = {'pico_respecto_fin_apertura_ms': {'mediana': float(np.median(lags)) if lags else None,
                                                       'iqr': float(np.subtract(*np.percentile(lags, [75, 25]))) if lags else None,
                                                       'nota': 'IQR grande = el pico no está ligado temporalmente al evento'},
                     'fraccion_energia_20_200_200_1k_1k_3k_Hz': np.round(np.median(bands, 0), 3).tolist() if bands else None}
        vals.pop('_lag')
        res[name].update({k: {'mediana': float(np.nanmedian(v)) if v else None, 'p25': float(np.nanpercentile(v, 25)) if v else None,
                         'p75': float(np.nanpercentile(v, 75)) if v else None, 'n': len(v)} for k, v in vals.items()})
        m = res[name]['fin_apertura_vs_mitad_dB']['mediana']
        res[name]['lectura'] = ('el fin de apertura NO se distingue del ruido del servo en movimiento (contraste < 6 dB)'
                                if m is None or m < 6 else 'contraste ≥ 6 dB respecto de la mitad de la carrera: evaluar con más ensayos')
    return res


def make_plots(out, d, ht, X, plate, rows, label, unit, synthetic, mode, plate_label):
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt

    def mark(fig):
        if synthetic:
            fig.text(0.5, 0.5, 'SINTÉTICO — EMULADOR', fontsize=44, color='red', alpha=0.15, ha='center', va='center', rotation=20)

    cmd = d['cmd']
    fig, ax = plt.subplots(4, 1, figsize=(13, 9), sharex=True)
    for i in range(3):
        ax[0].plot(ht, X[:, i], lw=0.9, label=f'valva {i+1}')
    for r in rows:
        for i in range(3):
            for key, c in (('t_inicio_apertura_s', 'g'), ('t_fin_apertura_s', 'g'), ('t_inicio_cierre_s', 'r'), ('t_fin_cierre_s', 'r')):
                t = r[f'v{i+1}_{key}']
                if np.isfinite(t):
                    ax[0].axvline(t, color=c, lw=0.3, alpha=0.5)
        if r['clasificacion'] != 'equivalente':
            ax[0].axvspan(r['t_cmd_apertura_s'], r['t_cmd_apertura_s'] + (r['periodo_s'] if np.isfinite(r['periodo_s']) else 1), color='red', alpha=0.07)
    ax[0].set_ylabel(f'{label}')
    ax[0].legend(fontsize=7, loc='upper right')
    a2 = ax[0].twinx()
    if len(cmd):
        a2.plot(cmd[:, 0], cmd[:, 1], 'k--', lw=0.7)
    a2.set_ylabel('comando (°) — no es posición')
    ax[1].plot(ht, plate, color='tab:purple'); ax[1].set_ylabel(plate_label, fontsize=7)
    if len(d['fast_t']):
        ax[2].plot(d['fast_t'], d['fast'][:, 0], lw=0.4, label='P1 (anillo)'); ax[2].plot(d['fast_t'], d['fast'][:, 1], lw=0.4, label='P2 (soporte servo)')
        ax[2].legend(fontsize=7); ax[2].set_ylabel('piezo (cuentas)')
    if len(d['audio_t']):
        a = d['audio'].astype(float); w = 256
        env = np.sqrt(np.convolve(a ** 2, np.ones(w) / w, 'same'))
        ax[3].plot(d['audio_t'][::32], env[::32], color='tab:green'); ax[3].set_ylabel('envolvente audio')
    ax[3].set_xlabel('tiempo del ESP32 (s)')
    fig.suptitle(f'CardioVal AI v2 · modo declarado {mode} · líneas verdes/rojas = inicio/fin de apertura/cierre MEDIDOS · franjas rojas = ciclo inconsistente', fontsize=9)
    mark(fig); fig.tight_layout(); fig.savefig(os.path.join(out, 'vista_general.png'), dpi=110); plt.close(fig)

    fig, ax = plt.subplots(1, 3, figsize=(14, 4), sharey=True)
    for i in range(3):
        for r in rows:
            t0 = r['t_cmd_apertura_s']
            m = (ht >= t0 - 0.3) & (ht <= t0 + (r['periodo_s'] if np.isfinite(r['periodo_s']) else 2.0))
            ax[i].plot((ht[m] - t0) * 1e3, X[m, i], lw=0.8, color='crimson' if r['clasificacion'] != 'equivalente' else 'tab:blue', alpha=0.7)
        ax[i].set_title(f'valva {i+1}'); ax[i].set_xlabel('ms desde el comando de apertura')
    ax[0].set_ylabel(label)
    fig.suptitle('Ciclos superpuestos (azul = equivalente, rojo = inconsistente)', fontsize=9)
    mark(fig); fig.tight_layout(); fig.savefig(os.path.join(out, 'ciclos_superpuestos.png'), dpi=110); plt.close(fig)

    ms = ['v1_retardo_apertura_ms', 'v1_duracion_apertura_ms', 'v1_duracion_cierre_ms', 'v1_meseta', 'v2_meseta', 'v3_meseta']
    fig, ax = plt.subplots(len(ms), 1, figsize=(10, 2 * len(ms)), sharex=True)
    k = [r['ciclo'] for r in rows]
    for a, m in zip(ax, ms):
        v = np.array([r[m] for r in rows], float)
        a.plot(k, v, 'o-', ms=3)
        bad = [j for j, r in enumerate(rows) if abs(r.get(f'z_{m}', 0) or 0) > Z_LIM]
        a.plot([k[j] for j in bad], v[bad], 'rx', ms=8)
        a.axhline(np.nanmedian(v), color='gray', lw=0.6)
        a.set_ylabel(m.replace('_', ' '), fontsize=7)
    ax[-1].set_xlabel('ciclo')
    mark(fig); fig.tight_layout(); fig.savefig(os.path.join(out, 'metricas.png'), dpi=110); plt.close(fig)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('sesion')
    ap.add_argument('--calib')
    ap.add_argument('--sin-graficos', action='store_true')
    a = ap.parse_args(argv)
    s, rows = analyze(a.sesion, a.calib, not a.sin_graficos)
    print(json.dumps({k: s[k] for k in ('fuente', 'SINTETICO', 'modo_declarado', 'posicion', 'ciclos', 'equivalentes', 'inconsistentes')}, ensure_ascii=False, indent=1))
    for r in rows:
        if r['clasificacion'] != 'equivalente':
            print(f"  ciclo {r['ciclo']}: {r['motivos']}")


if __name__ == '__main__':
    main()
