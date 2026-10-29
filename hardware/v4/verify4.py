"""
Verificación digital de CardioValveAI v4 (CAD, no ensayo físico). Resultados en out_v4/_canon/verify.json.
  1. Mallas de impresión: cerradas, un cuerpo, apoyadas, dentro de la cama.
  2. Barrido en TODO el recorrido del servo (β = −90…90°, 37 posiciones): interferencias de cada pieza móvil con todas las demás.
  3. Piezas fijas entre sí (una pose).
  4. Holguras mínimas entre pares críticos.
  5. Montaje: caminos de inserción (pasadores, portasensores, subconjunto pistón + valvas, servo por la ventana), acceso a tornillos y alicate.
  6. Retención de pasadores, ubicación axial de las valvas, corredera dentro de la ranura en todo el recorrido.
  7. Galgas, transmisión, carga del servo, efecto cajón del pistón, campo del Hall (sensing4).
"""
from __future__ import annotations
import itertools
import json
import math
import os
import time
import numpy as np
import trimesh
import manifold3d as m3d

import config4 as C
import kin4 as K
import parts4 as P
import registry4 as R
import assembly4 as A
import sensing4 as S4
from geom4 import T, Ry, Rz

OUT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', C.OUT_DIR))
CANON = os.path.join(OUT, '_canon')
TOL = 0.05          # mm³: por debajo es contacto / redondeo del facetado
MOVING = {'Valva_1', 'Valva_2', 'Valva_3', 'Iman_1', 'Iman_2', 'Iman_3', 'Piston', 'Yugo', 'Pasadores_horquilla', 'Pasador_traba',
          'Manivela', 'Pasador_manivela', 'Horn'}
INTENDED = {frozenset(p) for p in [('Horn', 'Servo'), ('Tornillos_servo', 'Cuerpo'), ('Tornillos_servo', 'Servo')]}   # horn en el estriado; tornillos roscando


def load(name):
    m = trimesh.load(os.path.join(CANON, f'{name}.stl'), process=True)
    m.merge_vertices()
    return m


def man(mesh):
    return m3d.Manifold(m3d.Mesh(vert_properties=np.asarray(mesh.vertices, np.float32), tri_verts=np.asarray(mesh.faces, np.uint32)))


def mtf(M, X):
    return M.transform(np.asarray(X)[:3, :].astype(np.float64))


def instance_names():
    return {inst: it.name for it in R.ITEMS for inst in it.instances}


def cylinder(r, p0, p1, n=32):
    p0, p1 = np.array(p0, float), np.array(p1, float)
    L = float(np.linalg.norm(p1 - p0))
    c = m3d.Manifold.cylinder(L, r, r, n)
    z = np.array([0, 0, 1.0]); dd = (p1 - p0) / L
    v = np.cross(z, dd); s = np.linalg.norm(v); ct = float(np.dot(z, dd))
    Rm = np.eye(3) if s < 1e-9 and ct > 0 else (np.diag([1, -1, -1]) if s < 1e-9 else
                                                   np.eye(3) + (vx := np.array([[0, -v[2], v[1]], [v[2], 0, -v[0]], [-v[1], v[0], 0]])) + vx @ vx * ((1 - ct) / s ** 2))
    M = np.eye(4); M[:3, :3] = Rm; M[:3, 3] = p0
    return c.transform(M[:3, :])


class World:
    def __init__(self):
        self.names = instance_names()
        self.mesh = {n: load(n) for n in set(self.names.values())}
        self.base = {n: man(m) for n, m in self.mesh.items()}

    def placed(self, tf, only=None):
        return {i: mtf(self.base[n], tf[i]) for i, n in self.names.items() if (only is None or i in only)}


def overlap(a, b):
    ba, bb = a.bounding_box(), b.bounding_box()
    if any(ba[k + 3] < bb[k] - 1e-6 or bb[k + 3] < ba[k] - 1e-6 for k in range(3)):
        return 0.0
    return (a ^ b).volume()


