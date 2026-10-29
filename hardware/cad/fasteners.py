"""
Fijaciones de CardioValveAI v3.1: todas impresas en PETG o de latón Ø2 (sin tornillería metálica comprada).

Por qué así:
  · Una rosca M2 o M3 tiene paso 0,4–0,5 mm: igual o menor que la boquilla de 0,4 mm de una impresora FDM común.
    Impresa sale deforme y se barre al apretar. Por eso NO se imprimen tornillos M2/M3.
  · Donde la unión es estructural y hay lugar, se usa rosca métrica M6 IMPRESA (paso 1,0 mm), con perfil ISO
    (bd_warehouse.IsoThread) y una compensación radial THREAD_COMP que se ajusta con la probeta `Thread_Coupon`.
  · Donde no hay lugar para M6 (topes, bielas, horquilla, pivote del micrófono) se usa un pasador de LATÓN Ø2
    (la misma varilla de los ejes) con una cabeza impresa pegada y una tuerca impresa a presión.

Marcos canónicos (los que usa el ensamblaje):
  · perno: cara de apoyo de la cabeza en z = 0, cabeza en z ∈ [0, h], caña hacia −z.
  · tuerca moleteada: cara de apoyo en z = 0, cuerpo hacia +z.
  · cabeza de pasador: cara de apoyo en z = 0, cuerpo hacia +z, agujero ciego desde z = 0.
  · tuerca a presión: cara de apoyo en z = 0, cuerpo hacia +z.
  · pestillo giratorio: cara inferior en z = 0, espiga hacia −z, brazo hacia +y.
"""
from __future__ import annotations
import math
from functools import lru_cache
from build123d import Align, Box, Cylinder, Part, Pos, RegularPolygon, extrude

import config as C

CEN = (Align.CENTER, Align.CENTER, Align.MIN)


def _cyl(r, z0, z1, x=0.0, y=0.0) -> Part:
    return Pos(x, y, z0) * Cylinder(r, z1 - z0, align=CEN)


@lru_cache(maxsize=None)
def _iso(length: float, external: bool, comp: float, finishes: tuple) -> Part:
    from bd_warehouse.thread import IsoThread
    return IsoThread(major_diameter=C.THREAD_D, pitch=C.THREAD_P, length=length, external=external,
                     end_finishes=finishes, manufacturing_compensation=comp)


def male_thread(z0: float, z1: float, comp: float | None = None, tip: str = 'chamfer', root: str = 'fade') -> Part:
    """Rosca macho M6 impresa entre z0 y z1 (núcleo incluido). `tip` es el extremo en z1."""
    comp = C.THREAD_COMP if comp is None else comp
    t = _iso(round(z1 - z0, 3), True, comp, (root, tip))
    core = Cylinder(t.min_radius, z1 - z0, align=CEN)
    return Pos(0, 0, z0) * (t + core)


def threaded_hole(part: Part, x: float, y: float, z0: float, z1: float, comp: float | None = None) -> Part:
    """Agujero con rosca hembra M6 impresa (eje z) entre z0 y z1 en `part`."""
    comp = C.THREAD_COMP if comp is None else comp
    t = _iso(round(z1 - z0, 3), False, comp, ('chamfer', 'chamfer'))
    r_cut = C.THREAD_D / 2 + comp + 0.05
    part = part - _cyl(r_cut, z0 - 0.01, z1 + 0.01, x, y)
    return part + Pos(x, y, z0) * t


def _knurl(part: Part, r: float, z0: float, z1: float, n: int, depth: float) -> Part:
    """Moleteado recto: n canales semicirculares de profundidad `depth` (mejor agarre con los dedos)."""
    for k in range(n):
        a = 2 * math.pi * k / n
        part -= _cyl(depth, z0 - 1, z1 + 1, (r + depth * 0.35) * math.cos(a), (r + depth * 0.35) * math.sin(a))
    return part


