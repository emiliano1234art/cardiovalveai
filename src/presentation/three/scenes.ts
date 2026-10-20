import * as THREE from 'three';
import { leafletCenter, leafletPoint, openFrac, OPEN_REF, R_IN, R_OUT, RING_H, Y_COM, type ViewName } from '../geometry/trileaflet';
import { commandState, LEAF_IDX, leafletBeat, leafletState, type SimParams } from '../sim/model';
import { COMPONENTS, type ComponentId } from './components';

export type SceneKind = 'university' | 'aortic' | 'future';
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
  /** apertura manual 0–1 (control «Abierta ↔ Cerrada»); null = sigue la simulación */
  manual: number | null;
  /** muestra el mecanismo servo → leva → anillo actuador → bielas */
  mech: boolean;
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

/** Varilla cilíndrica (altura 1) reubicada entre dos puntos. */
function rodBetween(mesh: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3) {
  const len = a.distanceTo(b);
  mesh.position.copy(a).lerp(b, 0.5);
  mesh.scale.set(1, Math.max(0.01, len), 1);
  if (len > 1e-6) mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3().subVectors(b, a).normalize());
}

function tube(points: THREE.Vector3[], r: number, m: THREE.Material) {
  return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 80, r, 8, false), m);
}

// ───────────────────────────── valvas (superficie flexible) ─────────────────────────────

const NU = 26;
const NV = 12;

/** Malla de una valva semilunar: grilla (u, v) cuyos vértices se recalculan cada cuadro. */
function cuspMesh(m: THREE.Material) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array((NU + 1) * (NV + 1) * 3), 3));
  const idx: number[] = [];
  for (let a = 0; a < NU; a++)
    for (let b = 0; b < NV; b++) {
      const p = a * (NV + 1) + b;
      const q = p + NV + 1;
      idx.push(p, q, p + 1, q, q + 1, p + 1);
    }
  g.setIndex(idx);
  const mesh = new THREE.Mesh(g, m);
  // borde libre y línea de inserción marcados (las tres valvas se distinguen mejor)
  const edge = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x0c4a6e, transparent: true, opacity: 0.55 }));
  edge.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array((NU + 1) * 3), 3));
  mesh.add(edge);
  return mesh;
}

function updateCusp(mesh: THREE.Mesh, i: number, s: number) {
  const attr = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
  let k = 0;
  for (let a = 0; a <= NU; a++)
    for (let b = 0; b <= NV; b++) {
      const [x, y, z] = leafletPoint(i, s, a / NU, b / NV);
      attr.setXYZ(k++, x, y, z);
    }
  attr.needsUpdate = true;
  mesh.geometry.computeVertexNormals();
  mesh.geometry.computeBoundingSphere();
  const edge = mesh.children[0] as THREE.Line | undefined;
  if (edge) {
    const ea = edge.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let a = 0; a <= NU; a++) {
      const [x, y, z] = leafletPoint(i, s, a / NU, 1);
      ea.setXYZ(a, x, y + 0.05, z);
    }
    ea.needsUpdate = true;
    edge.geometry.computeBoundingSphere();
  }
}

/** Apertura (0–1) de cada valva: simulación o control manual (respetando la condición). */
function openings(t: number, p: SimParams, o: UpdateOpts): number[] {
  if (o.manual !== null) {
    return LEAF_IDX.map((i) => {
      const lb = leafletBeat(p, i, 3);
      return openFrac(lb.min + (lb.max - lb.min) * o.manual!);
    });
  }
  return LEAF_IDX.map((i) => openFrac(leafletState(t, p, i).theta));
}

