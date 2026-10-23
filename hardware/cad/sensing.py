"""
CardioValveAI — diseño de la MEDICIÓN DE POSICIÓN (cálculo, no medición).

Valvas (H1–H3): imán cilíndrico en la cola de cada valva + sensor Hall lineal fijo en el anillo.

Modelo: imán cilíndrico magnetizado axialmente, discretizado en dipolos puntuales
(suma de N subvolúmenes). Es una aproximación de campo lejano por subvolumen; sirve para
elegir geometría y verificar que la respuesta sea MONÓTONA, no para predecir milivoltios
exactos. La curva real se obtiene por calibración (video + transportador).
"""
from __future__ import annotations
import itertools
import json
import math
import os
import numpy as np

import config as C
import kinematics as K

MU0_4PI = 1e-7
D2R = math.pi / 180

def magnet_points(diam, height, br=1.30, n_r=4, n_a=10, n_h=3):
    """Subdipolos de un cilindro axial (eje local +y). Devuelve posiciones (mm) y momentos (A·m²)."""
    vol = math.pi * (diam / 2) ** 2 * height * 1e-9
    m_total = br * vol / (4 * math.pi * 1e-7)
    pts = []
    for ih in range(n_h):
        y = (ih + 0.5) / n_h * height - height / 2
        pts.append((0.0, y, 0.0, 1.0))
        for ir in range(1, n_r):
            r = ir / (n_r - 0.5) * diam / 2
            for ia in range(n_a):
                a = 2 * math.pi * ia / n_a
                pts.append((r * math.cos(a), y, r * math.sin(a), r))
    P = np.array(pts)
    w = P[:, 3] / P[:, 3].sum()
    return P[:, :3], w * m_total

def field(sensor, centers, moments_vec):
    """B (mT) en el sensor debido a los subdipolos. centers (N,3) mm, moments_vec (N,3) A·m²."""
    r = (sensor[None, :] - centers) * 1e-3
    d = np.linalg.norm(r, axis=1)
    rh = r / d[:, None]
    mdotr = np.sum(moments_vec * rh, axis=1)
    B = MU0_4PI * (3 * mdotr[:, None] * rh - moments_vec) / (d ** 3)[:, None]
    return B.sum(axis=0) * 1e3   # mT

# ───────────────────────────── H1–H3: imán en la cola ─────────────────────────────

def tail_magnet_center(theta, s, y_c):
    x, z = K.tail_end(0)  # no se usa; mantiene import
    a = (C.TAIL_PHI0 - theta) * D2R
    return np.array([C.HINGE_D + s * math.cos(a), y_c, C.Z_HINGE + s * math.sin(a)])

def leaflet_response(sensor, axis, s, mag=(4.0, 2.0), y_face=None, thetas=None):
    """Componente del campo medida por el sensor (mT) en función del ángulo de la valva."""
    y_face = C.TAIL_Y[0] if y_face is None else y_face
    thetas = np.linspace(-6, 88, 189) if thetas is None else thetas
    P0, M = magnet_points(*mag)
    yc = y_face + mag[1] / 2                    # imán embutido a ras de la cara −y de la cola
    out = []
    for th in thetas:
        c = tail_magnet_center(th, s, yc)
        pts = P0 + c                            # el momento queda paralelo a y (la rotación es alrededor de y)
        mv = np.zeros_like(pts); mv[:, 1] = -M  # polo norte hacia −y (hacia el sensor); el signo solo invierte la curva
        out.append(field(sensor, pts, mv)[axis])
    return thetas, np.array(out)

def score(thetas, B, lo=0.0, hi=84.0, sens_mV_per_mT=60.0):
    sel = (thetas >= lo) & (thetas <= hi)
    b = B[sel]; t = thetas[sel]
    dB = np.diff(b) / np.diff(t)
    mono = np.all(dB > 0) or np.all(dB < 0)
    return {'monotonic': bool(mono), 'min_slope_mT_per_deg': float(np.min(np.abs(dB))), 'span_mT': float(abs(b[-1] - b[0])),
            'max_abs_mT': float(np.max(np.abs(B))), 'min_slope_mV_per_deg': float(np.min(np.abs(dB)) * sens_mV_per_mT)}

