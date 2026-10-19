import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { HALF_CHORD, leafletAngle, leafletVertices, P, R_IN, R_OUT, RING_H, LEAF_T, type ViewName } from '../geometry/trivalve';
import { leafletProfiles, leafletState, RESIDUAL_DEG } from '../sim/model';
import { sim } from '../sim/store';
import { COMPONENTS, type ComponentId } from './components';

interface Props {
  variant: 'hero' | 'full';
  view?: ViewName;
  exploded?: boolean;
  showLabels?: boolean;
  selected?: ComponentId | null;
  onSelect?: (id: ComponentId | null) => void;
  autoRotate?: boolean;
  /** se incrementa para forzar el reencuadre aunque la vista no cambie */
  viewNonce?: number;
}

const CAMERA: Record<ViewName, { pos: [number, number, number]; target: [number, number, number] }> = {
  top: { pos: [0, 290, 0.01], target: [0, -20, 0] },
  side: { pos: [330, -20, 0], target: [0, -30, 0] },
  iso: { pos: [215, 150, 215], target: [0, -28, 0] },
};
const HERO_CAMERA = { pos: [92, 88, 92] as [number, number, number], target: [0, -4, 0] as [number, number, number] };

const COL = {
  ring: 0xc9d6e3,
  seat: 0x9fb2c6,
  leaf: 0x22d3ee,
  leafAlt: 0xff7a59,
  metal: 0x8b98a8,
  servo: 0x2b5fd9,
  base: 0x1c3554,
  pcb: 0x0f7a5c,
  esp: 0x1d2633,
  brass: 0xd9a74a,
  power: 0x3a4a5e,
  rubber: 0x0b1422,
  wire: 0x7dd3fc,
};

function mat(color: number, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.25, ...opts });
}

/** Prisma triangular (valva con espesor) cuyos vértices se actualizan cada cuadro. */
function leafletGeometry() {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(8 * 3 * 3), 3));
  return g;
}

function updateLeaflet(g: THREE.BufferGeometry, i: number, theta: number) {
  const v = leafletVertices(i, theta).map((p) => new THREE.Vector3(...p));
  const n = new THREE.Vector3().subVectors(v[1], v[0]).cross(new THREE.Vector3().subVectors(v[2], v[0])).normalize();
  if (n.y < 0) n.negate();
  const h = LEAF_T / 2;
  const top = v.map((p) => p.clone().addScaledVector(n, h));
  const bot = v.map((p) => p.clone().addScaledVector(n, -h));
  const tris: THREE.Vector3[][] = [
    [top[0], top[1], top[2]],
    [bot[0], bot[2], bot[1]],
    [top[0], bot[0], bot[1]],
    [top[0], bot[1], top[1]],
    [top[1], bot[1], bot[2]],
    [top[1], bot[2], top[2]],
    [top[2], bot[2], bot[0]],
    [top[2], bot[0], top[0]],
  ];
  const arr = g.getAttribute('position') as THREE.BufferAttribute;
  let k = 0;
  for (const t of tris) for (const p of t) arr.setXYZ(k++, p.x, p.y, p.z);
  arr.needsUpdate = true;
  g.computeVertexNormals();
  g.computeBoundingSphere();
}

function annulus(rIn: number, rOut: number, h: number, m: THREE.Material) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, rOut, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, rIn, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: true, bevelSize: 0.6, bevelThickness: 0.6, bevelSegments: 2, curveSegments: 72 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, -h / 2, 0);
  return new THREE.Mesh(g, m);
}

function seat(i: number, m: THREE.Material) {
  const a = leafletAngle(i);
  const half = Math.asin(HALF_CHORD / R_IN);
  const shape = new THREE.Shape();
  shape.moveTo(R_IN * Math.cos(a - half), R_IN * Math.sin(a - half));
  shape.absarc(0, 0, R_IN + 0.5, a - half, a + half, false);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: 2, bevelEnabled: false, curveSegments: 24 });
  // shape en XY → plano XZ (y arriba)
  g.rotateX(Math.PI / 2);
  g.translate(0, 0.2, 0);
  return new THREE.Mesh(g, m);
}

function box(w: number, h: number, d: number, m: THREE.Material) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
}
function cyl(r: number, h: number, m: THREE.Material, seg = 24) {
  return new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), m);
}

