"""
Piezas de CardioValveAI v4 (build123d). Cada constructor devuelve el sólido en su MARCO DE ENSAMBLAJE:
  · cuerpo, servo (referencia): marco global.
  · valva, pasador de bisagra, portasensor, imán, Hall: marco de la valva (u = x, v = y, z global) con θ = 0.
  · pistón, yugo, pasadores de horquilla y de traba: marco del pistón (origen en el centro de la ranura del yugo).
  · manivela, pasador de manivela, horn: marco de la manivela (eje del servo = eje y, y = 0 en la cara trasera de la manivela).
La orientación de impresión de cada pieza está en registry4.py.
"""
from __future__ import annotations
import math
import numpy as np
from build123d import Align, Cylinder, Part, Pos, Rot
from shapely.geometry import Point, Polygon as SPoly
from shapely.ops import unary_union

import config4 as C
import kin4 as K
from geom4 import (D2R, box, cyl_x, cyl_y, cyl_z, engrave_text, prism_xy, prism_xz, rz, stadium)

S = C.SERVO
H = C.HORN
d, zh = C.D_HINGE, C.Z_HINGE

# ───────────────────────────── servo: posición fija (global) ─────────────────────────────
Y_DOME_TOP = C.Y_SHAFT_TOP - S.shaft_h
Y_BODY_TOP = Y_DOME_TOP - S.gear_top
Y_BODY_BOT = Y_BODY_TOP - S.H
Y_EAR0 = Y_BODY_BOT + S.tab_h
Y_EAR1 = Y_EAR0 + S.tab_t
X_BODY0 = -S.shaft_offset
X_BODY1 = S.L - S.shaft_offset
X_BODY_C = (X_BODY0 + X_BODY1) / 2
EAR_HOLES_X = (X_BODY_C - S.tab_hole_spacing / 2, X_BODY_C + S.tab_hole_spacing / 2)
Z_BODY0, Z_BODY1 = C.Z_SERVO - S.W / 2, C.Z_SERVO + S.W / 2
Y_HORN_TOP = C.Y_SHAFT_TOP + 1.0                 # cara superior del brazo del horn (el cubo queda 0,2 mm sobre el domo)
Y_CRANK = Y_HORN_TOP - H.t                       # cara trasera de la manivela (el brazo del horn queda dentro del encastre)
Y_WEB0 = Y_CRANK + C.CRANK_T + 0.5
Y_WEB1 = Y_WEB0 + C.WEB_T
BH_Y = (Y_EAR1, Y_EAR1 + 5.0)                    # tabique del servo: las orejas apoyan en su cara −y
BH_TOP = Z_BODY1 + 0.4
CUT_X = (X_BODY0 - 0.4, X_BODY1 + 0.4)           # hueco del tabique (deja pasar el cuerpo y la manivela colgando)
WIN_X = (X_BODY_C - S.tab_span / 2 - 0.5, X_BODY_C + S.tab_span / 2 + 0.5)
WIN_Z = BH_TOP + 0.5                             # ventana del servo (lado −y), abierta abajo, techo a dos aguas 45°
SHOE_Z0 = K.piston_z(-90) + C.WEB_DROP           # zapata más baja (pistón abajo del todo)
COMMISSURES = tuple((a + 60.0) % 360 for a in C.LEAF_DIR)


# ───────────────────────────── valva ─────────────────────────────

def leaflet_outline() -> SPoly:
    """Contorno de la valva (θ = 0, marco local): cuña de 120° con holgura de coaptación, limitada para que ningún punto
    toque la pared en todo el recorrido del servo (incluye el espesor) y angostada junto a la bisagra para el Hall."""
    th = np.radians(np.linspace(C.THETA_MIN - 1.0, C.THETA_MAX + 1.0, 241))
    rmax = C.RI - C.WALL_CLR
    pts_r, pts_l = [], []
    for u in np.linspace(1.6, d, 200):
        hw = u * math.tan(60 * D2R) - C.EDGE_GAP / 2 / math.cos(60 * D2R)
        umax = max(np.max(d + (u - d) * np.cos(th) + zz * np.sin(th)) for zz in (C.BARREL_R - C.LEAF_T, C.BARREL_R))
        hs = math.sqrt(max(0.0, rmax ** 2 - umax ** 2))
        h = min(hw, hs)
        if u > d - 4.5:
            h = min(h, C.BARREL_HALF)
        if h > 0.4:
            pts_r.append((u, h)); pts_l.append((u, -h))
    return SPoly(pts_r + pts_l[::-1]).buffer(0)


