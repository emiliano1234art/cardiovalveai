"""
Piezas de CardioValveAI (build123d / OpenCascade).

Cada constructor devuelve el sólido en su MARCO CANÓNICO (el que usa el
ensamblaje en `assembly.py`). La orientación de impresión se define en
`PRINT_ORIENT` (matriz que lleva el marco canónico a la cama de impresión).
"""
from __future__ import annotations
import math
import numpy as np
from build123d import Align, Box, Cylinder, Part, Polygon, Pos, Rot, Text, extrude
from shapely.geometry import Point, Polygon as SPoly
from shapely.ops import unary_union

import config as C
import kinematics as K

D2R = math.pi / 180
RO = C.RING_ID / 2          # radio interior del anillo
RX = C.RING_OD / 2          # radio exterior
MIN = (Align.MIN, Align.MIN, Align.MIN)

# ───────────────────────────── utilidades ─────────────────────────────

def _pts(geom) -> list[tuple[float, float]]:
    from shapely.geometry.polygon import orient
    if geom.geom_type == 'MultiPolygon':
        geom = max(geom.geoms, key=lambda g: g.area)
    geom = orient(geom, 1.0)   # antihorario → normal +z
    return [(float(x), float(y)) for x, y in list(geom.exterior.coords)[:-1]]

def _ext(geom, amount):
    return extrude(Polygon(*_pts(geom), align=None), amount, dir=(0, 0, 1))

def prism_xy(geom, z0: float, z1: float) -> Part:
    return Pos(0, 0, z0) * _ext(geom, z1 - z0)

def prism_xz(geom, y0: float, y1: float) -> Part:
    """Perfil en el plano x–z (shapely usa (x, z)) extruido entre y0 e y1."""
    solid = Rot(X=90) * _ext(geom, y1 - y0)
    return Pos(0, y1, 0) * solid

def cyl_x(r, x0, x1, y, z):
    return Pos((x0 + x1) / 2, y, z) * Rot(Y=90) * Cylinder(r, x1 - x0)

def cyl_y(r, y0, y1, x, z):
    return Pos(x, (y0 + y1) / 2, z) * Rot(X=90) * Cylinder(r, y1 - y0)

def cyl_z(r, z0, z1, x, y):
    return Pos(x, y, (z0 + z1) / 2) * Cylinder(r, z1 - z0)

def box(x0, x1, y0, y1, z0, z1):
    return Pos(x0, y0, z0) * Box(x1 - x0, y1 - y0, z1 - z0, align=MIN)

def stadium(p0, p1, r0, r1=None, n=48):
    r1 = r0 if r1 is None else r1
    return unary_union([Point(p0).buffer(r0, n), Point(p1).buffer(r1, n)]).convex_hull

def annular_sector(r0, r1, a0, a1, n=48):
    a = np.linspace(a0 * D2R, a1 * D2R, n)
    outer = [(r1 * math.cos(t), r1 * math.sin(t)) for t in a]
    inner = [(r0 * math.cos(t), r0 * math.sin(t)) for t in a[::-1]]
    return SPoly(outer + inner)

def rz(part, deg):
    return Rot(Z=deg) * part

def leaf_frame(part, i):
    return rz(part, K.leaf_dir(i))

def engrave_text(txt, size, x, y, z_top, depth=0.5, rot=0.0):
    t = Text(txt, size, align=(Align.CENTER, Align.CENTER))
    return Pos(x, y, z_top - depth) * Rot(Z=rot) * extrude(t, depth + 1)

# ───────────────────────────── valva ─────────────────────────────
PLATE_Z0 = C.Z_HINGE - C.BARREL_R
PLATE_Z1 = PLATE_Z0 + C.LEAF_T

def leaflet_outline() -> SPoly:
    """Contorno admisible de la valva (marco local): sector a 120°, coaptación con holgura,
    y barrido sin tocar la pared hasta THETA_DESIGN (incluye espesor de la valva)."""
    d = C.HINGE_D
    Rp = RO - C.WALL_CLEAR
    zos = (PLATE_Z0 - C.Z_HINGE, PLATE_Z1 - C.Z_HINGE)
    ths = np.linspace(0, C.THETA_DESIGN, 87)
    right = []
    for x in np.arange(0.0, d + 1e-9, 0.1):
        y = math.tan(60 * D2R) * x - C.EDGE_GAP / math.cos(60 * D2R)
        for th in ths:
            c, s = math.cos(th * D2R), math.sin(th * D2R)
            for zo in zos:
                xp = d + c * (x - d) + s * zo
                y = min(y, math.sqrt(max(0.0, Rp * Rp - xp * xp)))
        if y > 0.05:
            right.append((x, y))
    poly = SPoly(right + [(x, -y) for x, y in reversed(right)])
    return poly.buffer(-1.2, 32).buffer(1.2, 32)

def tail_profile():
    a = C.TAIL_PHI0 * D2R
    end = (C.HINGE_D + C.TAIL_LT * math.cos(a), C.Z_HINGE + C.TAIL_LT * math.sin(a))
    return stadium((C.HINGE_D, C.Z_HINGE), end, C.BARREL_R, C.TAIL_R_END), end

def tail_point(s):
    a = C.TAIL_PHI0 * D2R
    return C.HINGE_D + s * math.cos(a), C.Z_HINGE + s * math.sin(a)

EAR_S = 3.0               # agujero del elástico: a 3 mm del eje, en la dirección de la cola
EAR_Y = (-6.8, -5.5)      # oreja del elástico (y local): fuera de la ranura, dentro del diámetro interior

