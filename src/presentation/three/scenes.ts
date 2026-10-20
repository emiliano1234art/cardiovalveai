import * as THREE from 'three';
import { H, LEAF_T, leafletOutline, leafletPoints, R_IN, R_OUT, RING_H, type ViewName } from '../geometry/bileaflet';
import { leafletState, type SimParams } from '../sim/model';
import { COMPONENTS, type ComponentId } from './components';

export type SceneKind = 'university' | 'prosthesis' | 'future';
export type CameraPreset = ViewName | 'hero';

export interface LabelDef {
  id: string;
  num?: number;
  text: string;
  anchor: THREE.Vector3;
  group: THREE.Object3D;
  /** solo visible en ciertos modos */
  when?: (o: UpdateOpts) => boolean;
}

export interface UpdateOpts {
  exploded: number;
  xray: boolean;
  selected: string | null;
  now: number;
}

export interface Built {
  scene: THREE.Scene;
  labels: LabelDef[];
  meshesById: Map<THREE.Object3D, string>;
  /** grupos por componente (para anclar puntos interactivos externos) */
  groups?: Record<string, THREE.Object3D>;
  cameras: Record<CameraPreset, { pos: [number, number, number]; target: [number, number, number] }>;
  update: (t: number, p: SimParams, o: UpdateOpts) => void;
}

// ───────────────────────────── utilidades ─────────────────────────────

const mat = (color: number, o: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.15, ...o });

function lights(scene: THREE.Scene) {
  scene.add(new THREE.HemisphereLight(0xffffff, 0xcbd5e1, 1.9));
  const key = new THREE.DirectionalLight(0xffffff, 2.1);
  key.position.set(140, 260, 180);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xbae6fd, 0.9);
  fill.position.set(-200, 80, -60);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 0.6);
  rim.position.set(0, 60, -260);
  scene.add(rim);
}

function annulus(rIn: number, rOut: number, h: number, m: THREE.Material, seg = 96) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, rOut, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, rIn, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: true, bevelSize: 0.7, bevelThickness: 0.7, bevelSegments: 3, curveSegments: seg });
  g.rotateX(-Math.PI / 2);
  g.translate(0, -h / 2, 0);
  return new THREE.Mesh(g, m);
}

const box = (w: number, h: number, d: number, m: THREE.Material) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
const cyl = (r: number, h: number, m: THREE.Material, seg = 24) => new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), m);

/** Barra entre dos puntos. */
function beam(a: THREE.Vector3, b: THREE.Vector3, w: number, h: number, m: THREE.Material) {
  const len = a.distanceTo(b);
  const mesh = box(w, h, len, m);
  mesh.position.copy(a).lerp(b, 0.5);
  mesh.lookAt(b);
  return mesh;
}

function tube(points: THREE.Vector3[], r: number, m: THREE.Material) {
  return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 80, r, 8, false), m);
}

const OUTLINE = leafletOutline(30);

/** Placa con espesor cuyos vértices se recalculan cada cuadro. */
function leafletMesh(m: THREE.Material) {
  const n = OUTLINE.length;
  const tris = (n - 2) * 2 + n * 2;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(tris * 9), 3));
  return new THREE.Mesh(g, m);
}

function updateLeaflet(mesh: THREE.Mesh, i: number, theta: number) {
  const v = leafletPoints(i, theta, OUTLINE).map((p) => new THREE.Vector3(...p));
  const n = new THREE.Vector3().subVectors(v[1], v[0]).cross(new THREE.Vector3().subVectors(v[3], v[0])).normalize();
  if (n.y < 0) n.negate();
  const hT = LEAF_T / 2;
  const top = v.map((p) => p.clone().addScaledVector(n, hT));
  const bot = v.map((p) => p.clone().addScaledVector(n, -hT));
  const attr = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
  let k = 0;
  const put = (p: THREE.Vector3) => attr.setXYZ(k++, p.x, p.y, p.z);
  for (let j = 1; j < v.length - 1; j++) {
    put(top[0]);
    put(top[j]);
    put(top[j + 1]);
    put(bot[0]);
    put(bot[j + 1]);
    put(bot[j]);
  }
  for (let j = 0; j < v.length; j++) {
    const a = j;
    const b = (j + 1) % v.length;
    put(top[a]);
    put(bot[a]);
    put(bot[b]);
    put(top[a]);
    put(bot[b]);
    put(top[b]);
  }
  attr.needsUpdate = true;
  mesh.geometry.computeVertexNormals();
  mesh.geometry.computeBoundingSphere();
}