def tail_dir():
    a = C.TAIL_PSI0 * D2R
    return np.array([-math.cos(a), -math.sin(a)])      # (u, z): hacia adentro y hacia abajo con la valva cerrada


def tail_lengths():
    r0, r1 = K.rho_range()
    slot = (r0 - 0.3, r1 + 0.3)
    tip = slot[1] + C.PIN_FREE / 2 + 2.0
    return slot, tip


def magnet_dir0():
    """Magnetización del imán con θ = 0 (marco de la valva): vertical cuando la valva está a 40° (mitad del recorrido)."""
    a = -C.TAIL_PSI0 * D2R
    return np.array([math.sin(a), 0.0, math.cos(a)])


def leaflet(idx: int) -> Part:
    t_dir = tail_dir()
    (s0, s1), tip = tail_lengths()
    zt0 = zh + C.BARREL_R - C.LEAF_T
    p = prism_xy(leaflet_outline(), zt0, zh + C.BARREL_R)
    p += cyl_y(C.BARREL_R, -C.BARREL_HALF, C.BARREL_HALF, d, zh)
    ax = np.array([d, zh])
    tip_c = ax + (tip - C.TAIL_W / 2) * t_dir
    tail = stadium(tuple(ax), tuple(tip_c), C.TAIL_W / 2)
    # alma entre la cola y la valva: la cola queda soportada al imprimir la valva boca abajo (sin soportes)
    web = unary_union([tail, SPoly([(tip_c[0], zt0), (d, zt0), (d, zh)])]).convex_hull
    web = web.intersection(SPoly([(-50, -50), (60, -50), (60, zt0 + 0.01), (-50, zt0 + 0.01)]))
    flat = SPoly([(-50, -50), (60, -50), (60, zh + C.BARREL_R), (-50, zh + C.BARREL_R)])     # nada sobresale de la cara superior
    p += prism_xz(unary_union([tail, web]).intersection(flat), -C.TAIL_T / 2, C.TAIL_T / 2)
    # ranura de la corredera (el pasador de la horquilla desliza a lo largo de la cola)
    slot = stadium(tuple(ax + s0 * t_dir), tuple(ax + s1 * t_dir), C.PIN_FREE / 2)
    p -= prism_xz(slot, -C.TAIL_T / 2 - 1, C.TAIL_T / 2 + 1)
    # agujero del pasador de bisagra (gira sobre el latón), ciego antes del imán
    v_mag0 = C.BARREL_HALF - C.MAG_SLOT[2]
    p -= cyl_y(C.PIN_FREE / 2, -C.BARREL_HALF - 1, v_mag0 - 0.8, d, zh)
    # ranura del imán en el extremo +v del barril: disco de pie, magnetización perpendicular a la bisagra
    slot_m = box(-C.MAG_SLOT[0] / 2, C.MAG_SLOT[0] / 2, v_mag0, C.BARREL_HALF + 1, -C.MAG_SLOT[1] / 2, C.MAG_SLOT[1] / 2)
    p -= Pos(d, 0, zh) * Rot(Y=-C.TAIL_PSI0) * slot_m
    # marcas: número de valva (puntos) en la cara superior, junto a la bisagra
    for k in range(idx + 1):
        p -= cyl_z(0.6, zh + C.BARREL_R - 0.5, zh + C.BARREL_R + 1, d - 7.0, -6.0 + 3.0 * k)
    return p


def ref_magnet() -> Part:
    v_c = C.BARREL_HALF - C.MAG_SLOT[2] + C.MAGNET[0] / 2
    m = cyl_z(C.MAGNET[0] / 2, -C.MAGNET[1] / 2, C.MAGNET[1] / 2, 0, 0)      # eje (magnetización) = z local
    return Pos(d, v_c, zh) * Rot(Y=-C.TAIL_PSI0) * m


