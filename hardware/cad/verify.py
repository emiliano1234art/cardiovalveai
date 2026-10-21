"""
Verificaciones digitales de CardioVal AI (no reemplazan ensayos físicos).

1. Mallas STL de impresión: cerradas (watertight), orientación coherente, un solo cuerpo,
   volumen positivo, escala en mm, volumen de impresión, voladizos > 45° (soportes).
2. Interferencias (intersección booleana exacta con manifold3d) entre TODAS las piezas
   del ensamblaje, en 25 posiciones del servo × 5 modos.
3. Holgura mínima entre piezas móviles y su entorno (distancia punto–superficie).
4. Montaje: inserción de ejes y tornillos, acceso de herramientas.
5. Estimación de carga del servo.
Resultado: out/_canon/verify.json  (lo usa make_docs.py)
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

import config as C
import kinematics as K
import registry as R
import assembly as A

OUT = os.path.join(os.path.dirname(__file__), '..', 'out')
CANON = os.path.join(OUT, '_canon')
CONTACT_TOL = 0.05     # mm³: por debajo se considera contacto/redondeo de facetado

def load(name):
    m = trimesh.load(os.path.join(CANON, f'{name}.stl'), process=True)
    m.merge_vertices()
    return m

def to_manifold(m: trimesh.Trimesh) -> m3d.Manifold:
    mesh = m3d.Mesh(vert_properties=np.asarray(m.vertices, np.float32), tri_verts=np.asarray(m.faces, np.uint32))
    return m3d.Manifold(mesh)

def mtf(man: m3d.Manifold, M: np.ndarray) -> m3d.Manifold:
    return man.transform(M[:3, :].astype(np.float64))

# ───────────────────────────── 1. mallas de impresión ─────────────────────────────

def check_print_meshes():
    res = []
    bed = np.array(C.BED)
    for it in R.ITEMS:
        if not it.printable:
            continue
        f = os.path.join(OUT, f'{C.PREFIX}_STL', f'{C.PREFIX}_{it.name}.stl')
        m = trimesh.load(f, process=True)
        bodies = m.split(only_watertight=False)
        man = to_manifold(m)
        ext = m.extents
        # voladizos: caras hacia abajo (> 45° desde la vertical) que no están en la cama.
        #  · techos casi horizontales angostos (≤ 8 mm en planta) = puentes imprimibles sin soporte
        #  · pendientes 45–70° o techos anchos = requieren soporte
        n = m.face_normals
        c = m.triangles_center
        down = (n[:, 2] < -math.cos(math.radians(45))) & (c[:, 2] > 0.3)
        overhang, bridges = 0.0, 0.0
        idx = np.nonzero(down)[0]
        if len(idx):
            sub = m.submesh([idx], append=True)
            for comp in sub.split(only_watertight=False):
                ext2 = np.sort(comp.extents[:2])
                flat = np.mean(comp.face_normals[:, 2]) < -0.94
                if ext2[0] <= 3.2 or (flat and ext2[0] <= 12.0):
                    bridges += float(comp.area)      # agujeros pequeños y techos angostos: se imprimen como puente
                else:
                    overhang += float(comp.area)
        fits = bool(np.all(np.sort(ext[:2]) <= np.sort(bed[:2])) and ext[2] <= bed[2])
        res.append({
            'part': it.name, 'file': os.path.basename(f), 'qty': it.qty,
            'watertight': bool(m.is_watertight), 'winding': bool(m.is_winding_consistent),
            'manifold_ok': man.status() == m3d.Error.NoError, 'bodies': len(bodies),
            'volume_mm3': round(float(m.volume), 1), 'mass_g_petg': round(float(m.volume) * 1.27e-3, 1),
            'triangles': int(len(m.faces)), 'size_mm': [round(float(v), 1) for v in ext],
            'zmin': round(float(m.bounds[0][2]), 3), 'fits_bed': fits,
            'overhang_mm2': round(overhang, 1), 'bridge_mm2': round(bridges, 1), 'needs_support': overhang > 20.0,
        })
    return res

# ───────────────────────────── 2–3. barrido cinemático ─────────────────────────────
MOVING = {'Leaflet_1', 'Leaflet_2', 'Leaflet_3', 'Link_1', 'Link_2', 'Link_3', 'Actuator_Plate', 'Pushrod', 'Servo_Horn_Reference'}
IGNORE = {frozenset(p) for p in [('Servo_Horn_Reference', 'Servo_MG90S_Reference')]}   # horn encajado en el eje (intencional)

def instance_meshes(mode: str):
    """Mallas canónicas por instancia, con la biela que corresponde a cada módulo del modo."""
    link_for = {'N': 'Link_Normal', 'R60': 'Link_LostMotion', 'R45': 'Link_LostMotion', 'IC': 'Link_LostMotion_IC'}
    stop_for = {'N': 'Opening_Stop_84', 'R60': 'Opening_Stop_60', 'R45': 'Opening_Stop_45', 'IC': 'Opening_Stop_84'}
    names = {}
    for it in R.ITEMS:
        for inst in it.instances:
            names[inst] = it.name
    for i, mk in enumerate(K.MODES[mode]):
        names[f'Link_{i+1}'] = link_for[mk]
        names[f'Stop_{i+1}'] = stop_for[mk]
    return names

def sweep(n_pos=25):
    cache_mesh, cache_man = {}, {}
    def get(name):
        if name not in cache_man:
            cache_mesh[name] = load(name)
            cache_man[name] = to_manifold(cache_mesh[name])
        return cache_mesh[name], cache_man[name]
    results = {}
    worst = {}
    contacts = {}
    t0 = time.time()
    betas = np.linspace(C.SERVO_SWEEP, -C.SERVO_SWEEP, n_pos)
    for mode in K.MODES:
        names = instance_meshes(mode)
        for beta in betas:
            tf = A.pose_transforms(float(beta), mode)
            placed = {}
            boxes = {}
            for inst, nm in names.items():
                mesh, man = get(nm)
                M = tf[inst]
                pm = mtf(man, M)
                placed[inst] = pm
                bb = pm.bounding_box()
                boxes[inst] = (np.array(bb[:3]), np.array(bb[3:]))
            for a, b in itertools.combinations(sorted(placed), 2):
                if a not in MOVING and b not in MOVING:
                    continue
                if frozenset((a, b)) in IGNORE:
                    continue
                (amin, amax), (bmin, bmax) = boxes[a], boxes[b]
                if np.any(amax < bmin - 1e-6) or np.any(bmax < amin - 1e-6):
                    continue
                v = (placed[a] ^ placed[b]).volume()
                key = f'{a} × {b}'
                if v > CONTACT_TOL:
                    w = worst.get(key)
                    if not w or v > w['volume']:
                        worst[key] = {'volume': round(v, 3), 'mode': mode, 'beta': round(float(beta), 1)}
                elif v > 0:
                    contacts[key] = max(contacts.get(key, 0.0), round(v, 4))
    results['interferences'] = worst
    results['contacts'] = contacts
    results['poses_checked'] = len(betas) * len(K.MODES)
    results['seconds'] = round(time.time() - t0, 1)
    return results, cache_mesh

def clearance(cache_mesh, n_pos=9):
    """Holgura mínima (mm) entre pares móviles críticos, por muestreo punto–superficie."""
    pairs = [('Leaflet_1', 'Valve_Ring'), ('Leaflet_1', 'Leaflet_2'), ('Leaflet_2', 'Leaflet_3'), ('Leaflet_1', 'MEMS_Mount'),
             ('Leaflet_1', 'Stop_1'), ('Link_1', 'Valve_Ring'), ('Link_1', 'Stop_1'), ('Link_1', 'Leaflet_1'),
             ('Actuator_Plate', 'Valve_Ring'), ('Actuator_Plate', 'Column_1'), ('Actuator_Plate', 'Stop_1'),
             ('Pushrod', 'Actuator_Plate'), ('Pushrod', 'Servo_Horn_Reference'), ('Pushrod', 'Servo_MG90S_Reference')]
    out = {}
    rng = np.random.default_rng(0)
    for mode in K.MODES:
        names = instance_meshes(mode)
        for beta in np.linspace(C.SERVO_SWEEP, -C.SERVO_SWEEP, n_pos):
            tf = A.pose_transforms(float(beta), mode)
            for a, b in pairs:
                ma = cache_mesh.get(names[a]) or load(names[a]); mb = cache_mesh.get(names[b]) or load(names[b])
                pa = trimesh.transformations.transform_points(ma.vertices, tf[a])
                mbt = mb.copy(); mbt.apply_transform(tf[b])
                # filtrar puntos lejanos para acelerar
                lo, hi = mbt.bounds[0] - 6, mbt.bounds[1] + 6
                sel = np.all((pa > lo) & (pa < hi), axis=1)
                pts = pa[sel]
                if len(pts) == 0:
                    continue
                if len(pts) > 4000:
                    pts = pts[rng.choice(len(pts), 4000, replace=False)]
                _, dist, _ = trimesh.proximity.closest_point(mbt, pts)
                d = float(dist.min())
                key = f'{a} ↔ {b}'
                if key not in out or d < out[key]['min_mm']:
                    out[key] = {'min_mm': round(d, 3), 'mode': mode, 'beta': round(float(beta), 1)}
    return out

# ───────────────────────────── 4. montaje ─────────────────────────────

def assembly_checks(cache_mesh):
    """Trayectorias de herramientas y elementos de unión (cilindros) que no deben chocar con nada."""
    import parts as P
    from build123d import export_stl
    tf = A.pose_transforms(C.SERVO_SWEEP, 'NORMAL')
    names = instance_meshes('NORMAL')
    world = {}
    for inst, nm in names.items():
        m = (cache_mesh.get(nm) or load(nm)).copy()
        m.apply_transform(tf[inst])
        world[inst] = to_manifold(m)
    checks = []

    def cyl(r, p0, p1):
        p0, p1 = np.array(p0, float), np.array(p1, float)
        L = float(np.linalg.norm(p1 - p0))
        c = m3d.Manifold.cylinder(L, r, r, 32)
        z = np.array([0, 0, 1.0]); d = (p1 - p0) / L
        v = np.cross(z, d); s = np.linalg.norm(v); cth = float(np.dot(z, d))
        if s < 1e-9:
            Rm = np.eye(3) if cth > 0 else np.diag([1, -1, -1])
        else:
            vx = np.array([[0, -v[2], v[1]], [v[2], 0, -v[0]], [-v[1], v[0], 0]])
            Rm = np.eye(3) + vx + vx @ vx * ((1 - cth) / s ** 2)
        M = np.eye(4); M[:3, :3] = Rm; M[:3, 3] = p0
        return c.transform(M[:3, :])

    def test(label, solid, allowed=()):
        hits = {}
        for inst, man in world.items():
            if inst in allowed:
                continue
            v = (solid ^ man).volume()
            if v > CONTACT_TOL:
                hits[inst] = round(v, 3)
        checks.append({'check': label, 'ok': not hits, 'hits': hits})

    ring = A.RING
    def ring_pt(i, x, y, z):
        M = ring @ A.Rz(K.leaf_dir(i))
        return (M @ np.array([x, y, z, 1.0]))[:3]
    for i in range(3):
        # eje de bisagra: el eje Ø2 entra desde el exterior y recorre todo el agujero
        test(f'Eje Ø2 de la valva {i+1}: inserción desde el exterior (camino libre)', cyl(1.0, ring_pt(i, C.HINGE_D, -60, C.Z_HINGE), ring_pt(i, C.HINGE_D, 60, C.Z_HINGE)), allowed=(f'Pin_{i+1}',))
        # tornillo de columna: cabeza M3 + llave allen desde arriba
        a = (K.leaf_dir(i) + 60) * math.pi / 180
        cx, cy = A.VX + C.COLUMN_R * math.cos(a), A.VY + C.COLUMN_R * math.sin(a)
        top = A.Z_RING + C.RING_H + C.POST_H
        test(f'Tornillo M3 de la columna {i+1}: acceso vertical desde arriba', cyl(1.4, (cx, cy, top - 25), (cx, cy, top + 60)), allowed=(f'Column_{i+1}',))
        # tornillo del tope: M2 desde arriba
        sx, sy = __import__('parts').STOP_SCREW
        test(f'Tornillo M2 del tope {i+1}: acceso vertical desde arriba', cyl(0.9, ring_pt(i, sx, sy, -2.0), ring_pt(i, sx, sy, 80)), allowed=(f'Stop_{i+1}',))
        # tornillos de las almohadillas: acceso radial
        for s in (-1, 1):
            Mp = ring @ A.Rz(K.leaf_dir(i) + C.PAD_ANGLE_OFFSET)
            p0 = (Mp @ np.array([C.PAD_FACE_R - 5.5, s * C.PAD_SCREW_SPACING / 2, C.PAD_H / 2, 1]))[:3]
            p1 = (Mp @ np.array([C.PAD_FACE_R + 60, s * C.PAD_SCREW_SPACING / 2, C.PAD_H / 2, 1]))[:3]
            mount = {0: 'MEMS_Mount', 1: 'Piezo_Mount'}.get(i)
            allowed = (mount, 'Piezo_Cover') if mount else ()
            test(f'Tornillo M2 de la almohadilla {i+1}{"ab"[s > 0]}: acceso radial', cyl(0.9, p0, p1), allowed=allowed)
        # tornillo M2 cola–biela: eje libre (cola con piloto 1,8; biela 2,4)
        th = 0.0
        tx, tz = K.tail_end(th)
        test(f'Tornillo M2 cola–biela de la valva {i+1}: agujeros alineados', cyl(0.8, ring_pt(i, tx, C.TAIL_Y[0] + 0.5, tz), ring_pt(i, tx, C.LINK_Y[1] + 0.2, tz)))
        # tornillo M2 biela–orejeta del plato
        zp = K.zp_from_servo(C.SERVO_SWEEP)
        test(f'Tornillo M2 biela–plato de la valva {i+1}: agujeros alineados', cyl(0.8, ring_pt(i, C.LINK_PIN_X, C.TAB_Y[0] - 0.5, zp), ring_pt(i, C.LINK_PIN_X, C.LINK_Y[1] + 0.5, zp)))
    # acceso del destornillador al tornillo biela–plato: tangencial, bajo el anillo, con el plato abajo (servo 50°)
    tf_open = A.pose_transforms(-C.SERVO_SWEEP, 'NORMAL')
    world_open = {}
    for inst, nm in names.items():
        m = (cache_mesh.get(nm) or load(nm)).copy(); m.apply_transform(tf_open[inst]); world_open[inst] = to_manifold(m)
    zpo = K.zp_from_servo(-C.SERVO_SWEEP)
    for i in range(3):
        M = ring @ A.Rz(K.leaf_dir(i))
        p0 = (M @ np.array([C.LINK_PIN_X, C.LINK_Y[1] + 1.6, zpo, 1]))[:3]
        p1 = (M @ np.array([C.LINK_PIN_X, C.LINK_Y[1] + 70, zpo, 1]))[:3]
        tool = cyl(1.5, p0, p1)
        hits = {k: round((tool ^ v).volume(), 3) for k, v in world_open.items() if (tool ^ v).volume() > CONTACT_TOL}
        checks.append({'check': f'Tornillo M2 biela–plato de la valva {i+1}: acceso del destornillador (plato abajo)', 'ok': not hits, 'hits': hits})
    # horquilla del plato y empujador
    zp = K.zp_from_servo(C.SERVO_SWEEP)
    kz = A.Z_RING + zp - C.PLATE_TAB_PIN_Z + C.CLEVIS_PIN_Z
    test('Tornillo M2 horquilla–empujador: agujeros alineados', cyl(0.8, (A.VX, A.VY - 5, kz), (A.VX, A.VY + 5, kz)))
    # tornillos de las orejas del servo: acceso desde el lado del horn (−y)
    import parts as P
    L = P.servo_layout(A.ZS)
    for s in (-1, 1):
        x = A.VX + L['body_cx'] + s * C.SERVO.tab_hole_spacing / 2
        y = A.VY + L['y_of_h'](C.SERVO.tab_h + C.SERVO.tab_t)
        test(f'Tornillo M2 oreja {"izq der".split()[s > 0]} del servo: acceso con destornillador', cyl(1.2, (x, y + 0.5, A.ZS), (x, y - 60, A.ZS)), allowed=('Servo_MG90S_Reference', 'Servo_Mount'))
    return checks

# ───────────────────────────── 5. carga del servo ─────────────────────────────

def servo_load(masses):
    """Fuerza vertical en el empujador y par en la palanca (estimación conservadora)."""
    g = 9.81
    m_plate = masses['Actuator_Plate'] + 3 * masses['Link_Normal'] + masses['Pushrod']
    # par de gravedad de cada valva (centro de masa a ~9 mm del eje) llevado al pasador de la cola
    m_leaf = masses['Leaflet_1']
    tail_force = (m_leaf * 1e-3 * g * 9.0) / (C.TAIL_LT * math.cos(math.radians(C.TAIL_PHI0)))
    friction_mu = 0.35            # PETG–PETG / acero sin lubricar (valor conservador)
    side_load = 0.3              # N supuesto por desalineación en los bujes
    elastic = 0.6                # N por elástico de los módulos alterados (2 en modo asimétrico)
    F = m_plate * 1e-3 * g + 3 * tail_force + friction_mu * side_load * 3 + 2 * elastic
    torque_Nm = F * K.CRANK_R * 1e-3
    stall_Nm = 1.8 * 9.81 / 100   # 1,8 kg·cm a 4,8 V (dato de distribuidores, NO verificado)
    return {'plate_and_links_g': round(m_plate, 1), 'force_N': round(F, 3), 'torque_Nmm': round(torque_Nm * 1000, 2),
            'torque_kgcm': round(torque_Nm * 100 / 9.81, 3), 'mg90s_stall_kgcm_unverified': 1.8, 'margin_x': round(stall_Nm / torque_Nm, 1)}

def main():
    t0 = time.time()
    res = {'generated': time.strftime('%Y-%m-%d %H:%M'), 'units': 'mm'}
    print('· mallas de impresión'); res['print_meshes'] = check_print_meshes()
    masses = {r['part']: r['mass_g_petg'] for r in res['print_meshes']}
    print('· barrido de interferencias'); sw, cache = sweep(25)
    res['sweep'] = sw
    print(f'  {sw["poses_checked"]} poses en {sw["seconds"]} s · interferencias: {len(sw["interferences"])}')
    print('· holguras'); res['clearance'] = clearance(cache)
    print('· montaje'); res['assembly'] = assembly_checks(cache)
    res['servo'] = servo_load(masses)
    # cinemática tabulada
    kin = {}
    for mode in K.MODES:
        rows = []
        for beta in np.linspace(C.SERVO_SWEEP, -C.SERVO_SWEEP, 9):
            p = K.pose(float(beta), mode)
            rows.append({'servo_cmd_deg': round(K.servo_command(float(beta)), 1), 'plate_mm': round(p['zp'] - K.Z_TOP, 2),
                         'theta': [round(s['theta'], 1) for s in p['leaves']], 'on_stop': [s['on_stop'] for s in p['leaves']],
                         'slot_mm': [round(s['slot_used'], 2) for s in p['leaves']], 'transmission': [round(s['transmission'], 1) for s in p['leaves']]})
        kin[mode] = rows
    res['kinematics'] = kin
    res['geometry'] = {'stroke_mm': round(K.STROKE, 3), 'crank_r_mm': round(K.CRANK_R, 3), 'ic_link_mm': round(K.MODULES['IC'].L, 3),
                       'ring_bottom_z': round(A.Z_RING, 2), 'servo_shaft_z': round(A.ZS, 2), 'column_h': round(A.COLUMN_H, 2)}
    with open(os.path.join(CANON, 'verify.json'), 'w') as f:
        json.dump(res, f, indent=1, ensure_ascii=False)
    bad_mesh = [r['part'] for r in res['print_meshes'] if not (r['watertight'] and r['winding'] and r['manifold_ok'] and r['bodies'] == 1 and r['fits_bed'] and abs(r['zmin']) < 1e-3)]
    print('mallas con problemas:', bad_mesh)
    print('interferencias:', json.dumps(sw['interferences'], ensure_ascii=False, indent=1))
    print('montaje fallido:', [c for c in res['assembly'] if not c['ok']])
    print('holgura mínima:', min(v['min_mm'] for v in res['clearance'].values()))
    print('servo:', res['servo'])
    print(f'Total {time.time() - t0:.0f} s')

if __name__ == '__main__':
    main()
