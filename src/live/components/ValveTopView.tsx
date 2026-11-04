import { useEffect, useRef } from 'react';
import { MODE_LABEL } from '../config';
import type { LiveSnapshot } from '../LiveEngine';

const STATE = { closed: 'Cerrada', opening: 'Abriendo', open: 'Abierta', closing: 'Cerrando' } as const;

/** Ángulo visual de las valvas cuando la válvula está 100 % abierta (°). */
const VISUAL_FULL = 85;
const C = 140; // centro del dibujo
const R = 78; // radio del orificio
/** Dirección central de cada una de las 3 valvas (°). Una apunta hacia arriba. */
const PHI = [-90, 30, 150];
const GAP = 1.2; // pequeña separación entre valvas en el anillo (°)

const rad = (d: number) => (d * Math.PI) / 180;
const pt = (r: number, deg: number): [number, number] => [C + r * Math.cos(rad(deg)), C + r * Math.sin(rad(deg))];

/**
 * Forma de una valva vista desde arriba: un sector unido al anillo cuyo vértice (el borde libre)
 * se retrae hacia la pared al abrirse. p = distancia del vértice al centro.
 */
function leafletPath(phi: number, p: number): string {
  const [x1, y1] = pt(R, phi - 60 + GAP);
  const [x2, y2] = pt(R, phi + 60 - GAP);
  const [ax, ay] = pt(p, phi);
  return `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${R} ${R} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)} L ${ax.toFixed(1)} ${ay.toFixed(1)} Z`;
}

interface Props {
  snap: LiveSnapshot;
  getAngle: () => number;
}

