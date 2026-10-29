"""Transformaciones de ensamblaje de CardioValveAI v4 para una posición del servo β (β = 90° − comando del servo)."""
from __future__ import annotations
import numpy as np

import config4 as C
import kin4 as K
import parts4 as P
from geom4 import T, Ry, Rz

d, zh = C.D_HINGE, C.Z_HINGE


def leaf_tf(i: int, theta: float) -> np.ndarray:
    return Rz(C.LEAF_DIR[i]) @ T(d, 0, zh) @ Ry(theta) @ T(-d, 0, -zh)


def crank_tf(beta: float) -> np.ndarray:
    return T(0, P.Y_CRANK, C.Z_SERVO) @ Ry(-beta)


def pose(beta: float, theta_override=None) -> dict:
    """Posición armada para el comando β (θ de las valvas según la cinemática, salvo theta_override)."""
    th = K.theta(beta) if theta_override is None else theta_override
    zp = K.piston_z(beta)
    out = {'Cuerpo': np.eye(4), 'Servo': np.eye(4), 'Tornillos_servo': np.eye(4)}
    for i, a in enumerate(C.LEAF_DIR):
        out[f'Valva_{i+1}'] = leaf_tf(i, th)
        out[f'Iman_{i+1}'] = leaf_tf(i, th)
        out[f'Pasador_bisagra_{i+1}'] = Rz(a)
        out[f'Portasensor_{i+1}'] = Rz(a)
        out[f'Hall_{i+1}'] = Rz(a)
    for k in ('Piston', 'Yugo', 'Pasadores_horquilla', 'Pasador_traba'):
        out[k] = T(0, 0, zp)
    for k in ('Manivela', 'Pasador_manivela', 'Horn'):
        out[k] = crank_tf(beta)
    return out


def exploded(beta: float = 0.0, e: float = 1.0) -> dict:
    """Despiece: cada pieza se separa a lo largo de su dirección real de montaje."""
    th = K.theta(beta)
    zp = K.piston_z(beta)
    out = {'Cuerpo': np.eye(4)}
    for i, a in enumerate(C.LEAF_DIR):
        out[f'Valva_{i+1}'] = T(0, 0, 100 * e) @ leaf_tf(i, th)
        out[f'Iman_{i+1}'] = T(0, 0, 100 * e) @ leaf_tf(i, th) @ T(0, 14 * e, 0)
        out[f'Pasador_bisagra_{i+1}'] = Rz(a) @ T(0, -45 * e, 0)
        out[f'Portasensor_{i+1}'] = Rz(a) @ T(0, 35 * e, 0)
        out[f'Hall_{i+1}'] = Rz(a) @ T(0, 55 * e, 0)
    out['Piston'] = T(0, 0, zp + 55 * e)
    out['Pasadores_horquilla'] = T(0, 0, zp + 70 * e)
    out['Pasador_traba'] = T(0, 0, zp + 82 * e)
    out['Yugo'] = T(0, 0, zp + 30 * e)
    out['Manivela'] = T(0, -40 * e, 0) @ crank_tf(beta)
    out['Pasador_manivela'] = T(0, -28 * e, 0) @ crank_tf(beta)
    out['Horn'] = T(0, -55 * e, 0) @ crank_tf(beta)
    out['Servo'] = T(0, -90 * e, 0)
    out['Tornillos_servo'] = T(0, -112 * e, 0)
    return out