def magnet_center():
    """El imán se empuja hasta el FONDO de su ranura (y se fija con una gota de cianoacrilato)."""
    return np.array([d, C.BARREL_HALF - C.MAG_SLOT[2] + C.MAGNET[0] / 2, zh])


# ───────────────────────────── portasensor Hall ─────────────────────────────
HALL_SENSOR_U = (d - C.TO92[1] / 2, d + C.TO92[1] / 2)          # el sensor queda sobre el eje de la bisagra
CARRIER_U = (HALL_SENSOR_U[0], HALL_SENSOR_U[1] + 1.0)          # abierto hacia −u (el túnel lo cierra), lomo en +u
CARRIER_Z = (zh - C.TO92[0] / 2 - C.CARRIER_WALL, zh + C.TO92[0] / 2 + C.CARRIER_WALL)
CARRIER_TIP = C.BARREL_HALF                                     # la punta apoya en el extremo del barril
CARRIER_END = C.SPOT_V + C.CARRIER_PUSH                         # cara interior de la pestaña con la punta en contacto (queda 0,6 mm del rebaje)
KEY = (CARRIER_U[1] - 1.0, CARRIER_U[1], 0.8)                    # nervio guía en el lomo (u0, u1, alto)


def hall_carrier() -> Part:
    """Portasensor: entra desde afuera por el túnel en la prolongación del eje de bisagra y se empuja hasta que la punta TOCA el
    extremo del barril (tope axial de la valva del lado +v y distancia imán–Hall fija). El Hall apoya en el labio de la punta;
    la cara plana mira hacia el centro (eje sensible radial); las patas salen hacia afuera."""
    u0, u1 = CARRIER_U
    z0, z1 = CARRIER_Z
    p = box(u0, u1, CARRIER_TIP, CARRIER_END, z0, z1)
    p += box(KEY[0], KEY[1], CARRIER_TIP + 2, CARRIER_END, z1, z1 + KEY[2])
    # canal del sensor y de las patas (abierto hacia −u)
    p -= box(u0 - 1, HALL_SENSOR_U[1] + 0.05, CARRIER_TIP + C.CARRIER_LIP, CARRIER_END + 5, zh - C.TO92[0] / 2 - 0.05, zh + C.TO92[0] / 2 + 0.05)
    # pestaña exterior (tope de inserción y tirador), al ras del lomo para imprimirla acostada
    p += box(u1 - 6.5, u1, CARRIER_END, CARRIER_END + 1.8, z0 - 1.5, z1 + 1.5)
    p -= box(u1 - 6.5 - 1, u1 - 2.6, CARRIER_END - 1, CARRIER_END + 3, zh - 1.6, zh + 1.6)   # paso del cable
    return p


def ref_hall() -> Part:
    s0 = CARRIER_TIP + C.CARRIER_LIP
    return box(HALL_SENSOR_U[0], HALL_SENSOR_U[1], s0, s0 + C.TO92[2], zh - C.TO92[0] / 2, zh + C.TO92[0] / 2) + \
        box(d - 0.2, d + 0.2, s0 + C.TO92[2], CARRIER_END - 0.5, zh - 1.5, zh + 1.5)


def hall_element():
    return np.array([d, CARRIER_TIP + C.CARRIER_LIP + C.HALL_ELEM_DEPTH, zh])


# ───────────────────────────── pasadores de latón (referencia) ─────────────────────────────
HINGE_PIN = (-(C.SPOT_V + 4.0), C.BARREL_HALF - C.MAG_SLOT[2] - 1.2)    # sobresale 4 mm del rebaje plano para sacarlo con alicate


def ref_hinge_pin() -> Part:
    return cyl_y(C.PIN_D / 2 * 0.98, HINGE_PIN[0], HINGE_PIN[1], d, zh)