/** Vista desde arriba de una válvula aórtica trifoliada (3 valvas) abriéndose y cerrándose. */
export function ValveTopView({ snap, getAngle }: Props) {
  const leaves = useRef<(SVGPathElement | null)[]>([]);
  const glow = useRef<SVGCircleElement>(null);
  const flow = useRef<SVGGElement>(null);
  const needle = useRef<SVGLineElement>(null);
  const angleText = useRef<HTMLSpanElement>(null);
  const stateText = useRef<HTMLSpanElement>(null);
  const stateDot = useRef<HTMLSpanElement>(null);
  const pctText = useRef<HTMLSpanElement>(null);
  // ángulo de apertura normal del servo (80°, 180°…): la animación se escala con él
  const refDeg = useRef(snap.angles.SANO);
  refDeg.current = snap.angles.SANO;

  useEffect(() => {
    let raf = 0;
    let cur = 0;
    let prev = 0;
    let last = performance.now();
    let state: keyof typeof STATE = 'closed';
    const loop = (now: number) => {
      const dt = Math.min(100, now - last);
      last = now;
      const target = getAngle();
      cur += (target - cur) * (1 - Math.exp(-dt / 70)); // suaviza entre muestras
      const frac = Math.max(0, Math.min(1.1, cur / Math.max(1, refDeg.current)));
      const a = frac * VISUAL_FULL; // ángulo visual de las valvas
      const s = Math.max(0.05, Math.cos((Math.min(90, a) * Math.PI) / 180));
      const p = R * 0.97 * (1 - s); // el borde libre de cada valva se retrae hacia la pared
      PHI.forEach((phi, i) => leaves.current[i]?.setAttribute('d', leafletPath(phi, p)));
      glow.current?.setAttribute('opacity', String(Math.min(1, (1 - s) * 1.25)));
      flow.current?.setAttribute('opacity', String(Math.min(1, (1 - s) * 1.4)));
      const th = Math.PI - (a / 90) * Math.PI;
      needle.current?.setAttribute('x2', String(70 + 52 * Math.cos(th)));
      needle.current?.setAttribute('y2', String(74 - 52 * Math.sin(th)));
      if (angleText.current) angleText.current.textContent = Math.max(0, cur).toFixed(0);
      if (pctText.current) pctText.current.textContent = `${Math.round(frac * 100)} %`;

      const d = a - prev;
      prev = a;
      const next = a < 3 ? 'closed' : d > 0.08 ? 'opening' : d < -0.08 ? 'closing' : a > 15 ? 'open' : state;
      if (next !== state) {
        state = next;
        if (stateText.current) stateText.current.textContent = STATE[state];
        if (stateDot.current) stateDot.current.style.background = state === 'closed' ? 'var(--muted)' : 'var(--brand)';
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [getAngle]);

  const incomplete = snap.mode === 'INCOMPLETA';
  const peak = snap.angles[snap.mode];
  const peakPct = Math.round((peak / snap.angles.SANO) * 100);
  const peakVisual = (peak / snap.angles.SANO) * VISUAL_FULL; // para el arco del goniómetro

  return (
      <div className="lv-valve-body">
        <svg viewBox="0 0 280 280" className="lv-valve-svg" role="img" aria-label="Animación de la válvula">
          <defs>
            <radialGradient id="lvOrifice" cx="50%" cy="50%" r="50%">
              <stop offset="0" stopColor="#f2fcfc" />
              <stop offset="1" stopColor="#d6f1f1" />
            </radialGradient>
            <radialGradient id="lvGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0" stopColor="#14c4b6" stopOpacity=".5" />
              <stop offset="1" stopColor="#14c4b6" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="lvLeaf" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#3fd6cc" />
              <stop offset="1" stopColor="#0c8f9c" />
            </linearGradient>
            <linearGradient id="lvRing" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#bfe7ea" />
              <stop offset="1" stopColor="#8fd0d6" />
            </linearGradient>
          </defs>
          <circle cx={C} cy={C} r={122} fill="#f4fcfc" stroke="#cdeceb" />
          <circle cx={C} cy={C} r={108} fill="none" stroke="#d4f0ef" strokeWidth={14} />
          <circle cx={C} cy={C} r={108} fill="none" stroke="#14c4b6" strokeOpacity=".6" strokeWidth={1.2} strokeDasharray="2 6" />
          <circle cx={C} cy={C} r={R + 12} fill="url(#lvRing)" />
          <circle cx={C} cy={C} r={R} fill="url(#lvOrifice)" />
          <circle ref={glow} cx={C} cy={C} r={R} fill="url(#lvGlow)" opacity={0} />
          <g ref={flow} opacity={0} stroke="#38b6f2" strokeLinecap="round" strokeWidth={2}>
            {[-34, -17, 0, 17, 34].map((x) => (
              <line key={x} x1={C + x} y1={C - 6} x2={C + x} y2={C + 6} className="lv-flow" style={{ animationDelay: `${(x + 34) * 12}ms` }} />
            ))}
          </g>
          {PHI.map((phi, i) => (
            <path
              key={phi}
              ref={(el) => { leaves.current[i] = el; }}
              d={leafletPath(phi, 0)}
              fill="url(#lvLeaf)"
              stroke="#e9fbfb"
              strokeOpacity=".9"
              strokeWidth={1.2}
              strokeLinejoin="round"
            />
          ))}
          {PHI.map((phi) => {
            const [cx, cy] = pt(R + 3, phi + 60);
            return <circle key={phi} cx={cx} cy={cy} r={5.5} fill="#38b6f2" stroke="#ffffff" strokeWidth={1.5} />;
          })}
        </svg>

        <div className="lv-valve-side">
          <svg viewBox="0 0 140 84" className="lv-gonio" aria-hidden>
            <path d="M18 74 A52 52 0 0 1 122 74" fill="none" stroke="#d4f0ef" strokeWidth="9" strokeLinecap="round" />
            <path d={`M18 74 A52 52 0 0 1 ${70 + 52 * Math.cos(Math.PI - (peakVisual / 90) * Math.PI)} ${74 - 52 * Math.sin(Math.PI - (peakVisual / 90) * Math.PI)}`} fill="none" stroke={incomplete ? 'var(--crit)' : 'var(--brand)'} strokeOpacity=".35" strokeWidth="9" strokeLinecap="round" />
            <line ref={needle} x1="70" y1="74" x2="18" y2="74" stroke="#0d3b44" strokeWidth="2.4" strokeLinecap="round" />
            <circle cx="70" cy="74" r="4" fill="#0d3b44" />
          </svg>
          <div className="lv-angle">
            <span ref={angleText} className="lv-angle-num">0</span>
            <span className="lv-angle-unit">°</span>
          </div>
          <div className="lv-kicker">Ángulo de apertura de las valvas</div>
          <div className="lv-valve-meta">
            <span className="lv-pill">
              <span ref={stateDot} className="lv-dot" />
              <span ref={stateText}>Cerrada</span>
            </span>
            <span className="lv-pill">
              <span ref={pctText}>0 %</span> de lo que abre una válvula sana
            </span>
          </div>
          <p className="lv-valve-note">
            <b>{MODE_LABEL[snap.mode]}</b> · llega hasta {peak.toFixed(0)}° ({peakPct} % de lo normal).
            {snap.angleSource === 'hall' ? ' El ángulo mostrado sigue a los imanes.' : ' El ángulo mostrado sigue al servo.'}
          </p>
        </div>
      </div>
  );
}
