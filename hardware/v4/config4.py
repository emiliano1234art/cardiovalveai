"""
CardioValveAI v4 — PARÁMETROS ÚNICOS (mm, grados). Diseño simplificado.

Arquitectura (todo lo demás se deriva de aquí):
  · Cuerpo único (anillo + faldón + tabique del servo) impreso en una pieza.
  · 3 valvas con barril de bisagra y cola ranurada. Bisagra: pasador de LATÓN Ø3 a presión en la pared del cuerpo,
    la valva gira sobre él. El otro extremo del barril lleva el IMÁN, que gira sobre el eje de la bisagra.
  · El sensor Hall va en un portasensor que entra desde AFUERA por un túnel en la prolongación del eje de la bisagra.
  · Pistón central (disco + 3 brazos guiados en ranuras del cuerpo) con 3 horquillas: un pasador de latón Ø3 en cada horquilla
    corre por la ranura de la cola de su valva (corredera). Un yugo escocés (ranura horizontal) recibe el pasador de la manivela.
  · Servo MG90S acostado (eje horizontal), atornillado con SUS tornillos a un tabique del cuerpo, accesible por una ventana.
Única fijación comprada: varilla de latón Ø3. Además, los tornillos que vienen con el servo.

Marco global: z hacia arriba, z = 0 en la cara inferior del cuerpo (apoyo en la mesa), eje de la válvula en x = y = 0.
Marco de cada valva i: u radial hacia afuera (dirección LEAF_DIR[i]), v a lo largo del eje de bisagra, z hacia arriba.
"""
import math
from dataclasses import dataclass

PROJECT = "CardioValveAI"
REVISION = "v4"
PREFIX = f"{PROJECT}_{REVISION}"
OUT_DIR = f"out_{REVISION}"

# ───────────────────────────── impresión (PETG, boquilla 0,4) ─────────────────────────────
CLR_MOVE = 0.40          # holgura entre piezas móviles
CLR_SLIDE = 0.25         # holgura de deslizamiento (pistón en ranuras, portasensor en su túnel), por lado
PIN_D = 3.0              # varilla de latón Ø3 (ÚNICA fijación comprada)
PIN_FREE = 3.30          # agujero donde el latón GIRA o DESLIZA (barril, ranura de la cola, ranura del yugo)
PIN_PRESS = 2.95         # agujero donde el latón queda A PRESIÓN (pared del cuerpo, horquillas, manivela): VERIFICAR con la probeta
SERVO_PILOT = 1.8        # piloto para los tornillos autorroscantes que trae el servo (VERIFICAR con la probeta)

# ───────────────────────────── cuerpo ─────────────────────────────
OD = 90.0
ID = 72.0
RI, RO = ID / 2, OD / 2
TOP_ABOVE_HINGE = 5.0    # cara superior del cuerpo sobre el eje de las bisagras

# ───────────────────────────── valvas ─────────────────────────────
N_LEAF = 3
LEAF_DIR = (30.0, 150.0, 270.0)   # dirección (°) de cada valva; las comisuras quedan en 90°, 210° y 330°
D_HINGE = 28.0           # distancia del eje de la válvula a cada eje de bisagra (cuerda)
LEAF_T = 2.4             # espesor de la valva
BARREL_R = 3.0           # radio del barril (la cara superior de la valva es tangente al barril)
EDGE_GAP = 1.0           # separación total entre bordes de valvas vecinas al cerrar
WALL_CLR = 0.8           # holgura mínima valva–pared del cuerpo en todo el recorrido (incluye el espesor)
THETA_OPEN = 80.0        # apertura de trabajo
TAIL_PSI0 = 40.0         # la cola apunta hacia adentro y hacia abajo 40° con la valva cerrada (simétrica respecto de 40°)
TAIL_A = 6.5             # distancia horizontal eje de bisagra → pasador de la horquilla
TAIL_W = 7.3             # ancho de la cola (perpendicular a su eje)
TAIL_T = 5.0             # espesor de la cola (a lo largo de v)
LUG_GAP = 0.4            # holgura cola–horquilla por lado