LUG_UV = (d - C.TAIL_A, C.TAIL_T / 2 + C.LUG_GAP, C.TAIL_T / 2 + C.LUG_GAP + 2.5)   # u del pasador, v interior y exterior de la horquilla
LUG_TOP = C.LUG_H + 3.3
LUG_U1 = 24.4


def ref_lug_pins() -> Part:
    out = None
    for a in C.LEAF_DIR:
        pin = rz(cyl_y(C.PIN_D / 2 * 0.98, -LUG_UV[2], LUG_UV[2], LUG_UV[0], C.LUG_H), a)
        out = pin if out is None else out + pin
    return out


# ───────────────────────────── cuerpo ─────────────────────────────

def body() -> Part:
    p = Pos(0, 0, 0) * Cylinder(C.RO, C.TOP_Z, align=(Align.CENTER, Align.CENTER, Align.MIN))
    p -= Pos(0, 0, -1) * Cylinder(C.RI, C.TOP_Z + 2, align=(Align.CENTER, Align.CENTER, Align.MIN))
    # tabique del servo: dos postes que van de la pared al hueco del cuerpo del servo (las orejas se atornillan aquí)
    half = math.sqrt(C.RI ** 2 - BH_Y[1] ** 2) + 2.0
    for xa, xb in ((-half, CUT_X[0]), (CUT_X[1], half)):
        p += box(xa, xb, BH_Y[0], BH_Y[1], 0, BH_TOP)
    for x in EAR_HOLES_X:
        p -= cyl_y(C.SERVO_PILOT / 2, BH_Y[0] - 1, BH_Y[1] - 0.8, x, C.Z_SERVO)
    # ventana del servo (lado −y): el servo entra por aquí con la manivela colgando; techo a dos aguas (sin puente)
    w0, w1 = WIN_X
    xm, hw = (w0 + w1) / 2, (w1 - w0) / 2
    win = SPoly([(w0, -1), (w1, -1), (w1, WIN_Z), (xm, WIN_Z + hw), (w0, WIN_Z)])
    p -= prism_xz(win, -C.RO - 2, -C.RI + 16.0)
    # ranuras guía de las zapatas del pistón (comisuras), abiertas arriba
    for a in COMMISSURES:
        g = box(C.RI - 0.6, C.RI + C.SHOE[0] + C.CLR_SLIDE, -C.SHOE[1] / 2 - C.CLR_SLIDE, C.SHOE[1] / 2 + C.CLR_SLIDE, SHOE_Z0 - 1.0, C.TOP_Z + 1)
        p -= rz(g, a)
    for i, a in enumerate(C.LEAF_DIR):
        # tope axial del lado −v: resalte coaxial con la bisagra (perfil de gota: se imprime sin soporte) hasta THRUST_GAP del barril
        tear = unary_union([Point(d, zh).buffer(C.THRUST_R, 48), SPoly([(d - C.THRUST_R * 0.7071, zh - C.THRUST_R * 0.7071), (d + C.THRUST_R * 0.7071, zh - C.THRUST_R * 0.7071), (d, zh - C.THRUST_R * 1.4142)])])
        p += rz(prism_xz(tear, -C.V_WALL_IN - 1.0, -C.BARREL_HALF - C.THRUST_GAP), a)
        # pasador de bisagra: a presión en la pared y en el resalte, lado −v (entra desde afuera)
        p -= rz(cyl_y(C.PIN_PRESS / 2, -C.V_WALL_OUT - 2, -C.BARREL_HALF, d, zh), a)
        # rebajes planos donde salen el pasador (−v) y el portasensor (+v)
        p -= rz(box(d - 5.0, d + 5.0, -C.RO - 5, -C.SPOT_V, zh - 5.0, zh + 5.0), a)
        p -= rz(box(d - 6.0, d + 3.0, C.SPOT_V, C.RO + 5, zh - 6.0, zh + 6.0), a)
        # túnel del portasensor, lado +v (en la prolongación del eje de bisagra), con ranura para el nervio guía
        c = C.CLR_SLIDE
        tun = box(CARRIER_U[0] - c, CARRIER_U[1] + c, C.V_WALL_IN - 4, C.V_WALL_OUT + 2, CARRIER_Z[0] - c, CARRIER_Z[1] + c)
        tun += box(KEY[0] - c, KEY[1] + c, C.V_WALL_IN - 4, C.V_WALL_OUT + 2, CARRIER_Z[1], CARRIER_Z[1] + KEY[2] + c)
        p -= rz(tun, a)
        # muesca índice para las galgas de calibración en la cara superior
        p -= rz(box(C.RI + 2.0, C.RI + 5.0, -1.6, 1.6, C.TOP_Z - 0.8, C.TOP_Z + 1), a)
        ang = a * D2R
        # número de valva: 1, 2 o 3 puntos (sin texto grabado)
        for k in range(i + 1):
            t = ang + 0.22 + 0.075 * k
            p -= cyl_z(0.9, C.TOP_Z - 0.5, C.TOP_Z + 1, (C.RI + 4.5) * math.cos(t), (C.RI + 4.5) * math.sin(t))
    return p