# ───────────────────────────── 1 ─────────────────────────────
def print_meshes():
    out = []
    for it in R.PRINTED:
        f = os.path.join(OUT, 'STL', '01_Imprimir_Obligatorio' if it.kind != 'opcional' else '02_Opcional', f'{it.file}.stl')
        m = trimesh.load(f, process=True)
        ext = m.extents
        n = m.face_normals; area = m.area_faces
        down = (n[:, 2] < -0.7072) & (m.triangles_center[:, 2] > 0.3)
        out.append({'pieza': it.file, 'cerrada': bool(m.is_watertight), 'cuerpos': len(m.split(only_watertight=False)), 'z_min': round(float(m.bounds[0][2]), 3),
                    'medidas_mm': [round(float(v), 1) for v in ext], 'cabe_en_cama': bool(ext[0] <= C.BED[0] and ext[1] <= C.BED[1] and ext[2] <= C.BED[2]),
                    'masa_g_petg': round(float(m.volume) * 1.27e-3, 1), 'voladizo_mm2': round(float(area[down].sum()), 1)})
    return out


# ───────────────────────────── 2–4 ─────────────────────────────
def sweep(W, n=37, rng=(-90, 90)):
    """rng (−90, 90): la manivela pasa por el lado +x. (90, 270): el servo gira al revés y pasa por el lado −x
    (la altura del pistón es la misma; cambia por dónde barre la manivela)."""
    worst, contacts = {}, {}
    betas = np.linspace(rng[0], rng[1], n)
    for b in betas:
        pl = W.placed(A.pose(float(b)))
        for a_, b_ in itertools.combinations(sorted(pl), 2):
            if a_ not in MOVING and b_ not in MOVING:
                continue
            if frozenset((a_, b_)) in INTENDED:
                continue
            v = overlap(pl[a_], pl[b_])
            key = f'{a_} × {b_}'
            if v > TOL:
                if key not in worst or v > worst[key]['mm3']:
                    worst[key] = {'mm3': round(v, 3), 'beta': round(float(b), 1)}
            elif v > 0:
                contacts[key] = max(contacts.get(key, 0), round(v, 4))
    return {'poses': len(betas), 'beta_rango': list(rng), 'interferencias': worst, 'contactos': contacts}


def static_pairs(W):
    pl = W.placed(A.pose(-C.BETA_WORK))
    bad = {}
    for a_, b_ in itertools.combinations(sorted(pl), 2):
        if a_ in MOVING or b_ in MOVING or frozenset((a_, b_)) in INTENDED:
            continue
        v = overlap(pl[a_], pl[b_])
        if v > TOL:
            bad[f'{a_} × {b_}'] = round(v, 3)
    return bad


def clearances(W, n=13):
    pairs = [('Valva_1', 'Cuerpo'), ('Valva_1', 'Valva_2'), ('Valva_1', 'Portasensor_1'), ('Valva_1', 'Piston'), ('Valva_1', 'Pasadores_horquilla'),
             ('Piston', 'Cuerpo'), ('Yugo', 'Cuerpo'), ('Manivela', 'Cuerpo'), ('Manivela', 'Yugo'), ('Horn', 'Cuerpo'), ('Piston', 'Servo'),
             ('Yugo', 'Servo'), ('Pasador_traba', 'Valva_1'), ('Valva_3', 'Cuerpo')]
    out = {}
    rng = np.random.default_rng(0)
    for b in np.linspace(-90, 90, n):
        tf = A.pose(float(b))
        for a_, b_ in pairs:
            ma = W.mesh[W.names[a_]].copy(); ma.apply_transform(tf[a_])
            mb = W.mesh[W.names[b_]].copy(); mb.apply_transform(tf[b_])
            lo, hi = mb.bounds[0] - 5, mb.bounds[1] + 5
            pts = ma.vertices[np.all((ma.vertices > lo) & (ma.vertices < hi), axis=1)]
            if len(pts) == 0:
                continue
            if len(pts) > 5000:
                pts = pts[rng.choice(len(pts), 5000, replace=False)]
            dist = float(trimesh.proximity.closest_point(mb, pts)[1].min())
            k = f'{a_} ↔ {b_}'
            if k not in out or dist < out[k]['mm']:
                out[k] = {'mm': round(dist, 3), 'beta': round(float(b), 1)}
    return out


