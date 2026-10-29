"""
CardioValveAI — PARÁMETROS ÚNICOS DEL DISEÑO MECÁNICO (unidades: mm, grados).

Todas las piezas, la cinemática, las verificaciones y la animación leen
este archivo. Cambiar un valor aquí y volver a ejecutar `python build_all.py`
regenera STL, STEP, ensamblaje, informe y animación.

Medidas marcadas «VERIFICAR» corresponden a componentes comerciales cuyo
plano dimensional no fue confirmado: medir la pieza comprada y ajustar.
"""
from dataclasses import dataclass, field

PROJECT = "CardioValveAI"       # nombre definitivo (sin espacios)
REVISION = "v3.1"               # v3.1 = v3 con TODAS las fijaciones impresas o de latón (sin tornillería metálica comprada).
                                # Anteriores archivadas sin cambios en entrega/ (v1 commit 519c9ac, v2 commit 2b3999f, v3 commit 344e2bb)
PREFIX = f"CardioValveAI_{REVISION}"   # prefijo de archivos de entrega (identifica la revisión)
OUT_DIR = f"out_{REVISION}"     # carpeta de salida (hardware/out_v3.1)
FIRMWARE = "CardioValveAI_v3_Adquisicion"   # el firmware no cambia en v3.1

# ───────────────────────────── impresión / tolerancias ─────────────────────────────
CLR_MOVE = 0.40      # holgura general entre piezas móviles (rango pedido 0,35–0,50)
CLR_FIT = 0.25       # holgura de encaje deslizante (insertos, soportes)
M2_CLEAR = 2.4       # agujero de paso M2 / eje Ø2 giratorio
M2_PILOT = 1.8       # agujero piloto para tornillo M2 autorroscante en PETG
M3_CLEAR = 3.4       # agujero de paso M3
M3_PILOT = 2.6       # agujero piloto M3 autorroscante en PETG
M3_HEAD_D = 6.0      # alojamiento cabeza M3 (allen DIN 912 ≈ 5,5)
M3_HEAD_H = 3.4
M2_NUT_AF = 4.0      # alojamiento hexagonal de la tuerca a presión impresa (entre caras)
M2_NUT_T = 1.6
NUT_CLR = 0.25       # holgura de la trampa de tuerca

# ───────────────────────────── fijaciones impresas (v3.1) ─────────────────────────────
# Las roscas M2/M3 no se pueden imprimir con una boquilla de 0,4 mm (paso 0,4–0,5 mm). Por eso:
#  · uniones estructurales grandes → rosca M6 IMPRESA (paso 1,0 mm, mínimo que imprime bien una FDM común);
#  · uniones chicas (topes, bielas, horquilla, pivote) → pasador de LATÓN Ø2 (misma varilla de los ejes)
#    con cabeza impresa (pegada) y tuerca impresa A PRESIÓN (se quita con alicate).
THREAD_D = 6.0           # rosca métrica impresa
THREAD_P = 1.0
THREAD_COMP = 0.15       # compensación radial por lado (macho hacia adentro, hembra hacia afuera): VERIFICAR con Thread_Coupon
M6_CLEAR = 6.6           # agujero de paso del perno M6 impreso
BOLT_L = 8.0             # único largo de perno impreso (M6×8): servo, bandeja y soporte del micrófono
BOLT_HEAD = (10.0, 4.0)  # cabeza moleteada Ø × alto (se aprieta con los dedos; ranura para moneda o destornillador plano)
KNURL_NUT = (9.0, 6.0)   # tuerca moleteada de las columnas Ø × alto (no sobresale del ancho de la comisura)
BRASS_PIN_D = 2.0        # varilla de latón Ø2
PIN_PRESS_HOLE = 1.95    # agujero a presión de cabezas y tuercas impresas sobre latón Ø2: VERIFICAR con la fila 2 de la probeta
PIN_HEAD = (3.8, 1.6)    # cabeza impresa del pasador Ø × alto
TURN_PEG_D = 3.9         # espiga del pestillo giratorio de la bandeja (agujero de 4,0 en el poste: giro con fricción)

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
PIN_D = 2.0          # v2: eje de LATÓN (o inox 316) Ø2 — no magnético (el acero deformaría el campo de los imanes Hall)
PIN_HOLE_LEAF = M2_CLEAR   # 2,4: la valva gira libre sobre el eje
PIN_HOLE_RING = 2.1        # el eje queda fijo en el anillo (ajuste + gota de adhesivo)

