import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { sim } from '../sim/store';
import { BUILDERS, type CameraPreset, type SceneKind } from './scenes';

/** Punto interactivo externo anclado a un componente del modelo. */
export interface Hotspot {
  id: string;
  num?: number;
  text: string;
  /** componente (grupo) al que se ancla y que se resalta */
  group: string;
  anchor: [number, number, number];
}

interface Props {
  kind: SceneKind;
  /** reemplaza las etiquetas propias de la escena */
  hotspots?: Hotspot[];
  activeHotspot?: string | null;
  onHotspot?: (id: string | null) => void;
  /** reloj externo (s); por defecto, el reloj único de la presentación */
  clock?: () => number;
  camera?: CameraPreset;
  /** se incrementa para forzar el reencuadre aunque la vista no cambie */
  cameraNonce?: number;
  exploded?: boolean;
  xray?: boolean;
  showLabels?: boolean;
  selected?: string | null;
  onSelect?: (id: string | null) => void;
  autoRotate?: boolean;
  interactive?: boolean;
  /** para renders: avisa cuando ya se dibujó al menos un cuadro */
  onReady?: () => void;
}

/** Escena 3D sincronizada con el reloj único de simulación. */
export function Scene3D({ kind, hotspots, activeHotspot = null, onHotspot, clock, camera = 'iso', cameraNonce = 0, exploded = false, xray = false, showLabels = true, selected = null, onSelect, autoRotate = false, interactive = true, onReady }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const state = useRef({ exploded, xray, selected, autoRotate, clock });
  const api = useRef<{ setCamera: (c: CameraPreset, instant?: boolean) => void } | null>(null);
  const [failed, setFailed] = useState(false);
  const [labelDefs, setLabelDefs] = useState<{ id: string; num?: number; text: string }[]>([]);
  state.current = { exploded, xray, selected, autoRotate, clock };

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    } catch {
      setFailed(true);
      return;
    }
    renderer.setClearColor(0xffffff, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    el.prepend(renderer.domElement);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.touchAction = 'none';

    const B = BUILDERS[kind]();
    if (hotspots && B.groups) {
      B.labels = hotspots.map((h) => ({ id: h.id, num: h.num, text: h.text, anchor: new THREE.Vector3(...h.anchor), group: B.groups![h.group] }));
    }
    setLabelDefs(B.labels.map((l) => ({ id: l.id, num: l.num, text: l.text })));
    const cam = new THREE.PerspectiveCamera(30, 1, 1, 3000);
    const controls = new OrbitControls(cam, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.enabled = interactive;
    controls.minDistance = 60;
    controls.maxDistance = 700;

    let tween: { from: THREE.Vector3; to: THREE.Vector3; tf: THREE.Vector3; tt: THREE.Vector3; t0: number } | null = null;
    const setCamera = (c: CameraPreset, instant = false) => {
      const def = B.cameras[c];
      const to = new THREE.Vector3(...def.pos);
      const tt = new THREE.Vector3(...def.target);
      if (instant) {
        cam.position.copy(to);
        controls.target.copy(tt);
        tween = null;
      } else tween = { from: cam.position.clone(), to, tf: controls.target.clone(), tt, t0: performance.now() };
    };
    setCamera(camera, true);
    api.current = { setCamera };

    const resize = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (!w || !h) return;
      const scale = el.getBoundingClientRect().width / w || 1;
      renderer.setPixelRatio(Math.min(2.5, (window.devicePixelRatio || 1) * Math.max(1, scale)));
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = `${w}px`;
      renderer.domElement.style.height = `${h}px`;
      cam.aspect = w / h;
      cam.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    const ray = new THREE.Raycaster();
    let downAt = 0;
    const onDown = () => (downAt = performance.now());
    const onUp = (ev: PointerEvent) => {
      if (!onSelect || performance.now() - downAt > 250) return;
      const r = renderer.domElement.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1), cam);
      const hit = ray.intersectObjects(B.scene.children, true).find((h) => B.meshesById.has(h.object) && (h.object as THREE.Mesh).isMesh && h.object.visible);
      onSelect(hit ? B.meshesById.get(hit.object)! : null);
    };
    renderer.domElement.addEventListener('pointerdown', onDown);
    renderer.domElement.addEventListener('pointerup', onUp);

    // fuera de pantalla no se dibuja (ahorra CPU/GPU en páginas largas)
    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(el);

    let explodeK = state.current.exploded ? 1 : 0;
    const tmp = new THREE.Vector3();
    let frames = 0;
    renderer.setAnimationLoop((now) => {
      if (!visible && frames > 3) return;
      if (tween) {
        const k = Math.min(1, (now - tween.t0) / 700);
        const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
        cam.position.lerpVectors(tween.from, tween.to, e);
        controls.target.lerpVectors(tween.tf, tween.tt, e);
        if (k >= 1) tween = null;
      }
      const st = state.current;
      controls.autoRotate = st.autoRotate && sim.running;
      controls.autoRotateSpeed = 0.7;
      controls.update();
      explodeK += ((st.exploded ? 1 : 0) - explodeK) * 0.12;
      B.update(st.clock ? st.clock() : sim.t, sim.state.params, { exploded: explodeK, xray: st.xray, selected: st.selected, now: sim.running ? now : 0 });
      renderer.render(B.scene, cam);
      const w = el.clientWidth;
      const h = el.clientHeight;
      const lbls = labelsRef.current ? (Array.from(labelsRef.current.children) as HTMLElement[]) : [];
      B.labels.forEach((l, i) => {
        const node = lbls[i];
        if (!node) return;
        l.group.updateMatrixWorld();
        tmp.copy(l.anchor).applyMatrix4(l.group.matrixWorld).project(cam);
        node.style.transform = `translate(${((tmp.x + 1) / 2) * w}px, ${((1 - tmp.y) / 2) * h}px) translate(-50%, -50%)`;
        node.style.opacity = tmp.z < 1 ? '' : '0';
      });
      if (++frames === 3) onReady?.();
    });

    return () => {
      renderer.setAnimationLoop(null);
      ro.disconnect();
      io.disconnect();
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
    // la escena se construye una vez por tipo; el resto se lee de `state`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  useEffect(() => {
    api.current?.setCamera(camera);
  }, [camera, cameraNonce]);

  if (failed) return <div className="scene-fallback">WebGL no disponible en este equipo.</div>;

  return (
    <div className="scene" ref={host}>
      <div className="scene-labels" ref={labelsRef} style={{ display: showLabels ? undefined : 'none' }}>
        {labelDefs.map((l) => (
          <button
            key={l.id}
            className={`scene-label${(hotspots ? activeHotspot : selected) === l.id ? ' active' : ''}`}
            onClick={() => (hotspots ? onHotspot?.(activeHotspot === l.id ? null : l.id) : onSelect?.(selected === l.id ? null : l.id))}
            tabIndex={onSelect || onHotspot ? 0 : -1}
            aria-pressed={(hotspots ? activeHotspot : selected) === l.id}
          >
            {l.num !== undefined && <b>{l.num}</b>} {l.text}
          </button>
        ))}
      </div>
    </div>
  );
}