# ───────────────────────────── 5–6 ─────────────────────────────
def assembly_checks(W):
    res = []

    def check(label, ok, detail=''):
        res.append({'comprobacion': label, 'ok': bool(ok), 'detalle': detail})

    def hits(solid, world, allowed=()):
        h = {k: round(overlap(solid, v), 3) for k, v in world.items() if k not in allowed}
        return {k: v for k, v in h.items() if v > TOL}

    closed = W.placed(A.pose(-C.BETA_WORK))
    for i, a in enumerate(C.LEAF_DIR):
        M = Rz(a)
        P_ = lambda u, v, z: (M @ np.array([u, v, z, 1.0]))[:3]
        h = hits(cylinder(1.35, P_(C.D_HINGE, -80, C.Z_HINGE), P_(C.D_HINGE, P.HINGE_PIN[1], C.Z_HINGE)), closed, (f'Pasador_bisagra_{i+1}',))
        check(f'Pasador de bisagra {i+1}: entra desde afuera hasta el fondo del barril sin chocar', not h, h)
        h = hits(cylinder(5.0, P_(C.D_HINGE, P.HINGE_PIN[0] + 1.5, C.Z_HINGE), P_(C.D_HINGE, -90, C.Z_HINGE)), closed, (f'Pasador_bisagra_{i+1}',))
        check(f'Pasador de bisagra {i+1}: el extremo que sobresale se toma con un alicate (Ø10 libre)', not h, h)
        # portasensor: sale hacia afuera 25 mm sin chocar (sin desarmar nada)
        okk, worst = True, {}
        for s in np.linspace(0, 25, 11):
            X = Rz(a) @ T(0, s, 0)
            moved = mtf(W.base['Portasensor_Hall'], X) + mtf(W.base['Hall_TO92'], X)
            h = hits(moved, closed, (f'Portasensor_{i+1}', f'Hall_{i+1}'))
            if h:
                okk = False; worst = h
        check(f'Portasensor {i+1}: se retira hacia afuera sin desarmar la válvula', okk, worst)
        h = hits(cylinder(2.0, P_(C.D_HINGE + 0.5, P.CARRIER_END + 2, C.Z_HINGE), P_(C.D_HINGE + 0.5, P.CARRIER_END + 40, C.Z_HINGE)), closed,
                 (f'Portasensor_{i+1}', f'Hall_{i+1}'))
        check(f'Cable del Hall {i+1}: sale hacia afuera sin obstáculos', not h, h)
        # pasador de la horquilla: alineado con la ranura de la cola en todo el recorrido (sin chocar)
    # subconjunto pistón + yugo + valvas: baja desde arriba hasta su lugar (servo todavía sin montar)
    sub = ('Piston', 'Yugo', 'Pasadores_horquilla', 'Pasador_traba', 'Valva_1', 'Valva_2', 'Valva_3', 'Iman_1', 'Iman_2', 'Iman_3')
    tf_open = A.pose(90.0)
    body = mtf(W.base['Cuerpo'], np.eye(4))
    worst, okk = {}, True
    for dz in np.linspace(0, 70, 36):
        for inst in sub:
            v = overlap(mtf(W.base[W.names[inst]], T(0, 0, dz) @ tf_open[inst]), body)
            if v > TOL:
                okk = False; worst[inst] = max(worst.get(inst, 0), round(v, 3))
    check('Subconjunto pistón + valvas: entra desde arriba (valvas abiertas) hasta su lugar, sin chocar con el cuerpo', okk, worst)
    # servo + horn + manivela: entra por la ventana a lo largo de +y con el horn y el pasador colgando (β = −90°)
    sv = ('Servo', 'Horn', 'Manivela', 'Pasador_manivela')
    tf_low = A.pose(-90.0)
    world90 = W.placed(tf_low)
    others = {k: v for k, v in world90.items() if k not in sv and k != 'Tornillos_servo'}
    worst, okk = {}, True
    for dy in np.linspace(0, 60, 31):
        for inst in sv:
            mv = mtf(W.base[W.names[inst]], T(0, -dy, 0) @ tf_low[inst])
            for k, v in others.items():
                vol = overlap(mv, v)
                if vol > TOL:
                    okk = False; worst[f'{inst} × {k}'] = max(worst.get(f'{inst} × {k}', 0), round(vol, 3))
    check('Servo con horn y manivela: entra por la ventana (horn colgando) y el pasador entra en la ranura del yugo', okk, worst)
    # tornillos de las orejas: destornillador desde afuera por la ventana
    for k, x in enumerate(P.EAR_HOLES_X):
        h = hits(cylinder(2.0, (x, P.Y_EAR0 - 2.0, C.Z_SERVO), (x, -90, C.Z_SERVO)), closed, ('Tornillos_servo',))
        check(f'Tornillo {k+1} de la oreja del servo: destornillador Ø4 desde afuera por la ventana', not h, h)
    h = hits(cylinder(2.5, (P.X_BODY_C, P.Y_BODY_BOT - 0.5, C.Z_SERVO), (P.X_BODY_C, -90, C.Z_SERVO)), closed, ())
    check('Cable del servo: sale por la ventana', not h, h)
    # corredera: el pasador queda dentro de la ranura de la cola en todo el recorrido
    (s0, s1), _ = P.tail_lengths()
    rmin, rmax = min(K.tail_rho(b) for b in np.linspace(-90, 90, 181)), max(K.tail_rho(b) for b in np.linspace(-90, 90, 181))
    check('Corredera: el pasador recorre la ranura de la cola sin llegar a sus extremos', s0 <= rmin - 0.2 and rmax <= s1 - 0.2,
          f'pasador ρ {rmin:.2f}–{rmax:.2f} mm; ranura {s0:.2f}–{s1:.2f} mm (centros)')
    xw = C.CRANK_R + 0.5
    check('Yugo: el pasador de la manivela recorre la ranura sin llegar a sus extremos', C.CRANK_R <= xw, f'±{C.CRANK_R} mm en una ranura de ±{xw} mm (centros)')
    return res


