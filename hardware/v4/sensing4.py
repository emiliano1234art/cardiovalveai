"""
CardioValveAI v4 — señal esperada del par imán–Hall (CÁLCULO, no medición).

Geometría: el imán (disco axial) va de pie en el extremo del barril, con su magnetización PERPENDICULAR al eje de la bisagra,
y gira con la valva. El Hall está en la prolongación del eje de bisagra, a HALL_GAP del barril, con su eje sensible radial (u).
Sobre ese eje, el campo del imán es ≈ antiparalelo a la magnetización; su componente u varía como sen(θ − 40°):
monótona en todo el recorrido del servo y con pendiente casi pareja.

Modelo: el imán se discretiza en subdipolos. Sirve para elegir la distancia y comparar sensores, no para predecir mV exactos:
la curva real se obtiene calibrando cada valva.
"""
from __future__ import annotations
import math
import numpy as np

import config4 as C
import parts4 as P

MU0_4PI = 1e-7
D2R = math.pi / 180

SENSORS = {   # mismos supuestos que en la v3 (hojas de datos de TI/distribuidores no descargables desde este entorno: VERIFICAR)
    'DRV5055A1 @3,3 V': dict(s=66.0, vq=1.65, v_lo=0.2, v_hi=3.1, nota='100 mV/mT a 5 V (TI); 66 a 3,3 V supone salida ratiométrica'),
    'DRV5055A2 @3,3 V': dict(s=33.0, vq=1.65, v_lo=0.2, v_hi=3.1, nota='50 mV/mT a 5 V (TI), ratiométrica'),
    'SS49E @3,3 V': dict(s=9.2, vq=1.65, v_lo=0.95, v_hi=2.35, nota='1,4 mV/G a 5 V (distribuidores); a 3,3 V NO confirmado'),
    '49E/SS49E @5 V + divisor 0,6': dict(s=14.0 * 0.6, vq=1.5, v_lo=0.57, v_hi=2.43, nota='salida de 5 V reducida con divisor 20k/30k'),
}
NOISE_MV = 1.0          # ruido supuesto tras promediar (se mide en la calibración)


def magnet_points(diam, height, br=1.30, n_r=4, n_a=10, n_h=3):
    """Subdipolos de un cilindro axial (eje local +z). Posiciones (mm) y momentos (A·m²)."""
    vol = math.pi * (diam / 2) ** 2 * height * 1e-9
    m_total = br * vol / (4 * math.pi * 1e-7)
    pts = []
    for ih in range(n_h):
        z = (ih + 0.5) / n_h * height - height / 2
        pts.append((0.0, 0.0, z, 1.0))
        for ir in range(1, n_r):
            r = ir / (n_r - 0.5) * diam / 2
            for ia in range(n_a):
                a = 2 * math.pi * ia / n_a
                pts.append((r * math.cos(a), r * math.sin(a), z, r))
    Pm = np.array(pts)
    w = Pm[:, 3] / Pm[:, 3].sum()
    return Pm[:, :3], w * m_total


def field(sensor, centers, moments_vec):
    r = (sensor[None, :] - centers) * 1e-3
    dd = np.linalg.norm(r, axis=1)
    rh = r / dd[:, None]
    mdotr = np.sum(moments_vec * rh, axis=1)
    B = MU0_4PI * (3 * mdotr[:, None] * rh - moments_vec) / (dd ** 3)[:, None]
    return B.sum(axis=0) * 1e3


def Ry(a):
    c, s = math.cos(a), math.sin(a)
    return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])


def response(thetas, offset=(0.0, 0.0, 0.0)):
    """B (mT, componentes u, v, z) en el elemento Hall (desplazado `offset` mm) para cada θ."""
    P0, M = magnet_points(*C.MAGNET)
    axis = np.array([C.D_HINGE, 0.0, C.Z_HINGE])
    m_c0 = P.magnet_center()
    sensor = P.hall_element() + np.array(offset)
    out = []
    for th in thetas:
        R = Ry(th * D2R) @ Ry(-C.TAIL_PSI0 * D2R)          # orientación del imán: θ de la valva + montaje a −40°
        pts = (P0 @ R.T) + (Ry(th * D2R) @ (m_c0 - axis)) + axis
        mv = np.outer(M, R @ np.array([0.0, 0.0, 1.0]))
        out.append(field(sensor, pts, mv))
    return np.array(out)