def search_leaflet(y_sensor_options=(-6.6, -7.2), z_max=15.5, axes=('x', 'y', 'z')):
    """Busca la posición del sensor (en la pared del anillo, lado −y de la ranura) y el punto del imán en la cola."""
    best = []
    for s, ys, axis_name, xs, zs in itertools.product((4.0, 4.6, 5.2), y_sensor_options, axes,
                                                        np.arange(25.0, 31.6, 0.5), np.arange(1.0, z_max + 0.01, 0.5)):
        if math.hypot(xs, ys) < C.RING_ID / 2 + 0.8 or math.hypot(xs, ys) > C.RING_OD / 2 - 1.0:
            continue
        axis = 'xyz'.index(axis_name)
        th, B = leaflet_response(np.array([xs, ys, zs]), axis, s)
        sc = score(th, B)
        if not sc['monotonic'] or sc['max_abs_mT'] > 18.0:
            continue
        # robustez: ±0,5 mm de error de montaje en x, z
        robust = True
        for dx, dz in ((0.5, 0), (-0.5, 0), (0, 0.5), (0, -0.5)):
            th2, B2 = leaflet_response(np.array([xs + dx, ys, zs + dz]), axis, s)
            sc2 = score(th2, B2)
            if not sc2['monotonic'] or sc2['min_slope_mT_per_deg'] < 0.5 * sc['min_slope_mT_per_deg']:
                robust = False; break
        if not robust:
            continue
        best.append((sc['min_slope_mT_per_deg'], dict(s=s, y=ys, axis=axis_name, x=float(xs), z=float(zs), **sc)))
    best.sort(key=lambda b: -b[0])
    return [b[1] for b in best[:8]]

# ───────────────────────────── sensores candidatos (VERIFICAR con el componente real) ─────────────────────────────
# s_mV_mT: sensibilidad en el pin de salida a la alimentación indicada; vq: salida sin campo; v_lo/v_hi: rango lineal de salida;
# k_div: divisor resistivo hasta el ADC (salidas de 5 V NUNCA directo al ESP32). Fuentes en la documentación (05).
SENSORS = {
    'DRV5055A1 @3,3 V': dict(s=66.0, vq=1.65, v_lo=0.2, v_hi=3.1, k_div=1.0, b_max=21.0, nota='100 mV/mT a 5 V (TI); 66 a 3,3 V supone salida ratiométrica: VERIFICAR'),
    'DRV5055A2 @3,3 V': dict(s=33.0, vq=1.65, v_lo=0.2, v_hi=3.1, k_div=1.0, b_max=42.0, nota='50 mV/mT a 5 V (TI); ratiométrica: VERIFICAR'),
    'DRV5055A3 @3,3 V': dict(s=16.5, vq=1.65, v_lo=0.2, v_hi=3.1, k_div=1.0, b_max=85.0, nota='25 mV/mT a 5 V (TI): VERIFICAR'),
    'SS49E @3,3 V': dict(s=9.2, vq=1.65, v_lo=0.95, v_hi=2.35, k_div=1.0, b_max=100.0, nota='1,4 mV/G a 5 V (distribuidores); escalado a 3,3 V NO confirmado'),
    'SS49E/49E @5 V + divisor 0,6': dict(s=14.0 * 0.6, vq=2.5 * 0.6, v_lo=0.95 * 0.6, v_hi=4.05 * 0.6, k_div=0.6, b_max=100.0, nota='salida de 5 V reducida con divisor 20k/30k antes del ADC'),
}
NOISE_MV = 1.0          # ruido efectivo supuesto en el ADC tras promediar 8 muestras (se MIDE en el ensayo 6)
RES_LIMIT_DEG = 1.0     # criterio propuesto: incertidumbre angular (2σ/pendiente) ≤ 1° en 0–80°


def sensor_eval(thetas, B, name):
    """Salida, saturación y resolución angular estimada de un sensor candidato para la curva B(θ) (mT, signo físico)."""
    p = SENSORS[name]
    # el imán se orienta para que la salida BAJE con el campo (más margen hasta el rango lineal inferior)
    v = p['vq'] - np.abs(B) * p['s'] / 1000.0
    sat = bool(np.any(v < p['v_lo']) or np.any(np.abs(B) > p['b_max']))
    sel = (thetas >= 0) & (thetas <= 80)
    dv = np.abs(np.gradient(v, thetas))[sel] * 1000.0          # mV/°
    res = 2 * NOISE_MV / np.maximum(dv, 1e-9)
    mono = bool(np.all(np.diff(v[sel]) < 0) or np.all(np.diff(v[sel]) > 0))
    worst = float(np.max(res))
    return {'sensor': name, 'v_cerrada_V': round(float(v[np.argmin(abs(thetas))]), 3), 'v_80_V': round(float(v[np.argmin(abs(thetas - 80))]), 3),
            'satura': sat, 'monotona': mono, 'pendiente_min_mV_por_grado': round(float(dv.min()), 2),
            'incertidumbre_max_deg': round(worst, 2), 'theta_peor': float(thetas[sel][int(np.argmax(res))]),
            'cumple_criterio': (not sat) and mono and worst <= RES_LIMIT_DEG, 'nota': p['nota']}