function setHighlight(scene: THREE.Scene, meshesById: Map<THREE.Object3D, string>, selected: string | null, skip: THREE.Material[] = []) {
  scene.traverse((obj) => {
    const m = (obj as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
    if (!m || !('emissive' in m) || skip.includes(m)) return;
    const id = meshesById.get(obj);
    m.emissive.setHex(selected && id === selected ? 0x0e7490 : 0x000000);
  });
}

// ═══════════════════════════ prototipo universitario ═══════════════════════════

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

  // ── válvula: anillo Ø70 mm + postes de comisura + 3 valvas ──
  tag('valve', annulus(R_IN, R_OUT, RING_H, pla));
  for (const i of LEAF_IDX) {
    const a = leafletCenter(i) + Math.PI / 3;
    const post = box(3.2, 7, 2.6, plaDark);
    post.position.set((R_IN - 0.4) * Math.cos(a), Y_COM + 1.5, (R_IN - 0.4) * Math.sin(a));
    post.lookAt(0, Y_COM + 1.5, 0);
    tag('valve', post);
  }
  const cuspMats = LEAF_IDX.map(() => mat(0x38bdf8, { roughness: 0.4, metalness: 0.05, side: THREE.DoubleSide, transparent: true, opacity: 0.94 }));
  const cusps = cuspMats.map((m) => tag('valve', cuspMesh(m)) as THREE.Mesh);

  // ── piezo Ø14 mm integrado en un rebaje de la pared del anillo ──
  const aPz = Math.PI / 2 - 0.35;
  const piezo = new THREE.Group();
  const pocket = new THREE.Mesh(new THREE.TorusGeometry(7.7, 0.7, 10, 48), plaDark);
  const disc = cyl(7, 0.5, mat(0xe7c27a, { metalness: 0.55, roughness: 0.3 }), 48);
  disc.rotation.x = Math.PI / 2;
  const ceramic = cyl(4.6, 0.6, mat(0xf8fafc, { roughness: 0.8 }), 48);
  ceramic.rotation.x = Math.PI / 2;
  ceramic.position.z = 0.4;
  piezo.add(pocket, disc, ceramic);
  piezo.position.set((R_OUT + 0.3) * Math.cos(aPz), -0.5, (R_OUT + 0.3) * Math.sin(aPz));
  piezo.lookAt(piezo.position.clone().multiplyScalar(2));
  tag('piezo', piezo);

  // ── soporte posterior + brazo del MEMS ──
  const col = new THREE.Vector3(-20, 0, -48);
  const column = cyl(4.5, 136, pla, 24);
  column.position.set(col.x, -26, col.z);
  tag('hardware', column);
  tag('hardware', beam(new THREE.Vector3(col.x, -2, col.z), new THREE.Vector3(-15, -2, -30.5), 9, 9, pla));
  const armEnd = new THREE.Vector3(-12, 34, -10);
  tag('hardware', beam(new THREE.Vector3(col.x, 34, col.z), armEnd, 8, 7, pla));

  // ── alojamiento del MEMS: puerto acústico orientado hacia la línea de coaptación ──
  const mic = new THREE.Group();
  mic.add(box(16, 9, 16, pla));
  const port = cyl(1.8, 0.6, mat(0x0f172a), 24);
  port.position.set(0, -4.7, 0);
  mic.add(port);
  const pcb = box(12, 1.2, 10, mat(0x0f766e));
  pcb.position.set(0, -2.4, 0);
  mic.add(pcb);
  mic.position.copy(armEnd).add(new THREE.Vector3(0, -2, 4));
  mic.lookAt(new THREE.Vector3(0, 0, 0));
  mic.rotateX(-Math.PI / 2);
  tag('mic', mic);

  // ── cableado interno ──
  const rMid = (R_IN + R_OUT) / 2;
  const arc: THREE.Vector3[] = [];
  for (let k = 0; k <= 24; k++) {
    const a = aPz + (k / 24) * (Math.PI * 0.75);
    arc.push(new THREE.Vector3(rMid * Math.cos(a), -3, rMid * Math.sin(a)));
  }
  const wireP = mat(0xf97316, { emissive: 0x7c2d12, emissiveIntensity: 0.4 });
  const wireM = mat(0x6366f1, { emissive: 0x312e81, emissiveIntensity: 0.4 });
  tag('wiring', tube([piezo.position.clone().multiplyScalar(0.97), ...arc, new THREE.Vector3(col.x, -3, col.z), new THREE.Vector3(col.x, -60, col.z), new THREE.Vector3(col.x, -88, col.z + 2), new THREE.Vector3(-30, -91, 30), new THREE.Vector3(-34, -90, 34)], 0.9, wireP));
  tag('wiring', tube([mic.position.clone(), new THREE.Vector3(-16, 34, -28), new THREE.Vector3(col.x + 1.5, 34, col.z), new THREE.Vector3(col.x + 1.5, -60, col.z), new THREE.Vector3(col.x + 1.5, -88, col.z + 3), new THREE.Vector3(-40, -91, 32), new THREE.Vector3(-46, -90, 30)], 0.9, wireM));

  // ── accionamiento: UN servo MG90S → leva → anillo actuador → 3 bielas → 3 valvas ──
  const servoMat = mat(0x1d4ed8, { roughness: 0.55 });
  const sx = R_OUT + 24;
  const servo = box(12, 28, 23, servoMat);
  servo.position.set(sx, -80, 0);
  tag('actuator', servo);
  const ears = box(12, 2.5, 32, servoMat);
  ears.position.set(sx, -70, 0);
  tag('actuator', ears);
  // parte móvil (visible con «Ver mecanismo» o al seleccionar el actuador)
  const mech = new THREE.Group();
  groups.actuator.add(mech);
  const mechMat = mat(0xf59e0b, { roughness: 0.4, metalness: 0.3 });
  const camPivot = new THREE.Group();
  camPivot.position.set(sx - 9, -62, 0);
  const cam = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 3, 40), mechMat);
  cam.rotation.x = Math.PI / 2;
  cam.position.set(0, 3.5, 0); // disco excéntrico (leva)
  camPivot.add(cam);
  mech.add(camPivot);
  const follower = cyl(1.4, 1, steel, 12);
  mech.add(follower);
  const yAct0 = -36;
  const actRing = new THREE.Mesh(new THREE.TorusGeometry(R_OUT + 4, 1.8, 12, 96), mechMat);
  actRing.rotation.x = Math.PI / 2;
  mech.add(actRing);
  const bracket = cyl(1.4, 1, mechMat, 10);
  mech.add(bracket);
  const links = LEAF_IDX.map(() => {
    const m = cyl(0.9, 1, steel, 10);
    mech.add(m);
    return m;
  });
  for (const i of LEAF_IDX) {
    // guías verticales del anillo actuador (parte del soporte)
    const a = leafletCenter(i) + Math.PI / 3;
    const guide = cyl(1.1, 58, steel, 10);
    guide.position.set((R_OUT + 4) * Math.cos(a), -64, (R_OUT + 4) * Math.sin(a));
    tag('hardware', guide);
  }
  mech.traverse((c) => meshesById.set(c, 'actuator'));

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
  const xrayMats = [pla, plaDark];

  return {
    scene,
    labels,
    meshesById,
    groups,
    cameras: {
      iso: { pos: [235, 150, 235], target: [0, -30, 0] },
      top: { pos: [0, 300, 0.01], target: [0, -20, 0] },
      side: { pos: [0, -10, 350], target: [0, -30, 0] },
      hero: { pos: [96, 92, 116], target: [0, 0, 0] },
    },
    update(t, p, o) {
      for (const c of COMPONENTS) groups[c.id].position.copy(explode[c.id]).multiplyScalar(o.exploded);
      groups.wiring.visible = o.exploded < 0.05 && (o.xray || o.selected === 'wiring');
      mech.visible = o.exploded < 0.05 && (o.mech || o.selected === 'actuator');
      xrayMats.forEach((m) => {
        m.opacity = o.xray ? 0.32 : 1;
        m.depthWrite = !o.xray;
      });
      const s = openings(t, p, o);
      s.forEach((v, i) => updateCusp(cusps[i], i, v));
      if (mech.visible) {
        // el servo gira la leva; la leva empuja el anillo actuador; las bielas abren las valvas
        const cmd = o.manual !== null ? o.manual : Math.min(1, commandState(t, p).theta / OPEN_REF);
        camPivot.rotation.z = cmd * Math.PI;
        const yAct = yAct0 + 14 * cmd;
        const top = -62 + 3.5 * Math.cos(cmd * Math.PI) + 8;
        rodBetween(follower, new THREE.Vector3(sx - 9, top, 0), new THREE.Vector3(sx - 9, yAct, 0));
        rodBetween(bracket, new THREE.Vector3(sx - 9, yAct, 0), new THREE.Vector3(R_OUT + 4, yAct, 0));
        actRing.position.set(0, yAct, 0);
        LEAF_IDX.forEach((i) => {
          const a = leafletCenter(i);
          const r = R_OUT + 4;
          const foot = new THREE.Vector3(r * Math.cos(a), yAct, r * Math.sin(a));
          const pin = new THREE.Vector3((R_OUT + 0.5) * Math.cos(a), -RING_H / 2 - 2 + 2 * s[i], (R_OUT + 0.5) * Math.sin(a));
          rodBetween(links[i], foot, pin);
        });
      }
      setHighlight(scene, meshesById, o.selected, [wireP, wireM]);
    },
  };
}