// ═══════════════════════════ modelo universitario ═══════════════════════════

export function buildUniversity(): Built {
  const scene = new THREE.Scene();
  lights(scene);
  const meshesById = new Map<THREE.Object3D, string>();
  const groups = Object.fromEntries(COMPONENTS.map((c) => [c.id, new THREE.Group()])) as Record<ComponentId, THREE.Group>;
  const tag = (id: ComponentId, o: THREE.Object3D) => {
    o.traverse((c) => meshesById.set(c, id));
    groups[id].add(o);
    return o;
  };

  const pla = mat(0xf1f5f9, { roughness: 0.62, metalness: 0.02, transparent: true });
  const plaDark = mat(0xe2e8f0, { roughness: 0.62, metalness: 0.02, transparent: true });
  const steel = mat(0x94a3b8, { metalness: 0.85, roughness: 0.28 });

  // ── válvula: anillo con canal interno + 2 valvas + topes ──
  const ring = annulus(R_IN, R_OUT, RING_H, pla);
  tag('valve', ring);
  const leafMat = [0, 1].map(() => mat(0x22b8e6, { roughness: 0.35, metalness: 0.05, side: THREE.DoubleSide, transparent: true, opacity: 0.95 }));
  const leaves = leafMat.map((m) => tag('valve', leafletMesh(m)) as THREE.Mesh);
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const ear = box(3, 7, 6, plaDark);
      ear.position.set(sx * (R_IN - 1.2), 0, sz * H);
      tag('valve', ear);
    }

  // ── ejes de pivote (atraviesan el anillo) ──
  for (const sz of [-1, 1]) {
    const axle = cyl(1.2, 2 * R_OUT + 14, steel, 14);
    axle.rotation.z = Math.PI / 2;
    axle.position.set(0, 0, sz * H);
    tag('hardware', axle);
  }

  // ── piezo Ø14 mm en rebaje de la pared externa ──
  const piezo = new THREE.Group();
  const pocket = new THREE.Mesh(new THREE.TorusGeometry(7.7, 0.7, 10, 48), plaDark);
  const disc = cyl(7, 0.5, mat(0xe7c27a, { metalness: 0.55, roughness: 0.3 }), 48);
  disc.rotation.x = Math.PI / 2;
  const ceramic = cyl(4.6, 0.6, mat(0xf8fafc, { roughness: 0.8 }), 48);
  ceramic.rotation.x = Math.PI / 2;
  ceramic.position.z = 0.4;
  piezo.add(pocket, disc, ceramic);
  piezo.position.set(0, -1.5, R_OUT + 0.3);
  tag('piezo', piezo);

  // ── soporte lateral posterior + brazo del MEMS ──
  const col = new THREE.Vector3(-22, 0, -52);
  const column = cyl(4.5, 140, pla, 24);
  column.position.set(col.x, -24, col.z);
  tag('hardware', column);
  const ringJoint = new THREE.Vector3(-16.9, -2, -38.5);
  tag('hardware', beam(new THREE.Vector3(col.x, -2, col.z), ringJoint, 9, 9, pla));
  const armEnd = new THREE.Vector3(-14, 44, -12);
  tag('hardware', beam(new THREE.Vector3(col.x, 44, col.z), armEnd, 8, 7, pla));

  // ── alojamiento del MEMS (orientado a la línea de cierre) ──
  const mic = new THREE.Group();
  const housing = box(18, 10, 18, pla);
  mic.add(housing);
  const port = cyl(1.8, 0.6, mat(0x0f172a), 24);
  port.position.set(0, -5.2, 0);
  mic.add(port);
  const pcb = box(13, 1.2, 11, mat(0x0f766e));
  pcb.position.set(0, -2.6, 0);
  mic.add(pcb);
  const chip = box(4.7, 1, 3.8, mat(0xcbd5e1, { metalness: 0.8 }));
  chip.position.set(0, -3.6, 0);
  mic.add(chip);
  mic.position.copy(armEnd).add(new THREE.Vector3(0, -2, 4));
  mic.lookAt(new THREE.Vector3(0, 0, 0)); // puerto (−y local) hacia la zona de cierre
  mic.rotateX(-Math.PI / 2);
  tag('mic', mic);

  // ── cableado interno (canal del anillo → brazo → columna → base) ──
  const rMid = (R_IN + R_OUT) / 2;
  const arc: THREE.Vector3[] = [];
  for (let k = 0; k <= 24; k++) {
    const a = Math.PI / 2 + (k / 24) * (Math.PI * 0.86);
    arc.push(new THREE.Vector3(rMid * Math.cos(a), -3, rMid * Math.sin(a)));
  }
  const wireP = mat(0xf97316, { emissive: 0x7c2d12, emissiveIntensity: 0.4 });
  const wireM = mat(0x6366f1, { emissive: 0x312e81, emissiveIntensity: 0.4 });
  const piezoWire = [new THREE.Vector3(0, -3, R_OUT - 0.5), ...arc, new THREE.Vector3(col.x, -3, col.z), new THREE.Vector3(col.x, -60, col.z), new THREE.Vector3(col.x, -88, col.z + 2), new THREE.Vector3(-30, -91, 30), new THREE.Vector3(-34, -90, 34)];
  tag('wiring', tube(piezoWire, 0.9, wireP));
  const micWire = [mic.position.clone(), new THREE.Vector3(-18, 44, -30), new THREE.Vector3(col.x + 1.5, 44, col.z), new THREE.Vector3(col.x + 1.5, -60, col.z), new THREE.Vector3(col.x + 1.5, -88, col.z + 3), new THREE.Vector3(-40, -91, 32), new THREE.Vector3(-46, -90, 30)];
  tag('wiring', tube(micWire, 0.9, wireM));

  // ── actuador: servo + corredera + bielas + palancas en los ejes ──
  const xs = R_OUT + 6;
  const servoMat = mat(0x1d4ed8, { roughness: 0.55 });
  const servo = box(12, 28, 23, servoMat);
  servo.position.set(xs, -80, 0);
  tag('actuator', servo);
  const ears = box(12, 2.5, 32, servoMat);
  ears.position.set(xs, -70, 0);
  tag('actuator', ears);
  const horn = new THREE.Group();
  const hornDisc = cyl(7, 2, mat(0xf8fafc), 32);
  hornDisc.rotation.z = Math.PI / 2;
  horn.add(hornDisc);
  horn.position.set(xs + 7, -66, 0);
  tag('actuator', horn);
  const rod = cyl(1.3, 1, steel, 12);
  tag('actuator', rod);
  const slider = box(5, 5, 5, mat(0x64748b, { metalness: 0.5 }));
  tag('actuator', slider);
  const levers = [0, 1].map(() => tag('actuator', box(2.2, 2.2, 1, steel)) as THREE.Mesh);
  const linkMat = new THREE.LineBasicMaterial({ color: 0x475569 });
  const links = [0, 1].map(() => {
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), linkMat);
    groups.actuator.add(l);
    meshesById.set(l, 'actuator');
    return l;
  });

  // ── base, ESP32, acondicionamiento, alimentación ──
  const base = box(180, 8, 130, mat(0xe8eef5, { roughness: 0.75 }));
  base.position.y = -98;
  tag('base', base);
  for (const [x, z] of [
    [-80, -55],
    [80, -55],
    [-80, 55],
    [80, 55],
  ]) {
    const foot = cyl(5, 5, mat(0x334155, { roughness: 0.95 }), 20);
    foot.position.set(x, -104.5, z);
    tag('base', foot);
  }
  const esp = box(52, 1.6, 28, mat(0x111827));
  esp.position.set(-55, -93, 34);
  tag('esp32', esp);
  const shield = box(18, 3, 16, mat(0xcbd5e1, { metalness: 0.9, roughness: 0.25 }));
  shield.position.set(-66, -91.5, 34);
  tag('esp32', shield);
  const cond = box(22, 1.6, 16, mat(0x0f766e));
  cond.position.set(-12, -93, 44);
  tag('conditioning', cond);
  for (let k = 0; k < 4; k++) {
    const part = box(2.5, 2, 4, mat(k % 2 ? 0x1f2937 : 0xe2b04a));
    part.position.set(-19 + k * 4.5, -91.4, 44);
    tag('conditioning', part);
  }
  const psu = box(36, 14, 24, mat(0x475569, { roughness: 0.7 }));
  psu.position.set(62, -87, 42);
  tag('power', psu);

  COMPONENTS.forEach((c) => scene.add(groups[c.id]));

  const labels: LabelDef[] = COMPONENTS.map((c) => ({ id: c.id, num: c.num, text: c.short, anchor: new THREE.Vector3(...c.anchor), group: groups[c.id] }));
  const explode = Object.fromEntries(COMPONENTS.map((c) => [c.id, new THREE.Vector3(...c.explode)])) as Record<ComponentId, THREE.Vector3>;
  const tmp = new THREE.Vector3();
  const xrayMats = [pla, plaDark];

  return {
    scene,
    labels,
    meshesById,
    groups,
    cameras: {
      iso: { pos: [255, 165, 255], target: [0, -28, 0] },
      top: { pos: [0, 330, 0.01], target: [0, -20, 0] },
      side: { pos: [0, -10, 380], target: [0, -30, 0] },
      hero: { pos: [128, 104, 150], target: [0, 2, 0] },
    },
    update(t, p, o) {
      for (const c of COMPONENTS) groups[c.id].position.copy(explode[c.id]).multiplyScalar(o.exploded);
      // en despiece el cableado y las bielas se ocultan (unen piezas separadas)
      groups.wiring.visible = o.exploded < 0.05 && (o.xray || o.selected === 'wiring');
      xrayMats.forEach((m) => {
        m.opacity = o.xray ? 0.32 : 1;
        m.depthWrite = !o.xray;
      });
      const th = [0, 1].map((i) => leafletState(t, p, i).theta);
      th.forEach((a, i) => updateLeaflet(leaves[i], i, a));
      // transmisión (conceptual): palancas giran con cada eje; la corredera baja al abrir
      const L = 9;
      const mean = (th[0] + th[1]) / 2;
      const ys = -L * Math.sin((mean * Math.PI) / 180) - 10;
      const v = groups.actuator.position;
      const vv = groups.valve.position;
      slider.position.set(xs, ys, 0);
      const rodBottom = -66;
      rod.scale.y = Math.max(1, ys - rodBottom);
      rod.position.set(xs, (ys + rodBottom) / 2, 0);
      horn.rotation.x = (mean / 90) * 1.2;
      th.forEach((a, i) => {
        const r = (a * Math.PI) / 180;
        const sz = i === 0 ? 1 : -1;
        const tip = new THREE.Vector3(R_OUT + 6, -L * Math.sin(r), sz * (H - L * Math.cos(r)));
        const piv = new THREE.Vector3(R_OUT + 6, 0, sz * H);
        levers[i].position.copy(piv).lerp(tip, 0.5).add(vv).sub(v);
        levers[i].scale.z = L;
        levers[i].lookAt(tmp.copy(tip).add(vv));
        links[i].geometry.setFromPoints([new THREE.Vector3(xs, ys, 0), tip.clone().add(vv).sub(v)]);
      });
      // resaltado
      scene.traverse((obj) => {
        const m = (obj as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
        if (!m || !('emissive' in m) || m === wireP || m === wireM) return;
        const id = meshesById.get(obj);
        m.emissive.setHex(o.selected && id === o.selected ? 0x0e7490 : 0x000000);
      });
    },
  };
}

