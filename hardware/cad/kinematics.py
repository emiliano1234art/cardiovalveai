"""
Cinemática del mecanismo CardioVal AI (un servo → plato actuador → 3 bielas → 3 valvas).

Marco del ANILLO: origen en el centro de la cara inferior, z hacia arriba.
Marco LOCAL de la valva i: x = dirección radial ψ_i, y = tangencial (+90°), z = arriba.
La valva gira alrededor de un eje paralelo a y que pasa por (x=HINGE_D, z=Z_HINGE).
Sentido: θ>0 levanta la parte interior (apertura hacia la «aorta»).

Cadena por valva (mecanismo biela-manivela plano en el plano x–z local):
  plato (desliza en z) ─ pasador P(x_p, z_p) ─ biela L ─ pasador T(θ) en la cola.
Las tres cadenas comparten el plato, que solo traslada en z: los tres planos son
compatibles porque cada pasador del plato está fijo en el sólido del plato.
"""
from __future__ import annotations
import math
from dataclasses import dataclass
import config as C

D2R = math.pi / 180

def leaf_dir(i: int) -> float:
    """Dirección radial (grados) de la valva i."""
    return 90.0 + 120.0 * i

def tail_end(theta: float) -> tuple[float, float]:
    a = (C.TAIL_PHI0 - theta) * D2R
    return C.HINGE_D + C.TAIL_LT * math.cos(a), C.Z_HINGE + C.TAIL_LT * math.sin(a)

def rotate_leaf_point(x: float, z: float, theta: float) -> tuple[float, float]:
    """Punto (x,z) de la valva cerrada → posición con apertura θ."""
    c, s = math.cos(theta * D2R), math.sin(theta * D2R)
    dx, dz = x - C.HINGE_D, z - C.Z_HINGE
    return C.HINGE_D + c * dx + s * dz, C.Z_HINGE - s * dx + c * dz

def zp_rigid(theta: float, L: float) -> float:
    tx, tz = tail_end(theta)
    return tz - math.sqrt(L * L - (tx - C.LINK_PIN_X) ** 2)

def theta_rigid(zp: float, L: float, lo=-30.0, hi=120.0) -> float:
    """Inversa de zp_rigid (monótona decreciente en el rango útil)."""
    f = lambda t: zp_rigid(t, L) - zp
    a, b = lo, hi
    fa = f(a)
    for _ in range(80):
        m = 0.5 * (a + b)
        fm = f(m)
        if (fm > 0) == (fa > 0):
            a, fa = m, fm
        else:
            b = m
    return 0.5 * (a + b)

# ───────────────────────────── módulos por valva ─────────────────────────────
@dataclass(frozen=True)
class Module:
    name: str
    kind: str          # 'rigid' | 'lostmotion'
    L: float           # longitud efectiva (agujero de cola → extremo superior de la ranura)
    stop: float        # ángulo del tope de apertura instalado
    label: str

Z_TOP = zp_rigid(0.0, C.LINK_L)                 # plato arriba = cerrado
Z_BOT = zp_rigid(C.THETA_NORMAL, C.LINK_L)      # plato abajo = 80°
STROKE = Z_TOP - Z_BOT

def _ic_length() -> float:
    """Biela corta: con el plato arriba la valva queda en IC_RESIDUAL."""
    tx, tz = tail_end(C.IC_RESIDUAL)
    return math.hypot(tx - C.LINK_PIN_X, tz - Z_TOP)

STOP_BACK = 84.0
MODULES = {
    'N': Module('N', 'rigid', C.LINK_L, STOP_BACK, 'Normal (80°)'),
    'R60': Module('R60', 'lostmotion', C.LINK_L, 60.0, 'Apertura restringida 60°'),
    'R45': Module('R45', 'lostmotion', C.LINK_L, 45.0, 'Apertura restringida 45°'),
    'IC': Module('IC', 'lostmotion', _ic_length(), STOP_BACK, f'Cierre incompleto ({C.IC_RESIDUAL:.0f}°)'),
}

MODES = {
    'NORMAL': ('N', 'N', 'N'),
    'RESTRINGIDA_60': ('R60', 'N', 'N'),
    'RESTRINGIDA_45': ('R45', 'N', 'N'),
    'CIERRE_INCOMPLETO': ('IC', 'N', 'N'),
    'ASIMETRICO': ('R60', 'R45', 'N'),
}