# ───────────────────────────── pistón y yugo ─────────────────────────────
TENON = (10.0, 3.5)       # medio largo (x) y alto sobre el disco de la espiga del yugo


def piston() -> Part:
    z0, z1 = C.WEB_DROP, C.WEB_DROP + C.DISC_T
    p = cyl_z(C.DISC_R, z0, z1, 0, 0)
    for a in COMMISSURES:
        arm = box(C.DISC_R - 3.0, C.RI - 0.4, -C.ARM_W / 2, C.ARM_W / 2, z0, z1)
        shoe = box(C.RI - 2.0, C.RI + C.SHOE[0], -C.SHOE[1] / 2, C.SHOE[1] / 2, z0, z0 + C.SHOE[2])
        p += rz(arm + shoe, a)
    for a in C.LEAF_DIR:
        u_p, v0, v1 = LUG_UV
        prof = unary_union([SPoly([(u_p - 3.5, z1 - 0.01), (LUG_U1, z1 - 0.01), (LUG_U1, C.LUG_H), (u_p - 3.5, C.LUG_H)]),
                            Point(u_p, C.LUG_H).buffer(3.3, 48)]).intersection(SPoly([(0, 0), (LUG_U1, 0), (LUG_U1, 60), (0, 60)]))
        cheeks = prism_xz(prof, v0, v1) + prism_xz(prof, -v1, -v0)
        cheeks -= cyl_y(C.PIN_PRESS / 2, -v1 - 1, v1 + 1, u_p, C.LUG_H)
        p += rz(cheeks, a)
    # muesca entre las mejillas: la cola de la valva baja por aquí con la valva muy abierta
    for a in C.LEAF_DIR:
        p -= rz(box(LUG_UV[0] - 0.5, C.DISC_R + 1, -LUG_UV[1], LUG_UV[1], z0 - 1, z1 + 1), a)
    # mortaja pasante para la espiga del yugo
    p -= box(-TENON[0] - 0.2, TENON[0] + 0.2, Y_WEB0 - 0.2, Y_WEB1 + 0.2, z0 - 1, z1 + 1)
    return p


LOCK_PIN_Z = C.WEB_DROP + C.DISC_T + C.PIN_D / 2


def yoke() -> Part:
    """Yugo escocés: placa vertical con ranura horizontal para el pasador de la manivela y espiga que atraviesa el disco;
    un pasador de latón (traba) sobre el disco la retiene. Se imprime acostado."""
    xw = C.CRANK_R + C.PIN_FREE / 2 + 0.5 + 3.5
    prof = SPoly([(-xw, -C.PIN_FREE / 2 - 3.0), (xw, -C.PIN_FREE / 2 - 3.0), (xw, C.WEB_DROP), (TENON[0], C.WEB_DROP),
                  (TENON[0], C.WEB_DROP + C.DISC_T + TENON[1] + 1.5), (-TENON[0], C.WEB_DROP + C.DISC_T + TENON[1] + 1.5),
                  (-TENON[0], C.WEB_DROP), (-xw, C.WEB_DROP)])
    p = prism_xz(prof, Y_WEB0, Y_WEB1)
    p -= prism_xz(stadium((-C.CRANK_R - 0.5, 0), (C.CRANK_R + 0.5, 0), C.PIN_FREE / 2), Y_WEB0 - 1, Y_WEB1 + 1)
    p -= cyl_y(C.PIN_PRESS / 2, Y_WEB0 - 1, Y_WEB1 + 1, 0, LOCK_PIN_Z)
    return p