interface Built {
  scene: THREE.Scene;
  groups: Record<ComponentId, THREE.Group>;
  basePos: Record<ComponentId, THREE.Vector3>;
  leafGeoms: THREE.BufferGeometry[];
  leafMats: THREE.MeshStandardMaterial[];
  hubAnchor: THREE.Object3D;
  rod: THREE.Mesh;
  horn: THREE.Group;
  links: THREE.Line[];
  gapMarker: THREE.Mesh;
  wires: THREE.Line[];
  wireDefs: [ComponentId, THREE.Vector3, ComponentId, THREE.Vector3][];
  meshesById: Map<THREE.Object3D, ComponentId>;
}

function build(variant: 'hero' | 'full'): Built {
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xdff6ff, 0x0b1830, 1.6));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(120, 220, 160);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x22d3ee, 0.9);
  rim.position.set(-160, 60, -120);
  scene.add(rim);

  const ids = COMPONENTS.map((c) => c.id);
  const groups = Object.fromEntries(ids.map((id) => [id, new THREE.Group()])) as Record<ComponentId, THREE.Group>;
  const basePos = Object.fromEntries(ids.map((id) => [id, new THREE.Vector3()])) as Record<ComponentId, THREE.Vector3>;
  const meshesById = new Map<THREE.Object3D, ComponentId>();
  const tag = (id: ComponentId, o: THREE.Object3D) => {
    o.traverse((c) => meshesById.set(c, id));
    groups[id].add(o);
    return o;
  };

  // ── válvula: anillo + asientos + 3 valvas ──
  const ringMat = mat(COL.ring, { metalness: 0.5, roughness: 0.35 });
  tag('valve', annulus(R_IN, R_OUT, RING_H, ringMat));
  const seatMat = mat(COL.seat, { metalness: 0.4 });
  [0, 1, 2].forEach((i) => tag('valve', seat(i, seatMat)));
  const leafGeoms: THREE.BufferGeometry[] = [];
  const leafMats: THREE.MeshStandardMaterial[] = [];
  [0, 1, 2].forEach(() => {
    const g = leafletGeometry();
    const m = mat(COL.leaf, { metalness: 0.15, roughness: 0.3, side: THREE.DoubleSide, emissive: 0x0a3b44, emissiveIntensity: 0.4 });
    leafGeoms.push(g);
    leafMats.push(m);
    tag('valve', new THREE.Mesh(g, m));
  });
  // marcador de separación residual (cierre incompleto)
  const gapMarker = new THREE.Mesh(new THREE.TorusGeometry(4.5, 0.6, 12, 40), new THREE.MeshBasicMaterial({ color: COL.leafAlt }));
  gapMarker.rotation.x = Math.PI / 2;
  gapMarker.position.y = 4;
  gapMarker.visible = false;
  groups.valve.add(gapMarker);

  // ── ejes, tornillos y soportes ──
  const metal = mat(COL.metal, { metalness: 0.8, roughness: 0.3 });
  [0, 1, 2].forEach((i) => {
    const a = leafletAngle(i);
    const ux = Math.cos(a);
    const uz = Math.sin(a);
    const tx = -uz;
    const tz = ux;
    for (const s of [-1, 1]) {
      const pin = cyl(0.9, 7, metal, 12);
      pin.rotation.z = Math.PI / 2;
      pin.rotation.y = -Math.atan2(tz, tx);
      pin.position.set(P * ux + s * (HALF_CHORD - 1) * tx, 0.6, P * uz + s * (HALF_CHORD - 1) * tz);
      tag('hardware', pin);
    }
  });

  if (variant === 'full') {
    [90, 210, 330].forEach((deg) => {
      const a = (deg * Math.PI) / 180;
      const post = cyl(2.2, 86, metal, 16);
      post.position.set(45 * Math.cos(a), -47, 45 * Math.sin(a));
      tag('hardware', post);
      const bracket = box(12, 3, 6, metal);
      bracket.position.set(40 * Math.cos(a), -5.5, 40 * Math.sin(a));
      bracket.rotation.y = -a;
      tag('hardware', bracket);
      const screw = cyl(1.4, 4, mat(0x5b6675, { metalness: 0.9 }), 10);
      screw.position.set(45 * Math.cos(a), -3.2, 45 * Math.sin(a));
      tag('hardware', screw);
    });

    // ── base y apoyos antivibración ──
    const base = box(170, 6, 130, mat(COL.base, { roughness: 0.8, metalness: 0.05 }));
    base.position.y = -93;
    tag('base', base);
    for (const [x, z] of [[-75, -55], [75, -55], [-75, 55], [75, 55]]) {
      const foot = cyl(5, 5, mat(COL.rubber, { roughness: 0.95, metalness: 0 }), 20);
      foot.position.set(x, -98.5, z);
      tag('base', foot);
    }

    // ── servomotor MG90S ──
    const servoMat = mat(COL.servo, { roughness: 0.55 });
    const body = box(23, 28, 12, servoMat);
    body.position.set(0, -76, 0);
    tag('servo', body);
    const ears = box(32, 2.5, 12, servoMat);
    ears.position.set(0, -66, 0);
    tag('servo', ears);
    const horn = new THREE.Group();
    const hornDisc = cyl(7, 2, mat(0xeef2f6, { roughness: 0.6 }), 32);
    horn.add(hornDisc);
    const pinH = cyl(1, 4, metal, 10);
    pinH.position.set(5, 2, 0);
    horn.add(pinH);
    horn.position.set(0, -61, 0);
    tag('servo', horn);

    // ── transmisión (corredera + bielas) — conceptual ──
    const rod = cyl(1.6, 1, metal, 12);
    tag('transmission', rod);
    const hub = new THREE.Object3D();
    const hubMesh = cyl(4, 3, mat(0xb8c4d0, { metalness: 0.6 }), 24);
    hub.add(hubMesh);
    tag('transmission', hub);

    // ── piezoeléctrico (adherido a la pared externa del anillo) ──
    const piezo = new THREE.Group();
    const disc = cyl(9, 0.5, mat(COL.brass, { metalness: 0.9, roughness: 0.25 }), 40);
    const ceramic = cyl(6, 0.6, mat(0xf2f4f7, { roughness: 0.7 }), 40);
    ceramic.position.y = 0.5;
    piezo.add(disc, ceramic);
    piezo.rotation.z = -Math.PI / 2;
    piezo.position.set(R_OUT + 1.2, 0, 0);
    tag('piezo', piezo);

    // ── micrófono MEMS INMP441 (en soporte, apuntando a la válvula) ──
    const micStand = cyl(1.2, 92, metal, 10);
    micStand.position.set(-62, -45, 26);
    tag('mic', micStand);
    const micPcb = box(14, 1.6, 12, mat(COL.pcb));
    micPcb.position.set(-62, 2, 26);
    micPcb.rotation.z = 0.25;
    tag('mic', micPcb);
    const micChip = box(4.7, 1, 3.8, mat(0xc0c8d2, { metalness: 0.8 }));
    micChip.position.set(-61, 3.2, 26);
    micChip.rotation.z = 0.25;
    tag('mic', micChip);

    // ── circuito de acondicionamiento del piezo ──
    const cond = box(22, 1.6, 16, mat(COL.pcb));
    cond.position.set(55, -89, 30);
    tag('conditioning', cond);
    for (let k = 0; k < 4; k++) {
      const part = box(2.5, 2, 4, mat(k % 2 ? 0x222831 : 0xe2b04a));
      part.position.set(48 + k * 4.5, -87.4, 30);
      tag('conditioning', part);
    }

    // ── ESP32 ──
    const esp = box(52, 1.6, 28, mat(COL.esp));
    esp.position.set(-38, -89, 34);
    tag('esp32', esp);
    const shield = box(18, 3, 16, mat(0xb9c2cc, { metalness: 0.9, roughness: 0.25 }));
    shield.position.set(-48, -87, 34);
    tag('esp32', shield);

    // ── fuente de alimentación ──
    const psu = box(40, 18, 26, mat(COL.power, { roughness: 0.7 }));
    psu.position.set(55, -81, -38);
    tag('power', psu);
  }

  ids.forEach((id) => {
    scene.add(groups[id]);
    basePos[id].copy(groups[id].position);
  });

  // bielas (líneas actualizadas cada cuadro)
  const linkMat = new THREE.LineBasicMaterial({ color: 0xe2e8f0 });
  const links = [0, 1, 2].map(() => {
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), linkMat);
    if (variant === 'full') scene.add(l);
    meshesById.set(l, 'transmission');
    return l;
  });

  // cables (conceptuales)
  const wireDefs: Built['wireDefs'] = [
    ['piezo', new THREE.Vector3(R_OUT + 1.5, -6, 0), 'conditioning', new THREE.Vector3(50, -88, 30)],
    ['conditioning', new THREE.Vector3(45, -88, 34), 'esp32', new THREE.Vector3(-14, -88, 34)],
    ['mic', new THREE.Vector3(-62, 0, 26), 'esp32', new THREE.Vector3(-58, -88, 30)],
    ['servo', new THREE.Vector3(-10, -80, -6), 'esp32', new THREE.Vector3(-40, -88, 20)],
    ['power', new THREE.Vector3(35, -80, -38), 'esp32', new THREE.Vector3(-30, -88, 20)],
  ];
  const wireMat = new THREE.LineBasicMaterial({ color: COL.wire, transparent: true, opacity: 0.55 });
  const wires = wireDefs.map(() => {
    const l = new THREE.Line(new THREE.BufferGeometry(), wireMat);
    if (variant === 'full') scene.add(l);
    return l;
  });

  const rod = (groups.transmission.children[0] as THREE.Mesh) ?? new THREE.Mesh();
  const hubAnchor = groups.transmission.children[1] ?? new THREE.Object3D();
  const horn = (groups.servo.children[2] as THREE.Group) ?? new THREE.Group();
  return { scene, groups, basePos, leafGeoms, leafMats, hubAnchor, rod, horn, links, gapMarker, wires, wireDefs, meshesById };
}