// ═══════════════════════════ prótesis mecánica real ═══════════════════════════

function prosthesisParts(scene: THREE.Scene, meshesById: Map<THREE.Object3D, string>) {
  const group = new THREE.Group();
  const housingMat = mat(0x94a3b8, { metalness: 0.7, roughness: 0.25 });
  const carbon = mat(0x475569, { metalness: 0.45, roughness: 0.22, side: THREE.DoubleSide });
  const cuffMat = mat(0xf1f5f9, { roughness: 1, metalness: 0, flatShading: true });
  const housing = annulus(R_IN, R_IN + 4, 12, housingMat);
  group.add(housing);
  meshesById.set(housing, 'housing');
  const cuff = new THREE.Mesh(new THREE.TorusGeometry(R_IN + 9, 5.5, 18, 120), cuffMat);
  cuff.rotation.x = Math.PI / 2;
  cuff.position.y = -3;
  group.add(cuff);
  meshesById.set(cuff, 'cuff');
  for (const sx of [-1, 1]) {
    const guard = box(4, 10, 16, housingMat);
    guard.position.set(sx * (R_IN + 0.5), 4, 0);
    group.add(guard);
    meshesById.set(guard, 'pivots');
  }
  const leaves = [0, 1].map(() => {
    const m = leafletMesh(carbon);
    group.add(m);
    meshesById.set(m, 'leaflets');
    return m;
  });
  // flecha de flujo ilustrativa
  const arrowMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4, transparent: true, opacity: 0 });
  const arrow = new THREE.Group();
  const shaft = cyl(1.8, 30, arrowMat, 16);
  const head = new THREE.Mesh(new THREE.ConeGeometry(4.5, 9, 24), arrowMat);
  head.position.y = 19;
  arrow.add(shaft, head);
  arrow.position.y = 30;
  group.add(arrow);
  scene.add(group);
  return { group, leaves, arrowMat };
}

