import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { LiveSnapshot } from '../LiveEngine';

interface Props {
  snap: LiveSnapshot;
  getAngle: () => number;
}

const R = 1; // radio interior de la válvula
const H = 1.15; // altura de la cúpula cerrada
const PHI = [-90, 30, 150].map((d) => (d * Math.PI) / 180); // las 3 valvas
const ARC_N = 14;

/**
 * Maqueta 3D del mecanismo (vista de referencia): carcasa transparente, 3 valvas que se abren
 * y el servo con su brazo. Se mueve en sincronía con la válvula real. Se puede girar con el mouse.
 */
export default function MechanismView({ snap, getAngle }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const hud = useRef<HTMLDivElement>(null);
  const refDeg = useRef(snap.angles.SANO);
  refDeg.current = snap.angles.SANO;
  const controlsRef = useRef<OrbitControls | null>(null);
  const [autoRotate, setAutoRotate] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (controlsRef.current) controlsRef.current.autoRotate = autoRotate;
  }, [autoRotate]);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setError('Tu navegador no pudo iniciar el modo 3D.');
      return;
    }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    el.appendChild(renderer.domElement);
    renderer.domElement.style.display = 'block';
    renderer.domElement.setAttribute('aria-label', 'Maqueta 3D del mecanismo de la válvula');

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 60);
    camera.position.set(3.1, 2.9, 3.6);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.2, 0);
    controls.enableDamping = true;
    controls.minDistance = 2.2;
    controls.maxDistance = 9;
    controls.autoRotateSpeed = 1.6;
    controlsRef.current = controls;

    scene.add(new THREE.HemisphereLight(0xffffff, 0xbfe7ea, 1.15));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(3, 6, 2);
    scene.add(sun);

    const disposables: { dispose(): void }[] = [];
    const track = <T extends { dispose(): void }>(o: T): T => (disposables.push(o), o);

    // ── carcasa (raíz aórtica) ──
    const housingMat = track(new THREE.MeshPhysicalMaterial({ color: 0x8fdde1, transparent: true, opacity: 0.2, side: THREE.DoubleSide, roughness: 0.2, depthWrite: false }));
    const housing = new THREE.Mesh(track(new THREE.CylinderGeometry(R * 1.06, R * 1.06, 1.5, 72, 1, true)), housingMat);
    housing.position.y = 0.75;
    scene.add(housing);
    const ringMat = track(new THREE.MeshStandardMaterial({ color: 0x14c4b6, roughness: 0.45, metalness: 0.2 }));
    const base = new THREE.Mesh(track(new THREE.TorusGeometry(R * 1.06, 0.07, 18, 72)), ringMat);
    base.rotation.x = Math.PI / 2;
    scene.add(base);
    const topRing = new THREE.Mesh(track(new THREE.TorusGeometry(R * 1.06, 0.035, 12, 72)), ringMat);
    topRing.rotation.x = Math.PI / 2;
    topRing.position.y = 1.5;
    scene.add(topRing);

    // ── base + servo ──
    const plate = new THREE.Mesh(track(new THREE.CylinderGeometry(R * 1.35, R * 1.35, 0.12, 72)), track(new THREE.MeshStandardMaterial({ color: 0xd4f0ef, roughness: 0.7 })));
    plate.position.y = -0.1;
    scene.add(plate);
    const servoMat = track(new THREE.MeshStandardMaterial({ color: 0x38b6f2, roughness: 0.5 }));
    const servo = new THREE.Mesh(track(new THREE.BoxGeometry(0.95, 0.5, 0.5)), servoMat);
    servo.position.y = -0.46;
    scene.add(servo);
    const ears = new THREE.Mesh(track(new THREE.BoxGeometry(1.3, 0.06, 0.4)), servoMat);
    ears.position.y = -0.3;
    scene.add(ears);
    const horn = new THREE.Group();
    horn.position.y = -0.2;
    const hornMat = track(new THREE.MeshStandardMaterial({ color: 0x0d3b44, roughness: 0.4 }));
    const hub = new THREE.Mesh(track(new THREE.CylinderGeometry(0.1, 0.1, 0.16, 24)), hornMat);
    const arm = new THREE.Mesh(track(new THREE.BoxGeometry(0.62, 0.05, 0.12)), hornMat);
    arm.position.x = 0.27;
    horn.add(hub, arm);
    scene.add(horn);

    // ── 3 valvas: abanico entre el arco del anillo y un vértice que se retrae al abrir ──
    // un tono distinto por valva para que se distingan las 3
    const tones = [0x2fc9bf, 0x4aa8ec, 0x6fd9d0];
    const leaves = PHI.map((phi, n) => {
      const leafMat = track(new THREE.MeshStandardMaterial({ color: tones[n], roughness: 0.45, metalness: 0.1, side: THREE.DoubleSide, flatShading: true }));
      const pos = new Float32Array((ARC_N + 1) * 3);
      for (let k = 0; k < ARC_N; k++) {
        const t = phi - Math.PI / 3 + (k * (2 * Math.PI / 3)) / (ARC_N - 1);
        pos.set([R * Math.cos(t), 0.02, R * Math.sin(t)], (k + 1) * 3);
      }
      const geo = track(new THREE.BufferGeometry());
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const idx: number[] = [];
      for (let k = 1; k < ARC_N; k++) idx.push(0, k, k + 1);
      geo.setIndex(idx);
      const mesh = new THREE.Mesh(geo, leafMat);
      scene.add(mesh);
      return { phi, geo, pos };
    });

    const resize = () => {
      const w = el.clientWidth;
      const h = Math.max(260, Math.min(460, w * 0.78));
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    let raf = 0;
    let cur = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(100, now - last);
      last = now;
      cur += (getAngle() - cur) * (1 - Math.exp(-dt / 70));
      const frac = Math.max(0, Math.min(1.05, cur / Math.max(1, refDeg.current)));
      const visual = frac * 85;
      const c = Math.max(0.05, Math.cos((Math.min(90, visual) * Math.PI) / 180));
      const p = R * 0.97 * (1 - c); // distancia del vértice al eje
      const y = H * (0.3 + 0.7 * c); // altura del vértice: las valvas se pliegan contra la pared

      for (const lf of leaves) {
        lf.pos.set([p * Math.cos(lf.phi), y, p * Math.sin(lf.phi)], 0);
        lf.geo.attributes.position.needsUpdate = true;
        lf.geo.computeVertexNormals();
      }
      horn.rotation.y = -frac * Math.PI; // el brazo del servo gira hasta 180°
      if (hud.current) hud.current.textContent = `Válvula ${Math.max(0, cur).toFixed(0)}° · Servo ${(frac * 180).toFixed(0)}°`;

      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      controlsRef.current = null;
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [getAngle]);

  const resetView = () => {
    const c = controlsRef.current;
    if (!c) return;
    c.object.position.set(3.1, 2.9, 3.6);
    c.target.set(0, 0.2, 0);
    c.update();
  };

  return (
    <div className="lv-3d">
      <div className="lv-3d-stage">
        <div ref={host} className="lv-3d-host" />
        {error ? <p className="lv-error">{error}</p> : <div ref={hud} className="lv-3d-hud" aria-live="off" />}
      </div>
      <div className="lv-3d-bar">
        <span className="lv-note" style={{ margin: 0 }}>
          Arrastra con el mouse para girar la maqueta · rueda para acercar. Se mueve igual que tu válvula real.
        </span>
        <div className="lv-actions">
          <label className="lv-check" style={{ margin: 0 }}>
            <input type="checkbox" checked={autoRotate} onChange={(e) => setAutoRotate(e.target.checked)} />
            Girar sola
          </label>
          <button className="lv-btn" onClick={resetView}>
            Restablecer vista
          </button>
        </div>
      </div>
      <p className="lv-note">
        <b>Maqueta de referencia:</b> muestra las 3 valvas abriéndose desde la base y el brazo del servo girando. Cuando compartas el modelo 3D de tu prototipo, esta vista se reemplaza por el tuyo.
      </p>
    </div>
  );
}