def bolt(length: float = None) -> Part:
    """Perno M6 impreso con cabeza moleteada y ranura (se aprieta con los dedos; ranura para moneda o destornillador plano)."""
    L = C.BOLT_L if length is None else length
    hd, hh = C.BOLT_HEAD
    head = _cyl(hd / 2, 0, hh)
    head = _knurl(head, hd / 2, 0, hh, 16, 0.45)
    head -= Pos(0, 0, hh - 1.0) * Box(hd + 2, 1.4, 2.0, align=CEN)      # ranura 1,4 × 1,0
    shank = male_thread(-L, 0.0, tip='chamfer', root='fade')
    neck = _cyl(C.THREAD_D / 2 - C.THREAD_COMP - 0.6, -0.6, 0.01)           # alivio bajo la cabeza (la rosca no llega a la cara)
    return head + shank + neck


def knurled_nut() -> Part:
    """Tuerca M6 moleteada de las columnas (sobre la comisura del anillo)."""
    d, h = C.KNURL_NUT
    n = _cyl(d / 2, 0, h)
    n = _knurl(n, d / 2, 0, h, 14, 0.35)
    return threaded_hole(n, 0, 0, 0, h)


def pin_head() -> Part:
    """Cabeza impresa del pasador de latón Ø2: se coloca a presión y se fija con una gota de cianoacrilato."""
    d, h = C.PIN_HEAD
    p = _cyl(d / 2, 0, h)
    return p - _cyl(C.PIN_PRESS_HOLE / 2, -0.1, h - 0.4)


def push_nut() -> Part:
    """Tuerca hexagonal impresa A PRESIÓN sobre el latón Ø2 (sin rosca): se empuja hasta apretar y se saca con alicate."""
    hexp = extrude(RegularPolygon(C.M2_NUT_AF / math.sqrt(3), 6, major_radius=True), C.M2_NUT_T)
    return hexp - _cyl(C.PIN_PRESS_HOLE / 2, -0.1, C.M2_NUT_T + 0.1)


TURN_ARM = 8.0     # distancia del eje del pestillo a la punta de su brazo
TURN_W = 6.4
TURN_T = 2.4
TURN_PEG_L = 5.0


def turn_button() -> Part:
    """Pestillo giratorio de la bandeja: gira sobre una espiga en el poste y apoya sobre el borde de la placa perforada.
    Reemplaza a las barras de sujeción y sus 4 tornillos (la placa no se perfora ni se flexiona)."""
    from shapely.geometry import Point
    from shapely.ops import unary_union
    import parts as P
    prof = unary_union([Point(0, 0).buffer(TURN_W / 2, 48), Point(0, TURN_ARM).buffer(TURN_W / 2, 48)]).convex_hull
    body = P.prism_xy(prof, 0, TURN_T)
    body -= P.box(-0.6, 0.6, 1.0, TURN_ARM, TURN_T - 0.8, TURN_T + 1.0)     # muesca para girarlo con la uña o un destornillador
    peg = _cyl(C.TURN_PEG_D / 2, -TURN_PEG_L, 0.01)
    return body + peg


def thread_coupon() -> Part:
    """Probeta de roscas: 3 agujeros M6 con compensación 0,10 / 0,20 / 0,30 mm (número de muescas = 1, 2, 3).
    Se prueba con un perno M6×8 impreso: elegir el agujero que entra a mano, sin juego visible, y ajustar THREAD_COMP."""
    import parts as P
    p = P.box(0, 42, 0, 14, 0, 6)
    for k, comp in enumerate((0.10, 0.20, 0.30)):
        x = 7 + 14 * k
        p = threaded_hole(p, x, 7, 0, 6, comp=comp)
        for j in range(k + 1):
            p -= P.box(x - 3 + 2.2 * j, x - 2.2 + 2.2 * j, 13.2, 15, -1, 7)    # muescas de identificación
    return p


def comp_label() -> str:
    return f'{C.THREAD_COMP:.2f}'.replace('.', ',')