def leaflet(idx: int) -> Part:
    d, zh = C.HINGE_D, C.Z_HINGE
    plate = prism_xy(leaflet_outline(), PLATE_Z0, PLATE_Z1)
    barrel = cyl_y(C.BARREL_R, -C.BARREL_HALF, C.BARREL_HALF, d, zh)
    tprof, tend = tail_profile()
    tail = prism_xz(tprof, *C.TAIL_Y)
    # oreja del elástico sobre el barril (lado −y, dentro del anillo): libera la cola para el imán
    ear = prism_xz(stadium((d, zh), tail_point(EAR_S), C.BARREL_R, 1.4), *EAR_Y)
    p = plate + barrel + tail + ear
    # eje Ø2 de latón (agujero de giro) y pasador de latón Ø2 a presión cola–biela
    p -= cyl_y(C.PIN_HOLE_LEAF / 2, -20, 20, d, zh)
    p -= cyl_y(C.TAIL_PIN_HOLE / 2, C.TAIL_Y[0] - 1, C.TAIL_Y[1] + 1, *tend)
    ex, ez = tail_point(EAR_S)
    p -= cyl_y(0.6, EAR_Y[0] - 1, EAR_Y[1] + 1, ex, ez)
    # alojamiento del imán N42 Ø4×2 (a ras de la cara −y de la cola; profundidad = imán + 0,2)
    mx, mz = tail_point(C.MAG_LEAF_S)
    p -= cyl_y((C.MAG_LEAF[0] + C.MAG_POCKET_CLR) / 2, C.TAIL_Y[0] - 0.1, C.TAIL_Y[0] + C.MAG_LEAF[1] + 0.2, mx, mz)
    # referencias ópticas (medición del ángulo con cámara) e identificación 1–3
    for s in (6.0, 16.0):
        p -= cyl_z(0.75, PLATE_Z1 - 0.4, PLATE_Z1 + 1, d - s, 0)
    for k in range(idx + 1):
        p -= cyl_z(0.6, PLATE_Z1 - 0.3, PLATE_Z1 + 1, d - 4.2, 4.5 + 2.6 * k)
    return p

# ───────────────────────────── anillo valvular ─────────────────────────────

def valve_ring() -> Part:
    r = Cylinder(RX, C.RING_H, align=(Align.CENTER, Align.CENTER, Align.MIN))
    for i in range(C.N_LEAF):
        a = K.leaf_dir(i) + 60
        wedge = prism_xy(SPoly([(0, 0), (60 * math.cos((a - C.POST_W_DEG / 2) * D2R), 60 * math.sin((a - C.POST_W_DEG / 2) * D2R)),
                                (60 * math.cos((a + C.POST_W_DEG / 2) * D2R), 60 * math.sin((a + C.POST_W_DEG / 2) * D2R))]), C.RING_H - 1, C.RING_H + C.POST_H)
        r += Cylinder(RX, C.RING_H + C.POST_H, align=(Align.CENTER, Align.CENTER, Align.MIN)) & wedge
    r -= Cylinder(RO, 200)
    for i in range(C.N_LEAF):
        # ranura de cola y biela
        r -= leaf_frame(box(C.SLOT_X[0], C.SLOT_X[1], C.SLOT_Y[0], C.SLOT_Y[1], -1, 40), i)
        # eje de bisagra (pasante: se introduce desde el exterior)
        r -= leaf_frame(cyl_y(C.PIN_HOLE_RING / 2, -50, 50, C.HINGE_D, C.Z_HINGE), i)
        # columna (M3 pasante + alojamiento de cabeza en la comisura)
        a = (K.leaf_dir(i) + 60) * D2R
        cx, cy = C.COLUMN_R * math.cos(a), C.COLUMN_R * math.sin(a)
        r -= cyl_z(C.M3_CLEAR / 2, -1, 40, cx, cy)
        r -= cyl_z(C.M3_HEAD_D / 2, C.RING_H + C.POST_H - C.M3_HEAD_H - 0.6, 40, cx, cy)
        # tope: tornillo M2 de latón pasante desde la cara superior (tuerca atrapada en la brida del tope)
        r -= leaf_frame(cyl_z(C.M2_CLEAR / 2, -1, 40, *STOP_SCREW), i)
        r -= leaf_frame(cyl_z(2.1, C.RING_H - 1.6, 40, *STOP_SCREW), i)
        # bolsillo del portasensor Hall (posición calculada en sensing.py), abierto arriba y con VENTANA hacia el diámetro
        # interior: la cara del TO-92 queda al ras del interior (sin pared delante). El piso fija la altura del sensor;
        # el lomo del portasensor apoya en la cara exterior del bolsillo. Bajada de cables por un canal en la pared exterior.
        r -= leaf_frame(hall_pocket(), i)
        hy = C.HALL_XYZ[1]
        r -= leaf_frame(box(RX - 1.8, RX + 1, hy - 1.0, hy + 1.0, -1, 40), i)
        # marca fiduciaria y número de valva grabados en la cara superior
        fa = (K.leaf_dir(i) - 34) * D2R
        r -= cyl_z(0.75, C.RING_H - 0.5, C.RING_H + 1, 30.5 * math.cos(fa), 30.5 * math.sin(fa))
        na = (K.leaf_dir(i) + 22) * D2R
        r -= engrave_text(str(i + 1), 4.5, 30.6 * math.cos(na), 30.6 * math.sin(na), C.RING_H, 0.5, K.leaf_dir(i) - 90)
    return r

STOP_SCREW = (30.0, -11.8)   # (x, y) en el marco de la valva (alejado del bolsillo Hall)


def hall_pocket():
    hx, hy, hz = C.HALL_XYZ
    bt, bw, bh = C.TO92_BODY
    z0 = hz - bh / 2 - 0.15
    p = box(RO - 4.0, C.HALL_POCKET_BACK, hy - bw / 2 - 0.15, hy + bw / 2 + 0.15, z0, 40)           # cuerpo del sensor + ventana
    return p


def hall_carrier(offset: float) -> Part:
    """Portasensor extraíble (marco de la valva). El TO-92 se pega con silicona neutra al lomo; la pestaña apoya en la cara superior
    del anillo; se retira tirando de la lengüeta, sin desarmar el mecanismo. `offset` aleja el sensor del imán (variantes 0 / 0,25 / 0,5)."""
    hx, hy, hz = C.HALL_XYZ
    bt, bw, bh = C.TO92_BODY
    x_back_s = hx + offset + bt / 2                       # cara trasera del sensor
    x_back = C.HALL_POCKET_BACK - 0.15
    zb = hz - bh / 2
    p = box(x_back_s, x_back, hy - 1.3, hy + 1.3, zb, C.RING_H)                                   # lomo
    p += box(x_back_s + 0.3, x_back, hy - bw / 2, hy + bw / 2, hz + bh / 2 + 0.3, C.RING_H)        # alas: centran en el bolsillo
    ft = C.CARRIER_FLANGE_T
    p += box(x_back_s + 0.3, 33.6, hy - 1.3, hy + 1.3, C.RING_H, C.RING_H + ft)                    # pestaña sobre el anillo
    p -= box(x_back_s + 0.3, 33.7, hy - 0.5, hy + 0.5, C.RING_H + ft - 0.5, C.RING_H + ft + 1)     # canal del cable
    p += cyl_y(1.4, hy - 1.3, hy + 1.3, 33.6, C.RING_H + ft + 1.0)                                 # lengüeta para retirar
    p -= cyl_y(0.6, hy - 2, hy + 2, 33.6, C.RING_H + ft + 1.0)
    p -= engrave_text(f'{offset:.2f}'.replace('0.', '.'), 1.6, 31.4, hy, C.RING_H + ft, 0.3, 90)
    return p