def neighbor_crosstalk(h=None):
    """Campo (mT) que los imanes de las OTRAS dos valvas producen en el Hall de la valva 1 (eje sensible x local)
    cuando se mueven entre 0° y 84° de forma independiente (modos asimétricos). Marco del anillo."""
    h = h or HALL_LEAF
    sensor_local = np.array([h['x'], h['y'], h['z']])
    P0, M = magnet_points(*h['mag'])
    yc = C.TAIL_Y[0] + h['mag'][1] / 2
    vals = []
    for j in (1, 2):
        ang = 120.0 * j * D2R
        Rz = np.array([[math.cos(ang), -math.sin(ang), 0], [math.sin(ang), math.cos(ang), 0], [0, 0, 1]])
        out = []
        for th in np.linspace(0, 84, 43):
            c = tail_magnet_center(th, h['s'], yc)
            pts = (P0 + c) @ Rz.T
            mv = np.zeros_like(pts); mv[:, 1] = -M
            mv = mv @ Rz.T
            out.append(field(sensor_local, pts, mv)[0])
        vals.append(np.array(out))
    span = sum(float(v.max() - v.min()) for v in vals)
    return {'variacion_por_vecinas_mT': round(span, 4), 'por_vecina_mT': [round(float(v.max() - v.min()), 4) for v in vals]}


def servo_stray(dist_mm, moments=(0.005, 0.05)):
    """Campo del imán del motor del servo como dipolo (momento SUPUESTO, A·m²) a la distancia dada: orden de magnitud."""
    r = dist_mm * 1e-3
    return [round(MU0_4PI * 2 * m / r ** 3 * 1e3, 4) for m in moments]


def magnet_mass_g(d, h, rho=7.5):
    return math.pi * (d / 20) ** 2 * (h / 10) * rho


# ───────────────────────────── diseño elegido (v3) ─────────────────────────────
HALL_LEAF = dict(x=C.HALL_XYZ[0], y=C.HALL_XYZ[1], z=C.HALL_XYZ[2], axis='x', s=C.MAG_LEAF_S, mag=C.MAG_LEAF)


def final_design():
    h = HALL_LEAF
    thf = np.linspace(-4, 86, 361)
    out = {'iman': {'medidas_mm': list(h['mag']), 'masa_g': round(magnet_mass_g(*h['mag']), 3), 's_mm': h['s']}, 'variantes': {}}
    for off in C.HALL_OFFSETS:
        sensor = np.array([h['x'] + off, h['y'], h['z']])
        _, B = leaflet_response(sensor, 0, h['s'], h['mag'], thetas=thf)
        out['variantes'][f'{off:.2f}'] = {'B_cerrada_mT': round(float(abs(B[np.argmin(abs(thf))])), 2), 'B_80_mT': round(float(abs(B[np.argmin(abs(thf - 80))])), 2),
                                          'sensores': [sensor_eval(thf, B, n) for n in SENSORS]}
        if off == 0.0:
            tab = []
            for t in (-2, 0, 5, 10, 20, 30, 40, 50, 60, 70, 80, 84):
                k = int(np.argmin(abs(thf - t)))
                tab.append({'theta_deg': t, 'B_mT': round(float(abs(B[k])), 3)})
            out['tabla_B'] = tab
            sc = score(thf, B)
            out['resumen'] = {k: (round(v, 4) if isinstance(v, float) else v) for k, v in sc.items()}
    tol = {}
    for name, d in (('x+0.5', (0.5, 0, 0)), ('x-0.5', (-0.5, 0, 0)), ('y-0.5', (0, -0.5, 0)), ('z+0.5', (0, 0, 0.5)), ('z-0.5', (0, 0, -0.5))):
        t2, B2 = leaflet_response(np.array([h['x'], h['y'], h['z']]) + np.array(d), 0, h['s'], h['mag'], thetas=thf)
        s2 = score(t2, B2)
        tol[name] = {'monotonic': s2['monotonic'], 'min_slope_mT_per_deg': round(s2['min_slope_mT_per_deg'], 4), 'max_abs_mT': round(s2['max_abs_mT'], 2)}
    out['tolerancia_montaje'] = tol
    out['diafonia_vecinas'] = neighbor_crosstalk()
    out['servo_campo_mT_a_57mm_momento_0.005_0.05'] = servo_stray(57.0)
    return out


if __name__ == '__main__':
    import sys
    if '--search' in sys.argv:
        res = search_leaflet(y_sensor_options=(-8.0,), z_max=14.45, axes=('x',))
        for r in res[:5]:
            print(r)
    d = final_design()
    os.makedirs(os.path.join(os.path.dirname(__file__), '..', C.OUT_DIR, '_canon'), exist_ok=True)
    json.dump(d, open(os.path.join(os.path.dirname(__file__), '..', C.OUT_DIR, '_canon', 'sensing_design.json'), 'w'), indent=1, ensure_ascii=False)
    for off, v in d['variantes'].items():
        print('desplazamiento', off, 'B', v['B_cerrada_mT'], '→', v['B_80_mT'])
        for e in v['sensores']:
            print('   ', e['sensor'], 'satura' if e['satura'] else '', 'mono' if e['monotona'] else 'NO MONÓTONA', e['pendiente_min_mV_por_grado'], 'mV/°  peor', e['incertidumbre_max_deg'], '° a', e['theta_peor'], '°', 'OK' if e['cumple_criterio'] else 'NO CUMPLE')
    print(json.dumps({k: d[k] for k in ('iman', 'diafonia_vecinas', 'servo_campo_mT_a_57mm_momento_0.005_0.05')}, ensure_ascii=False))