LOCK_PIN = (Y_WEB0 - 4.0, Y_WEB1 + 4.0)


def ref_lock_pin() -> Part:
    return cyl_y(C.PIN_D / 2 * 0.98, LOCK_PIN[0], LOCK_PIN[1], 0, LOCK_PIN_Z)


# ───────────────────────────── manivela (marco: eje del servo = y, y = 0 cara trasera) ─────────────────────────────
# El pasador está del MISMO lado que el brazo del horn (+x): así el horn apunta hacia arriba solo cuando el pistón está arriba
# y nunca alcanza el disco. El pasador va a presión en la parte de la manivela que queda SOBRE el brazo del horn.
CRANK_PIN = (HORN_POCKET := C.HORN.t + 0.2, C.CRANK_T + 0.5 + C.WEB_T + 1.0)


def _horn_outline(c=0.0):
    return stadium((0, 0), (H.arm_len - H.tip_w / 2, 0), H.hub_d / 2 + c, H.tip_w / 2 + c)


def crank() -> Part:
    out = stadium((0, 0), (H.arm_len - H.tip_w / 2, 0), H.hub_d / 2 + 2.0, H.tip_w / 2 + 1.6)
    p = prism_xz(out, 0, C.CRANK_T)
    p -= prism_xz(_horn_outline(0.3), -1, H.t + 0.2)                          # encastre del brazo del horn (cara trasera)
    p -= cyl_y(H.hub_d / 2 + 0.3, -1, H.t + 0.2, 0, 0)
    p -= cyl_y(2.6, -1, C.CRANK_T + 1, 0, 0)                                   # paso del destornillador del tornillo del horn
    p -= cyl_y(C.PIN_PRESS / 2, HORN_POCKET, C.CRANK_T + 1, C.CRANK_R, 0)       # pasador a presión sobre el brazo del horn
    return p


def ref_crank_pin() -> Part:
    return cyl_y(C.PIN_D / 2 * 0.98, CRANK_PIN[0], CRANK_PIN[1], C.CRANK_R, 0)


def ref_horn() -> Part:
    arm = prism_xz(_horn_outline(), 0, H.t)
    hub = cyl_y(H.hub_d / 2, H.t - H.hub_h, H.t, 0, 0)
    return arm + hub


# ───────────────────────────── servo (referencia, global) ─────────────────────────────

def ref_servo() -> Part:
    body_ = box(X_BODY0, X_BODY1, Y_BODY_BOT, Y_BODY_TOP, Z_BODY0, Z_BODY1)
    ears = box(X_BODY_C - S.tab_span / 2, X_BODY_C + S.tab_span / 2, Y_EAR0, Y_EAR1, Z_BODY0, Z_BODY1)
    dome = cyl_y(S.W / 2, Y_BODY_TOP, Y_DOME_TOP, 0, C.Z_SERVO)
    shaft = cyl_y(2.4, Y_DOME_TOP, C.Y_SHAFT_TOP, 0, C.Z_SERVO)
    p = body_ + ears + dome + shaft
    for x in EAR_HOLES_X:
        p -= cyl_y(1.0, Y_EAR0 - 1, Y_EAR1 + 1, x, C.Z_SERVO)
    return p


def ref_servo_screws() -> Part:
    out = None
    for x in EAR_HOLES_X:
        s = cyl_y(0.95, Y_EAR0, Y_EAR0 + 8.0, x, C.Z_SERVO) + cyl_y(1.9, Y_EAR0 - 1.6, Y_EAR0, x, C.Z_SERVO)
        out = s if out is None else out + s
    return out