def calib_gauge(theta: float) -> Part:
    """Galga angular de calibración (marco de la valva). Se apoya en la cara superior del anillo, con una chaveta dentro de la ranura
    de la cola, y presenta una cara plana donde la cara superior de la valva toca EXACTAMENTE a θ. La valva se lleva a mano (empujador
    desconectado) hasta tocarla: posición angular conocida para calibrar el Hall."""
    from shapely.geometry import MultiPoint
    d0, d1 = 7.5, 13.0
    A = np.array(K.rotate_leaf_point(C.HINGE_D - d0, PLATE_Z1, theta))
    B = np.array(K.rotate_leaf_point(C.HINGE_D - d1, PLATE_Z1, theta))
    n = np.array([math.sin(theta * D2R), math.cos(theta * D2R)])      # normal de la cara superior girada θ (hacia afuera de la valva)
    pad = [A, B, B + 3 * n, A + 3 * n]
    zarm = max(C.RING_H + 7.0, max(q[1] for q in pad) + 3.0)
    lifted = [np.array([q[0], zarm]) for q in pad]
    leg = MultiPoint([tuple(q) for q in pad + lifted]).convex_hull
    xs = [q[0] for q in pad]
    arm = SPoly([(min(xs), zarm - 3), (34.6, zarm - 3), (34.6, zarm), (min(xs), zarm)])
    foot = SPoly([(31.8, C.RING_H), (34.6, C.RING_H), (34.6, zarm), (31.8, zarm)])
    key = SPoly([(29.8, C.RING_H - 2.0), (31.4, C.RING_H - 2.0), (31.4, C.RING_H + 0.5), (29.8, C.RING_H + 0.5)])
    prof = unary_union([leg, arm, foot])
    p = prism_xz(prof, -3.0, 3.0) + prism_xz(key, C.SLOT_Y[0] + 0.3, C.SLOT_Y[1] - 0.3) + box(31.3, 31.9, -3, 3, C.RING_H, C.RING_H + 1.2)   # puente chaveta–pie SOBRE la cara superior (no entra en la pared)
    p -= engrave_text(f'{theta:.0f}°', 3.0, 33.2, 0, zarm, 0.4, 90)
    return p
ELASTIC_HOLE = (23.0, -6.15) # paso del elástico en la brida del tope (bajo la oreja de la valva)

# ───────────────────────────── bielas ─────────────────────────────
# marco de la biela: agujero superior en el origen, eje hacia −z, espesor en y ∈ [0, LINK_T]

def link(L: float, lost_motion: bool) -> Part:
    ext = C.LM_SLOT if lost_motion else 0.0
    prof = stadium((0, 0), (0, -(L + ext)), C.LINK_W / 2)
    p = prism_xz(prof, 0, C.LINK_T)
    p -= cyl_y(C.LINK_HOLE / 2, -1, C.LINK_T + 1, 0, 0)      # gira sobre el pasador de latón de la cola
    if lost_motion:
        p -= prism_xz(stadium((0, -L), (0, -(L + ext)), C.M2_CLEAR / 2), -1, C.LINK_T + 1)
    else:
        p -= cyl_y(C.M2_CLEAR / 2, -1, C.LINK_T + 1, 0, -L)
    # marca de identificación: 0 ranuras = normal, 1 = recorrido perdido, 2 = corta (IC)
    marks = 0 if not lost_motion else (1 if abs(L - C.LINK_L) < 1e-6 else 2)
    for k in range(marks):
        p -= box(-C.LINK_W, C.LINK_W, C.LINK_T - 0.4, C.LINK_T + 1, -8 - 2.2 * k, -7.2 - 2.2 * k)
    return p

# ───────────────────────────── topes de apertura (intercambiables) ─────────────────────────────

def opening_stop(theta_stop: float) -> Part:
    """Inserto bajo la cola: su cara superior coincide con el borde inferior de la cola a θ_stop."""
    a = (C.TAIL_PHI0 - theta_stop) * D2R
    nx, nz = -math.sin(a), math.cos(a)       # normal hacia arriba de la cola
    cx, cz = C.HINGE_D - C.TAIL_R_END * nx, C.Z_HINGE - C.TAIL_R_END * nz  # recta del borde inferior
    x0, x1 = 23.2, 31.0
    edge = lambda x: cz + (x - cx) * math.tan(a)
    below = SPoly([(x0 - 50, edge(x0 - 50)), (x1 + 50, edge(x1 + 50)), (x1 + 50, -100), (x0 - 50, -100)])
    body = SPoly([(x0, -2.5), (x1, -2.5), (x1, 14.0), (x0, 14.0)]).intersection(below)
    p = prism_xz(body, C.STOP_Y[0], C.STOP_Y[1]) if body.area > 0.5 else box(x0, x1, C.STOP_Y[0], C.STOP_Y[1], -2.5, -2.4)
    p += box(22.0, 33.0, -14.0, C.STOP_Y[1], -2.5, 0)
    p -= box(31.6, 34.0, C.HALL_XYZ[1] - 1.3, C.HALL_XYZ[1] + 1.3, -3.0, 1.0)   # paso del cable del Hall (bajada exterior)
    # agujero de paso + tuerca M2 atrapada desde abajo (sin rosca en el plástico)
    p -= cyl_z(C.M2_CLEAR / 2, -5, 5, *STOP_SCREW)
    p -= prism_xy(hexagon(STOP_SCREW, (C.M2_NUT_AF + C.NUT_CLR) / math.sqrt(3)), -3.0, -2.5 + C.M2_NUT_T + 0.2)
    p -= cyl_z(0.65, -5, 5, *ELASTIC_HOLE)     # paso del elástico (se anuda bajo la brida)
    return p