export function buildProsthesis(): Built {
  const scene = new THREE.Scene();
  lights(scene);
  const meshesById = new Map<THREE.Object3D, string>();
  const P = prosthesisParts(scene, meshesById);
  return {
    scene,
    meshesById,
    labels: [
      { id: 'leaflets', text: 'Dos valvas rígidas', anchor: new THREE.Vector3(0, 26, 22), group: P.group },
      { id: 'housing', text: 'Anillo (carcasa)', anchor: new THREE.Vector3(-26, -2, 30), group: P.group },
      { id: 'cuff', text: 'Anillo de sutura', anchor: new THREE.Vector3(36, -6, 34), group: P.group },
      { id: 'pivots', text: 'Pivotes', anchor: new THREE.Vector3(R_IN + 3, 16, 0), group: P.group },
    ],
    cameras: {
      iso: { pos: [150, 130, 175], target: [0, 8, 0] },
      top: { pos: [0, 230, 0.01], target: [0, 0, 0] },
      side: { pos: [0, 10, 230], target: [0, 8, 0] },
      hero: { pos: [100, 94, 126], target: [0, 8, 0] },
    },
    update(t, p) {
      const th = [0, 1].map((i) => leafletState(t, p, i).theta);
      th.forEach((a, i) => updateLeaflet(P.leaves[i], i, a));
      P.arrowMat.opacity = 0.55 * Math.min(1, (th[0] + th[1]) / 2 / 60);
    },
  };
}