// ═══════════════════════════ válvula aórtica natural ═══════════════════════════

/** Raíz aórtica con tres senos (abultamientos) — superficie de revolución deformada. */
function aorticRoot(m: THREE.Material) {
  const nA = 96;
  const nY = 30;
  const y0 = -26;
  const y1 = 46;
  const g = new THREE.BufferGeometry();
  const pos: number[] = [];
  const idx: number[] = [];
  for (let j = 0; j <= nY; j++) {
    const y = y0 + ((y1 - y0) * j) / nY;
    for (let k = 0; k <= nA; k++) {
      const a = (k / nA) * Math.PI * 2;
      // senos de Valsalva: tres abultamientos entre el anillo y la unión sinotubular
      const sinusY = Math.sin(Math.PI * Math.min(1, Math.max(0, (y + 4) / 26)));
      let lobes = 0;
      for (const i of LEAF_IDX) lobes = Math.max(lobes, Math.cos(Math.max(-Math.PI / 2, Math.min(Math.PI / 2, 1.5 * angleDiff(a, leafletCenter(i))))));
      const r = R_IN + 1.2 + 7 * sinusY * lobes ** 2 - (y < -8 ? 1.5 : 0);
      pos.push(r * Math.cos(a), y, r * Math.sin(a));
    }
  }
  for (let j = 0; j < nY; j++)
    for (let k = 0; k < nA; k++) {
      const p = j * (nA + 1) + k;
      const q = p + nA + 1;
      idx.push(p, p + 1, q, q, p + 1, q + 1);
    }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return new THREE.Mesh(g, m);
}