def hexagon(c, R):
    return SPoly([(c[0] + R * math.cos(k * math.pi / 3), c[1] + R * math.sin(k * math.pi / 3)) for k in range(6)])

# ───────────────────────────── plato actuador (corredera) ─────────────────────────────
# marco: cara inferior del plato en z = 0, centro en el eje de la válvula

def actuator_plate() -> Part:
    T = C.PLATE_T
    shapes = [Point(0, 0).buffer(21, 96)]
    for i in range(C.N_LEAF):
        a = K.leaf_dir(i) * D2R
        u = (math.cos(a), math.sin(a))
        shapes.append(stadium((0, 0), (C.LINK_PIN_X * u[0], C.LINK_PIN_X * u[1]), 5.0))
        b = (K.leaf_dir(i) + 60) * D2R
        v = (C.COLUMN_R * math.cos(b), C.COLUMN_R * math.sin(b))
        shapes.append(stadium((0, 0), v, 6.5))
    p = prism_xy(unary_union(shapes), 0, T)
    bush_r = C.COLUMN_D / 2 + C.BUSH_CLEAR
    for i in range(C.N_LEAF):
        b = (K.leaf_dir(i) + 60) * D2R
        cx, cy = C.COLUMN_R * math.cos(b), C.COLUMN_R * math.sin(b)
        p += cyl_z(bush_r + 2.6, 0, C.BUSH_H, cx, cy)
        p -= cyl_z(bush_r, -1, C.BUSH_H + 1, cx, cy)
        # orejeta de la biela
        tab = prism_xz(stadium((C.LINK_PIN_X, T), (C.LINK_PIN_X, C.PLATE_TAB_PIN_Z), 3.0).union(
            SPoly([(C.LINK_PIN_X - 3, 0), (C.LINK_PIN_X + 3, 0), (C.LINK_PIN_X + 3, T + 1), (C.LINK_PIN_X - 3, T + 1)])), *C.TAB_Y)
        tab -= cyl_y(C.M2_CLEAR / 2, -10, 10, C.LINK_PIN_X, C.PLATE_TAB_PIN_Z)
        p += leaf_frame(tab, i)
        # rebaje pasante bajo la biela: deja bajar el extremo largo de las bielas de recorrido perdido
        p -= leaf_frame(box(C.LINK_PIN_X - 3.6, C.LINK_PIN_X + 3.6, C.LINK_Y[0] - 0.25, C.LINK_Y[1] + 0.6, -1, C.PLATE_T + 1), i)
    # horquilla central para el empujador (pasador a lo largo de y global)
    for s in (-1, 1):
        y0, y1 = (2.0, 4.4) if s > 0 else (-4.4, -2.0)
        ear = prism_xz(stadium((0, T), (0, C.CLEVIS_PIN_Z), 3.4).union(SPoly([(-3.4, 0), (3.4, 0), (3.4, T + 1), (-3.4, T + 1)])), y0, y1)
        p += ear
    p -= cyl_y(C.M2_CLEAR / 2, -10, 10, 0, C.CLEVIS_PIN_Z)
    p -= box(-5.0, 5.0, -2.0, 2.0, -1, T + 0.01)   # paso del empujador
    return p

# ───────────────────────────── empujador del servo ─────────────────────────────
# marco: agujero inferior (palanca) en el origen, eje hacia +z, espesor y ∈ [−1,5; 1,5]

def pushrod() -> Part:
    L = C.PUSHROD_L
    p = prism_xz(stadium((0, 0), (0, L), 2.8), -1.5, 1.5)
    p -= cyl_y(C.M2_CLEAR / 2, -5, 5, 0, 0)
    p -= cyl_y(C.M2_CLEAR / 2, -5, 5, 0, L)
    return p

# ───────────────────────────── columnas ─────────────────────────────

def column(height: float) -> Part:
    """insertos M3 termofijados en ambos extremos (agujero más largo que el inserto para la punta del tornillo)."""
    p = cyl_z(C.COLUMN_D / 2, 0, height, 0, 0)
    p -= cyl_z(C.M3_INSERT_D / 2, -1, 9.5, 0, 0)
    p -= cyl_z(C.M3_INSERT_D / 2, height - 10.5, height + 1, 0, 0)
    return p

# ───────────────────────────── servo: soporte ─────────────────────────────
S = C.SERVO

def servo_layout(zs_global: float):
    """Geometría del servo en el marco de la base relativa al centro de la válvula (x, y) y z global.
    Eje de salida paralelo a −y global; cuerpo hacia +y y hacia +x."""
    shaft_x = K.CRANK_XC
    body_cx = shaft_x + (S.L / 2 - S.shaft_offset)
    horn_mid_h = S.H + S.gear_top + S.shaft_h + 0.3 + 1.5      # plano medio del empujador (sobre el horn)
    y_of_h = lambda h: horn_mid_h - h                         # h (a lo largo del eje) → y global (relativa)
    return {'shaft_x': shaft_x, 'body_cx': body_cx, 'y_of_h': y_of_h, 'zs': zs_global, 'horn_mid_h': horn_mid_h}

def servo_mount(zs: float) -> Part:
    """Marco: x,y relativos al centro de la válvula; z global (base en z = BASE_T)."""
    L = servo_layout(zs)
    yh = L['y_of_h']
    y_face = yh(S.tab_h)              # cara donde apoyan las orejas
    y_back = y_face + 4.0
    zb = C.BASE_T
    xc = L['body_cx']
    half = S.tab_span / 2 + 4
    plate = box(xc - half, xc + half, y_face, y_back, zb, zs + S.W / 2 + 4)
    plate -= box(xc - S.L / 2 - 0.3, xc + S.L / 2 + 0.3, y_face - 1, y_back + 1, zs - S.W / 2 - 0.3, zs + S.W / 2 + 0.3)
    for s in (-1, 1):
        plate -= cyl_y(C.M2_PILOT / 2, y_face - 1, y_back + 1, xc + s * S.tab_hole_spacing / 2, zs)
    foot = box(xc - half, xc + half, y_face - 8, y_back + 19.0, zb, zb + 3.0)
    p = plate + foot
    for s in (-1, 1):
        gx = xc + s * (half - 2.5)
        p += prism_yz(SPoly([(y_back, zb + 3), (y_back + 14, zb + 3), (y_back, zb + 3 + 12)]), gx - 1.5, gx + 1.5)
    # agujeros M3 al piso (con arandelas de goma: antivibración)
    for s in (-1, 1):
        p -= cyl_z(C.M3_CLEAR / 2 + 0.6, zb - 1, zb + 5, xc + s * (half - 6), y_back + 14)
        p -= cyl_z(C.M3_CLEAR / 2 + 0.6, zb - 1, zb + 5, xc + s * (half - 6), y_face - 4.5)
    return p

