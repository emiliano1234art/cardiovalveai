"""
Piezas de CardioVal AI (build123d / OpenCascade).

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

def pad_frame(part, i):
    return rz(part, K.leaf_dir(i) + C.PAD_ANGLE_OFFSET)

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

def leaflet(idx: int) -> Part:
    d, zh = C.HINGE_D, C.Z_HINGE
    plate = prism_xy(leaflet_outline(), PLATE_Z0, PLATE_Z1)
    barrel = cyl_y(C.BARREL_R, -C.BARREL_HALF, C.BARREL_HALF, d, zh)
    tprof, tend = tail_profile()
    tail = prism_xz(tprof, *C.TAIL_Y)
    p = plate + barrel + tail
    # eje Ø2 (agujero de giro) y pasador de la biela (tornillo M2 autorroscante)
    p -= cyl_y(C.PIN_HOLE_LEAF / 2, -20, 20, d, zh)
    p -= cyl_y(C.M2_PILOT / 2, C.TAIL_Y[0] - 1, C.TAIL_Y[1] + 1, *tend)
    # agujero para el elástico de los módulos alterados y alojamiento de imán (opción Hall)
    ex, ez = tail_point(2.8)
    p -= cyl_y(0.75, C.TAIL_Y[0] - 1, C.TAIL_Y[1] + 1, ex, ez)
    mx, mz = tail_point(5.35)
    p -= cyl_y(1.6, C.TAIL_Y[0] - 0.1, C.TAIL_Y[0] + 0.8, mx, mz)
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
        pad = box(RX - 2.5, C.PAD_FACE_R, -C.PAD_W / 2, C.PAD_W / 2, 0, C.PAD_H)
        r += pad_frame(pad, i)
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
        # almohadillas: 2 pilotos M2 horizontales
        for s in (-1, 1):
            r -= pad_frame(cyl_x(C.M2_PILOT / 2, C.PAD_FACE_R - 6.0, C.PAD_FACE_R + 1, s * C.PAD_SCREW_SPACING / 2, C.PAD_H / 2), i)
        # tope: tornillo M2 pasante desde la cara superior (se cambia sin desarmar)
        r -= leaf_frame(cyl_z(C.M2_CLEAR / 2, -1, 40, *STOP_SCREW), i)
        r -= leaf_frame(cyl_z(2.1, C.RING_H - 1.6, 40, *STOP_SCREW), i)
        # bolsillo reservado para sensor Hall (opción B), abierto arriba
        r -= leaf_frame(box(25.8, 29.5, -8.8, -6.3, 8.0, 40), i)
        # marca fiduciaria y número de valva grabados en la cara superior
        fa = (K.leaf_dir(i) - 34) * D2R
        r -= cyl_z(0.75, C.RING_H - 0.5, C.RING_H + 1, 30.5 * math.cos(fa), 30.5 * math.sin(fa))
        na = (K.leaf_dir(i) + 22) * D2R
        r -= engrave_text(str(i + 1), 4.5, 30.6 * math.cos(na), 30.6 * math.sin(na), C.RING_H, 0.5, K.leaf_dir(i) - 90)
    return r

STOP_SCREW = (29.5, -10.6)   # (x, y) en el marco de la valva

# ───────────────────────────── bielas ─────────────────────────────
# marco de la biela: agujero superior en el origen, eje hacia −z, espesor en y ∈ [0, LINK_T]

def link(L: float, lost_motion: bool) -> Part:
    ext = C.LM_SLOT if lost_motion else 0.0
    prof = stadium((0, 0), (0, -(L + ext)), C.LINK_W / 2)
    p = prism_xz(prof, 0, C.LINK_T)
    p -= cyl_y(C.M2_CLEAR / 2, -1, C.LINK_T + 1, 0, 0)
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
    p += box(x0, x1, -13.0, C.STOP_Y[1], -2.5, 0)
    p -= cyl_z(C.M2_PILOT / 2, -5, 5, *STOP_SCREW)
    p -= cyl_z(1.3, -5, 20, 24.0, -3.4)        # canal del elástico
    return p

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
    p = cyl_z(C.COLUMN_D / 2, 0, height, 0, 0)
    p -= cyl_z(C.M3_PILOT / 2, -1, 12, 0, 0)
    p -= cyl_z(C.M3_PILOT / 2, height - 12, height + 1, 0, 0)
    return p

# ───────────────────────────── soportes de sensores ─────────────────────────────
# marco de la almohadilla: x radial (cara en x = PAD_FACE_R), y tangencial, z del anillo

def piezo_mount() -> Part:
    x0 = C.PAD_FACE_R
    t = 4.0
    w = C.PAD_W + 2
    p = box(x0, x0 + t, -w / 2, w / 2, -6.0, C.PAD_H + 1.5)
    rec = C.PIEZO_D / 2 + 0.3
    zc = C.PAD_H / 2
    p -= cyl_x(rec, x0 + t - 0.8, x0 + t + 1, 0, zc)                      # asiento del disco (0,8 mm)
    p -= box(x0 + t - 1.2, x0 + t + 1, -1.2, 1.2, -7, zc - rec + 0.5)      # canal de cables
    p -= box(x0 - 1, x0 + t + 1, -5.5, -3.8, -4.6, -2.2)      # alivio de tensión: ranuras para brida
    p -= box(x0 - 1, x0 + t + 1, 3.8, 5.5, -4.6, -2.2)
    for s in (-1, 1):
        y = s * C.PAD_SCREW_SPACING / 2
        p -= cyl_x(C.M2_CLEAR / 2, x0 - 1, x0 + t + 1, y, zc)
        p -= cyl_x(2.1, x0 + t - 1.6, x0 + t + 1, y, zc)                    # cabeza M2 rebajada
    return p

def piezo_cover() -> Part:
    x0 = C.PAD_FACE_R + 4.0
    t = 3.4
    w = C.PAD_W + 2
    zc = C.PAD_H / 2
    p = box(x0, x0 + t, -w / 2, w / 2, -6.0, C.PAD_H + 1.5)
    p -= cyl_x(C.PIEZO_D / 2 + 1.2, x0 - 1, x0 + 1.8, 0, zc)               # cámara de protección (sin tocar el disco)
    p -= box(x0 - 1, x0 + 1.8, -1.6, 1.6, -7, zc)                          # salida de cables
    for s in (-1, 1):
        y = s * C.PAD_SCREW_SPACING / 2
        p -= cyl_x(C.M2_CLEAR / 2, x0 - 1, x0 + t + 1, y, zc)
        p -= cyl_x(2.1, x0 + t - 1.6, x0 + t + 1, y, zc)
    return p

def piezo_adapter_12() -> Part:
    x0 = C.PAD_FACE_R + 4.0 - 0.8
    p = cyl_x(C.PIEZO_D / 2 + 0.1, x0, x0 + 0.6, 0, C.PAD_H / 2)
    p -= cyl_x(6.2, x0 - 1, x0 + 2, 0, C.PAD_H / 2)
    return p

MEMS_TILT = 40.0   # inclinación del micrófono hacia el centro de la válvula

def mems_mount() -> Part:
    """Escuadra atornillada a una almohadilla del anillo, con portaplaca regulable."""
    x0 = C.PAD_FACE_R
    w = 14.0
    zc = C.PAD_H / 2
    back = box(x0, x0 + 3.5, -w / 2, w / 2, -2.0, 34.0)
    bridge = box(29.0, x0 + 3.5, -w / 2, w / 2, 30.5, 34.0)
    p = back + bridge
    # orejas de fijación con ranuras verticales (ajuste de altura ±3 mm) sobre los pilotos de la almohadilla
    ear = box(x0, x0 + 3.5, -C.PAD_W / 2 - 1, C.PAD_W / 2 + 1, zc - 4.5, zc + 4.5)
    p += ear
    for s in (-1, 1):
        y = s * C.PAD_SCREW_SPACING / 2
        p -= prism_xz_slot(y, x0, zc)
    # portaplaca: marco con ventana a ambos lados (puerto acústico libre, sea cual sea la cara)
    bw, bh, bt = C.MEMS_BOARD
    fw, fh, ft = bw + 4.4, bh + 4.4, 4.2
    holder = box(-ft / 2, ft / 2, -fw / 2, fw / 2, -fh / 2, fh / 2)
    holder -= box(-(bt + 0.4) / 2, (bt + 0.4) / 2, -(bw + 0.5) / 2, (bw + 0.5) / 2, -(bh + 0.5) / 2, fh)   # ranura de inserción desde arriba
    holder -= box(-ft, ft, -(bw - 3.0) / 2, (bw - 3.0) / 2, -(bh - 3.0) / 2, (bh - 3.0) / 2)         # ventanas
    holder -= box(-ft, ft, -3.0, 3.0, (bh - 3.0) / 2 - 0.1, fh)                                     # salida de pines/cables
    holder = Pos(30.5, 0, 30.5 - fh / 2 * math.cos(MEMS_TILT * D2R) - 1.5) * Rot(Y=-MEMS_TILT) * holder
    hanger = box(28.0, 33.5, -fw / 2, fw / 2, 26.0, 31.0)
    p += holder + hanger
    return p

def prism_xz_slot(y, x0, zc):
    """Ranura vertical (regulación ±3 mm) para tornillo M2 en la escuadra del MEMS."""
    return cyl_x(C.M2_CLEAR / 2, x0 - 1, x0 + 5, y, zc - 3) + cyl_x(C.M2_CLEAR / 2, x0 - 1, x0 + 5, y, zc + 3) + box(x0 - 1, x0 + 5, y - C.M2_CLEAR / 2, y + C.M2_CLEAR / 2, zc - 3, zc + 3)

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
    foot = box(xc - half, xc + half, y_face - 8, y_back + 22, zb, zb + 3.0)
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

def esp32_mount() -> Part:
    bl, bw, _ = C.ESP32_BOARD
    wall = 2.0
    il, iw = bl + 0.8, bw + 0.8
    h = C.ESP32_PIN_DEPTH + 2.0
    p = box(-il / 2 - wall, il / 2 + wall, -iw / 2 - wall, iw / 2 + wall, 0, h + 2.0)
    p -= box(-il / 2, il / 2, -iw / 2, iw / 2, 2.0, h + 5)                         # cavidad para pines y Dupont
    for s in (-1, 1):                                                              # repisas en los extremos (la placa apoya sin pines)
        p += box(s * il / 2 - (3.0 if s > 0 else 0), s * il / 2 + (0 if s > 0 else 3.0), -iw / 2, iw / 2, 2.0, h)
    p -= box(il / 2 - 1, il / 2 + wall + 1, -6.5, 6.5, h - 6, h + 5)               # USB
    p -= box(-il / 2 + 8, il / 2 - 8, -iw / 2 - wall - 1, -iw / 2 + 0.1, 5.0, h - 2)   # ventanas laterales para cables
    p -= box(-il / 2 + 8, il / 2 - 8, iw / 2 - 0.1, iw / 2 + wall + 1, 5.0, h - 2)
    for s in (-1, 1):
        p += cyl_z(4.0, 0, 8.0, s * 16.0, 0)
        p -= cyl_z(C.M3_PILOT / 2, -1, 7.5, s * 16.0, 0)
    p -= box(-6, 6, -iw / 2 - wall - 1, -iw / 2 + 0.1, 2.0, 4.0)                  # paso de brida bajo la placa (retención)
    return p

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

def base(col_xy: list[tuple[float, float]], servo_holes: list[tuple[float, float]], esp_xy: tuple[float, float], scale_xy: tuple[float, float]) -> Part:
    T = C.BASE_T
    p = box(0, C.BASE_X, 0, C.BASE_Y, 0, T)
    for x, y in col_xy:
        p -= cyl_z(C.M3_CLEAR / 2, -1, T + 1, x, y)
        p -= cyl_z(C.M3_HEAD_D / 2, -1, C.M3_HEAD_H, x, y)
    for x, y in servo_holes:
        p -= cyl_z(C.M3_PILOT / 2, -1, T + 1, x, y)
    ex, ey = esp_xy
    for s in (-1, 1):
        p -= cyl_z(C.M3_CLEAR / 2, -1, T + 1, ex + s * 16.0, ey)
        p -= cyl_z(C.M3_HEAD_D / 2, -1, C.M3_HEAD_H, ex + s * 16.0, ey)
    sx, sy = scale_xy
    p -= box(sx - 0.15, sx + 2.15, sy - 35.3, sy + 35.3, 0.4, T + 1)                 # ranura del transportador
    for x, y in ((12, 12), (C.BASE_X - 12, 12), (12, C.BASE_Y - 12), (C.BASE_X - 12, C.BASE_Y - 12)):
        p -= cyl_z(5.5, -1, 1.0, x, y)                                                # patas de goma adhesivas Ø10
    # pares de ranuras para bridas (canal de cables) entre válvula, servo y ESP32
    for x, y in ((128, 92), (128, 120), (150, 70), (110, 150), (40, 40)):
        for dx in (-4.0, 4.0):
            p -= box(x + dx - 1.0, x + dx + 1.0, y - 2.0, y + 2.0, -1, T + 1)
    p -= engrave_text(C.PROJECT, 8, 150, 24, T, 0.6)
    p -= engrave_text('Prototipo académico experimental · no implantable', 3.2, 150, 13, T, 0.4)
    return p

# ───────────────────────────── muestra de calibración ─────────────────────────────

def tolerance_coupon() -> Part:
    p = box(0, 60, 0, 14, 0, 6)
    for k, d in enumerate((2.0, 2.1, 2.2, 2.3, 2.4, 2.5)):
        p -= cyl_z(d / 2, -1, 7, 5 + 9.5 * k, 4.5)
    for k, d in enumerate((1.6, 1.7, 1.8, 1.9, 2.4, 2.6)):
        p -= cyl_z(d / 2, 1.0, 7, 5 + 9.5 * k, 10.5)
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

def ref_piezo() -> Part:
    x0 = C.PAD_FACE_R + 4.0 - 0.8
    return cyl_x(C.PIEZO_D / 2, x0, x0 + C.PIEZO_T, 0, C.PAD_H / 2) + cyl_x(6.0, x0 + C.PIEZO_T, x0 + C.PIEZO_T + 0.25, 0, C.PAD_H / 2)

def ref_screw(length: float, d=2.0, head_d=3.8, head_h=1.6) -> Part:
    """Tornillo genérico. Marco: eje +z, cabeza bajo z = 0, caña en z ∈ [0, length]."""
    return cyl_z(d / 2 * 0.92, 0, length, 0, 0) + cyl_z(head_d / 2, -head_h, 0, 0, 0)