def retention():
    return [
        {'union': 'Pasador de bisagra en la pared y el resalte', 'ajuste': 'a presión', 'largo_a_presion_mm': round(C.SPOT_V - C.BARREL_HALF - C.THRUST_GAP, 1),
         'nota': f'Se saca tirando con alicate del extremo que sobresale {-P.HINGE_PIN[0] - C.SPOT_V:.0f} mm del rebaje'},
        {'union': 'Valva en el pasador', 'ajuste': f'libre ({C.PIN_FREE} sobre Ø{C.PIN_D})', 'largo_mm': round(2 * C.BARREL_HALF - C.MAG_SLOT[2] - 1.2, 1),
         'nota': 'Axialmente queda entre el resalte del cuerpo (−v) y la punta del portasensor (+v)'},
        {'union': 'Pasadores de las horquillas', 'ajuste': 'a presión en las dos mejillas', 'largo_a_presion_mm': 2 * 2.5, 'nota': 'La cola los encierra: no pueden salir con la válvula armada'},
        {'union': 'Pasador de la manivela', 'ajuste': 'a presión', 'largo_a_presion_mm': C.CRANK_T, 'nota': 'No puede retroceder: detrás está el horn'},
        {'union': 'Espiga del yugo', 'ajuste': 'pasador de traba a presión en la espiga, apoyado en el disco', 'largo_a_presion_mm': C.WEB_T, 'nota': 'Empuja el pistón hacia arriba con el hombro y tira hacia abajo con la traba'},
        {'union': 'Imán', 'ajuste': 'ranura con 0,2 mm de holgura + gota de cianoacrilato', 'nota': 'Empujado hasta el fondo; la ranura fija su orientación'},
        {'union': 'Portasensor', 'ajuste': f'deslizante en el túnel ({C.CLR_SLIDE} mm por lado)', 'nota': 'Empujado hasta tocar el barril; fijarlo con cinta o una gota de pegamento caliente en la pestaña'},
    ]


def gauge_checks(W):
    out = []
    names = instance_names()
    for a in P.GAUGE_ANGLES:
        g = mtf(man(load(f'Galga_{a:02d}')), Rz(C.LEAF_DIR[0]))
        r = {'angulo': a}
        for tag, dth in (('antes', -0.3), ('despues', 0.7)):
            th = a + dth
            tf = A.pose(K.beta_for_theta(max(C.THETA_MIN, min(C.THETA_MAX, th))), theta_override=th)
            pl = W.placed(tf)
            r[tag] = {k: round(overlap(g, v), 3) for k, v in pl.items() if overlap(g, v) > TOL}
        r['ok'] = (not r['antes']) and set(r['despues']) == {'Valva_1'}
        out.append(r)
    return out


def drive():
    rows = []
    for b in (-90, -60, -40, -20, 0, 20, 40, 60, 90):
        tr = K.transmission(b)
        rows.append({'beta': b, 'comando_servo': 90 - b, 'theta': round(K.theta(b), 1), 'piston_z': round(K.piston_z(b), 2),
                     'cos_yugo': round(tr['yugo'], 3), 'cos_cola': round(tr['cola'], 3)})
    work = [K.transmission(b) for b in np.linspace(-C.BETA_WORK, C.BETA_WORK, 81)]
    return {'tabla': rows, 'cos_min_trabajo': round(min(min(t['yugo'], t['cola']) for t in work), 3),
            'nota': 'En los extremos del servo (±90°) el yugo queda en punto muerto: la valva no se mueve más, el servo no se fuerza (no hay topes).'}


