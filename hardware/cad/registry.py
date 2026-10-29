"""Catálogo de piezas: constructor, cantidad, orientación de impresión y notas de fabricación."""
from __future__ import annotations
import math
from dataclasses import dataclass, field
import numpy as np
import config as C
import kinematics as K
import parts as P
import assembly as A
import fasteners as FA

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
    Item('Valve_Ring', P.valve_ring, 1, True, np.eye(4), 'Anillo valvular con comisuras, bisagras, ranuras de mando y 3 bolsillos con ventana para los portasensores Hall',
         '50 %', 4, 0.2, 'Repasar los agujeros horizontales de Ø2,1 con broca de 2,0–2,1 mm si quedan ovalados. Superficie crítica: paredes del bolsillo Hall (0,55 mm hacia la ranura).', ('Valve_Ring',)),
    *[Item(f'Hall_Carrier_{int(round(o * 100)):03d}', (lambda o=o: P.hall_carrier(o)), 3, True, Rx(180),
           f'Portasensor Hall extraíble, sensor alejado {o:.2f} mm del imán ' + ('(NOMINAL: se monta en las 3 valvas)' if o == 0 else '(ALTERNATIVA: solo si el sensor satura)'),
           '100 %', 3, 0.12, 'Pestaña en la cama. NO DEFINITIVA hasta confirmar el encapsulado del sensor.', ('Hall_Carrier_1', 'Hall_Carrier_2', 'Hall_Carrier_3') if o == 0 else ())
      for o in C.HALL_OFFSETS],
    *[Item(f'Calib_Gauge_{a:02d}', (lambda a=a: P.calib_gauge(float(a))), 1, True, Rx(90), f'Galga angular de calibración: la cara superior de la valva la toca a {a}°',
           '100 %', 4, 0.12, 'Acostada sobre su cara lateral. Superficie crítica: la cara de contacto (sin soportes).') for a in C.CALIB_ANGLES],
    *[Item(f'Leaflet_{i+1}', (lambda i=i: P.leaflet(i)), 1, True, A.T(0, 0, -P.PLATE_Z0), f'Valva {i+1} (semilunar simplificada, barril de bisagra y cola de mando)',
           '100 %', 3, 0.12, 'Imprimir con la cara inferior plana en la cama. Soporte mínimo (árbol) bajo la cola inclinada 40°. Imán Ø4×2 en la cara −y de la cola (polaridad marcada).', (f'Leaflet_{i+1}',)) for i in range(3)],
    Item('Link_Normal', lambda: P.link(C.LINK_L, False), 4, True, Rx(90), 'Biela rígida (modo normal). 3 + 1 de repuesto', '100 %', 3, 0.2, 'Plana. Sin marcas.', ('Link_1', 'Link_2', 'Link_3')),
    Item('Link_LostMotion', lambda: P.link(C.LINK_L, True), 2, True, Rx(90), 'Biela con recorrido perdido (apertura restringida / asimétrica). 1 marca', '100 %', 3, 0.2, 'Plana.'),
    Item('Link_LostMotion_IC', lambda: P.link(K.MODULES['IC'].L, True), 1, True, Rx(90), f'Biela corta con recorrido perdido (cierre incompleto {C.IC_RESIDUAL:.0f}°). 2 marcas', '100 %', 3, 0.2, 'Plana.'),
    Item('Opening_Stop_84', lambda: P.opening_stop(84.0), 3, True, A.T(0, 0, 2.5), 'Tope de seguridad (84°) — se usa en modo normal y cierre incompleto', '100 %', 3, 0.2, 'Brida en la cama.', ('Stop_1', 'Stop_2', 'Stop_3')),
    Item('Opening_Stop_60', lambda: P.opening_stop(60.0), 1, True, A.T(0, 0, 2.5), 'Tope intercambiable 60°', '100 %', 3, 0.2, 'Brida en la cama.'),
    Item('Opening_Stop_45', lambda: P.opening_stop(45.0), 1, True, A.T(0, 0, 2.5), 'Tope intercambiable 45°', '100 %', 3, 0.2, 'Brida en la cama.'),
    Item('Actuator_Plate', P.actuator_plate, 1, True, np.eye(4), 'Plato actuador (corredera) con bujes, orejetas y horquilla', '40 %', 4, 0.2,
         'Repasar los bujes Ø8,6 con lija y lubricar con grasa de PTFE.', ('Actuator_Plate',)),
    Item('Pushrod', P.pushrod, 1, True, Rx(90), 'Empujador servo → plato', '100 %', 3, 0.2, 'Plano.', ('Pushrod',)),
    Item('Column', lambda: P.column(A.COLUMN_H), 3, True, A.T(0, 0, C.BASE_T), 'Columna guía con espárragos M6 impresos: abajo se enrosca en la base, arriba recibe la tuerca moleteada del anillo', '100 %', 4, 0.12,
         'Vertical, espárrago inferior en la cama (el cono de 45° no lleva soporte). Capa 0,12 mm por las roscas. Lijar la superficie de deslizamiento (grano 400) y lubricar.', ('Column_1', 'Column_2', 'Column_3')),
    Item('Cable_Clip', P.cable_clip, 3, True, np.eye(4), 'Pinza de cables a presión en cada columna (bajo el recorrido del plato)', '100 %', 3, 0.2, '', ('Cable_Clip_1', 'Cable_Clip_2', 'Cable_Clip_3')),
    Item('MEMS_Stand', P.mems_stand, 1, True, np.eye(4), 'Soporte independiente del micrófono M1 (configuración inicial recomendada): ranura radial ±8 mm y pivote de inclinación',
         '40 %', 4, 0.2, 'Pie en la cama.', ('MEMS_Stand',)),
    Item('MEMS_Stand_Holder', P.stand_holder, 1, True, A.T(0, 0, 0) @ np.array([[0, 0, 1, 0], [0, 1, 0, 0], [-1, 0, 0, 0], [0, 0, 0, 1]], float) ,
         'Portaplaca del INMP441 con lengüeta de pivote', '40 %', 3, 0.2, 'Cara del marco en la cama.', ('MEMS_Stand_Holder',)),
    Item('Servo_Mount', lambda: P.servo_mount(A.ZS), 1, True, A.T(0, 0, -C.BASE_T), 'Soporte del servo con escuadras (medidas del servo por confirmar)', '50 %', 4, 0.2,
         'Fijar a la base sobre arandelas de goma (antivibración).', ('Servo_Mount',)),
    Item('Electronics_Tray', P.electronics_tray, 1, True, np.eye(4), 'Bandeja de la placa perforada 70×90 (ESP32 en zócalos hembra, antena libre, USB accesible)', '30 %', 3, 0.2,
         'Insertos M3 en los 4 postes.', ('Electronics_Tray',)),
    Item('Turn_Button', FA.turn_button, 5, True, A.T(0, 0, FA.TURN_T) @ Rx(180), 'Pestillo giratorio que sujeta la placa perforada (4 + 1 de repuesto): reemplaza barras y tornillos',
         '100 %', 3, 0.12, 'Cara superior en la cama, espiga hacia arriba.', ('Turn_Button_1', 'Turn_Button_2', 'Turn_Button_3', 'Turn_Button_4')),
    Item('Angle_Scale', lambda: P.angle_scale(A.Z_RING + C.Z_HINGE - C.BASE_T), 1, True, A.T(0, 0, 0) @ np.array([[0, 0, -1, 0], [0, 1, 0, 0], [1, 0, 0, 0], [0, 0, 0, 1]], float),
         'Transportador 0–90° para medir la valva 1 con cámara lateral', '30 %', 3, 0.2, 'Plano; marcas hacia arriba.', ('Angle_Scale',)),
    Item('Base', lambda: P.base([A.column_xy(i) for i in range(3)], A.servo_mount_holes(), A.TRAY_XY, A.SCALE_XY, A.stand_insert_xy(), A.zip_points(), A.base_labels()), 1, True, np.eye(4),
         'Base modular 200 × 180 mm con roscas M6 impresas y ranuras para bridas', '20 %', 4, 0.2, 'Cabe en camas ≥ 220 × 220 mm. Usar borde (brim) de 5 mm para evitar alabeo.', ('Base',)),
    Item('Tolerance_Coupon', P.tolerance_coupon, 1, True, np.eye(4), 'Probeta: ejes de latón libres y a presión (también para cabezas y tuercas a presión), pilotos, paso M6, espiga del pestillo e imán Ø4', '100 %', 3, 0.2,
         'Imprimir primero: elegir los diámetros reales que ajustan con la varilla de latón, los imanes y las piezas impresas.'),
    # fijaciones impresas (v3.1): nada de tornillería metálica comprada
    Item('Thread_Coupon', FA.thread_coupon, 1, True, np.eye(4), 'Probeta de roscas M6 impresas (compensación 0,10 / 0,20 / 0,30 mm): se prueba con un perno M6×8',
         '100 %', 4, 0.12, 'Imprimir junto con un Bolt_M6x8 ANTES que el resto de las fijaciones.'),
    Item('Bolt_M6x8', FA.bolt, 9, True, A.T(0, 0, C.BOLT_HEAD[1]) @ Rx(180), 'Perno M6×8 impreso, cabeza moleteada: soporte del servo (4), bandeja (2), soporte del micrófono (2) + 1 de repuesto',
         '100 %', 4, 0.12, 'Vertical, cabeza en la cama. Apretar SOLO con los dedos (la rosca de plástico se barre con herramientas).'),
    Item('Knurled_Nut_M6', FA.knurled_nut, 4, True, np.eye(4), 'Tuerca M6 moleteada impresa: fija el anillo sobre el espárrago de cada columna (3 + 1)',
         '100 %', 4, 0.12, 'Plana en la cama. Apretar con los dedos.'),
    Item('Pin_Head', FA.pin_head, 10, True, np.eye(4), 'Cabeza impresa del pasador de latón Ø2 (8 + 2): topes, bielas, horquilla y pivote del micrófono',
         '100 %', 2, 0.12, 'Agujero hacia la cama. Se coloca a presión y se fija con una gota de cianoacrilato.'),
    Item('Push_Nut', FA.push_nut, 10, True, np.eye(4), 'Tuerca hexagonal impresa A PRESIÓN sobre el latón Ø2 (8 + 2): reemplaza las tuercas M2',
         '100 %', 2, 0.12, 'Plana. Se empuja con un alicate hasta apretar; se saca haciendo palanca.'),
    # referencias (NO imprimir)
    Item('Servo_MG90S_Reference', lambda: P.ref_servo(A.ZS), 1, False, instances=('Servo_MG90S_Reference',), role='Modelo dimensional de referencia del MG90S (VERIFICAR con el servo comprado)'),
    Item('Servo_Horn_Reference', P.ref_horn, 1, False, instances=('Servo_Horn_Reference',), role='Horn de un brazo (referencia; se usa el original del servo)'),
    Item('Perfboard_ESP32_Reference', P.ref_perfboard, 1, False, instances=('Perfboard_ESP32_Reference',), role='Placa perforada 70×90 + zócalos + ESP32 DevKit (referencia NO DEFINITIVA: medidas del ESP32 por confirmar)'),
    Item('MEMS_Board_Reference', P.ref_mems_board, 1, False, instances=('MEMS_Board_Reference',), role='Placa INMP441 (referencia, VERIFICAR medidas y puerto acústico)'),
    Item('Hinge_Pin_Reference', P.ref_pin, 3, False, instances=('Pin_1', 'Pin_2', 'Pin_3'), role='Eje de LATÓN Ø2 × 56 mm (no magnético)'),
    Item('Tail_Pin_Reference', P.ref_tail_pin, 3, False, instances=('Tail_Pin_1', 'Tail_Pin_2', 'Tail_Pin_3'), role='Pasador de latón Ø2 × 9 cola–biela (a presión en la cola)'),
    Item('Magnet_Leaf_Reference', P.ref_magnet_leaf, 3, False, instances=('Magnet_1', 'Magnet_2', 'Magnet_3'), role='Imán N42 Ø4×2 axial (cola de cada valva)'),
    Item('Hall_Sensor_Reference', P.ref_hall_ring, 3, False, instances=('Hall_1', 'Hall_2', 'Hall_3'), role='Sensor Hall lineal TO-92 (modelo por confirmar; recomendado DRV5055A1QLPG)'),
    Item('Plate_Fasteners_Reference', P.ref_plate_fasteners, 1, False, instances=('Plate_Fasteners_Reference',), role='Pasadores de latón Ø2 + cabezas y tuercas impresas que se mueven con el plato'),
    Item('Ring_Fasteners_Reference', P.ref_ring_fasteners, 1, False, instances=('Ring_Fasteners_Reference',), role='Pasadores de los topes y tuercas moleteadas M6 de las comisuras'),
    Item('Base_Fasteners_Reference', lambda: P.ref_base_fasteners(A.servo_mount_holes(), A.TRAY_XY), 1, False, instances=('Base_Fasteners_Reference',), role='Pernos M6×8 impresos del servo y de la bandeja'),
    Item('Stand_Fasteners_Reference', P.ref_stand_fasteners, 1, False, instances=('Stand_Fasteners_Reference',), role='Pernos M6×8 y pasador del pivote del soporte del micrófono'),
    Item('Cable_Routes_Reference', lambda: P.ref_cable_all(), 1, False, instances=('Cable_Routes_Reference',), role='Recorridos de cables (haces Ø3): señales por el sur, servo por el norte'),
]

def by_name(n):
    return next(i for i in ITEMS if i.name == n)
