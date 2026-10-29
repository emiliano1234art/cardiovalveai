"""
Cinemática de CardioValveAI v4: servo → manivela → yugo escocés → pistón → corredera en la cola → valva.

  β = 90° − comando del servo (β > 0: el pasador de la manivela sube). El horn se monta con el pasador ABAJO en el comando 180°
  (β = −90°): cerrada = comando 130°, abierta = comando 50°, que son los valores por omisión del firmware v3.
  Pistón:  z_yugo(β) = Z_SERVO + CRANK_R·sin β          (desplazamiento vertical puro)
  Pasador de la horquilla: Δz = z_pasador − z_bisagra = CRANK_R·sin β, a TAIL_A hacia adentro del eje de bisagra.
  Valva:   θ(β) = TAIL_PSI0 + atan(CRANK_R·sin β / TAIL_A)      (la cola apunta hacia adentro y abajo TAIL_PSI0 − θ)
Con β = ±40° la valva va de 0° a 80°; con todo el recorrido del servo (±90°) va de THETA_MIN a THETA_MAX, sin topes.
"""
from __future__ import annotations
import math
import config4 as C

D2R = math.pi / 180


def piston_z(beta: float) -> float:
    return C.Z_SERVO + C.CRANK_R * math.sin(beta * D2R)


def theta(beta: float) -> float:
    return C.TAIL_PSI0 + math.degrees(math.atan(C.CRANK_R * math.sin(beta * D2R) / C.TAIL_A))


def beta_for_theta(th: float) -> float:
    s = C.TAIL_A * math.tan((th - C.TAIL_PSI0) * D2R) / C.CRANK_R
    return math.degrees(math.asin(max(-1.0, min(1.0, s))))


def tail_rho(beta: float) -> float:
    """Distancia eje de bisagra → pasador de la horquilla (posición del pasador en la ranura de la cola)."""
    return math.hypot(C.TAIL_A, C.CRANK_R * math.sin(beta * D2R))


def rho_range():
    return C.TAIL_A, math.hypot(C.TAIL_A, C.CRANK_R)


def transmission(beta: float) -> dict:
    """Cosenos de transmisión (1 = ideal, 0 = punto muerto) del yugo y de la corredera de la cola."""
    b = beta * D2R
    psi = math.atan(C.CRANK_R * math.sin(b) / C.TAIL_A)
    return {'yugo': abs(math.cos(b)), 'cola': math.cos(psi)}
