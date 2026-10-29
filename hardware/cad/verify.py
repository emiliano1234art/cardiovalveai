"""
Verificaciones digitales de CardioValveAI (no reemplazan ensayos físicos).

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

OUT = os.path.join(os.path.dirname(__file__), '..', C.OUT_DIR)
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
                from shapely.geometry import MultiPoint
                rect = MultiPoint([tuple(v) for v in comp.vertices[:, :2]]).minimum_rotated_rectangle
                xy = np.array(rect.exterior.coords) if rect.geom_type == 'Polygon' else np.zeros((2, 2))
                sides = sorted(np.linalg.norm(np.diff(xy[:3], axis=0), axis=1)) if len(xy) >= 3 else [0.0, 0.0]
                ext2 = np.array(sides)          # ancho y largo mínimos (orientados) en planta
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
MOVING = {'Leaflet_1', 'Leaflet_2', 'Leaflet_3', 'Link_1', 'Link_2', 'Link_3', 'Actuator_Plate', 'Pushrod', 'Servo_Horn_Reference',
          'Magnet_1', 'Magnet_2', 'Magnet_3', 'Tail_Pin_1', 'Tail_Pin_2', 'Tail_Pin_3', 'Plate_Fasteners_Reference',
          'Cable_Routes_Reference'}   # los cables se comparan contra TODO (salvo las piezas por las que pasan a propósito)
_CABLE_HOSTS = ['Valve_Ring', 'Hall_1', 'Hall_2', 'Hall_3', 'Hall_Carrier_1', 'Hall_Carrier_2', 'Hall_Carrier_3', 'Cable_Clip_1', 'Cable_Clip_2', 'Cable_Clip_3',
                'MEMS_Stand_Holder', 'MEMS_Board_Reference', 'Base', 'Electronics_Tray', 'Perfboard_ESP32_Reference',
                'Servo_MG90S_Reference']
IGNORE = {frozenset(p) for p in [('Servo_Horn_Reference', 'Servo_MG90S_Reference')]   # horn encajado en el eje (intencional)
          + [(f'Tail_Pin_{i}', f'Leaflet_{i}') for i in (1, 2, 3)]                       # pasador a presión en la cola (intencional)
          + [('Cable_Routes_Reference', h) for h in _CABLE_HOSTS]}

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
    betas = np.linspace(K.SWEEP, -K.SWEEP, n_pos)
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
    pairs = [('Leaflet_1', 'Valve_Ring'), ('Leaflet_1', 'Leaflet_2'), ('Leaflet_2', 'Leaflet_3'),
             ('Leaflet_1', 'Hall_1'), ('Leaflet_1', 'Hall_Carrier_1'), ('Magnet_1', 'Hall_1'), ('Link_1', 'Hall_Carrier_1'), ('Tail_Pin_1', 'Hall_Carrier_1'),
             ('Leaflet_2', 'Hall_Carrier_1'), ('Actuator_Plate', 'Ring_Fasteners_Reference'), ('Plate_Fasteners_Reference', 'Stop_1'),
             ('Plate_Fasteners_Reference', 'Column_1'), ('Cable_Routes_Reference', 'Actuator_Plate'), ('Cable_Routes_Reference', 'Pushrod'),
             ('Cable_Routes_Reference', 'Link_1'), ('Cable_Routes_Reference', 'Column_1'),
             ('Leaflet_1', 'Stop_1'), ('Link_1', 'Valve_Ring'), ('Link_1', 'Stop_1'), ('Link_1', 'Leaflet_1'),
             ('Actuator_Plate', 'Valve_Ring'), ('Actuator_Plate', 'Column_1'), ('Actuator_Plate', 'Stop_1'),
             ('Pushrod', 'Actuator_Plate'), ('Pushrod', 'Servo_Horn_Reference'), ('Pushrod', 'Servo_MG90S_Reference')]
    out = {}
    rng = np.random.default_rng(0)
    for mode in K.MODES:
        names = instance_meshes(mode)
        for beta in np.linspace(K.SWEEP, -K.SWEEP, n_pos):
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
    tf = A.pose_transforms(K.SWEEP, 'NORMAL')
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
        # tuerca moleteada M6 de la columna: se enrosca con los dedos desde arriba (cilindro de Ø 9 + 6 mm para los dedos)
        a = (K.leaf_dir(i) + 60) * math.pi / 180
        cx, cy = A.VX + C.COLUMN_R * math.cos(a), A.VY + C.COLUMN_R * math.sin(a)
        top = A.Z_RING + C.RING_H + C.POST_H
        test(f'Tuerca moleteada M6 de la columna {i+1}: acceso con los dedos desde arriba', cyl(C.KNURL_NUT[0] / 2 + 3.0, (cx, cy, top + 0.05), (cx, cy, top + 60)),
             allowed=(f'Column_{i+1}', 'Ring_Fasteners_Reference'))
        # pasador del tope: latón Ø2 desde arriba, tuerca a presión en la brida
        sx, sy = __import__('parts').STOP_SCREW
        test(f'Pasador de latón del tope {i+1}: inserción vertical desde arriba', cyl(0.9, ring_pt(i, sx, sy, -2.0), ring_pt(i, sx, sy, 80)), allowed=(f'Stop_{i+1}', 'Ring_Fasteners_Reference'))
        # portasensor Hall: se retira y se vuelve a colocar verticalmente sin desarmar
        hx, hy, hz = C.HALL_XYZ
        test(f'Portasensor H{i+1}: extracción vertical sin desarmar (cuerpo del sensor)', cyl(0.7, ring_pt(i, hx, hy, hz), ring_pt(i, hx, hy, 90)),
             allowed=(f'Hall_{i+1}', f'Hall_Carrier_{i+1}', 'Cable_Routes_Reference'))
        test(f'Portasensor H{i+1}: extracción vertical sin desarmar (lomo)', cyl(0.7, ring_pt(i, C.HALL_POCKET_BACK - 0.9, hy, hz), ring_pt(i, C.HALL_POCKET_BACK - 0.9, hy, 90)),
             allowed=(f'Hall_{i+1}', f'Hall_Carrier_{i+1}', 'Cable_Routes_Reference'))
        # pasador de latón cola–biela: agujeros alineados (cola Ø{TAIL_PIN_HOLE}, biela Ø{LINK_HOLE})
        tx, tz = K.tail_end(0.0)
        test(f'Pasador Ø2 cola–biela de la valva {i+1}: agujeros alineados', cyl(0.8, ring_pt(i, tx, C.TAIL_Y[0] + 0.5, tz), ring_pt(i, tx, C.LINK_Y[1] + 0.2, tz)), allowed=(f'Tail_Pin_{i+1}',))
        zp = K.zp_from_servo(K.SWEEP)
        test(f'Pasador biela–plato de la valva {i+1}: agujeros alineados', cyl(0.8, ring_pt(i, C.LINK_PIN_X, C.TAB_Y[0] - 0.5, zp), ring_pt(i, C.LINK_PIN_X, C.LINK_Y[1] + 0.5, zp)), allowed=('Plate_Fasteners_Reference',))
    # acceso al pasador biela–plato con el plato abajo (servo 50°): se empuja por la cabeza (−y) y se coloca o se saca la tuerca a presión con alicate (+y)
    tf_open = A.pose_transforms(-K.SWEEP, 'NORMAL')
    world_open = {}
    for inst, nm in names.items():
        m = (cache_mesh.get(nm) or load(nm)).copy(); m.apply_transform(tf_open[inst]); world_open[inst] = to_manifold(m)
    zpo = K.zp_from_servo(-K.SWEEP)
    def tool_test(label, tool, allowed=()):
        hits = {k: round((tool ^ v).volume(), 3) for k, v in world_open.items() if k not in allowed and (tool ^ v).volume() > CONTACT_TOL}
        checks.append({'check': label, 'ok': not hits, 'hits': hits})
    for i in range(3):
        M = ring @ A.Rz(K.leaf_dir(i))
        P = lambda y: (M @ np.array([C.LINK_PIN_X, y, zpo, 1]))[:3]
        tool_test(f'Pasador biela–plato de la valva {i+1}: empujador por la cabeza (−y), plato abajo, transportador retirado',
                  cyl(1.5, P(C.TAB_Y[0] - 2.2), P(C.TAB_Y[0] - 70)), allowed=('Angle_Scale', 'Cable_Routes_Reference'))
        tool_test(f'Pasador biela–plato de la valva {i+1}: alicate sobre la tuerca a presión (+y), plato abajo, transportador retirado',
                  cyl(3.2, P(C.LINK_Y[1] + C.M2_NUT_T + 0.1), P(C.LINK_Y[1] + 70)), allowed=('Angle_Scale', 'Cable_Routes_Reference', 'Plate_Fasteners_Reference'))   # el tubo es hueco: la punta del tornillo entra
    zp = K.zp_from_servo(K.SWEEP)
    kz = A.Z_RING + zp - C.PLATE_TAB_PIN_Z + C.CLEVIS_PIN_Z
    test('Pasador horquilla–empujador: agujeros alineados', cyl(0.8, (A.VX, A.VY - 5, kz), (A.VX, A.VY + 5, kz)), allowed=('Plate_Fasteners_Reference',))
    # tornillos de las orejas del servo: acceso desde el lado del horn (−y)
    import parts as P
    L = P.servo_layout(A.ZS)
    for s in (-1, 1):
        x = A.VX + L['body_cx'] + s * C.SERVO.tab_hole_spacing / 2
        y = A.VY + L['y_of_h'](C.SERVO.tab_h + C.SERVO.tab_t)
        test(f'Tornillo M2 oreja {"izq der".split()[s > 0]} del servo: acceso con destornillador', cyl(1.2, (x, y + 0.5, A.ZS), (x, y - 60, A.ZS)), allowed=('Servo_MG90S_Reference', 'Servo_Mount'))
    # pernos M6×8 impresos (cabeza moleteada Ø10): acceso con los dedos desde arriba (cilindro Ø16 sobre la cabeza)
    hd, hh = C.BOLT_HEAD
    for k, (x, y) in enumerate(A.stand_insert_xy()):
        test(f'Perno M6 {k+1} del soporte M1: acceso con los dedos', cyl(hd / 2 + 1.0, (x, y, C.BASE_T + 4.0 + hh + 0.05), (x, y, C.BASE_T + 80)), allowed=())
    # el soporte del servo se atornilla a la base ANTES de colocar el servo, las columnas, el plato y el anillo (queda debajo de la válvula):
    # solo puede estorbar el propio soporte
    for k, (x, y) in enumerate(A.servo_mount_holes()):
        test(f'Perno M6 {k+1} del soporte del servo: acceso con los dedos (antes de montar servo y válvula)', cyl(hd / 2 + 1.0, (x, y, C.BASE_T + 3.0 + hh + 0.05), (x, y, C.BASE_T + 80)),
             allowed=tuple(n for n in world if n != 'Servo_Mount'))
    for hx, hy in P.tray_base_holes()[::3]:
        x, y = A.TRAY_XY[0] + hx, A.TRAY_XY[1] + hy
        test(f'Perno M6 bandeja→base ({hx:.0f},{hy:.0f}): acceso vertical sin la placa', cyl(hd / 2 + 1.0, (x, y, C.BASE_T + 2.0 + hh + 0.05), (x, y, C.BASE_T + 80)),
             allowed=('Perfboard_ESP32_Reference',))
    # pestillos de la bandeja: abiertos (girados 90° hacia afuera) dejan sacar la placa
    W, Lg, zb, _ = P.tray_dims()
    for k, (bx_, by_, ang) in enumerate(P.turn_button_poses()):
        x, y = A.TRAY_XY[0] + bx_, A.TRAY_XY[1] + by_
        test(f'Pestillo {k+1} de la bandeja: gira sobre su espiga (agujero libre en el poste)', cyl(C.TURN_PEG_D / 2, (x, y, C.BASE_T + zb + C.PERFBOARD[2] - 5.0), (x, y, C.BASE_T + zb + C.PERFBOARD[2] - 0.05)),
             allowed=(f'Turn_Button_{k+1}',))
    # USB, EN y BOOT del ESP32: deben quedar descubiertos desde arriba (verificación con la referencia NO definitiva)
    W, Lg, zb, (bx, by) = P.tray_dims()
    bl = C.ESP32_BOARD[0]
    ey_usb = A.TRAY_XY[1] + by - 6.0 + bl
    zt = C.BASE_T + zb + C.PERFBOARD[2] + 8.5 + C.ESP32_BOARD[2]
    test('Conector USB del ESP32: enchufable desde +y sin obstáculos (referencia)', cyl(4.0, (A.TRAY_XY[0] + W / 2, ey_usb + 1.0, zt + 1.5), (A.TRAY_XY[0] + W / 2, ey_usb + 40, zt + 1.5)),
         allowed=('Perfboard_ESP32_Reference', 'Cable_Routes_Reference'))
    return checks

STATIC_TARGETS = ['Ring_Fasteners_Reference', 'Base_Fasteners_Reference', 'Stand_Fasteners_Reference', 'Turn_Button_1', 'Turn_Button_2',
                  'Turn_Button_3', 'Turn_Button_4', 'Servo_Mount', 'MEMS_Stand', 'Electronics_Tray', 'Column_1', 'Column_2', 'Column_3', 'Base']

def static_checks(cache_mesh):
    """Piezas FIJAS que cambiaron en v3.1 (fijaciones impresas, pie del servo, soporte del micrófono, bandeja, columnas, base) contra
    todas las demás, con la válvula cerrada. Las roscas de las columnas en la base se enroscan a propósito (se excluyen)."""
    tf = A.pose_transforms(K.SWEEP, 'NORMAL')
    names = instance_meshes('NORMAL')
    world = {}
    for inst, nm in names.items():
        m = (cache_mesh.get(nm) or load(nm)).copy(); m.apply_transform(tf[inst]); world[inst] = to_manifold(m)
    allowed = set(IGNORE) | {frozenset((f'Column_{i}', 'Base')) for i in (1, 2, 3)}
    out, done = [], set()
    for t in STATIC_TARGETS:
        hits = {}
        bt = world[t].bounding_box()
        for o, man in world.items():
            if o == t or frozenset((t, o)) in allowed or frozenset((t, o)) in done:
                continue
            bo = man.bounding_box()
            if any(bt[k + 3] < bo[k] - 1e-6 or bo[k + 3] < bt[k] - 1e-6 for k in range(3)):
                continue
            v = (world[t] ^ man).volume()
            if v > CONTACT_TOL:
                hits[o] = round(v, 3)
            done.add(frozenset((t, o)))
        out.append({'pieza': t, 'ok': not hits, 'choques': hits})
    return out

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

def horn_table(force_N):
    """Consecuencia de usar otro agujero del horn (radio r): barrido, comando, altura de columnas y par. Requiere regenerar."""
    out = []
    S = K.STROKE
    for r in (6.0, 7.0, 8.0, 9.0, 10.0, 11.0, 12.0, 14.0):
        if S / (2 * r) > math.sin(math.radians(60)):
            out.append({'horn_r_mm': r, 'valido': False, 'motivo': 'barrido > ±60° (ángulo de transmisión pobre)'}); continue
        sw = math.degrees(math.asin(S / (2 * r)))
        xc = -r * (1 + math.cos(math.radians(sw))) / 2
        qx = xc + r * math.cos(math.radians(sw))
        shaft_z = (K.Z_TOP + K.CLEVIS_OFFSET) - r * math.sin(math.radians(sw)) - math.sqrt(C.PUSHROD_L ** 2 - qx ** 2)
        z_ring = A.ZS - shaft_z
        tilt = max(abs(math.degrees(math.asin((xc + r * math.cos(math.radians(b))) / C.PUSHROD_L))) for b in np.linspace(-sw, sw, 41))
        out.append({'horn_r_mm': r, 'valido': True, 'barrido_deg': round(sw, 1), 'comando_deg': [round(90 - sw, 1), round(90 + sw, 1)],
                    'columna_mm': round(z_ring - C.BASE_T, 2), 'inclinacion_max_empujador_deg': round(tilt, 1),
                    'par_kgcm': round(force_N * r * 1e-3 * 100 / 9.81, 3)})
    return out

def plate_binding():
    """Efecto cajón en los bujes del plato: se traba si la fuerza resultante queda a más de L/(2μ) del eje del buje."""
    L = C.BUSH_H
    res = {'largo_buje_mm': L, 'holgura_radial_mm': C.BUSH_CLEAR, 'radio_articulacion_biela_mm': C.LINK_PIN_X}
    for mu, txt in ((0.35, 'PETG–PETG seco'), (0.15, 'con grasa PTFE')):
        res[f'limite_mm_mu_{mu}'] = round(L / (2 * mu), 1)
        res[f'nota_mu_{mu}'] = txt
    res['lectura'] = (f'Con cargas simétricas (3 valvas iguales) la resultante pasa por el centro: sin riesgo. Si UNA valva se traba, la resultante '
                      f'se desplaza hasta ≈ {C.LINK_PIN_X} mm: supera {res["limite_mm_mu_0.35"]} mm en seco (puede trabarse el plato) y queda por debajo de '
                      f'{res["limite_mm_mu_0.15"]} mm lubricado. Lubricar y dejar activa la detección de falta de movimiento (Hall de las valvas) del firmware.')
    return res

def beta_for_theta(theta):
    """Posición de la palanca que lleva a las valvas (modo normal) al ángulo θ (θ fuera del recorrido → extremo)."""
    zp = K.zp_rigid(max(0.0, min(80.0, theta)), C.LINK_L)
    return K.servo_from_zp(zp)


def gauge_checks(cache_mesh):
    """Cada galga (montada en la valva 1): con la valva 0,3° por debajo de su ángulo no toca nada; con la valva 0,7° por encima,
    la valva la penetra (es decir, la galga detiene la valva en su ángulo). Además no toca otras piezas en ese estado."""
    out = []
    names = instance_meshes('NORMAL')
    for a in C.CALIB_ANGLES:
        g = mtf(to_manifold(cache_mesh.get(f'Calib_Gauge_{a:02d}') or load(f'Calib_Gauge_{a:02d}')), A.RING @ A.Rz(K.leaf_dir(0)))
        res = {'angulo': a}
        for tag, dth in (('debajo', -0.3), ('encima', 0.7)):
            th = a + dth
            tf = A.pose_transforms(beta_for_theta(th), 'NORMAL', manual_theta=[th, max(0.0, min(80.0, th)), max(0.0, min(80.0, th))])
            hits = {}
            for inst, nm in names.items():
                bb = None
                m = mtf(to_manifold(cache_mesh.get(nm) or load(nm)), tf[inst])
                v = (g ^ m).volume()
                if v > CONTACT_TOL:
                    hits[inst] = round(v, 3)
            res[tag] = hits
        res['ok'] = (not res['debajo']) and ('Leaflet_1' in res['encima']) and set(res['encima']) <= {'Leaflet_1'}
        out.append(res)
    return out


def drive_checks():
    """Ángulo entre palanca y empujador en todo el recorrido (lejos de 0°/180° = sin punto muerto) y velocidad pedida al servo."""
    worst = 180.0
    for b in np.linspace(-K.SWEEP, K.SWEEP, 81):
        qx, qz = K.crank(b)
        crank_v = np.array([qx - K.CRANK_XC, qz - K.SHAFT_Z])
        zp = K.zp_from_servo(b)
        kz = zp - C.PLATE_TAB_PIN_Z + C.CLEVIS_PIN_Z
        rod_v = np.array([0 - qx, kz - qz])
        ang = math.degrees(math.acos(np.dot(crank_v, rod_v) / np.linalg.norm(crank_v) / np.linalg.norm(rod_v)))
        worst = min(worst, ang, 180 - ang)
    rows = []
    for t_ms in (400, 800, 1500):
        peak = math.pi / 2 * (2 * K.SWEEP) / (t_ms / 1000.0)        # perfil coseno: velocidad máxima = π/2 · Δ/t
        rows.append({'t_apertura_ms': t_ms, 'vel_pico_deg_s': round(peak, 0), 'MG90S_sin_carga_deg_s_no_verificado': 600,
                     'margen_x': round(600 / peak, 1)})
    return {'margen_punto_muerto_deg': round(worst, 1), 'velocidades': rows,
            'nota': 'Velocidad del MG90S según distribuidores (0,1 s/60° a 4,8 V sin carga): NO verificada. Comenzar con t_apertura ≥ 1500 ms.'}


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
    res['horn_table'] = horn_table(res['servo']['force_N'])
    res['plate_binding'] = plate_binding()
    print('· galgas de calibración'); res['gauges'] = gauge_checks(cache)
    print('· piezas fijas y fijaciones impresas'); res['static'] = static_checks(cache)
    res['drive'] = drive_checks()
    # cinemática tabulada
    kin = {}
    for mode in K.MODES:
        rows = []
        for beta in np.linspace(K.SWEEP, -K.SWEEP, 9):
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
    print('fijas con choques:', [(c['pieza'], c['choques']) for c in res['static'] if not c['ok']])
    print('galgas:', [(g['angulo'], g['ok'], list(g['debajo']), list(g['encima'])) for g in res['gauges']])
    print('accionamiento:', res['drive'])
    print(f'Total {time.time() - t0:.0f} s')

if __name__ == '__main__':
    main()