// ═══════════════════════════ visión futura (concepto) ═══════════════════════════

export function buildFuture(): Built {
  const scene = new THREE.Scene();
  lights(scene);
  const meshesById = new Map<THREE.Object3D, string>();
  const P = prosthesisParts(scene, meshesById);
  P.group.scale.setScalar(0.62);
  const sensorMat = mat(0x0891b2, { emissive: 0x22d3ee, emissiveIntensity: 0.9, metalness: 0.4 });
  const sensors: THREE.Mesh[] = [];
  for (const a of [0.25, 1.3, 2.4, 3.6, 4.7]) {
    const s = box(5, 3, 3.5, sensorMat);
    const r = (R_IN + 4.3) * 0.62;
    s.position.set(r * Math.cos(a), 2.5, r * Math.sin(a));
    s.lookAt(0, 2.5, 0);
    scene.add(s);
    meshesById.set(s, 'sensors');
    sensors.push(s);
  }
  // receptor externo (dispositivo portátil)
  const rx = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(46, 8, 30), mat(0xf8fafc, { roughness: 0.4 }));
  const screen = box(38, 0.6, 22, mat(0x0f172a, { emissive: 0x0e7490, emissiveIntensity: 0.35 }));
  screen.position.y = 4.3;
  const ecgLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(
      Array.from({ length: 40 }, (_, i) => {
        const x = -16 + (i / 39) * 32;
        const spike = Math.abs(x) < 2 ? (2 - Math.abs(x)) * 3 : 0;
        return new THREE.Vector3(x, 4.8, -spike + Math.sin(i * 0.9) * 0.4);
      }),
    ),
    new THREE.LineBasicMaterial({ color: 0x22d3ee }),
  );
  rx.add(body, screen, ecgLine);
  rx.position.set(92, -4, 30);
  rx.rotation.y = -0.5;
  rx.scale.setScalar(0.7);
  scene.add(rx);
  rx.traverse((c) => meshesById.set(c, 'receiver'));
  // ondas de transmisión (concepto)
  const waves = [0, 1, 2].map((k) => {
    const w = new THREE.Mesh(new THREE.TorusGeometry(10 + k * 12, 0.5, 6, 48, Math.PI / 2.4), new THREE.MeshBasicMaterial({ color: 0x06b6d4, transparent: true, opacity: 0.6 }));
    w.position.set(30, 6, 12);
    w.rotation.set(Math.PI / 2, 0, -0.9);
    scene.add(w);
    return w;
  });
  return {
    scene,
    meshesById,
    labels: [
      { id: 'sensors', text: 'Sensores miniaturizados (hipotéticos)', anchor: new THREE.Vector3(6, 26, -14), group: scene },
      { id: 'receiver', text: 'Receptor externo', anchor: new THREE.Vector3(92, 12, 30), group: scene },
      { id: 'link', text: 'Enlace inalámbrico (concepto)', anchor: new THREE.Vector3(56, 26, 20), group: scene },
    ],
    cameras: {
      iso: { pos: [56, 170, 300], target: [44, 4, 14] },
      top: { pos: [40, 230, 14.01], target: [40, 0, 14] },
      side: { pos: [40, 10, 230], target: [40, 0, 14] },
      hero: { pos: [70, 110, 190], target: [40, 0, 14] },
    },
    update(t, p, o) {
      const th = [0, 1].map((i) => leafletState(t, p, i).theta);
      th.forEach((a, i) => updateLeaflet(P.leaves[i], i, a));
      P.arrowMat.opacity = 0.4 * Math.min(1, (th[0] + th[1]) / 2 / 60);
      const ph = (o.now / 1400) % 1;
      waves.forEach((w, k) => ((w.material as THREE.MeshBasicMaterial).opacity = 0.15 + 0.6 * Math.max(0, Math.sin(Math.PI * ((ph + k / 3) % 1)))));
      sensors.forEach((s) => ((s.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.6 + 0.4 * Math.sin(o.now / 300)));
    },
  };
}

export const BUILDERS: Record<SceneKind, () => Built> = { university: buildUniversity, prosthesis: buildProsthesis, future: buildFuture };
