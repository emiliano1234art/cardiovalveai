"""Catálogo de CardioValveAI v4: número de despiece, cantidad, carpeta, orientación de impresión y notas."""
from __future__ import annotations
from dataclasses import dataclass, field
import numpy as np

import config4 as C
import parts4 as P
from geom4 import Rx, Ry


@dataclass
class Item:
    num: str                  # número en el despiece y en el nombre del archivo
    name: str                 # nombre del archivo (sin número ni cantidad)
    build: callable
    qty: int
    kind: str                 # 'obligatoria', 'opcional', 'probeta' o 'referencia'
    print_rot: np.ndarray = field(default_factory=lambda: np.eye(4))
    role: str = ''
    orient: str = ''          # cómo va en la cama
    supports: str = 'No'
    params: str = 'capa 0,2 mm · 3 perímetros · 30 % relleno'
    instances: tuple = ()
    buy: str = ''             # para referencias: qué comprar / de dónde sale

    @property
    def file(self):
        return f'{self.num}_{self.name}_x{self.qty}'


def _pin_len(a, b):
    return round(b - a, 1)


HINGE_L = _pin_len(*P.HINGE_PIN)
LUG_L = round(2 * P.LUG_UV[2], 1)
CRANK_L = _pin_len(*P.CRANK_PIN)
LOCK_L = _pin_len(*P.LOCK_PIN)

ITEMS: list[Item] = [
    Item('00', 'Probeta', P.coupon, 1, 'probeta', np.eye(4), 'Probeta de ajustes: latón Ø3 a presión y libre, ranura del imán, pilotos de los tornillos del servo y túnel del portasensor',
         'De pie, como figura (cara de 66 × 12 mm en la cama)', 'No', 'capa 0,2 mm · 4 perímetros · 25 % relleno (igual que el cuerpo, sin brim)'),
    Item('01', 'Cuerpo', P.body, 1, 'obligatoria', np.eye(4), 'Cuerpo único: anillo de bisagras, faldón, ranuras guía del pistón, túneles de los Hall, tabique y ventana del servo',
         'De pie, cara inferior en la cama', 'No (techo de la ventana a dos aguas; agujeros horizontales chicos)', 'capa 0,2 mm · 4 perímetros · 25 % relleno · borde (brim) 4 mm',
         ('Cuerpo',)),
    Item('02', 'Valva', lambda: P.leaflet(-1), 3, 'obligatoria', Rx(180), 'Valva con barril de bisagra, imán en el extremo +v y cola ranurada (las tres son iguales)',
         'Boca abajo: cara superior de la valva en la cama (barril, cola y alma hacia arriba)', 'No', 'capa 0,16 mm · 3 perímetros · 40 % relleno',
         ('Valva_1', 'Valva_2', 'Valva_3')),
    Item('03', 'Piston', P.piston, 1, 'obligatoria', np.eye(4), 'Pistón: disco con 3 horquillas y 3 brazos con zapatas guía',
         'Cara inferior del disco en la cama', 'No', 'capa 0,2 mm · 3 perímetros · 40 % relleno', ('Piston',)),
    Item('04', 'Yugo', P.yoke, 1, 'obligatoria', Rx(90), 'Yugo escocés: ranura horizontal para el pasador de la manivela; espiga que atraviesa el pistón',
         'Acostado (placa plana en la cama)', 'No', 'capa 0,2 mm · 4 perímetros · 60 % relleno', ('Yugo',)),
    Item('05', 'Manivela', P.crank, 1, 'obligatoria', Rx(-90), 'Manivela que encastra sobre el horn de UN brazo del servo; lleva el pasador del yugo',
         'Plana, encastre del horn hacia ARRIBA (cara del pasador en la cama)', 'No', 'capa 0,16 mm · 4 perímetros · 100 % relleno', ('Manivela',)),
    Item('06', 'Portasensor_Hall', P.hall_carrier, 3, 'obligatoria', Ry(90), 'Portasensor del Hall TO-92: entra desde afuera por el túnel del cuerpo (se cambia sin desarmar)',
         'Acostado sobre el lomo (canal abierto hacia arriba)', 'No', 'capa 0,12 mm · 2 perímetros · 100 % relleno',
         ('Portasensor_1', 'Portasensor_2', 'Portasensor_3')),
    *[Item('07', f'Galga_{a:02d}', (lambda a=a: P.gauge(float(a))), 1, 'opcional', Rx(90), f'Galga de calibración: la cara superior de la valva la toca a {a}°',
           'Acostada sobre una cara lateral', 'No', 'capa 0,16 mm · 3 perímetros · 50 % relleno') for a in P.GAUGE_ANGLES],
    # referencias (NO se imprimen)
    Item('R1', 'Pasador_bisagra_laton_D3', P.ref_hinge_pin, 3, 'referencia', instances=('Pasador_bisagra_1', 'Pasador_bisagra_2', 'Pasador_bisagra_3'),
         role='Eje de bisagra: a presión en la pared, la valva gira sobre él', buy=f'Varilla de latón Ø3, cortar a {HINGE_L} mm'),
    Item('R2', 'Pasador_horquilla_laton_D3', P.ref_lug_pins, 1, 'referencia', instances=('Pasadores_horquilla',),
         role='3 pasadores: a presión en las horquillas del pistón, deslizan en la ranura de la cola', buy=f'Varilla de latón Ø3, cortar 3 × {LUG_L} mm'),
    Item('R3', 'Pasador_manivela_laton_D3', P.ref_crank_pin, 1, 'referencia', instances=('Pasador_manivela',),
         role='A presión en la manivela; corre en la ranura del yugo', buy=f'Varilla de latón Ø3, cortar a {CRANK_L} mm'),
    Item('R4', 'Pasador_traba_laton_D3', P.ref_lock_pin, 1, 'referencia', instances=('Pasador_traba',),
         role='Traba la espiga del yugo sobre el pistón', buy=f'Varilla de latón Ø3, cortar a {LOCK_L} mm'),
    Item('R5', 'Iman_D4x2', P.ref_magnet, 3, 'referencia', instances=('Iman_1', 'Iman_2', 'Iman_3'),
         role='Imán en el extremo del barril (gira con la valva)', buy='Imán de neodimio Ø4 × 2 mm, magnetización axial (VERIFICAR)'),
    Item('R6', 'Hall_TO92', P.ref_hall, 3, 'referencia', instances=('Hall_1', 'Hall_2', 'Hall_3'),
         role='Sensor Hall LINEAL (analógico) TO-92', buy='DRV5055A1QLPG (recomendado) o 49E/SS49E suelto (VERIFICAR modelo)'),
    Item('R7', 'Servo_MG90S', P.ref_servo, 1, 'referencia', instances=('Servo',), role='Servo MG90S 180° (medidas típicas: VERIFICAR)', buy='MG90S con sus horns y tornillos'),
    Item('R8', 'Horn_un_brazo', P.ref_horn, 1, 'referencia', instances=('Horn',), role='Horn de un brazo que trae el servo', buy='Viene con el servo'),
    Item('R9', 'Tornillos_del_servo', P.ref_servo_screws, 1, 'referencia', instances=('Tornillos_servo',), role='2 tornillos de las orejas', buy='Vienen con el servo'),
]


def by_name(n):
    return next(i for i in ITEMS if i.name == n)


PRINTED = [i for i in ITEMS if i.kind != 'referencia']