# ───────────────────────────── probeta ─────────────────────────────
COUPON_HOLES = [('Ø3 a presión', (2.85, 2.95, 3.05)), ('Ø3 libre', (3.20, 3.30, 3.40))]
COUPON_MAG = ((4.1, 2.1), (4.2, 2.2), (4.3, 2.3))
COUPON_PILOT = (1.6, 1.8, 2.0)


def coupon() -> Part:
    """Probeta (impresa de pie, como el cuerpo): agujeros horizontales para el latón Ø3 (a presión / libre), ranuras de imán,
    pilotos de los tornillos del servo y un tramo del túnel del portasensor. Las muescas de arriba numeran las columnas 1–3."""
    W_, Dp, Hh = 66.0, 12.0, 24.0
    p = box(0, W_, 0, Dp, 0, Hh)
    xs = (6.0, 15.0, 24.0)
    for r, (_, ds) in enumerate(COUPON_HOLES):
        for k, dd in enumerate(ds):
            p -= cyl_y(dd / 2, -1, Dp + 1, xs[k] + 27.0 * r, 5.0)
    for k, (w, t) in enumerate(COUPON_MAG):
        p -= box(xs[k] - w / 2, xs[k] + w / 2, -1, C.MAG_SLOT[2], 14.0 - t / 2, 14.0 + t / 2)
    for k, dd in enumerate(COUPON_PILOT):
        p -= cyl_y(dd / 2, -1, 9.0, xs[k] + 27.0, 14.0)
    c = C.CLR_SLIDE
    cu = (CARRIER_U[1] - CARRIER_U[0]) / 2
    cz = (CARRIER_Z[1] - CARRIER_Z[0]) / 2
    p -= box(59.0 - cu - c, 59.0 + cu + c, -1, Dp + 1, 13.0 - cz - c, 13.0 + cz + c)
    p -= box(59.0 + cu - 1.0 - c, 59.0 + cu + c, -1, Dp + 1, 13.0 + cz, 13.0 + cz + KEY[2] + c)
    for k in range(3):
        for j in range(k + 1):
            for base in (0.0, 27.0):
                p -= box(xs[k] + base - 1.6 + 1.2 * j, xs[k] + base - 1.0 + 1.2 * j, -1, Dp + 1, Hh - 1.0, Hh + 1)
    return p


# ───────────────────────────── galgas de calibración (opcionales) ─────────────────────────────
GAUGE_ANGLES = (0, 20, 40, 60, 80)


def gauge(theta: float) -> Part:
    """Galga angular (marco de la valva): apoya en la cara superior del cuerpo con una chaveta en la muesca índice; su cara
    toca la cara superior de la valva exactamente a θ, entre 8 y 14 mm del eje de bisagra."""
    from shapely.geometry import MultiPoint
    t = theta * D2R
    n = np.array([math.sin(t), math.cos(t)])
    pts = [np.array([d - s * math.cos(t) + C.BARREL_R * math.sin(t), zh + s * math.sin(t) + C.BARREL_R * math.cos(t)]) for s in (8.0, 14.0)]
    pad = [pts[0], pts[1], pts[1] + 3 * n, pts[0] + 3 * n]
    zarm = max(C.TOP_Z + 4.0, max(q[1] for q in pad) + 3.0)
    lifted = [np.array([q[0], zarm]) for q in pad]
    leg = MultiPoint([tuple(q) for q in pad + lifted]).convex_hull
    xs_ = [q[0] for q in pad]
    arm = SPoly([(min(xs_), zarm - 3), (C.RI + 6.0, zarm - 3), (C.RI + 6.0, zarm), (min(xs_), zarm)])
    foot = SPoly([(C.RI + 1.0, C.TOP_Z), (C.RI + 6.0, C.TOP_Z), (C.RI + 6.0, zarm), (C.RI + 1.0, zarm)])
    prof = unary_union([leg, arm, foot])
    p = prism_xz(prof, -3.0, 3.0)
    p += box(C.RI + 2.25, C.RI + 4.75, -1.35, 1.35, C.TOP_Z - 0.6, C.TOP_Z + 0.01)       # chaveta en la muesca índice
    p -= engrave_text(f'{theta:.0f}°', 3.0, C.RI + 3.5, 0, zarm, 0.4, 90)
    return p
