import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { LiveSnapshot } from '../LiveEngine';

interface Props {
  snap: LiveSnapshot;
  getAngle: () => number;
}

const R = 1.05; // radio del anillo de la válvula
const H = 1.2; // altura de las valvas cerradas
const PHI = [-90, 30, 150].map((d) => (d * Math.PI) / 180); // las 3 valvas
const ARC_N = 14;
const N_BLOOD = 170;
const CAM_POS = new THREE.Vector3(4.6, 2.2, 13.2);
const CAM_TARGET = new THREE.Vector3(-0.7, 0.9, 0);

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

interface Layers {
  heart: boolean;
  blood: boolean;
  sensors: boolean;
}

/**
 * La válvula trifoliada dentro de un corazón (ventrículo izquierdo → válvula aórtica → aorta):
 * se ve cómo se abre con cada latido, cómo pasa la sangre y cómo la detectan los sensores Hall
 * gracias a los imanes pegados a las valvas. Va en sincronía con la válvula real.
 */
export default function HeartView({ snap, getAngle }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const hud = useRef<HTMLDivElement>(null);
  const bars = useRef<(HTMLSpanElement | null)[]>([]);
  const labelEls = useRef<(HTMLDivElement | null)[]>([]);
  const refDeg = useRef(snap.angles.SANO);
  refDeg.current = snap.angles.SANO;
  const controlsRef = useRef<OrbitControls | null>(null);
  const [layers, setLayers] = useState<Layers>({ heart: true, blood: true, sensors: true });
  const layersRef = useRef(layers);
  layersRef.current = layers;
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
    renderer.domElement.setAttribute('aria-label', 'Válvula aórtica dentro del corazón, en 3D');

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 80);
    camera.position.copy(CAM_POS);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(CAM_TARGET);
    controls.enableDamping = true;
    controls.minDistance = 3;
    controls.maxDistance = 16;
    controls.autoRotateSpeed = 1.4;
    controlsRef.current = controls;

    scene.add(new THREE.HemisphereLight(0xffffff, 0xf3c5cb, 1.2));
    const sun = new THREE.DirectionalLight(0xffffff, 1.3);
    sun.position.set(4, 7, 5);
    scene.add(sun);

    const disposables: { dispose(): void }[] = [];
    const track = <T extends { dispose(): void }>(o: T): T => (disposables.push(o), o);

    // ── corazón: ventrículo izquierdo + raíz aórtica con senos + aorta ──
    const heart = new THREE.Group();
    scene.add(heart);
    const wallMat = track(new THREE.MeshPhysicalMaterial({ color: 0xf4a3ae, transparent: true, opacity: 0.26, side: THREE.DoubleSide, roughness: 0.35, depthWrite: false }));
    const profile = (
      [[0, -2.75], [0.75, -2.66], [1.35, -2.4], [1.78, -1.85], [2.0, -1.15], [1.9, -0.55], [1.5, -0.2], [1.16, 0.0],
       [1.3, 0.35], [1.36, 0.65], [1.2, 1.0], [1.05, 1.25], [0.98, 1.75]] as [number, number][]
    ).map(([r, y]) => new THREE.Vector2(r, y));
    heart.add(new THREE.Mesh(track(new THREE.LatheGeometry(profile, 72)), wallMat));
    const arch = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 1.7, 0), new THREE.Vector3(0, 2.45, 0), new THREE.Vector3(-0.4, 3.15, 0),
      new THREE.Vector3(-1.2, 3.5, 0), new THREE.Vector3(-2.0, 3.15, 0), new THREE.Vector3(-2.35, 2.3, 0), new THREE.Vector3(-2.35, 1.2, 0),
    ]);
    heart.add(new THREE.Mesh(track(new THREE.TubeGeometry(arch, 90, 0.98, 36, false)), wallMat));
    // ── anillo de la válvula ──
    const ringMat = track(new THREE.MeshStandardMaterial({ color: 0x14c4b6, roughness: 0.4, metalness: 0.2 }));
    const ring = new THREE.Mesh(track(new THREE.TorusGeometry(R + 0.03, 0.06, 16, 72)), ringMat);
    ring.rotation.x = Math.PI / 2;
    scene.add(ring);

    // ── las 3 valvas ──
    const tones = [0x2fc9bf, 0x4aa8ec, 0x6fd9d0];
    const leaves = PHI.map((phi, n) => {
      const pos = new Float32Array((ARC_N + 1) * 3);
      for (let k = 0; k < ARC_N; k++) {
        const t = phi - Math.PI / 3 + (k * ((2 * Math.PI) / 3)) / (ARC_N - 1);
        pos.set([R * Math.cos(t), 0.0, R * Math.sin(t)], (k + 1) * 3);
      }
      const geo = track(new THREE.BufferGeometry());
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const idx: number[] = [];
      for (let k = 1; k < ARC_N; k++) idx.push(0, k, k + 1);
      geo.setIndex(idx);
      const mat = track(new THREE.MeshStandardMaterial({ color: tones[n], roughness: 0.45, metalness: 0.1, side: THREE.DoubleSide, flatShading: true }));
      scene.add(new THREE.Mesh(geo, mat));
      return { phi, geo, pos };
    });

    // ── sensores Hall (afuera, en la pared) e imanes (pegados al borde libre de cada valva) ──
    const sensorsGroup = new THREE.Group();
    scene.add(sensorsGroup);
    const sensorBodyMat = track(new THREE.MeshStandardMaterial({ color: 0x0d3b44, roughness: 0.5 }));
    const magnetMat = track(new THREE.MeshStandardMaterial({ color: 0xe5495c, roughness: 0.4 }));
    const sensors = PHI.map((phi) => {
      const sp = new THREE.Vector3(1.5 * Math.cos(phi), 0.5, 1.5 * Math.sin(phi));
      const body = new THREE.Mesh(track(new THREE.BoxGeometry(0.26, 0.26, 0.16)), sensorBodyMat);
      body.position.copy(sp);
      body.lookAt(0, 0.5, 0);
      const haloMat = track(new THREE.MeshBasicMaterial({ color: 0x1fe0d0, transparent: true, opacity: 0.0, depthWrite: false }));
      const halo = new THREE.Mesh(track(new THREE.SphereGeometry(0.34, 20, 14)), haloMat);
      halo.position.copy(sp);
      const magnet = new THREE.Mesh(track(new THREE.BoxGeometry(0.15, 0.15, 0.15)), magnetMat);
      sensorsGroup.add(body, halo, magnet);
      return { sp, haloMat, halo, magnet };
    });

    // ── sangre: partículas que suben por la válvula cuando está abierta ──
    const bloodPos = new Float32Array(N_BLOOD * 3);
    const blood = Array.from({ length: N_BLOOD }, () => ({ u: Math.sqrt(Math.random()), th: Math.random() * Math.PI * 2, y: -1.9 + Math.random() * 4.4, sp: 0.8 + Math.random() * 0.5 }));
    const bloodGeo = track(new THREE.BufferGeometry());
    bloodGeo.setAttribute('position', new THREE.BufferAttribute(bloodPos, 3));
    const dot = document.createElement('canvas');
    dot.width = dot.height = 64;
    const dctx = dot.getContext('2d');
    if (dctx) {
      const g = dctx.createRadialGradient(32, 32, 2, 32, 32, 30);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.6, 'rgba(255,255,255,0.9)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      dctx.fillStyle = g;
      dctx.fillRect(0, 0, 64, 64);
    }
    const bloodMat = track(new THREE.PointsMaterial({ color: 0xe5495c, size: 0.16, sizeAttenuation: true, transparent: true, opacity: 0.85, depthWrite: false, map: track(new THREE.CanvasTexture(dot)), alphaTest: 0.05 }));
    const bloodPts = new THREE.Points(bloodGeo, bloodMat);
    scene.add(bloodPts);

    // ── rótulos que siguen a las partes 3D ──
    const anchors = [new THREE.Vector3(-1.2, -1.9, 0), new THREE.Vector3(-1.9, 0.0, 0.2), new THREE.Vector3(-1.2, 4.45, 0), sensors[1].sp.clone().add(new THREE.Vector3(0.35, 0.55, 0))];

    const resize = () => {
      const w = el.clientWidth;
      const h = Math.max(320, Math.min(560, w * 0.9));
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    const tmp = new THREE.Vector3();
    let raf = 0;
    let cur = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(100, now - last);
      last = now;
      const dts = dt / 1000;
      cur += (getAngle() - cur) * (1 - Math.exp(-dt / 70));
      const frac = Math.max(0, Math.min(1.05, cur / Math.max(1, refDeg.current)));
      const visual = frac * 85;
      const c = Math.max(0.05, Math.cos((Math.min(90, visual) * Math.PI) / 180));
      const p = R * 0.97 * (1 - c); // distancia del borde libre al eje
      const y = H * (0.3 + 0.7 * c); // altura del borde libre

      const L = layersRef.current;
      heart.visible = L.heart;
      bloodPts.visible = L.blood;
      sensorsGroup.visible = L.sensors;

      // valvas e imanes
      const act: number[] = [];
      leaves.forEach((lf, i) => {
        lf.pos.set([p * Math.cos(lf.phi), y, p * Math.sin(lf.phi)], 0);
        lf.geo.attributes.position.needsUpdate = true;
        lf.geo.computeVertexNormals();
        const s = sensors[i];
        s.magnet.position.set(p * Math.cos(lf.phi) * 1.04, y, p * Math.sin(lf.phi) * 1.04);
        // el sensor "siente" más al imán cuanto más cerca lo tiene
        const d = s.magnet.position.distanceTo(s.sp);
        const a = Math.pow(Math.min(1, Math.max(0, 1 - (d - 0.4) / 1.0)), 1.4);
        act.push(a);
        s.haloMat.opacity = 0.65 * a;
        s.halo.scale.setScalar(0.7 + 0.6 * a);
        const bar = bars.current[i];
        if (bar) bar.style.width = `${Math.round(a * 100)}%`;
      });

      // sangre: sube solo si la válvula está abierta; con la válvula cerrada se queda abajo
      const holeR = R * (0.1 + 0.8 * frac);
      const speed = 0.15 + 4.2 * frac * frac;
      const arr = bloodGeo.attributes.position.array as Float32Array;
      blood.forEach((b, i) => {
        b.y += speed * b.sp * dts;
        if (frac < 0.12 && b.y > -0.18 && b.y < 0.7) b.y = -0.18 - Math.random() * 0.1; // la válvula cerrada la detiene
        if (b.y > 3.0) { b.y = -2.0 - Math.random() * 0.3; b.u = Math.sqrt(Math.random()); b.th = Math.random() * Math.PI * 2; }
        // ancha en el ventrículo, se estrecha en la válvula y se ensancha otra vez en la aorta
        const widthBelow = 1.2 - smoothstep(-1.6, -0.1, b.y) * (1.2 - holeR);
        const rr = (b.y < 0.1 ? widthBelow : holeR + smoothstep(0.1, 1.2, b.y) * (0.95 - holeR)) * b.u;
        // en la aorta curva la sangre sigue el recorrido del arco
        if (b.y > 1.7) {
          const t = Math.min(1, (b.y - 1.7) / 1.5);
          arch.getPoint(t * 0.9, tmp);
          arr.set([tmp.x + rr * 0.8 * Math.cos(b.th), tmp.y, tmp.z + rr * 0.8 * Math.sin(b.th)], i * 3);
        } else {
          arr.set([rr * Math.cos(b.th), b.y, rr * Math.sin(b.th)], i * 3);
        }
      });
      bloodGeo.attributes.position.needsUpdate = true;
      bloodMat.opacity = 0.35 + 0.5 * Math.min(1, frac * 1.6);

      if (hud.current) hud.current.textContent = `Válvula ${Math.max(0, cur).toFixed(0)}° · ${frac < 0.08 ? 'cerrada' : frac > 0.9 ? 'abierta del todo' : 'abriéndose'}`;

      controls.update();
      renderer.render(scene, camera);

      // rótulos
      const w = renderer.domElement.clientWidth;
      const h = renderer.domElement.clientHeight;
      anchors.forEach((a, i) => {
        const lab = labelEls.current[i];
        if (!lab) return;
        tmp.copy(a).project(camera);
        lab.style.transform = `translate(${((tmp.x + 1) / 2) * w}px, ${((1 - tmp.y) / 2) * h}px) translate(-50%, -50%)`;
        lab.style.opacity = i === 3 ? (L.sensors ? '1' : '0') : L.heart ? '1' : '0';
      });
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
    c.object.position.copy(CAM_POS);
    c.target.copy(CAM_TARGET);
    c.update();
  };
  const toggle = (k: keyof Layers) => setLayers((l) => ({ ...l, [k]: !l[k] }));
  const incomplete = snap.mode === 'INCOMPLETA';
  const names = ['Ventrículo izquierdo', 'Válvula aórtica (3 valvas)', 'Aorta', 'Sensor Hall + imán'];

  return (
    <div className="lv-3d">
      <div className="lv-3d-stage">
        <div ref={host} className="lv-3d-host" />
        {error ? (
          <p className="lv-error">{error}</p>
        ) : (
          <>
            <div ref={hud} className="lv-3d-hud" />
            {names.map((n, i) => (
              <div key={n} ref={(e) => { labelEls.current[i] = e; }} className={`lv-3d-label ${i === 3 ? 'sensor' : ''}`}>
                {n}
              </div>
            ))}
            <div className="lv-3d-sensors" aria-label="Lo que detecta cada sensor Hall">
              <div className="lv-kicker">Lo que sienten los sensores</div>
              {[1, 2, 3].map((n, i) => (
                <div key={n} className="lv-3d-sensor-row">
                  <span>Hall {n}</span>
                  <div className="lv-track">
                    <span ref={(e) => { bars.current[i] = e; }} className="lv-fill" style={{ display: 'block', width: '0%' }} />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="lv-3d-bar">
        <div className="lv-actions">
          <label className="lv-check" style={{ margin: 0 }}>
            <input type="checkbox" checked={layers.heart} onChange={() => toggle('heart')} /> Corazón
          </label>
          <label className="lv-check" style={{ margin: 0 }}>
            <input type="checkbox" checked={layers.blood} onChange={() => toggle('blood')} /> Sangre
          </label>
          <label className="lv-check" style={{ margin: 0 }}>
            <input type="checkbox" checked={layers.sensors} onChange={() => toggle('sensors')} /> Sensores e imanes
          </label>
          <label className="lv-check" style={{ margin: 0 }}>
            <input type="checkbox" checked={autoRotate} onChange={(e) => setAutoRotate(e.target.checked)} /> Girar sola
          </label>
        </div>
        <button className="lv-btn" onClick={resetView}>
          Restablecer vista
        </button>
      </div>

      <div className="lv-3d-explain">
        <p>
          <b>Cómo se abre en el corazón:</b> en cada latido el ventrículo izquierdo empuja la sangre hacia arriba. Las 3 valvas se abren hacia la pared de la aorta y dejan pasar la sangre; cuando
          el corazón se relaja, vuelven a cerrarse para que la sangre no regrese.
        </p>
        <p>
          <b>Cómo lo detectan los sensores:</b> pegamos un imán (cubo rojo) al borde de cada valva. Cuando la valva se abre, el imán se acerca al sensor Hall (cajita oscura) y el sensor se enciende
          más. Así el sistema sabe cuánto se abrió la válvula.
        </p>
        <p className={incomplete ? 'warn' : ''}>
          {incomplete
            ? 'En este modo la válvula se abre solo una parte: pasa menos sangre y los sensores se encienden menos.'
            : 'En este modo la válvula se abre completa: pasa toda la sangre y los sensores se encienden al máximo.'}
        </p>
      </div>
    </div>
  );
}