def evaluate():
    th = np.linspace(C.THETA_MIN, C.THETA_MAX, 211)
    B = response(th)
    bu = B[:, 0]
    sel = (th >= 0) & (th <= 80)
    dist = float(np.linalg.norm(P.hall_element() - P.magnet_center()))
    res = {'distancia_iman_elemento_mm': round(dist, 2), 'B_u_mT': {f'{t:.0f}': round(float(bu[np.argmin(abs(th - t))]), 2) for t in (-12, 0, 20, 40, 60, 80, 92)},
           'monotona_0_80': bool(np.all(np.diff(bu[sel]) > 0) or np.all(np.diff(bu[sel]) < 0)),
           'monotona_todo_el_servo': bool(np.all(np.diff(bu) > 0) or np.all(np.diff(bu) < 0)),
           'B_max_0_80_mT': round(float(np.abs(bu[sel]).max()), 2), 'B_max_todo_mT': round(float(np.abs(bu).max()), 2),
           'pendiente_min_0_80_mT_por_grado': round(float(np.abs(np.gradient(bu, th))[sel].min()), 3)}
    sens = []
    for name, p in SENSORS.items():
        v = p['vq'] + bu * p['s'] / 1000.0
        sat_work = bool(np.any(v[sel] < p['v_lo']) or np.any(v[sel] > p['v_hi']))
        sat_all = bool(np.any(v < p['v_lo']) or np.any(v > p['v_hi']))
        slope = np.abs(np.gradient(v, th))[sel] * 1000.0
        sens.append({'sensor': name, 'v_0': round(float(v[np.argmin(abs(th))]), 3), 'v_80': round(float(v[np.argmin(abs(th - 80))]), 3),
                     'satura_0_80': sat_work, 'satura_fuera_de_rango': sat_all and not sat_work,
                     'pendiente_min_mV_por_grado': round(float(slope.min()), 2), 'incertidumbre_max_deg': round(float(2 * NOISE_MV / slope.min()), 2),
                     'nota': p['nota']})
    res['sensores'] = sens
    tol = {}
    for name, off in (('juego radial del barril u ±0,15', (0.15, 0, 0)), ('juego vertical del barril z ±0,15', (0, 0, 0.15)),
                      ('portasensor 0,2 mm sin tocar el barril', (0, 0.2, 0)), ('portasensor 0,5 mm sin tocar el barril', (0, 0.5, 0))):
        b = response(th, off)[:, 0]
        tol[name] = {'monotona_0_80': bool(np.all(np.diff(b[sel]) > 0) or np.all(np.diff(b[sel]) < 0)),
                     'B_0_mT': round(float(b[np.argmin(abs(th))]), 2), 'B_80_mT': round(float(b[np.argmin(abs(th - 80))]), 2),
                     'pendiente_min_mT_por_grado': round(float(np.abs(np.gradient(b, th))[sel].min()), 3),
                     'error_max_con_calibracion_nominal_deg': round(float(np.max(np.abs(np.interp(b[sel], bu[sel][::-1], th[sel][::-1]) - th[sel]))), 2)}
    res['tolerancia'] = tol
    # imanes de las otras valvas (a 120°): variación máxima que inducen en este Hall
    others = []
    for j in (1, 2):
        a = 120.0 * j * D2R
        Rz = np.array([[math.cos(a), -math.sin(a), 0], [math.sin(a), math.cos(a), 0], [0, 0, 1]])
        P0, M = magnet_points(*C.MAGNET)
        axis = np.array([C.D_HINGE, 0.0, C.Z_HINGE])
        vals = []
        for t in np.linspace(C.THETA_MIN, C.THETA_MAX, 41):
            R = Ry(t * D2R) @ Ry(-C.TAIL_PSI0 * D2R)
            pts = ((P0 @ R.T) + (Ry(t * D2R) @ (P.magnet_center() - axis)) + axis) @ Rz.T
            mv = np.outer(M, Rz @ R @ np.array([0.0, 0.0, 1.0]))
            vals.append(field(P.hall_element(), pts, mv)[0])
        others.append(float(np.ptp(vals)))
    res['diafonia_otras_valvas_mT'] = round(sum(others), 4)
    return res


if __name__ == '__main__':
    import json
    print(json.dumps(evaluate(), indent=1, ensure_ascii=False))