def leaflet_state(zp: float, m: Module) -> dict:
    """Ángulo de la valva, contacto con tope y recorrido usado en la ranura."""
    th = theta_rigid(zp, m.L)
    on_stop = False
    if m.kind == 'lostmotion' and th > m.stop:
        th, on_stop = m.stop, True
    if m.kind == 'rigid' and th > m.stop + 1e-6:
        raise RuntimeError(f'biela rígida empujaría contra el tope ({th:.1f}° > {m.stop}°)')
    tx, tz = tail_end(th)
    dist = math.hypot(tx - C.LINK_PIN_X, tz - zp)
    slot_used = dist - m.L if m.kind == 'lostmotion' else 0.0
    # ángulo de transmisión (entre biela y cola)
    a_tail = (C.TAIL_PHI0 - th) * D2R
    v_tail = (math.cos(a_tail), math.sin(a_tail))
    v_link = ((C.LINK_PIN_X - tx) / dist, (zp - tz) / dist)
    cosang = abs(v_tail[0] * v_link[0] + v_tail[1] * v_link[1])
    trans = 90.0 - math.degrees(math.acos(min(1.0, cosang))) if False else math.degrees(math.acos(min(1.0, cosang)))
    return {'theta': th, 'on_stop': on_stop, 'slot_used': slot_used, 'tail': (tx, tz), 'link_tilt': math.degrees(math.atan2(C.LINK_PIN_X - tx, tz - zp)), 'transmission': trans}

# ───────────────────────────── servo (biela-manivela vertical) ─────────────────────────────
CRANK_R = C.SERVO.horn_r                                       # radio del agujero del horn (dato medido)
if STROKE / (2 * CRANK_R) > math.sin(60 * D2R):
    raise ValueError(f'horn_r = {CRANK_R} mm es demasiado chico para la carrera {STROKE:.2f} mm (barrido > ±60°)')
SWEEP = math.degrees(math.asin(STROKE / (2 * CRANK_R)))        # ± grados de la palanca respecto de la horizontal
CRANK_XC = -CRANK_R * (1 + math.cos(SWEEP * D2R)) / 2   # centra el empujador
_qx = CRANK_XC + CRANK_R * math.cos(SWEEP * D2R)
# altura (marco del anillo) del eje del servo para que la horquilla quede en Z_TOP con β=+sweep
CLEVIS_OFFSET = C.CLEVIS_PIN_Z - C.PLATE_TAB_PIN_Z               # horquilla respecto del pasador de orejeta
SHAFT_Z = (Z_TOP + CLEVIS_OFFSET) - CRANK_R * math.sin(SWEEP * D2R) - math.sqrt(C.PUSHROD_L ** 2 - _qx ** 2)

def crank(beta: float) -> tuple[float, float]:
    b = beta * D2R
    return CRANK_XC + CRANK_R * math.cos(b), SHAFT_Z + CRANK_R * math.sin(b)

def zp_from_servo(beta: float) -> float:
    qx, qz = crank(beta)
    return qz + math.sqrt(C.PUSHROD_L ** 2 - qx ** 2) - CLEVIS_OFFSET

def servo_from_zp(zp: float) -> float:
    a, b = -SWEEP - 10, SWEEP + 10
    for _ in range(80):
        m = 0.5 * (a + b)
        if zp_from_servo(m) < zp:
            a = m
        else:
            b = m
    return 0.5 * (a + b)

def servo_command(beta: float) -> float:
    """Ángulo de comando estándar del servo (0–180) para la palanca β (90 = horizontal)."""
    return 90.0 + beta

def pose(beta: float, mode: str = 'NORMAL') -> dict:
    zp = zp_from_servo(beta)
    mods = [MODULES[k] for k in MODES[mode]]
    return {'beta': beta, 'zp': zp, 'crank': crank(beta), 'leaves': [leaflet_state(zp, m) for m in mods], 'modules': mods}

if __name__ == '__main__':
    print(f'Carrera del plato: {STROKE:.3f} mm (Z_TOP {Z_TOP:.2f}, Z_BOT {Z_BOT:.2f})')
    print(f'Radio de palanca del servo: {CRANK_R:.3f} mm · centro x={CRANK_XC:.2f} · eje z(anillo)={SHAFT_Z:.2f}')
    print(f'Biela IC: L={MODULES["IC"].L:.3f} (Δ={C.LINK_L - MODULES["IC"].L:.3f})')
    for mode in MODES:
        print('──', mode)
        mins = [1e9] * 3; maxs = [-1e9] * 3; slot = [0] * 3; trans = [1e9] * 3
        for k in range(0, 81):
            beta = SWEEP - 2 * SWEEP * k / 80
            p = pose(beta, mode)
            for i, s in enumerate(p['leaves']):
                mins[i] = min(mins[i], s['theta']); maxs[i] = max(maxs[i], s['theta'])
                slot[i] = max(slot[i], s['slot_used']); trans[i] = min(trans[i], s['transmission'])
        for i in range(3):
            print(f'  valva {i+1}: θ {mins[i]:6.2f} → {maxs[i]:6.2f}°  ranura usada {slot[i]:.2f}/{C.LM_SLOT} mm  ángulo transmisión mín {trans[i]:.1f}°')
