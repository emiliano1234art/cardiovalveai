"""
Ensamblaje de CardioValveAI: posición de cada pieza (matriz 4×4) para una pose del servo y un modo.

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
TRAY_XY = C.TRAY_XY
SCALE_XY = (VX - 50.0, VY + C.HINGE_D)
CLIP_Z = 12.0                                             # altura (sobre la base) de las pinzas de cables en las columnas

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
    """Pernos M6 impresos del soporte del servo (global)."""
    return [(VX + x, VY + y) for x, y in P.servo_bolt_xy(P.servo_layout(ZS))]

def column_angle(i):
    return K.leaf_dir(i) + 60

def stand_frame():
    a = C.MEMS_STAND_ANG
    return T(VX + C.MEMS_STAND_R * math.cos(a * D2R), VY + C.MEMS_STAND_R * math.sin(a * D2R), C.BASE_T) @ Rz(a + 180)

def stand_holder_frame():
    zpiv, tilt = P.stand_heights()
    return stand_frame() @ T(P.STAND_PIVOT_X, 0, zpiv) @ Ry(tilt) @ T(0, 0, P.STAND_PIVOT_DZ)

def stand_insert_xy():
    M = stand_frame()
    return [tuple((M @ np.array([x, y, 0, 1.0]))[:2]) for x, y in P.STAND_INSERTS]

def tray_frame():
    return T(TRAY_XY[0], TRAY_XY[1], C.BASE_T)

def ring_local(i, x, y, z):
    """Punto del marco de la valva i (anillo) → global."""
    return tuple((RING @ Rz(K.leaf_dir(i)) @ np.array([x, y, z, 1.0]))[:3])

def _arc(r, a0, a1, z, step=10.0):
    n = max(2, int(abs(a1 - a0) / step) + 1)
    return [(VX + r * math.cos(a * D2R), VY + r * math.sin(a * D2R), z) for a in np.linspace(a0, a1, n)]

ZB = C.BASE_T + 1.6          # centro de un haz de cables apoyado en la base
R_CLIP = C.COLUMN_R + C.COLUMN_D / 2 + 5.8     # centro del cable en el apoyo de la pinza (radio desde el eje de la válvula)
CABLE_R = {'H1': 1.0, 'H2': 1.0, 'H3': 1.0, 'M1': 1.5, 'SERVO': 1.0}   # radio de cada haz (mm)
SIG_ENTRY = (TRAY_XY[0] + 14.0, TRAY_XY[1] + 9.0)        # entrada de señales: extremo −y de la bandeja
PWR_ENTRY = (TRAY_XY[0] + 24.0, TRAY_XY[1] + 95.0)       # entrada de potencia (servo 5 V): extremo +y

def cable_routes():
    """Recorridos de los haces de cables (referencia de diseño, Ø3). Señales por el sur, potencia por el norte."""
    hx, hy, _ = C.HALL_XYZ
    rx = C.RING_OD / 2
    routes = {}
    zclip = C.BASE_T + CLIP_Z + 3.0
    for i in range(3):
        a_exit = K.leaf_dir(i) + math.degrees(math.atan2(hy, rx - 0.9))
        a_col = column_angle((i - 1) % 3)
        zf = C.RING_H + C.CARRIER_FLANGE_T - 0.2            # sobre el canal de la pestaña del portasensor
        pts = [ring_local(i, hx, hy, zf), ring_local(i, rx - 0.9, hy, zf), ring_local(i, rx - 0.9, hy, -2.5)]
        pts += _arc(41.0, a_exit, a_col + 12, Z_RING - 14.0)
        pts += [(VX + R_CLIP * math.cos(a_col * D2R), VY + R_CLIP * math.sin(a_col * D2R), zclip),
                (VX + 40.0 * math.cos(a_col * D2R), VY + 40.0 * math.sin(a_col * D2R), ZB)]
        routes[f'H{i+1}'] = pts
    q = lambda M, x, y, z: tuple((M @ np.array([x, y, z, 1.0]))[:3])
    # M1 (soporte independiente): baja por detrás del poste
    Ms = stand_frame()
    px = P.STAND_PIVOT_X - 6.0 - P.STAND_POST
    zpiv, _ = P.stand_heights()
    fh = C.MEMS_BOARD[1] + 4.4
    Mh = stand_holder_frame()
    ztop = zpiv + P.STAND_PIVOT_DZ + fh / 2 + 3.0
    zf = 4.0 + 1.5 + 0.3                              # sobre el pie del soporte, sin apoyarse
    routes['M1'] = [q(Mh, 0, 0, fh / 2 + 1.5), q(Ms, -4.0, 0, ztop), q(Ms, px - 1.6, 4.5, ztop), q(Ms, px - 1.6, 4.5, zf),
                    q(Ms, -38.0, 4.5, zf), q(Ms, -42.0, 4.5, ZB - C.BASE_T)]
    # troncales sobre la base
    # troncal sur: bordea el pie del soporte del micrófono por el borde de la base
    south = [(58.0, 14.0, ZB), (100.0, 5.0, ZB), (130.0, 5.0, ZB), (147.0, 12.0, ZB), (SIG_ENTRY[0], SIG_ENTRY[1] - 8.0, ZB),
             (SIG_ENTRY[0], SIG_ENTRY[1], C.BASE_T + TRAY_TOP + 1.6)]
    routes['H1'] += [(115.0, 76.0, ZB)] + south[-2:]
    routes['H2'] += [(34.0, 98.0, ZB), (34.0, 70.0, ZB), (46.0, 40.0, ZB)] + south
    routes['H3'] += [(80.0, 30.0, ZB)] + south[1:]
    routes['M1'] += [(128.0, 8.0, ZB)] + south[3:]
    # servo: sale por el extremo +x del cuerpo, va por el norte a la entrada de potencia
    L = P.servo_layout(ZS)
    sx = VX + L['body_cx'] + C.SERVO.L / 2
    sy = VY + L['y_of_h'](3.0)
    # pasa por encima de la cartela del soporte y baja después del extremo del pie
    xe = VX + L['body_cx'] + C.SERVO.tab_span / 2 + 4
    routes['SERVO'] = [(sx + 1.0, sy, ZS - 0.5), (xe + 2.0, sy, ZS - 0.5), (xe + 5.0, sy, ZB), (112.0, 150.0, ZB), (PWR_ENTRY[0], PWR_ENTRY[1] + 4.0, ZB),
                       (PWR_ENTRY[0], PWR_ENTRY[1], C.BASE_T + TRAY_TOP + 1.6)]
    return routes

TRAY_TOP = 2.0 + C.PERF_UNDER + C.PERFBOARD[2]

def zip_points():
    """Pares de ranuras para bridas (x, y, ángulo de la ranura) a lo largo de las troncales."""
    return [(36.0, 140.0, 0), (34.0, 84.0, 0), (80.0, 9.5, 90 - 12), (115.0, 6.0, 90), (149.0, 40.0, 0),
            (112.0, 140.0, 90 + 30), (PWR_ENTRY[0] - 10, PWR_ENTRY[1] + 4.0, 90)]

def base_labels():
    return [('SEÑALES', 3.5, 160.0, 30.0, 90), ('SERVO 5 V', 3.5, 100.0, 170.0, 0)]

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
        out[f'Magnet_{i+1}'] = out[f'Leaflet_{i+1}']
        out[f'Tail_Pin_{i+1}'] = radial(16, 46) @ RING @ Rz(ψ) @ hinge(th)
        out[f'Cable_Clip_{i+1}'] = T(0, 0, -14 * ex) @ T(*column_xy(i), C.BASE_T + CLIP_Z) @ Rz(column_angle(i))
        out[f'Hall_Carrier_{i+1}'] = radial(12, 40) @ RING @ Rz(ψ)
        out[f'Hall_{i+1}'] = radial(12, 40) @ RING @ Rz(ψ)
    out['Ring_Fasteners_Reference'] = T(0, 0, 18 * ex) @ RING
    out['Actuator_Plate'] = T(0, 0, -30 * ex) @ RING @ T(0, 0, zp - C.PLATE_TAB_PIN_Z)
    out['Plate_Fasteners_Reference'] = out['Actuator_Plate']
    qx, qz = p['crank']
    kz = zp - C.PLATE_TAB_PIN_Z + C.CLEVIS_PIN_Z
    a = math.degrees(math.atan2(0 - qx, kz - qz))
    out['Pushrod'] = T(0, 0, -44 * ex) @ RING @ T(qx, 0, qz) @ Ry(a)
    out['Servo_Horn_Reference'] = T(0, -10 * ex, -50 * ex) @ RING @ T(K.CRANK_XC, 1.8, K.SHAFT_Z) @ Ry(-beta)
    out['Servo_MG90S_Reference'] = T(0, 30 * ex, -50 * ex) @ T(VX, VY, 0)
    out['Servo_Mount'] = T(0, 30 * ex, -50 * ex) @ T(VX, VY, 0)
    out['MEMS_Stand'] = T(0, 0, 0) @ stand_frame()
    out['MEMS_Stand_Holder'] = T(0, 0, 10 * ex) @ stand_holder_frame()
    out['MEMS_Board_Reference'] = out['MEMS_Stand_Holder']
    out['Electronics_Tray'] = tray_frame()
    _, _, zb, _ = P.tray_dims()
    for k, (bx, by, ang) in enumerate(P.turn_button_poses()):
        out[f'Turn_Button_{k+1}'] = T(0, 0, 14 * ex) @ tray_frame() @ T(bx, by, zb + C.PERFBOARD[2]) @ Rz(ang)
    out['Base_Fasteners_Reference'] = T(0, 0, 14 * ex)
    out['Stand_Fasteners_Reference'] = stand_frame()
    out['Perfboard_ESP32_Reference'] = T(0, 0, 8 * ex) @ tray_frame()
    out['Cable_Routes_Reference'] = np.eye(4)
    out['Angle_Scale'] = T(-20 * ex, 0, 0) @ T(SCALE_XY[0], SCALE_XY[1], C.BASE_T)
    out['Base'] = T(0, 0, -20 * ex)
    return out

if __name__ == '__main__':
    print(f'Eje del servo z={ZS:.2f} · anillo z={Z_RING:.2f} · columnas {COLUMN_H:.2f} mm')
    for k, v in pose_transforms(0.0).items():
        print(f'{k:24s} {v[:3,3].round(2)}')
