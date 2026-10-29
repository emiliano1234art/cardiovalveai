"""Primitivas geométricas (build123d + shapely) y transformaciones 4×4 de CardioValveAI v4."""
from __future__ import annotations
import math
import numpy as np
from build123d import Align, Box, Cylinder, Part, Polygon, Pos, Rot, Text, extrude
from shapely.geometry import Point, Polygon as SPoly
from shapely.ops import unary_union

D2R = math.pi / 180
MIN = (Align.MIN, Align.MIN, Align.MIN)


def _pts(geom):
    from shapely.geometry.polygon import orient
    if geom.geom_type == 'MultiPolygon':
        geom = max(geom.geoms, key=lambda g: g.area)
    geom = orient(geom, 1.0)
    return [(float(x), float(y)) for x, y in list(geom.exterior.coords)[:-1]]


def _ext(geom, amount):
    return extrude(Polygon(*_pts(geom), align=None), amount, dir=(0, 0, 1))


def prism_xy(geom, z0, z1) -> Part:
    return Pos(0, 0, z0) * _ext(geom, z1 - z0)


def prism_xz(geom, y0, y1) -> Part:
    """Perfil en el plano x–z (shapely (x, z)) extruido entre y0 e y1."""
    return Pos(0, y1, 0) * (Rot(X=90) * _ext(geom, y1 - y0))


def prism_yz(geom, x0, x1) -> Part:
    """Perfil en el plano y–z (shapely (y, z)) extruido entre x0 y x1."""
    return Pos(x0, 0, 0) * (Rot(Y=90) * Rot(Z=90) * _ext(geom, x1 - x0))


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


def engrave_text(txt, size, x, y, z_top, depth=0.5, rot=0.0):
    t = Text(txt, size, align=(Align.CENTER, Align.CENTER))
    return Pos(x, y, z_top - depth) * Rot(Z=rot) * extrude(t, depth + 1)


def rz(part, deg):
    return Rot(Z=deg) * part


# ───────────────────────────── matrices ─────────────────────────────
def T(x=0.0, y=0.0, z=0.0):
    m = np.eye(4); m[:3, 3] = (x, y, z); return m


def Rz(deg):
    c, s = math.cos(deg * D2R), math.sin(deg * D2R)
    m = np.eye(4); m[0, 0], m[0, 1], m[1, 0], m[1, 1] = c, -s, s, c; return m


def Ry(deg):
    """Rotación alrededor de +y: lleva +z hacia +x para ángulos positivos."""
    c, s = math.cos(deg * D2R), math.sin(deg * D2R)
    m = np.eye(4); m[0, 0], m[0, 2], m[2, 0], m[2, 2] = c, s, -s, c; return m


def Rx(deg):
    c, s = math.cos(deg * D2R), math.sin(deg * D2R)
    m = np.eye(4); m[1, 1], m[1, 2], m[2, 1], m[2, 2] = c, -s, s, c; return m
