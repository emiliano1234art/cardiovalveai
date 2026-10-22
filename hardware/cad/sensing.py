"""
CardioVal AI v2 — diseño de la MEDICIÓN DE POSICIÓN (cálculo, no medición).

Valvas (H1–H3): imán cilíndrico en la cola de cada valva + sensor Hall lineal fijo en el anillo.
Plato (H0): imán en el plato + sensor Hall fijo sobre él (mide la carrera real del accionamiento).

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

# ───────────────────────────── H0: imán en el plato ─────────────────────────────

def plate_response(gap_closed, mag=(6.0, 3.0)):
    """Imán axial (eje z) en el plato; sensor fijo encima, en el eje. Campo B_z vs desplazamiento del plato."""
    P0, M = magnet_points(*mag)
    # reorientar el cilindro: eje local y → z
    P0 = P0[:, [0, 2, 1]]
    travel = np.linspace(0, K.STROKE, 60)
    Bz = []
    for d in travel:
        c = np.array([0.0, 0.0, -(gap_closed + d) - mag[1] / 2])
        pts = P0 + c
        mv = np.zeros_like(pts); mv[:, 2] = M
        Bz.append(field(np.zeros(3), pts, mv)[2])
    return travel, np.array(Bz)

# ───────────────────────────── diseño elegido (v2) ─────────────────────────────
# Marco local de la valva (ver kinematics.py). Elemento Hall del TO-92 en el centro del cuerpo (aprox.).
HALL_LEAF = dict(x=26.8, y=-8.0, z=13.5, axis='x', s=4.0, mag=(4.0, 2.0))
HALL_PLATE = dict(r=20.0, gap_closed=4.0, mag=(3.0, 2.0))
DRV5055 = {'A1': 60.0, 'A2': 30.0}   # mV/mT a VCC = 3,3 V (hoja de datos TI DRV5055, tabla de sensibilidad)

def final_design():
    h = HALL_LEAF
    sensor = np.array([h['x'], h['y'], h['z']])
    th = np.array([-2, 0, 5, 10, 20, 30, 40, 50, 60, 70, 80, 84], float)
    _, B = leaflet_response(sensor, 'xyz'.index(h['axis']), h['s'], h['mag'], thetas=th)
    thf, Bf = leaflet_response(sensor, 'xyz'.index(h['axis']), h['s'], h['mag'])
    sc = score(thf, Bf)
    slope = np.gradient(Bf, thf)
    rows = []
    for t, b in zip(th, B):
        k = int(np.argmin(abs(thf - t)))
        rows.append({'theta_deg': float(t), 'B_mT': round(float(b), 3), 'V_out_A1_V': round(1.65 - abs(float(b)) * DRV5055['A1'] / 1000, 3),
                     'slope_mV_per_deg': round(abs(float(slope[k])) * DRV5055['A1'], 2)})
    # tolerancia de montaje ±0,5 mm
    tol = {}
    for name, d in (('x+0.5', (0.5, 0, 0)), ('x-0.5', (-0.5, 0, 0)), ('y-0.5', (0, -0.5, 0)), ('z+0.5', (0, 0, 0.5)), ('z-0.5', (0, 0, -0.5))):
        t2, B2 = leaflet_response(sensor + np.array(d), 'xyz'.index(h['axis']), h['s'], h['mag'])
        s2 = score(t2, B2)
        tol[name] = {'monotonic': s2['monotonic'], 'min_slope_mV_per_deg': round(s2['min_slope_mV_per_deg'], 2), 'max_abs_mT': round(s2['max_abs_mT'], 2)}
    tr, Bz = plate_response(HALL_PLATE['gap_closed'], HALL_PLATE['mag'])
    plate = {'travel_mm': [round(float(x), 2) for x in tr[::6]], 'Bz_mT': [round(float(x), 2) for x in Bz[::6]],
             'monotonic': bool(np.all(np.diff(Bz) < 0)), 'min_slope_mV_per_mm_A2': round(float(np.min(np.abs(np.diff(Bz) / np.diff(tr)))) * DRV5055['A2'], 1)}
    # diafonía: imán del plato visto por el Hall de la valva (peor caso: plato arriba)
    P0, M = magnet_points(*HALL_PLATE['mag']); P0 = P0[:, [0, 2, 1]]
    xt = []
    for zp in (K.Z_TOP, K.Z_BOT):
        top = zp - C.PLATE_TAB_PIN_Z + C.PLATE_T
        for ang in (60.0, -60.0):   # imán en un lóbulo de comisura (a ±60° de la valva)
            c = np.array([HALL_PLATE['r'] * math.cos(ang * D2R), HALL_PLATE['r'] * math.sin(ang * D2R), top - HALL_PLATE['mag'][1] / 2])
            mv = np.zeros_like(P0); mv[:, 2] = M
            xt.append(abs(field(sensor, P0 + c, mv)[0]) * DRV5055['A1'])
    return {'leaflet_sensor': h, 'summary': {k: (round(v, 3) if isinstance(v, float) else v) for k, v in sc.items()}, 'table': rows,
            'mount_tolerance': tol, 'plate': plate, 'plate_to_leaf_crosstalk_mV_max': round(max(xt), 2)}

if __name__ == '__main__':
    import sys
    if '--search' in sys.argv:
        # TO-92 (DRV5055A1QLPG): cuerpo ≈ 4,0 × 3,05 × 1,55 mm; elemento Hall cerca del centro.
        # Centro en y = −8,0 (pared de 0,65 mm hacia la ranura en y = −5,3); z ≤ 14,45 deja el
        # cuerpo bajo la cara superior del anillo (z = 16) con las patas saliendo hacia arriba.
        res = search_leaflet(y_sensor_options=(-8.0,), z_max=14.45, axes=('x',))
        for r in res[:5]:
            print(r)
        json.dump({'leaflet_candidates': res}, open(os.path.join(os.path.dirname(__file__), '..', 'out_v2', '_canon', 'sensing_search.json'), 'w'), indent=1)
    d = final_design()
    print(json.dumps(d['summary']), '\n', json.dumps(d['mount_tolerance']), '\n', json.dumps(d['plate']), '\n xtalk', d['plate_to_leaf_crosstalk_mV_max'])
    for r in d['table']:
        print(r)
    os.makedirs(os.path.join(os.path.dirname(__file__), '..', 'out_v2', '_canon'), exist_ok=True)
    json.dump(d, open(os.path.join(os.path.dirname(__file__), '..', 'out_v2', '_canon', 'sensing_design.json'), 'w'), indent=1)