def prism_yz(geom, x0, x1):
    """Perfil en el plano y–z extruido entre x0 y x1."""
    solid = Rot(Y=90) * Rot(Z=90) * _ext(geom, x1 - x0)
    # Rot(Z=90): (a,b)→(−b,a); Rot(Y=90): (x,y,z)→(z,y,−x). Resultado: (a,b,e)→(e, a, b)
    return Pos(x0, 0, 0) * solid

# ───────────────────────────── soporte ESP32 ─────────────────────────────

# ───────────────────────────── bandeja electrónica (placa perforada + ESP32 en zócalos) ─────────────────────────────
# marco: esquina de la bandeja en el origen, z = 0 en la cara superior de la base. El ESP32 va en zócalos hembra
# soldados a la placa perforada (no se perfora ni se flexiona la placa del ESP32). Antena hacia −y, USB hacia +y.
TRAY_FLOOR = 2.0
TRAY_RAIL = 8.0           # ancho de los rieles laterales (la placa apoya 3,3 mm sobre cada riel)
TRAY_END = 6.6            # zona libre en los extremos (postes, bridas, antena, USB)

def tray_dims():
    px, py, pt = C.PERFBOARD
    W = px + 2 * (TRAY_RAIL - 3.3)
    Lg = py + 2 * TRAY_END + 0.6
    z_board = TRAY_FLOOR + C.PERF_UNDER
    return W, Lg, z_board, (TRAY_RAIL - 3.3, TRAY_END + 0.3)   # ancho, largo, cara inferior de la placa, esquina de la placa

def tray_post_xy():
    W, Lg, _, _ = tray_dims()
    return [(4.0, 3.3), (W - 4.0, 3.3), (4.0, Lg - 3.3), (W - 4.0, Lg - 3.3)]

def tray_base_holes():
    W, Lg, _, _ = tray_dims()
    return [(18.0, 22.0), (W - 18.0, 22.0), (18.0, Lg - 22.0), (W - 18.0, Lg - 22.0)]

def electronics_tray() -> Part:
    W, Lg, zb, (bx, by) = tray_dims()
    px, py, pt = C.PERFBOARD
    p = box(0, W, 0, Lg, 0, TRAY_FLOOR)
    for x0 in (0, W - TRAY_RAIL):
        p += box(x0, x0 + TRAY_RAIL, 0, Lg, 0, zb)                              # rieles (apoyo de la placa)
    p += box(0, bx - 0.3, 0, Lg, zb, zb + pt)                                    # labios de ubicación (alto = placa)
    p += box(bx + px + 0.3, W, 0, Lg, zb, zb + pt)
    for y0, y1 in ((0, by - 0.3), (by + py + 0.3, Lg)):                          # postes de los extremos
        for x0, x1 in ((0, TRAY_RAIL), (W - TRAY_RAIL, W)):
            p += box(x0, x1, y0, y1, zb, zb + pt)
    for x, y in tray_post_xy():
        p -= cyl_z(C.M3_INSERT_D / 2, zb + pt - C.M3_INSERT_L - 1.0, zb + pt + 1, x, y)
    for x, y in tray_base_holes():                                               # fijación a la base (insertos en la base)
        p -= cyl_z(C.M3_CLEAR / 2, -1, TRAY_FLOOR + 1, x, y)
    # puentes para bridas (alivio de tensión) en los extremos, fuera del área de la placa y lejos de la antena
    for x, y in ((14.0, 3.3), (W - 14.0, 3.3), (24.0, Lg - 3.3), (W - 24.0, Lg - 3.3)):
        p += box(x - 4, x + 4, y - 2.5, y + 2.5, TRAY_FLOOR, TRAY_FLOOR + 4.0)
        p -= box(x - 5, x + 5, y - 2.0, y + 2.0, TRAY_FLOOR + 0.8, TRAY_FLOOR + 2.6)
    p -= engrave_text('ANTENA', 3.0, W / 2, 2.2, TRAY_FLOOR, 0.4)
    p -= engrave_text('USB', 3.0, W / 2, Lg - 2.2, TRAY_FLOOR, 0.4)
    return p

def tray_clamp() -> Part:
    """Barra de sujeción de un borde largo de la placa (aprieta sobre el riel; la placa no se flexiona)."""
    W, Lg, zb, (bx, by) = tray_dims()
    pt = C.PERFBOARD[2]
    z0 = zb + pt
    p = box(0, TRAY_RAIL, 0, Lg, z0, z0 + 3.0)
    p -= box(-1, bx - 0.3, -1, Lg + 1, z0 - 1, z0 + 0.3)      # alivio de 0,3 mm: la barra solo apoya sobre la placa
    for x, y in tray_post_xy()[::2]:
        p -= cyl_z(C.M3_CLEAR / 2, z0 - 1, z0 + 5, x, y)
    p -= engrave_text(f'{C.PROJECT} {C.REVISION}', 2.6, TRAY_RAIL / 2, Lg / 2, z0 + 3.0, 0.4, 90)
    return p

# ───────────────────────────── soporte independiente del micrófono (MEMS_Stand) ─────────────────────────────
# marco: origen en la base (z = 0 en la cara superior), +x hacia el eje de la válvula. El micrófono queda en x = 0.
STAND_POST = 12.0
STAND_PIVOT_X = 0.0              # el pivote queda bajo el micrófono (la inclinación no cambia la distancia horizontal)
STAND_PIVOT_DZ = (C.MEMS_BOARD[1] + 4.4) / 2 + 6.5   # centro del micrófono sobre el pivote
STAND_INSERTS = ((-12.0, -11.0), (-12.0, 11.0))   # insertos M3 en la base (x, y local), a los costados del poste