# v2: pasador cola–biela: varilla de latón Ø2 a presión en la cola, libre en la biela, retenido por las paredes de la ranura
TAIL_PIN_HOLE = 1.95     # ajuste a presión (VERIFICAR con la probeta: 1,85–2,0)
LINK_HOLE = 2.2          # biela gira sobre el pasador (menos juego que 2,4 de v1: el juego se ve como histéresis)
TAIL_PIN_LEN = 9.0       # de la cara −y de la cola (−4,5) a la cara exterior de la biela (4,6)

# Medición de posición (una pareja Hall–imán por valva). Imán N42 Ø4×2 axial (eje y) en la cara −y de la cola.
# MEDIDAS DEL IMÁN COMPRADO: VERIFICAR (diámetro, espesor y dirección de magnetización).
MAG_LEAF = (4.0, 2.0)    # diámetro, altura (mm)
MAG_LEAF_S = 4.0         # distancia del eje de bisagra al centro del imán, a lo largo de la cola
MAG_POCKET_CLR = 0.2     # holgura diametral del alojamiento (se fija con una gota de cianoacrilato)
# Sensor Hall LINEAL (modelo por confirmar; ver sensing.SENSORS) en un PORTASENSOR extraíble que entra desde arriba en
# un bolsillo de la pared del anillo (marco de la valva). Posición NOMINAL (portasensor con desplazamiento 0):
HALL_XYZ = (26.1, -8.0, 13.0)   # centro del elemento Hall; eje sensible = x local (radial). Cara del TO-92 al ras del diámetro interior
TO92_BODY = (1.55, 4.0, 3.15)   # espesor (x), ancho (y), alto (z) del cuerpo TO-92: VERIFICAR con el sensor comprado
HALL_OFFSETS = (0.0, 0.25, 0.5) # variantes del portasensor: alejan el sensor del imán (mm). Solo si hay saturación (imán más fuerte)
HALL_POCKET_BACK = 29.4         # cara exterior del bolsillo (x local): apoyo del lomo del portasensor
CARRIER_FLANGE_T = 1.2          # pestaña del portasensor sobre la cara superior del anillo
CALIB_ANGLES = (0, 5, 10, 15, 20, 30, 40, 50, 60, 70, 80)   # galgas angulares de calibración (más densas cerca del cierre, donde la curva cambia más)

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

# servo (palanca y empujador). v2: el dato de entrada es el RADIO DEL AGUJERO DEL HORN (medido);
# el barrido ±β se calcula como asin(carrera / (2·r)) en kinematics.py (r = 8 → β = 40,0°).
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
    horn_r: float = 8.0          # radio del agujero usado en el horn (MEDIR: distancia centro del eje → centro del agujero)
    horn_t: float = 1.8
SERVO = ServoDims()

# ───────────────────────────── sensores y electrónica (VERIFICAR) ─────────────────────────────
MEMS_BOARD = (14.5, 14.5, 1.6)   # INMP441 (placa redonda Ø≈14 o cuadrada ≈14): VERIFICAR
ESP32_BOARD = (55.0, 28.0, 1.6)  # DevKit de referencia: VERIFICAR (existen 48–58 × 25–29) — NO DEFINITIVO
ESP32_ROW_PITCH = 25.4           # separación entre filas de pines: VERIFICAR (22,86 o 25,4 según el clon)
ESP32_PINS_PER_ROW = 15          # 30 pines (15 por lado): VERIFICAR (hay versiones de 38)
ESP32_PIN_DEPTH = 15.0           # espacio bajo la placa para pines + conectores Dupont
# v2: placa perforada de acondicionamiento (lleva el ESP32 en zócalos hembra + filtros)
PERFBOARD = (70.0, 90.0, 1.6)    # VERIFICAR (formato común 7 × 9 cm)
PERF_UNDER = 6.0                 # luz bajo la placa perforada (soldaduras)
TRAY_XY = (118.0, 70.0)          # esquina de la bandeja electrónica en la base


# ───────────────────────────── base ─────────────────────────────
BASE_X = 200.0
BASE_Y = 180.0
BASE_T = 6.0
VALVE_XY = (78.0, 92.0)  # centro de la válvula sobre la base
MEMS_STAND_ANG = 300.0   # posición angular del soporte independiente del micrófono (grados, marco global)
MEMS_STAND_R = 52.0      # distancia horizontal eje de la válvula → micrófono (ajustable ±10 con las ranuras)

# impresora de referencia (volumen útil)
BED = (220.0, 220.0, 250.0)

# alturas globales (marco de la base): la cara superior de la base está en z = BASE_T
SERVO_BODY_CLEAR = 4.0   # luz entre la base y el costado inferior del servo