const angleDiff = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

function cuspSet(group: THREE.Group, m: THREE.Material, meshesById: Map<THREE.Object3D, string>, id: string) {
  return LEAF_IDX.map(() => {
    const c = cuspMesh(m);
    group.add(c);
    meshesById.set(c, id);
    return c;
  });
}

function flowArrow(group: THREE.Group) {
  const arrowMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4, transparent: true, opacity: 0 });
  const arrow = new THREE.Group();
  const shaft = cyl(2, 30, arrowMat, 16);
  const head = new THREE.Mesh(new THREE.ConeGeometry(5, 10, 24), arrowMat);
  head.position.y = 20;
  arrow.add(shaft, head);
  arrow.position.y = 22;
  group.add(arrow);
  return { arrow, arrowMat };
}

export function buildAortic(): Built {
  const scene = new THREE.Scene();
  lights(scene);
  const meshesById = new Map<THREE.Object3D, string>();
  const g = new THREE.Group();
  scene.add(g);
  const wall = mat(0xfda4af, { roughness: 0.7, metalness: 0, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false });
  const root = aorticRoot(wall);
  g.add(root);
  meshesById.set(root, 'sinus');
  const ann = new THREE.Mesh(new THREE.TorusGeometry(R_IN + 1.5, 2.2, 14, 96), mat(0xf5e1c8, { roughness: 0.85, metalness: 0 }));
  ann.rotation.x = Math.PI / 2;
  ann.position.y = -5;
  g.add(ann);
  meshesById.set(ann, 'annulus');
  const tissue = mat(0xe9c9a3, { roughness: 0.75, metalness: 0, side: THREE.DoubleSide });
  const cusps = cuspSet(g, tissue, meshesById, 'cusps');
  const { arrowMat } = flowArrow(g);
  return {
    scene,
    meshesById,
    labels: [
      { id: 'cusps', text: 'Tres valvas semilunares', anchor: new THREE.Vector3(0, 8, 20), group: g },
      { id: 'sinus', text: 'Senos aórticos', anchor: new THREE.Vector3(-32, 14, 20), group: g },
      { id: 'annulus', text: 'Anillo aórtico', anchor: new THREE.Vector3(32, -6, 18), group: g },
      { id: 'aorta', text: 'Aorta ↑', anchor: new THREE.Vector3(0, 46, 0), group: g },
      { id: 'lv', text: 'Ventrículo izquierdo ↓', anchor: new THREE.Vector3(30, -24, 14), group: g },
    ],
    cameras: {
      iso: { pos: [120, 110, 140], target: [0, 6, 0] },
      top: { pos: [0, 190, 0.01], target: [0, 0, 0] },
      side: { pos: [0, 16, 190], target: [0, 8, 0] },
      hero: { pos: [70, 92, 98], target: [0, 4, 0] },
    },
    update(t, p, o) {
      const s = openings(t, p, o);
      s.forEach((v, i) => updateCusp(cusps[i], i, v));
      arrowMat.opacity = 0.55 * Math.min(1, (s[0] + s[1] + s[2]) / 3);
      setHighlight(scene, meshesById, o.selected);
    },
  };
}