def stand_heights():
    """Altura del pivote y del centro del micrófono (global), apuntando al plano de las bisagras."""
    import assembly as A
    z_mic = A.Z_RING + C.RING_H + 15.0
    z_aim = A.Z_RING + C.Z_HINGE
    tilt = math.degrees(math.atan2(z_mic - z_aim, C.MEMS_STAND_R))
    return z_mic - C.BASE_T - STAND_PIVOT_DZ, tilt     # altura del pivote sobre la base, inclinación

def mems_stand() -> Part:
    zpiv, _ = stand_heights()
    p = box(-34.0, 10.0, -16.0, 16.0, 0, 4.0)
    for x, y in STAND_INSERTS:                                     # ranuras radiales a los costados del poste (±8 mm)
        p -= box(x - 8.0, x + 8.0, y - C.M3_CLEAR / 2, y + C.M3_CLEAR / 2, -1, 5)
        p -= cyl_z(C.M3_CLEAR / 2, -1, 5, x - 8.0, y) + cyl_z(C.M3_CLEAR / 2, -1, 5, x + 8.0, y)
    px0 = STAND_PIVOT_X - 6.0 - STAND_POST
    p += box(px0, px0 + STAND_POST, -STAND_POST / 2, STAND_POST / 2, 1.0, zpiv - 3.5)
    # cartelas (rigidez del poste; ver frecuencia estimada en la documentación)
    p += prism_xz(SPoly([(px0 - 12, 3.5), (px0 + 1.0, 3.5), (px0 + 1.0, 27), (px0, 27)]), -1.5, 1.5)
    p += prism_xz(SPoly([(px0 + STAND_POST - 1.0, 3.5), (px0 + STAND_POST + 9, 3.5), (px0 + STAND_POST, 22), (px0 + STAND_POST - 1.0, 22)]), -1.5, 1.5)
    # horquilla del pivote (M3 horizontal + tuerca autoblocante: fricción regulable)
    for y0, y1 in ((2.6, 5.6), (-5.6, -2.6)):
        p += box(px0 + 1.0, STAND_PIVOT_X + 3.7, y0, y1, zpiv - 4.0, zpiv + 3.5)
    p -= cyl_y(C.M3_CLEAR / 2, -10, 10, STAND_PIVOT_X, zpiv)
    p -= engrave_text('M1', 4.0, 4.0, 0, 4.0, 0.4, 90)
    return p

def stand_holder() -> Part:
    """Portaplaca del INMP441 para el soporte independiente (sin inclinar; pivote en x = STAND_PIVOT_X, z = 0)."""
    bw, bh, bt = C.MEMS_BOARD
    fw, fh, ft = bw + 4.4, bh + 4.4, 4.2
    holder = box(-ft / 2, ft / 2, -fw / 2, fw / 2, -fh / 2, fh / 2)
    holder -= box(-(bt + 0.4) / 2, (bt + 0.4) / 2, -(bw + 0.5) / 2, (bw + 0.5) / 2, -(bh + 0.5) / 2, fh)
    holder -= box(-ft, ft, -(bw - 3.0) / 2, (bw - 3.0) / 2, -(bh - 3.0) / 2, (bh - 3.0) / 2)
    holder -= box(-ft, ft, -3.0, 3.0, (bh - 3.0) / 2 - 0.1, fh)
    zp = -STAND_PIVOT_DZ
    tongue = box(-2.0, 2.0, -2.4, 2.4, zp, -fh / 2 + 1.0) + cyl_y(3.5, -2.4, 2.4, 0, zp)
    tongue -= cyl_y(C.M3_CLEAR / 2, -5, 5, 0, zp)
    return holder + tongue

# ───────────────────────────── pinza de cables para columna ─────────────────────────────
# marco: eje de la columna en el origen; abertura hacia −x (lado del plato), soporte del cable hacia +x

def cable_clip() -> Part:
    ring = SPoly(Point(0, 0).buffer(C.COLUMN_D / 2 + 1.9, 64).exterior.coords, [Point(0, 0).buffer(C.COLUMN_D / 2 + 0.1, 64).exterior.coords])
    ring = ring.difference(box2d(-20, -3.4, 0, 3.4))          # abertura de 6,8 mm: se calza a presión sobre Ø8
    p = prism_xy(ring, 0, 6.0)
    p += box(C.COLUMN_D / 2 + 1.0, C.COLUMN_D / 2 + 8.0, -4.0, 4.0, 0, 6.0)
    p -= box(C.COLUMN_D / 2 + 3.0, C.COLUMN_D / 2 + 4.6, -5.0, 5.0, 0.8, 5.2)      # túnel de la brida
    return p

def box2d(x0, y0, x1, y1):
    return SPoly([(x0, y0), (x1, y0), (x1, y1), (x0, y1)])

# ───────────────────────────── escala angular (alternativa A) ─────────────────────────────

def angle_scale(center_h: float) -> Part:
    """Transportador vertical 0–90° para filmar la valva 1 de perfil. Marco: plano y–z, x = espesor."""
    w, t = 70.0, 2.0
    H = center_h + 20
    p = box(0, t, -w / 2, w / 2, -C.BASE_T + 0.4, H)          # la pestaña inferior entra en la ranura de la base
    cy, cz = 0.0, center_h
    for k in range(0, 91, 5):
        a = k * D2R
        L = 14 if k % 30 == 0 else (9 if k % 10 == 0 else 5)
        r0 = 26
        # el ángulo de apertura se mide desde la horizontal hacia arriba, girando hacia el centro (−y)
        p0 = (cy - r0 * math.cos(a), cz + r0 * math.sin(a))
        p1 = (cy - (r0 + L) * math.cos(a), cz + (r0 + L) * math.sin(a))
        groove = stadium(p0, p1, 0.35, 0.35, 8)
        p -= Pos(t - 0.5, 0, 0) * prism_yz(groove, 0, 1.0)
    p -= cyl_x(1.0, -1, t + 1, cy, cz)
    return p

# ───────────────────────────── base ─────────────────────────────

