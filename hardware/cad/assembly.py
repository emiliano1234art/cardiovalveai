"""
Ensamblaje de CardioVal AI: posición de cada pieza (matriz 4×4) para una pose del servo y un modo.

Marco GLOBAL: origen en la esquina inferior de la base, z hacia arriba.
Marco del ANILLO: centro de la cara inferior del anillo → (VX, VY, Z_RING).
"""
from __future__ import annotations
import math
import numpy as np
import config as C
import kinematics as K
import parts as P

D2R = math.pi / 180
VX, VY = C.VALVE_XY
ZS = C.BASE_T + C.SERVO_BODY_CLEAR + C.SERVO.W / 2      # eje del servo (global)
Z_RING = ZS - K.SHAFT_Z                                   # cara inferior del anillo (global)
COLUMN_H = Z_RING - C.BASE_T
ESP_XY = (160.0, 128.0)
SCALE_XY = (VX - 50.0, VY + C.HINGE_D)

def T(x=0.0, y=0.0, z=0.0):
    m = np.eye(4); m[:3, 3] = (x, y, z); return m

def Rz(deg):
    c, s = math.cos(deg * D2R), math.sin(deg * D2R)
    m = np.eye(4); m[0, 0], m[0, 1], m[1, 0], m[1, 1] = c, -s, s, c; return m

def Ry(deg):
    c, s = math.cos(deg * D2R), math.sin(deg * D2R)
    m = np.eye(4); m[0, 0], m[0, 2], m[2, 0], m[2, 2] = c, s, -s, c; return m

RING = T(VX, VY, Z_RING)

def column_xy(i):
    a = (K.leaf_dir(i) + 60) * D2R
    return VX + C.COLUMN_R * math.cos(a), VY + C.COLUMN_R * math.sin(a)

def servo_mount_holes():
    L = P.servo_layout(ZS)
    xc = L['body_cx']; half = C.SERVO.tab_span / 2 + 4
    y_face = L['y_of_h'](C.SERVO.tab_h); y_back = y_face + 4.0
    pts = []
    for s in (-1, 1):
        pts += [(VX + xc + s * (half - 6), VY + y_back + 14), (VX + xc + s * (half - 6), VY + y_face - 4.5)]
    return pts

def hinge(theta):
    """Rotación de la valva alrededor de su eje (marco local)."""
    return T(C.HINGE_D, 0, C.Z_HINGE) @ Ry(theta) @ T(-C.HINGE_D, 0, -C.Z_HINGE)

def pose_transforms(beta: float, mode: str = 'NORMAL', explode: float = 0.0, manual_theta: list | None = None) -> dict:
    """Devuelve {nombre_instancia: matriz 4×4} para todas las piezas móviles y fijas."""
    p = K.pose(beta, mode)
    zp = p['zp']
    out = {}
    ex = explode
    out['Valve_Ring'] = T(0, 0, 18 * ex) @ RING
    for i in range(3):
        ψ = K.leaf_dir(i)
        th = p['leaves'][i]['theta'] if manual_theta is None else manual_theta[i]
        radial = lambda r, z=0.0: T(r * ex * math.cos(ψ * D2R), r * ex * math.sin(ψ * D2R), z * ex)
        out[f'Leaflet_{i+1}'] = radial(10, 46) @ RING @ Rz(ψ) @ hinge(th)
        out[f'Pin_{i+1}'] = radial(46, 18) @ RING @ Rz(ψ)
        # biela: desde el agujero de la cola hacia el pasador del plato
        tx, tz = K.tail_end(th)
        dx, dz = C.LINK_PIN_X - tx, zp - tz
        alpha = math.degrees(math.atan2(-dx, -dz))
        out[f'Link_{i+1}'] = radial(22, -8) @ RING @ Rz(ψ) @ T(tx, C.LINK_Y[0], tz) @ Ry(alpha)
        out[f'Stop_{i+1}'] = radial(30, -26) @ RING @ Rz(ψ)
        out[f'Column_{i+1}'] = T(0, 0, -14 * ex) @ T(*column_xy(i), C.BASE_T)
    out['Actuator_Plate'] = T(0, 0, -30 * ex) @ RING @ T(0, 0, zp - C.PLATE_TAB_PIN_Z)
    qx, qz = p['crank']
    kz = zp - C.PLATE_TAB_PIN_Z + C.CLEVIS_PIN_Z
    a = math.degrees(math.atan2(0 - qx, kz - qz))
    out['Pushrod'] = T(0, 0, -44 * ex) @ RING @ T(qx, 0, qz) @ Ry(a)
    out['Servo_Horn_Reference'] = T(0, -10 * ex, -50 * ex) @ RING @ T(K.CRANK_XC, 1.8, K.SHAFT_Z) @ Ry(-beta)
    out['Servo_MG90S_Reference'] = T(0, 30 * ex, -50 * ex) @ T(VX, VY, 0)
    out['Servo_Mount'] = T(0, 30 * ex, -50 * ex) @ T(VX, VY, 0)
    out['Piezo_Mount'] = T(0, 0, 18 * ex) @ RING @ Rz(K.leaf_dir(1) + C.PAD_ANGLE_OFFSET) @ T(14 * ex, 0, 0)
    out['Piezo_Disc_Reference'] = T(0, 0, 18 * ex) @ RING @ Rz(K.leaf_dir(1) + C.PAD_ANGLE_OFFSET) @ T(22 * ex, 0, 0)
    out['Piezo_Cover'] = T(0, 0, 18 * ex) @ RING @ Rz(K.leaf_dir(1) + C.PAD_ANGLE_OFFSET) @ T(32 * ex, 0, 0)
    out['MEMS_Mount'] = T(0, 0, 18 * ex) @ RING @ Rz(K.leaf_dir(0) + C.PAD_ANGLE_OFFSET) @ T(16 * ex, 0, 10 * ex)
    out['MEMS_Board_Reference'] = out['MEMS_Mount'] @ MEMS_BOARD_LOCAL @ T(0, 0, 14 * ex)
    out['ESP32_Mount'] = T(*ESP_XY, C.BASE_T)
    out['ESP32_Board_Reference'] = T(*ESP_XY, C.BASE_T + C.ESP32_PIN_DEPTH + 2.0 + 12 * ex)
    out['Angle_Scale'] = T(-20 * ex, 0, 0) @ T(SCALE_XY[0], SCALE_XY[1], C.BASE_T)
    out['Base'] = T(0, 0, -20 * ex)
    return out

def _mems_board_local():
    bw, bh, bt = C.MEMS_BOARD
    fh = bh + 4.4
    return T(30.5, 0, 30.5 - fh / 2 * math.cos(P.MEMS_TILT * D2R) - 1.5) @ Ry(-P.MEMS_TILT)
MEMS_BOARD_LOCAL = _mems_board_local()

if __name__ == '__main__':
    print(f'Eje del servo z={ZS:.2f} · anillo z={Z_RING:.2f} · columnas {COLUMN_H:.2f} mm')
    for k, v in pose_transforms(0.0).items():
        print(f'{k:24s} {v[:3,3].round(2)}')