def loads(masses):
    g = 9.81e-3
    m_mov = masses.get('03_Piston_x1', 0) + masses.get('04_Yugo_x1', 0) + 3 * masses.get('02_Valva_x3', 0) / 3 * 1 + 1.0
    f_w = m_mov * g                              # N (peso de lo que sube)
    f_fric = 3 * 0.3 * 0.35 + 3 * 0.2 * 0.35     # zapatas y correderas con carga lateral supuesta 0,3 / 0,2 N, μ = 0,35
    F = f_w + f_fric
    torque = F * C.CRANK_R / math.cos(math.radians(C.BETA_WORK)) / math.cos(math.radians(C.TAIL_PSI0))
    stall = 1.8 * 98.0665
    L = C.SHOE[2]
    return {'masa_movil_g': round(m_mov, 1), 'fuerza_N': round(F, 2), 'par_Nmm': round(torque, 1), 'par_kgcm': round(torque / 98.0665, 3),
            'par_bloqueo_MG90S_kgcm_no_verificado': 1.8, 'margen_x': round(stall / torque, 1),
            'cajon': {'guia_mm': L, 'excentricidad_una_valva_trabada_mm': round(P.LUG_UV[0], 1),
                      'limite_seco_mm_mu_0.35': round(L / (2 * 0.35), 1), 'limite_lubricado_mm_mu_0.15': round(L / (2 * 0.15), 1),
                      'lectura': (f'Si UNA valva se traba, la fuerza actúa a {P.LUG_UV[0]:.1f} mm del eje; el pistón podría acuñarse en seco '
                                  f'(límite ≈ {L / 0.7:.1f} mm con μ 0,35) pero no lubricado (≈ {L / 0.3:.1f} mm con μ 0,15): engrasar las zapatas.')}}


def main():
    t0 = time.time()
    res = {'generado': time.strftime('%Y-%m-%d %H:%M'), 'unidades': 'mm', 'revision': C.REVISION}
    print('· mallas'); res['mallas'] = print_meshes()
    W = World()
    print('· barrido'); res['barrido'] = sweep(W)
    print('· barrido, servo girando al revés'); res['barrido_sentido_inverso'] = sweep(W, rng=(90, 270))
    print('· piezas fijas'); res['fijas'] = static_pairs(W)
    print('· holguras'); res['holguras'] = clearances(W)
    print('· montaje'); res['montaje'] = assembly_checks(W)
    res['retencion'] = retention()
    print('· galgas'); res['galgas'] = gauge_checks(W)
    res['accionamiento'] = drive()
    res['cargas'] = loads({m['pieza']: m['masa_g_petg'] for m in res['mallas']})
    print('· campo del Hall'); res['hall'] = S4.evaluate()
    res['geometria'] = {'OD': C.OD, 'ID': C.ID, 'alto_cuerpo': round(C.TOP_Z, 1), 'z_bisagra': C.Z_HINGE, 'd_bisagra': C.D_HINGE,
                        'theta_trabajo': [round(K.theta(-C.BETA_WORK), 1), round(K.theta(C.BETA_WORK), 1)], 'theta_servo_completo': [round(C.THETA_MIN, 1), round(C.THETA_MAX, 1)],
                        'pasadores_mm': {'bisagra': R.HINGE_L, 'horquilla': R.LUG_L, 'manivela': R.CRANK_L, 'traba': R.LOCK_L}}
    res['segundos'] = round(time.time() - t0, 1)
    json.dump(res, open(os.path.join(CANON, 'verify.json'), 'w'), indent=1, ensure_ascii=False)
    bad_mesh = [m['pieza'] for m in res['mallas'] if not (m['cerrada'] and m['cuerpos'] == 1 and abs(m['z_min']) < 1e-3 and m['cabe_en_cama'])]
    print('mallas con problemas:', bad_mesh)
    print('interferencias:', json.dumps(res['barrido']['interferencias'], ensure_ascii=False))
    print('fijas con choques:', res['fijas'])
    print('montaje fallido:', [(c['comprobacion'], c['detalle']) for c in res['montaje'] if not c['ok']])
    print('galgas:', [(g['angulo'], g['ok']) for g in res['galgas']])
    print('holgura mínima:', min((v['mm'], k) for k, v in res['holguras'].items()))
    print('cargas:', res['cargas']['par_kgcm'], 'kg·cm, margen', res['cargas']['margen_x'])
    print(f'Total {res["segundos"]} s')


if __name__ == '__main__':
    main()