def base(col_xy, servo_holes, tray_xy, scale_xy, stand_pts, zip_pts, labels) -> Part:
    """insertos M3 para servo, bandeja y soporte del micrófono; ranuras para bridas a lo largo de los cables."""
    T = C.BASE_T
    p = box(0, C.BASE_X, 0, C.BASE_Y, 0, T)
    for x, y in col_xy:
        p -= cyl_z(C.M3_CLEAR / 2, -1, T + 1, x, y)
        p -= cyl_z(C.M3_HEAD_D / 2, -1, C.M3_HEAD_H, x, y)
    for x, y in list(servo_holes) + list(stand_pts) + [(tray_xy[0] + hx, tray_xy[1] + hy) for hx, hy in tray_base_holes()]:
        p -= cyl_z(C.M3_INSERT_D / 2, T - C.M3_INSERT_L - 0.3, T + 1, x, y)     # inserto desde arriba
        p -= cyl_z(C.M3_CLEAR / 2 + 0.2, -1, T, x, y)                             # salida de la punta del tornillo
    sx, sy = scale_xy
    p -= box(sx - 0.15, sx + 2.15, sy - 35.3, sy + 35.3, 0.4, T + 1)                 # ranura del transportador
    for x, y in ((12, 12), (C.BASE_X - 12, 12), (12, C.BASE_Y - 12), (C.BASE_X - 12, C.BASE_Y - 12)):
        p -= cyl_z(5.5, -1, 1.0, x, y)                                                # patas de goma adhesivas Ø10
    for x, y, ang in zip_pts:                                                         # pares de ranuras para bridas
        for d in (-4.0, 4.0):
            cx, cy = x + d * math.cos(ang * D2R), y + d * math.sin(ang * D2R)
            p -= rz_at(box(-1.0, 1.0, -2.0, 2.0, -1, T + 1), ang, cx, cy)
    for txt, size, x, y, rot in labels:
        p -= engrave_text(txt, size, x, y, T, 0.4, rot)
    p -= engrave_text(f'{C.PROJECT} {C.REVISION}', 7, 52, 172, T, 0.6)
    p -= engrave_text('Prototipo académico experimental · no implantable', 3.2, 52, 164, T, 0.4)
    return p

def rz_at(part, deg, x, y):
    return Pos(x, y, 0) * Rot(Z=deg) * part

# ───────────────────────────── muestra de calibración ─────────────────────────────

COUPON_ROWS = [
    ('Eje Ø2 libre', (2.0, 2.1, 2.2, 2.3, 2.4, 2.5), None),
    ('Eje Ø2 a presión', (1.80, 1.85, 1.90, 1.95, 2.00, 2.05), None),
    ('Pilotos M2/M3', (1.6, 1.7, 1.8, 1.9, 2.4, 2.6), 5.0),
    ('Insertos M2 / M3', (3.1, 3.2, 3.3, 4.0, 4.1, 4.2), 6.0),
    ('Imán Ø4×2 (alojamiento)', (4.05, 4.10, 4.15, 4.20, 4.25, 4.30), 2.2),
]

def tolerance_coupon() -> Part:
    """Probeta: 5 filas × 6 agujeros. Fila k a y = 5 + 9·k. Diámetros grabados en la documentación."""
    n = len(COUPON_ROWS)
    p = box(0, 66, 0, 9 * n + 1, 0, 6.5)
    for r, (_, ds, depth) in enumerate(COUPON_ROWS):
        y = 5 + 9 * r
        for k, d in enumerate(ds):
            z0 = -1 if depth is None else 6.5 - depth
            p -= cyl_z(d / 2, z0, 8, 6 + 10.8 * k, y)
        p -= engrave_text(str(r + 1), 2.6, 1.7, y, 6.5, 0.4)
    return p

# ───────────────────────────── modelos de REFERENCIA (no imprimir) ─────────────────────────────

def ref_pin(length=58.0):
    return cyl_y(C.PIN_D / 2, -length / 2, length / 2, C.HINGE_D, C.Z_HINGE)

def ref_servo(zs: float) -> Part:
    L = servo_layout(zs)
    yh = L['y_of_h']
    xc = L['body_cx']
    body = box(xc - S.L / 2, xc + S.L / 2, yh(S.H), yh(0), zs - S.W / 2, zs + S.W / 2)
    tabs = box(xc - S.tab_span / 2, xc + S.tab_span / 2, yh(S.tab_h + S.tab_t), yh(S.tab_h), zs - S.W / 2, zs + S.W / 2)
    gear = cyl_y(S.W / 2, yh(S.H + S.gear_top), yh(S.H), L['shaft_x'], zs)
    shaft = cyl_y(2.4, yh(S.H + S.gear_top + S.shaft_h), yh(S.H + S.gear_top), L['shaft_x'], zs)
    p = body + tabs + gear + shaft
    for s in (-1, 1):
        p -= cyl_y(S.tab_hole_d / 2, yh(S.tab_h + S.tab_t) - 1, yh(S.tab_h) + 1, xc + s * S.tab_hole_spacing / 2, zs)
    return p

def ref_horn() -> Part:
    """Horn de un brazo (referencia). Marco: eje del servo = −y; brazo hacia +x; plano y ∈ [0, horn_t]."""
    prof = stadium((0, 0), (S.horn_r + 2.5, 0), 3.4, 2.2)
    p = prism_xz(prof, 0, S.horn_t)
    p -= cyl_y(0.8, -1, S.horn_t + 1, S.horn_r, 0)
    return p

def ref_esp32() -> Part:
    bl, bw, bt = C.ESP32_BOARD
    p = box(-bl / 2, bl / 2, -bw / 2, bw / 2, 0, bt)
    p += box(bl / 2 - 25, bl / 2 - 7, -9, 9, bt, bt + 3.2)      # módulo WROOM (aprox.)
    p += box(-bl / 2 - 1, -bl / 2 + 6, -4, 4, bt, bt + 3)       # USB
    for s in (-1, 1):
        p += box(-bl / 2 + 4, bl / 2 - 4, s * (bw / 2 - 1.3) - 0.3, s * (bw / 2 - 1.3) + 0.3, -8.5, 0)
    return p

def ref_mems_board() -> Part:
    bw, bh, bt = C.MEMS_BOARD
    return box(-bt / 2, bt / 2, -bw / 2, bw / 2, -bh / 2, bh / 2)

def ref_magnet_leaf() -> Part:
    """Imán Ø4×2 en la cola (marco de la valva)."""
    mx, mz = tail_point(C.MAG_LEAF_S)
    return cyl_y(C.MAG_LEAF[0] / 2, C.TAIL_Y[0], C.TAIL_Y[0] + C.MAG_LEAF[1], mx, mz)

