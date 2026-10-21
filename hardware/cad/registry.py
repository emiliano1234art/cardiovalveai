"""Catálogo de piezas: constructor, cantidad, orientación de impresión y notas de fabricación."""
from __future__ import annotations
import math
from dataclasses import dataclass, field
import numpy as np
import config as C
import kinematics as K
import parts as P
import assembly as A

def Rx(deg):
    c, s = math.cos(math.radians(deg)), math.sin(math.radians(deg))
    m = np.eye(4); m[1, 1], m[1, 2], m[2, 1], m[2, 2] = c, -s, s, c; return m

@dataclass
class Item:
    name: str                 # nombre de archivo (sin prefijo)
    build: callable
    qty: int
    printable: bool
    print_tf: np.ndarray = field(default_factory=lambda: np.eye(4))
    role: str = ''
    infill: str = '40 %'
    walls: int = 3
    layer: float = 0.2
    notes: str = ''
    instances: tuple = ()     # nombres de instancia en el ensamblaje

ITEMS: list[Item] = [
    Item('Valve_Ring', P.valve_ring, 1, True, np.eye(4), 'Anillo valvular con comisuras, bisagras, ranuras de mando, almohadillas de sensores y alojamiento Hall',
         '50 %', 4, 0.2, 'Repasar los agujeros horizontales de Ø2,1 con broca de 2,0–2,1 mm si quedan ovalados.', ('Valve_Ring',)),
    *[Item(f'Leaflet_{i+1}', (lambda i=i: P.leaflet(i)), 1, True, A.T(0, 0, -P.PLATE_Z0), f'Valva {i+1} (semilunar simplificada, barril de bisagra y cola de mando)',
           '100 %', 3, 0.12, 'Imprimir con la cara inferior plana en la cama. Soporte mínimo (árbol) bajo la cola inclinada 40°.', (f'Leaflet_{i+1}',)) for i in range(3)],
    Item('Link_Normal', lambda: P.link(C.LINK_L, False), 4, True, Rx(90), 'Biela rígida (modo normal). 3 + 1 de repuesto', '100 %', 3, 0.2, 'Plana. Sin marcas.', ('Link_1', 'Link_2', 'Link_3')),
    Item('Link_LostMotion', lambda: P.link(C.LINK_L, True), 2, True, Rx(90), 'Biela con recorrido perdido (apertura restringida / asimétrica). 1 marca', '100 %', 3, 0.2, 'Plana.'),
    Item('Link_LostMotion_IC', lambda: P.link(K.MODULES['IC'].L, True), 1, True, Rx(90), f'Biela corta con recorrido perdido (cierre incompleto {C.IC_RESIDUAL:.0f}°). 2 marcas', '100 %', 3, 0.2, 'Plana.'),
    Item('Opening_Stop_84', lambda: P.opening_stop(84.0), 3, True, A.T(0, 0, 2.5), 'Tope de seguridad (84°) — se usa en modo normal y cierre incompleto', '100 %', 3, 0.2, 'Brida en la cama.', ('Stop_1', 'Stop_2', 'Stop_3')),
    Item('Opening_Stop_60', lambda: P.opening_stop(60.0), 1, True, A.T(0, 0, 2.5), 'Tope intercambiable 60°', '100 %', 3, 0.2, 'Brida en la cama.'),
    Item('Opening_Stop_45', lambda: P.opening_stop(45.0), 1, True, A.T(0, 0, 2.5), 'Tope intercambiable 45°', '100 %', 3, 0.2, 'Brida en la cama.'),
    Item('Actuator_Plate', P.actuator_plate, 1, True, np.eye(4), 'Plato actuador (corredera) con bujes, orejetas y horquilla', '40 %', 4, 0.2,
         'Repasar los bujes Ø8,6 con lija y lubricar con grasa de PTFE.', ('Actuator_Plate',)),
    Item('Pushrod', P.pushrod, 1, True, Rx(90), 'Empujador servo → plato', '100 %', 3, 0.2, 'Plano.', ('Pushrod',)),
    Item('Column', lambda: P.column(A.COLUMN_H), 3, True, np.eye(4), 'Columna guía y soporte del anillo', '40 %', 4, 0.2,
         'Vertical. Lijar la superficie de deslizamiento (grano 400) y lubricar.', ('Column_1', 'Column_2', 'Column_3')),
    Item('Piezo_Mount', P.piezo_mount, 1, True, A.T(0, 0, -C.PAD_FACE_R) @ np.array([[0, 0, -1, 0], [0, 1, 0, 0], [1, 0, 0, 0], [0, 0, 0, 1]], float),
         'Soporte del disco piezoeléctrico (Ø15; adaptador para Ø12)', '100 %', 4, 0.2, 'Cara de contacto con el anillo en la cama.', ('Piezo_Mount',)),
    Item('Piezo_Cover', P.piezo_cover, 1, True, A.T(0, 0, C.PAD_FACE_R + 4.0 + 3.4) @ np.array([[0, 0, 1, 0], [0, 1, 0, 0], [-1, 0, 0, 0], [0, 0, 0, 1]], float),
         'Tapa protectora del piezo (no lo presiona)', '40 %', 3, 0.2, 'Cara exterior en la cama.', ('Piezo_Cover',)),
    Item('Piezo_Adapter_12mm', P.piezo_adapter_12, 1, True, A.T(0, 0, -(C.PAD_FACE_R + 4.0 - 0.8)) @ np.array([[0, 0, -1, 0], [0, 1, 0, 0], [1, 0, 0, 0], [0, 0, 0, 1]], float),
         'Anillo adaptador para disco Ø12', '100 %', 2, 0.15, 'Solo si el disco comprado es de 12 mm.'),
    Item('MEMS_Mount', P.mems_mount, 1, True, A.T(0, 0, C.PAD_FACE_R + 3.5) @ np.array([[0, 0, 1, 0], [0, 1, 0, 0], [-1, 0, 0, 0], [0, 0, 0, 1]], float),
         'Escuadra regulable y portaplaca del micrófono INMP441', '40 %', 3, 0.2, 'Apoyar la cara exterior de la escuadra en la cama; soportes bajo el portaplaca.', ('MEMS_Mount',)),
    Item('Servo_Mount', lambda: P.servo_mount(A.ZS), 1, True, A.T(0, 0, -C.BASE_T), 'Soporte del MG90S con escuadras', '50 %', 4, 0.2,
         'Fijar a la base sobre arandelas de goma (antivibración).', ('Servo_Mount',)),
    Item('ESP32_Mount', P.esp32_mount, 1, True, np.eye(4), 'Cuna del ESP32 DevKit (apoya en los extremos, pines libres)', '30 %', 3, 0.2, '', ('ESP32_Mount',)),
    Item('Angle_Scale', lambda: P.angle_scale(A.Z_RING + C.Z_HINGE - C.BASE_T), 1, True, A.T(0, 0, 0) @ np.array([[0, 0, -1, 0], [0, 1, 0, 0], [1, 0, 0, 0], [0, 0, 0, 1]], float),
         'Transportador 0–90° para medir la valva 1 con cámara lateral', '30 %', 3, 0.2, 'Plano; marcas hacia arriba.', ('Angle_Scale',)),
    Item('Base', lambda: P.base([A.column_xy(i) for i in range(3)], A.servo_mount_holes(), A.ESP_XY, A.SCALE_XY), 1, True, np.eye(4),
         'Base modular 200 × 180 mm', '20 %', 4, 0.2, 'Cabe en camas ≥ 220 × 220 mm. Usar borde (brim) de 5 mm para evitar alabeo.', ('Base',)),
    Item('Tolerance_Coupon', P.tolerance_coupon, 1, True, np.eye(4), 'Probeta de holguras: ejes Ø2 y pilotos M2/M3', '100 %', 3, 0.2,
         'Imprimir primero: elegir los diámetros reales que ajustan con el eje y los tornillos comprados.'),
    # referencias (NO imprimir)
    Item('Servo_MG90S_Reference', lambda: P.ref_servo(A.ZS), 1, False, instances=('Servo_MG90S_Reference',), role='Modelo dimensional de referencia del MG90S (VERIFICAR con el servo comprado)'),
    Item('Servo_Horn_Reference', P.ref_horn, 1, False, instances=('Servo_Horn_Reference',), role='Horn de un brazo (referencia; se usa el original del servo)'),
    Item('ESP32_Board_Reference', P.ref_esp32, 1, False, instances=('ESP32_Board_Reference',), role='ESP32 DevKit (referencia)'),
    Item('MEMS_Board_Reference', P.ref_mems_board, 1, False, instances=('MEMS_Board_Reference',), role='Placa INMP441 (referencia, VERIFICAR medidas)'),
    Item('Piezo_Disc_Reference', P.ref_piezo, 1, False, instances=('Piezo_Disc_Reference',), role='Disco piezoeléctrico Ø15 (referencia)'),
    Item('Hinge_Pin_Reference', P.ref_pin, 3, False, instances=('Pin_1', 'Pin_2', 'Pin_3'), role='Eje de acero Ø2 × 56 mm (comercial)'),
]

def by_name(n):
    return next(i for i in ITEMS if i.name == n)