# ───────────────────────────── accionamiento ─────────────────────────────
Z_SERVO = 23.0           # altura del eje del servo (el horn colgando hacia abajo no toca la mesa)
CRANK_R = 8.5            # radio del pasador de la manivela; con ±40° de servo → valvas 0…80°; con ±90° → −12,6…92,6°
LUG_H = 28.5             # altura del pasador de las horquillas sobre la ranura del yugo (marco del pistón)
WEB_DROP = 19.0          # el disco del pistón queda 19 mm sobre la ranura del yugo (el horn apuntando arriba pasa por debajo)
DISC_R = 24.0
DISC_T = 3.0
ARM_W = 4.0
SHOE = (2.2, 7.0, 9.0)   # zapata guía al final de cada brazo: radial (dentro de la ranura), tangencial, alto
WEB_T = 4.0
Y_SHAFT_TOP = -1.0       # cara superior del eje del servo (y global): el servo queda del lado −y
CRANK_T = 6.0            # el pasador va a presión en los 4 mm que quedan sobre el brazo del horn
SERVO_ANGLE_RANGE = (-90.0, 90.0)     # β = 90° − comando (horn montado con el pasador abajo en el comando 180°): el banco se verifica en TODO el recorrido del servo (no hay topes)
BETA_WORK = 40.0         # β de trabajo: ±40° ↔ 0…80°

# ───────────────────────────── servo MG90S (hoja de datos típica: MEDIR el comprado) ─────────────────────────────
@dataclass(frozen=True)
class ServoDims:
    L: float = 22.8          # largo del cuerpo (x)
    W: float = 12.2          # ancho (z: el servo va acostado)
    H: float = 22.7          # alto del cuerpo sin engranajes (a lo largo del eje)
    tab_span: float = 32.2
    tab_t: float = 2.5
    tab_h: float = 15.9      # cara inferior de las orejas desde la base del cuerpo
    tab_hole_spacing: float = 27.8
    shaft_offset: float = 5.9
    gear_top: float = 4.3
    shaft_h: float = 3.2
SERVO = ServoDims()

@dataclass(frozen=True)
class HornDims:              # horn de UN brazo que viene con el servo (MEDIR): la manivela impresa lo encastra
    hub_d: float = 7.0
    arm_len: float = 20.0    # centro del eje → punta del brazo
    tip_w: float = 4.0
    t: float = 1.8           # espesor del brazo
    hub_h: float = 4.0       # alto del cubo bajo el brazo
HORN = HornDims()

# ───────────────────────────── sensores ─────────────────────────────
MAGNET = (4.0, 2.0)      # imán de neodimio Ø4 × 2 mm, magnetización AXIAL (VERIFICAR)
MAG_SLOT = (MAGNET[0] + 0.2, MAGNET[1] + 0.2, MAGNET[0] + 0.3)   # ranura en el extremo del barril: ancho × espesor × profundidad
TO92 = (4.0, 1.55, 3.0)  # Hall lineal TO-92 (p. ej. DRV5055A1QLPG o 49E suelto): ancho × espesor × alto del cuerpo (VERIFICAR)
CARRIER_LIP = 1.3        # labio de la punta del portasensor: la punta APOYA en el extremo del barril (distancia imán–Hall fija por contacto)
HALL_ELEM_DEPTH = 1.5    # el elemento sensible queda ≈ en el centro del cuerpo
CARRIER_WALL = 0.8
CARRIER_PUSH = 0.6       # recorrido extra antes de que la pestaña toque la pared (para llegar al contacto aunque varíe la impresión)
THRUST_GAP = 0.2         # resalte del cuerpo junto al extremo −v del barril (tope axial del lado del pasador)
THRUST_R = 2.6
SPOT_V = 34.0            # rebaje plano en la pared donde salen el pasador y el portasensor (|v|): el alicate y la pestaña apoyan en plano

# ───────────────────────────── derivados ─────────────────────────────
D2R = math.pi / 180
Z_HINGE = Z_SERVO + LUG_H
TOP_Z = Z_HINGE + TOP_ABOVE_HINGE
BARREL_HALF = round(math.sqrt((RI - WALL_CLR) ** 2 - (D_HINGE + BARREL_R) ** 2) - 0.2, 2)   # el barril gira sin tocar la pared
V_WALL_IN = math.sqrt(RI ** 2 - D_HINGE ** 2)     # el eje de bisagra entra a la pared
V_WALL_OUT = math.sqrt(RO ** 2 - D_HINGE ** 2)    # y sale por la cara exterior
PSI_MAX = math.degrees(math.atan(CRANK_R / TAIL_A))   # ángulo máximo de la cola (servo en ±90°)
THETA_MIN, THETA_MAX = TAIL_PSI0 - PSI_MAX, TAIL_PSI0 + PSI_MAX
BED = (220.0, 220.0, 250.0)   # cama supuesta (VERIFICAR)