// ═══════════════════════════ visión futura (concepto) ═══════════════════════════

export function buildFuture(): Built {
  const scene = new THREE.Scene();
  lights(scene);
  const meshesById = new Map<THREE.Object3D, string>();
  const g = new THREE.Group();
  g.scale.setScalar(0.72);
  scene.add(g);
  g.add(annulus(R_IN, R_IN + 3.5, 10, mat(0xcbd5e1, { metalness: 0.6, roughness: 0.3 })));
  const cuff = new THREE.Mesh(new THREE.TorusGeometry(R_IN + 7, 4.5, 16, 110), mat(0xf1f5f9, { roughness: 1, metalness: 0, flatShading: true }));
  cuff.rotation.x = Math.PI / 2;
  cuff.position.y = -3;
  g.add(cuff);
  const cusps = cuspSet(g, mat(0xe9c9a3, { roughness: 0.75, metalness: 0, side: THREE.DoubleSide }), meshesById, 'valve');
  const { arrowMat } = flowArrow(g);
  const sensorMat = mat(0x0891b2, { emissive: 0x22d3ee, emissiveIntensity: 0.9, metalness: 0.4 });
  const sensors: THREE.Mesh[] = [];
  for (const a of [0.3, 1.4, 2.4, 3.5, 4.6, 5.6]) {
    const s = box(5, 3, 3.5, sensorMat);
    const r = R_IN + 3.6;
    s.position.set(r * Math.cos(a), 3, r * Math.sin(a));
    s.lookAt(0, 3, 0);
    g.add(s);
    meshesById.set(s, 'sensors');
    sensors.push(s);
  }
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
      { id: 'sensors', text: 'Sensores miniaturizados (hipotéticos)', anchor: new THREE.Vector3(6, 22, -14), group: scene },
      { id: 'receiver', text: 'Receptor externo', anchor: new THREE.Vector3(92, 12, 30), group: scene },
      { id: 'link', text: 'Enlace inalámbrico (concepto)', anchor: new THREE.Vector3(56, 26, 20), group: scene },
    ],
    cameras: {
      iso: { pos: [44, 120, 205], target: [44, 2, 14] },
      top: { pos: [40, 230, 14.01], target: [40, 0, 14] },
      side: { pos: [40, 10, 230], target: [40, 0, 14] },
      hero: { pos: [70, 110, 190], target: [40, 0, 14] },
    },
    update(t, p, o) {
      const s = openings(t, p, o);
      s.forEach((v, i) => updateCusp(cusps[i], i, v));
      arrowMat.opacity = 0.4 * Math.min(1, (s[0] + s[1] + s[2]) / 3);
      const ph = (o.now / 1400) % 1;
      waves.forEach((w, k) => ((w.material as THREE.MeshBasicMaterial).opacity = 0.15 + 0.6 * Math.max(0, Math.sin(Math.PI * ((ph + k / 3) % 1)))));
      sensors.forEach((s) => ((s.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.6 + 0.4 * Math.sin(o.now / 300)));
    },
  };
}

export const BUILDERS: Record<SceneKind, () => Built> = { university: buildUniversity, aortic: buildAortic, future: buildFuture };