/** Escena 3D del prototipo, sincronizada con el reloj único de simulación. */
export function ValveScene({ variant, view = 'iso', exploded = false, showLabels = true, selected = null, onSelect, autoRotate = false, viewNonce = 0 }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const api = useRef<{ setView: (v: ViewName, instant?: boolean) => void; state: { exploded: boolean; selected: ComponentId | null; autoRotate: boolean } } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: false });
    } catch {
      setFailed(true);
      return;
    }
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.appendChild(renderer.domElement);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.touchAction = 'none';

    const B = build(variant);
    const camera = new THREE.PerspectiveCamera(variant === 'hero' ? 32 : 30, 1, 1, 2000);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minDistance = variant === 'hero' ? 60 : 90;
    controls.maxDistance = 520;

    const state = { exploded, selected, autoRotate };
    let explodeK = exploded ? 1 : 0;
    let tween: { from: THREE.Vector3; to: THREE.Vector3; tf: THREE.Vector3; tt: THREE.Vector3; t0: number } | null = null;

    const setView = (v: ViewName, instant = false) => {
      const c = variant === 'hero' ? HERO_CAMERA : CAMERA[v];
      const to = new THREE.Vector3(...c.pos);
      const tt = new THREE.Vector3(...c.target);
      if (instant) {
        camera.position.copy(to);
        controls.target.copy(tt);
        tween = null;
      } else tween = { from: camera.position.clone(), to, tf: controls.target.clone(), tt, t0: performance.now() };
    };
    setView(view, true);
    api.current = { setView, state };

    const resize = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (!w || !h) return;
      const scale = el.getBoundingClientRect().width / w || 1;
      renderer.setPixelRatio(Math.min(2.5, (window.devicePixelRatio || 1) * Math.max(1, scale)));
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = `${w}px`;
      renderer.domElement.style.height = `${h}px`;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    // selección por clic
    const ray = new THREE.Raycaster();
    let downAt = 0;
    const onDown = () => (downAt = performance.now());
    const onUp = (ev: PointerEvent) => {
      if (!onSelect || performance.now() - downAt > 250) return;
      const r = renderer.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const hit = ray.intersectObjects(B.scene.children, true).find((h) => B.meshesById.has(h.object) && (h.object as THREE.Mesh).isMesh);
      onSelect(hit ? B.meshesById.get(hit.object)! : null);
    };
    renderer.domElement.addEventListener('pointerdown', onDown);
    renderer.domElement.addEventListener('pointerup', onUp);

    const explodeOffset: Partial<Record<ComponentId, THREE.Vector3>> = Object.fromEntries(COMPONENTS.map((c) => [c.id, new THREE.Vector3(...c.explode)]));
    const tmpA = new THREE.Vector3();
    const tmpB = new THREE.Vector3();
    const labelEls = labelsRef.current ? Array.from(labelsRef.current.children) as HTMLElement[] : [];

    renderer.setAnimationLoop((now) => {
      if (tween) {
        const k = Math.min(1, (now - tween.t0) / 700);
        const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
        camera.position.lerpVectors(tween.from, tween.to, e);
        controls.target.lerpVectors(tween.tf, tween.tt, e);
        if (k >= 1) tween = null;
      }
      controls.autoRotate = state.autoRotate && sim.running;
      controls.autoRotateSpeed = 0.8;
      controls.update();

      // despiece animado
      explodeK += ((state.exploded ? 1 : 0) - explodeK) * 0.12;
      for (const id of Object.keys(B.groups) as ComponentId[]) {
        B.groups[id].position.copy(B.basePos[id]).addScaledVector(explodeOffset[id] ?? tmpA.set(0, 0, 0), explodeK);
      }

      // cinemática (mismo estado para todo)
      const p = sim.state.params;
      const prof = leafletProfiles(p);
      const thetas = prof.map((lp) => leafletState(sim.t, p, lp).theta);
      thetas.forEach((th, i) => updateLeaflet(B.leafGeoms[i], i, th));
      B.leafMats.forEach((m, i) => {
        const alt = p.condition === 'asymmetric' && i === 2;
        m.color.setHex(alt ? COL.leafAlt : COL.leaf);
      });
      B.gapMarker.visible = p.condition === 'incomplete';

      // transmisión: la corredera sube con la apertura media; bielas a cada valva
      if (variant === 'full') {
        const mean = thetas.reduce((s, x) => s + x, 0) / 3;
        const lift = 9 * Math.sin((mean * Math.PI) / 180);
        const top = -12 + lift;
        const bottom = -59;
        B.rod.scale.y = top - bottom;
        B.rod.position.set(0, (top + bottom) / 2, 0);
        B.hubAnchor.position.set(0, top, 0);
        B.horn.rotation.y = (mean / 90) * Math.PI * 0.6;
        const tGroup = B.groups.transmission.position;
        const vGroup = B.groups.valve.position;
        thetas.forEach((th, i) => {
          const a = leafletAngle(i);
          const v = leafletVertices(i, th);
          // punto de unión: 55 % del camino desde la cuerda hacia el vértice
          tmpA.set((v[0][0] + v[1][0]) / 2, (v[0][1] + v[1][1]) / 2, (v[0][2] + v[1][2]) / 2);
          tmpB.set(v[2][0], v[2][1], v[2][2]);
          const attach = tmpA.clone().lerp(tmpB, 0.55).add(vGroup);
          const arm = new THREE.Vector3(4 * Math.cos(a), top, 4 * Math.sin(a)).add(tGroup);
          B.links[i].geometry.setFromPoints([arm, attach]);
        });
        B.wires.forEach((w, k) => {
          const [ia, pa, ib, pb] = B.wireDefs[k];
          const a = pa.clone().add(B.groups[ia].position);
          const b = pb.clone().add(B.groups[ib].position);
          const mid = a.clone().lerp(b, 0.5);
          mid.y = Math.min(a.y, b.y) - 6;
          w.geometry.setFromPoints(new THREE.QuadraticBezierCurve3(a, mid, b).getPoints(20));
        });
      }

      // resaltado del componente seleccionado
      const sel = state.selected;
      B.scene.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
        if (!m || !('emissive' in m) || B.leafMats.includes(m)) return;
        const id = B.meshesById.get(o);
        m.emissive.setHex(sel && id === sel ? 0x0e7490 : 0x000000);
      });

      renderer.render(B.scene, camera);

      // etiquetas HTML proyectadas
      const w = el.clientWidth;
      const h = el.clientHeight;
      for (const lbl of labelEls) {
        const id = lbl.dataset.id as ComponentId;
        const c = COMPONENTS.find((x) => x.id === id)!;
        tmpA.set(...c.anchor).add(B.groups[id].position).project(camera);
        const vis = tmpA.z < 1;
        lbl.style.transform = `translate(${((tmpA.x + 1) / 2) * w}px, ${((1 - tmpA.y) / 2) * h}px) translate(-50%, -50%)`;
        lbl.style.opacity = vis ? '' : '0';
      }
    });

    return () => {
      renderer.setAnimationLoop(null);
      ro.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('pointerup', onUp);
      B.scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose?.();
        const mm = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mm)) mm.forEach((x) => x.dispose());
        else mm?.dispose?.();
      });
      renderer.dispose();
      renderer.domElement.remove();
      api.current = null;
    };
    // la escena se construye una vez por variante; el resto se actualiza vía `api.state`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant]);

  useEffect(() => {
    if (api.current) Object.assign(api.current.state, { exploded, selected, autoRotate });
  }, [exploded, selected, autoRotate]);

  useEffect(() => {
    api.current?.setView(view);
  }, [view, viewNonce]);

  if (failed) {
    return (
      <div className="scene-fallback">
        <p>WebGL no disponible en este equipo. Se muestra la vista 2D equivalente.</p>
      </div>
    );
  }

  return (
    <div className="scene" ref={host}>
      <div className="scene-labels" ref={labelsRef} style={{ display: showLabels && variant === 'full' ? undefined : 'none' }}>
        {COMPONENTS.map((c) => (
          <button
            key={c.id}
            data-id={c.id}
            className={`scene-label${selected === c.id ? ' active' : ''}`}
            onClick={() => onSelect?.(selected === c.id ? null : c.id)}
          >
            <b>{c.num}</b> {c.short}
          </button>
        ))}
      </div>
    </div>
  );
}

export { RESIDUAL_DEG };
