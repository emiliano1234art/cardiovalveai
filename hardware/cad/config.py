"""
CardioVal AI — PARÁMETROS ÚNICOS DEL DISEÑO MECÁNICO (unidades: mm, grados).

Todas las piezas, la cinemática, las verificaciones y la animación leen
este archivo. Cambiar un valor aquí y volver a ejecutar `python build_all.py`
regenera STL, STEP, ensamblaje, informe y animación.

Medidas marcadas «VERIFICAR» corresponden a componentes comerciales cuyo
plano dimensional no fue confirmado: medir la pieza comprada y ajustar.
"""
from dataclasses import dataclass, field

PREFIX = "CardioValAI"          # prefijo de archivos de entrega
PROJECT = "CardioVal AI"        # nombre visible en documentos

# ───────────────────────────── impresión / tolerancias ─────────────────────────────
CLR_MOVE = 0.40      # holgura general entre piezas móviles (rango pedido 0,35–0,50)
CLR_FIT = 0.25       # holgura de encaje deslizante (insertos, soportes)
M2_CLEAR = 2.4       # agujero de paso M2 / eje Ø2 giratorio
M2_PILOT = 1.8       # agujero piloto para tornillo M2 autorroscante en PETG
M3_CLEAR = 3.4       # agujero de paso M3
M3_PILOT = 2.6       # agujero piloto M3 autorroscante en PETG
M3_HEAD_D = 6.0      # alojamiento cabeza M3 (allen DIN 912 ≈ 5,5)
M3_HEAD_H = 3.4

# ───────────────────────────── anillo valvular ─────────────────────────────
RING_OD = 70.0
RING_ID = 52.0
RING_H = 16.0        # profundidad del cuerpo valvular
POST_H = 8.0         # comisuras que sobresalen sobre el anillo (aspecto de raíz aórtica)
POST_W_DEG = 16.0    # ancho angular de cada comisura

# ───────────────────────────── valvas ─────────────────────────────
N_LEAF = 3
HINGE_D = 20.0       # distancia centro → eje de bisagra (cuerda)
Z_HINGE = 9.0        # altura del eje de bisagra sobre la cara inferior del anillo
LEAF_T = 1.6         # espesor de la valva (rango pedido 1,5–1,8)
BARREL_R = 2.6       # radio exterior del barril de bisagra
BARREL_HALF = 11.4   # semilongitud del barril (limitada por la pared interior)
EDGE_GAP = 0.5       # holgura de coaptación por lado (valva–valva al cerrar)
WALL_CLEAR = 1.0     # holgura mínima valva–pared en todo el recorrido
THETA_NORMAL = 80.0  # apertura experimental máxima
THETA_DESIGN = 86.0  # apertura usada para dimensionar holguras (margen sobre 84° del tope)
PIN_D = 2.0          # eje de acero Ø2 (varilla rectificada)
PIN_HOLE_LEAF = M2_CLEAR   # 2,4: la valva gira libre sobre el eje
PIN_HOLE_RING = 2.1        # el eje queda fijo en el anillo (ajuste + gota de adhesivo)

# palanca (cola) de cada valva: biela de mando
TAIL_LT = 8.0        # brazo de palanca eje → agujero de la biela
TAIL_PHI0 = 40.0     # ángulo de la cola sobre la horizontal con la válvula cerrada
TAIL_R_END = 2.9     # radio del extremo de la cola
TAIL_Y = (-4.5, 1.3) # espesor de la cola en dirección tangencial (local y)

# ───────────────────────────── transmisión ─────────────────────────────
LINK_L = 26.0        # biela normal: distancia entre agujeros
LINK_W = 6.0
LINK_T = 3.0
LINK_Y = (1.6, 4.6)
LM_SLOT = 5.5        # recorrido perdido de las bielas de módulo alterado
IC_RESIDUAL = 12.0   # ángulo residual del módulo «cierre incompleto»
TAB_Y = (-1.2, 1.3)  # orejeta del plato actuador
STOP_Y = (-4.8, -2.0)
SLOT_Y = (-5.3, 6.9) # ranura en la pared del anillo (cola + biela + cabeza de tornillo)
SLOT_X = (22.5, 31.6)
LINK_PIN_X = 27.1    # radio de la articulación biela–plato

PLATE_T = 4.0
PLATE_TAB_PIN_Z = 10.0   # altura del pasador de las orejetas sobre la cara inferior del plato
CLEVIS_PIN_Z = 9.0       # pasador de la horquilla central (sobre el plato; el empujador cruza un agujero central)
BUSH_H = 12.0            # longitud de guiado de los bujes del plato

COLUMN_R = 30.5      # radio de las columnas (en las comisuras)
COLUMN_D = 8.0
BUSH_CLEAR = 0.30    # holgura radial buje–columna

# servo (palanca y empujador)
SERVO_SWEEP = 40.0   # ± grados de la palanca respecto de la horizontal
PUSHROD_L = 30.0

# ───────────────────────────── MG90S (modelo de referencia, VERIFICAR) ─────────────────────────────
@dataclass(frozen=True)
class ServoDims:
    L: float = 22.8          # largo del cuerpo
    W: float = 12.2          # ancho
    H: float = 22.7          # alto del cuerpo (sin engranajes)
    tab_span: float = 32.2   # largo total con orejas
    tab_t: float = 2.5
    tab_h: float = 15.9      # altura de la cara inferior de las orejas
    tab_hole_spacing: float = 27.8
    tab_hole_d: float = 2.0
    shaft_offset: float = 5.9   # eje respecto del extremo del cuerpo
    gear_top: float = 4.3        # domo de engranajes sobre el cuerpo
    shaft_h: float = 3.2
    horn_r: float = 8.0          # radio del agujero usado en la palanca (VERIFICAR en el horn)
    horn_t: float = 1.8
SERVO = ServoDims()

# ───────────────────────────── sensores y electrónica (VERIFICAR) ─────────────────────────────
PIEZO_D = 15.0       # disco 12–15 mm: se diseña para 15 y se incluye adaptador para 12
PIEZO_T = 0.45
MEMS_BOARD = (14.5, 14.5, 1.6)   # INMP441 (placa redonda Ø≈14 o cuadrada ≈14): VERIFICAR
ESP32_BOARD = (55.0, 28.0, 1.6)  # DevKit de referencia: VERIFICAR (existen 48–58 × 25–29)
ESP32_PIN_DEPTH = 15.0           # espacio bajo la placa para pines + conectores Dupont

# sujeción de sensores al anillo: almohadillas planas
PAD_ANGLE_OFFSET = 30.0  # respecto de la dirección de cada valva
PAD_FACE_R = 37.0
PAD_W = 28.0
PAD_H = 14.5
PAD_SCREW_SPACING = 22.0

# ───────────────────────────── base ─────────────────────────────
BASE_X = 200.0
BASE_Y = 180.0
BASE_T = 6.0
VALVE_XY = (78.0, 92.0)  # centro de la válvula sobre la base

# impresora de referencia (volumen útil)
BED = (220.0, 220.0, 250.0)

# alturas globales (marco de la base): la cara superior de la base está en z = BASE_T
SERVO_BODY_CLEAR = 4.0   # luz entre la base y el costado inferior del servo
