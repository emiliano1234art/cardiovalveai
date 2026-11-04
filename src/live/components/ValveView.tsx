import { useEffect, useRef } from 'react';
import { MODE_LABEL, REFERENCE_DEG } from '../config';
import type { LiveSnapshot } from '../LiveEngine';

const C = 140;
const R = 78;
const STATE = { closed: 'Cerrada', opening: 'Abriendo', open: 'Abierta', closing: 'Cerrando' } as const;

interface Props {
  snap: LiveSnapshot;
  getAngle: () => number;
}

/** Animación frontal de la válvula: cada valva se abre según el ángulo mostrado. */
export function ValveView({ snap, getAngle }: Props) {
  const top = useRef<SVGGElement>(null);
  const bottom = useRef<SVGGElement>(null);
  const glow = useRef<SVGCircleElement>(null);
  const flow = useRef<SVGGElement>(null);
  const needle = useRef<SVGLineElement>(null);
  const angleText = useRef<HTMLSpanElement>(null);
  const stateText = useRef<HTMLSpanElement>(null);
  const stateDot = useRef<HTMLSpanElement>(null);
  const pctText = useRef<HTMLSpanElement>(null);

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
      const a = Math.max(0, Math.min(90, cur));
      const s = Math.max(0.05, Math.cos((a * Math.PI) / 180));
      const hinge = 2;
      top.current?.setAttribute('transform', `translate(0 ${C - hinge}) scale(1 ${s}) translate(0 ${-(C - hinge)})`);
      bottom.current?.setAttribute('transform', `translate(0 ${C + hinge}) scale(1 ${s}) translate(0 ${-(C + hinge)})`);
      glow.current?.setAttribute('opacity', String(Math.min(1, (1 - s) * 1.25)));
      flow.current?.setAttribute('opacity', String(Math.min(1, (1 - s) * 1.4)));
      const th = Math.PI - (a / 90) * Math.PI;
      needle.current?.setAttribute('x2', String(70 + 52 * Math.cos(th)));
      needle.current?.setAttribute('y2', String(74 - 52 * Math.sin(th)));
      if (angleText.current) angleText.current.textContent = a.toFixed(0);
      if (pctText.current) pctText.current.textContent = `${Math.round((a / REFERENCE_DEG) * 100)} %`;

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

  const leaflet = (sign: 1 | -1) => {
    const y = C - sign * 2;
    const x0 = C - Math.sqrt(R * R - 4);
    const x1 = C + Math.sqrt(R * R - 4);
    return `M ${x0} ${y} A ${R} ${R} 0 0 ${sign === 1 ? 1 : 0} ${x1} ${y} Z`;
  };

  const incomplete = snap.mode === 'INCOMPLETA';
  const peak = snap.angles[snap.mode];
  const peakPct = Math.round((peak / REFERENCE_DEG) * 100);

  return (
    <section className="lv-card lv-valve">
      <div className="lv-card-head">
        <div>
          <h2 className="lv-card-title">Válvula en vivo</h2>
          <p className="lv-card-sub">Se abre y se cierra con la señal de los imanes</p>
        </div>
        <span className={`lv-chip ${incomplete ? 'crit' : 'ok'}`}>{incomplete ? 'Apertura incompleta' : 'Apertura normal'}</span>
      </div>

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
          <g ref={top}>
            <path d={leaflet(1)} fill="url(#lvLeaf)" />
            <path d={leaflet(1)} fill="none" stroke="#e9fbfb" strokeOpacity=".9" strokeWidth={1} />
          </g>
          <g ref={bottom}>
            <path d={leaflet(-1)} fill="url(#lvLeaf)" />
            <path d={leaflet(-1)} fill="none" stroke="#e9fbfb" strokeOpacity=".9" strokeWidth={1} />
          </g>
          {[-1, 1].map((sx) => (
            <rect key={sx} x={C + sx * (R + 2) - 5} y={C - 10} width={10} height={20} rx={3} fill="#38b6f2" />
          ))}
        </svg>

        <div className="lv-valve-side">
          <svg viewBox="0 0 140 84" className="lv-gonio" aria-hidden>
            <path d="M18 74 A52 52 0 0 1 122 74" fill="none" stroke="#d4f0ef" strokeWidth="9" strokeLinecap="round" />
            <path d={`M18 74 A52 52 0 0 1 ${70 + 52 * Math.cos(Math.PI - (peak / 90) * Math.PI)} ${74 - 52 * Math.sin(Math.PI - (peak / 90) * Math.PI)}`} fill="none" stroke={incomplete ? 'var(--crit)' : 'var(--brand)'} strokeOpacity=".35" strokeWidth="9" strokeLinecap="round" />
            <line ref={needle} x1="70" y1="74" x2="18" y2="74" stroke="#0d3b44" strokeWidth="2.4" strokeLinecap="round" />
            <circle cx="70" cy="74" r="4" fill="#0d3b44" />
          </svg>
          <div className="lv-angle">
            <span ref={angleText} className="lv-angle-num">0</span>
            <span className="lv-angle-unit">°</span>
          </div>
          <div className="lv-kicker">Ángulo de apertura</div>
          <div className="lv-valve-meta">
            <span className="lv-pill">
              <span ref={stateDot} className="lv-dot" />
              <span ref={stateText}>Cerrada</span>
            </span>
            <span className="lv-pill">
              <span ref={pctText}>0 %</span> de la apertura normal
            </span>
          </div>
          <p className="lv-valve-note">
            <b>{MODE_LABEL[snap.mode]}</b> · apertura máxima {peak.toFixed(0)}° ({peakPct} % de lo normal).
            {snap.angleSource === 'hall' ? ' El ángulo mostrado sigue a los imanes.' : ' El ángulo mostrado sigue al servo.'}
          </p>
        </div>
      </div>
    </section>
  );
}