def ref_tail_pin() -> Part:
    """Pasador de latón Ø2 × 9 cola–biela (marco de la valva)."""
    _, tend = tail_profile()
    return cyl_y(C.PIN_D / 2, C.TAIL_Y[0], C.TAIL_Y[0] + C.TAIL_PIN_LEN, *tend)

def ref_hall_ring() -> Part:
    """Sensor Hall TO-92 en su portasensor (variante 0), patas hacia arriba (marco de la valva)."""
    hx, hy, hz = C.HALL_XYZ
    bt, bw, bh = C.TO92_BODY
    body = box(hx - bt / 2, hx + bt / 2, hy - bw / 2, hy + bw / 2, hz - bh / 2, hz + bh / 2)
    for k in (-1, 0, 1):
        body += box(hx - 0.2, hx + 0.2, hy + 1.27 * k - 0.2, hy + 1.27 * k + 0.2, hz + bh / 2, C.RING_H + C.CARRIER_FLANGE_T - 0.6)
    return body


def _screw_y(x, z, y_head, y_tip, nut_y0=None, d=2.0, head_d=3.8, head_h=2.0, af=4.0, nut_t=1.6):
    """Tornillo a lo largo de y con cabeza del lado de y_head; tuerca hexagonal opcional."""
    sgn = 1 if y_tip > y_head else -1
    p = cyl_y(d / 2 * 0.92, min(y_head, y_tip), max(y_head, y_tip), x, z)
    p += cyl_y(head_d / 2, min(y_head, y_head - sgn * head_h), max(y_head, y_head - sgn * head_h), x, z)
    if nut_y0 is not None:
        hexp = hexagon((x, z), af / math.sqrt(3))
        p += prism_xz(hexp, min(nut_y0, nut_y0 + sgn * nut_t), max(nut_y0, nut_y0 + sgn * nut_t))
    return p

def ref_plate_fasteners() -> Part:
    """M2×10 + tuerca en cada orejeta (biela–plato) y M2×14 + tuerca en la horquilla (marco del plato)."""
    out = None
    for i in range(C.N_LEAF):
        s_ = _screw_y(C.LINK_PIN_X, C.PLATE_TAB_PIN_Z, C.TAB_Y[0], C.TAB_Y[0] + 10.0, C.LINK_Y[1])
        s_ = leaf_frame(s_, i)
        out = s_ if out is None else out + s_
    out += _screw_y(0.0, C.CLEVIS_PIN_Z, -4.4, -4.4 + 14.0, 4.4)
    return out

def ref_ring_fasteners() -> Part:
    """Tornillos de latón M2×20 de los topes + tuercas atrapadas; M3×30 de las comisuras (marco del anillo)."""
    out = None
    sx, sy = STOP_SCREW
    z_head = C.RING_H - 1.6
    for i in range(C.N_LEAF):
        st = cyl_z(0.92, z_head - 20.0, z_head, sx, sy) + cyl_z(1.9, z_head, z_head + 1.6, sx, sy)
        st += prism_xy(hexagon(STOP_SCREW, C.M2_NUT_AF / math.sqrt(3)), -2.5, -2.5 + C.M2_NUT_T)
        st = leaf_frame(st, i)
        a = (K.leaf_dir(i) + 60) * D2R
        cx, cy = C.COLUMN_R * math.cos(a), C.COLUMN_R * math.sin(a)
        ztop = C.RING_H + C.POST_H - C.M3_HEAD_H - 0.6
        st += cyl_z(1.38, ztop - 30.0, ztop, cx, cy) + cyl_z(2.75, ztop, ztop + 3.0, cx, cy)
        out = st if out is None else out + st
    return out

def ref_perfboard() -> Part:
    """Placa perforada 70×90 + zócalos hembra + ESP32 de referencia (marco de la bandeja)."""
    W, Lg, zb, (bx, by) = tray_dims()
    px, py, pt = C.PERFBOARD
    p = box(bx, bx + px, by, by + py, zb, zb + pt)
    bl, bw, bt = C.ESP32_BOARD
    ex, ey = bx + px / 2, by - 6.0 + bl / 2            # antena 6 mm fuera del borde −y de la placa perforada
    hz = zb + pt
    for s_ in (-1, 1):
        p += box(ex + s_ * C.ESP32_ROW_PITCH / 2 - 1.27, ex + s_ * C.ESP32_ROW_PITCH / 2 + 1.27, ey - 1.27 * C.ESP32_PINS_PER_ROW,
                 ey + 1.27 * C.ESP32_PINS_PER_ROW, hz, hz + 8.5)
    e = Pos(ex, ey, hz + 8.5) * Rot(Z=-90) * ref_esp32()
    return p + e

def ref_cable(points, r=1.5) -> Part:
    """Haz de cables (referencia) como cadena de cilindros + esferas por los puntos dados (marco global)."""
    from build123d import Sphere
    out = None
    for a, b in zip(points[:-1], points[1:]):
        a, b = np.array(a, float), np.array(b, float)
        L = float(np.linalg.norm(b - a))
        if L < 1e-6:
            continue
        d = (b - a) / L
        yaw = math.degrees(math.atan2(d[1], d[0]))
        pitch = math.degrees(math.acos(max(-1.0, min(1.0, d[2]))))
        seg = Pos(*a) * Rot(Z=yaw) * Rot(Y=pitch) * Cylinder(r, L, align=(Align.CENTER, Align.CENTER, Align.MIN))
        out = seg if out is None else out + seg
    for q in points[1:-1]:
        out += Pos(*q) * Sphere(r)
    return out

def ref_cable_all() -> Part:
    import assembly as A
    out = None
    for name, pts in A.cable_routes().items():
        c = ref_cable(pts, A.CABLE_R[name])
        out = c if out is None else out + c
    return out

def ref_screw(length: float, d=2.0, head_d=3.8, head_h=1.6) -> Part:
    """Tornillo genérico. Marco: eje +z, cabeza bajo z = 0, caña en z ∈ [0, length]."""
    return cyl_z(d / 2 * 0.92, 0, length, 0, 0) + cyl_z(head_d / 2, -head_h, 0, 0, 0)
