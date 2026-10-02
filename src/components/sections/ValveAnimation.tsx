import { useEffect, useRef } from 'react';

interface Props {
  getAngle: () => number;
  maxAngle?: number;
}

const STATE_LABEL = {
  closed: 'Cerrada',
  opening: 'Abriendo',
  open: 'Abierta',
  closing: 'Cerrando',
} as const;

const C = 140; // centro
const R = 78; // radio del orificio

/**
 * Vista frontal de una válvula bivalva. Cada valva gira sobre su eje de
 * bisagra; en proyección frontal su altura escala con cos(θ).
 * Se actualiza con requestAnimationFrame directamente sobre el DOM.
 */
export function ValveAnimation({ getAngle, maxAngle = 90 }: Props) {
  const top = useRef<SVGGElement>(null);
  const bottom = useRef<SVGGElement>(null);
  const glow = useRef<SVGCircleElement>(null);
  const needle = useRef<SVGLineElement>(null);
  const angleText = useRef<SVGTextElement>(null);
  const stateText = useRef<HTMLSpanElement>(null);
  const stateDot = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let raf = 0;
    let prev = 0;
    let state: keyof typeof STATE_LABEL = 'closed';
    const loop = () => {
      const a = Math.min(maxAngle, getAngle());
      const s = Math.max(0.04, Math.cos((a * Math.PI) / 180));
      const hinge = 2; // desplazamiento de la bisagra respecto del diámetro
      top.current?.setAttribute('transform', `translate(0 ${C - hinge}) scale(1 ${s}) translate(0 ${-(C - hinge)})`);
      bottom.current?.setAttribute('transform', `translate(0 ${C + hinge}) scale(1 ${s}) translate(0 ${-(C + hinge)})`);
      glow.current?.setAttribute('opacity', String(Math.min(1, a / 60)));
      // aguja del goniómetro (0° → 90°)
      const th = Math.PI - (a / 90) * (Math.PI / 2);
      needle.current?.setAttribute('x2', String(40 + 30 * Math.cos(th)));
      needle.current?.setAttribute('y2', String(44 - 30 * Math.sin(th)));
      if (angleText.current) angleText.current.textContent = `${a.toFixed(0)}°`;

      const d = a - prev;
      prev = a;
      const next = a < 3 ? 'closed' : d > 0.15 ? 'opening' : d < -0.15 ? 'closing' : a > 20 ? 'open' : state;
      if (next !== state) {
        state = next;
        if (stateText.current) stateText.current.textContent = STATE_LABEL[state];
        if (stateDot.current) stateDot.current.style.background = state === 'closed' ? 'var(--muted)' : 'var(--brand-2)';
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [getAngle, maxAngle]);

  const leaflet = (sign: 1 | -1) => {
    // semidisco: arco del orificio + cuerda desplazada
    const y = C - sign * 2;
    const x0 = C - Math.sqrt(R * R - 4);
    const x1 = C + Math.sqrt(R * R - 4);
    return `M ${x0} ${y} A ${R} ${R} 0 0 ${sign === 1 ? 1 : 0} ${x1} ${y} Z`;
  };

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <svg viewBox="0 0 280 280" width="100%" style={{ maxWidth: 300 }} role="img" aria-label="Animación de la válvula">
        <defs>
          <radialGradient id="orifice" cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor="#e9f8f8" />
            <stop offset="1" stopColor="#cfeef0" />
          </radialGradient>
          <radialGradient id="flowGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor="#10a2a0" stopOpacity=".35" />
            <stop offset="1" stopColor="#10a2a0" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="leaf" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3a4f66" />
            <stop offset="1" stopColor="#1d3046" />
          </linearGradient>
          <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#dfe7ee" />
            <stop offset="1" stopColor="#b9c7d4" />
          </linearGradient>
        </defs>
        {/* anillo de sutura */}
        <circle cx={C} cy={C} r={118} fill="#f4f8fa" stroke="#e3e8ee" />
        <circle cx={C} cy={C} r={108} fill="none" stroke="#d7ebef" strokeWidth={14} />
        <circle cx={C} cy={C} r={108} fill="none" stroke="#a9d3db" strokeWidth={1.2} strokeDasharray="2 6" />
        {/* carcasa */}
        <circle cx={C} cy={C} r={R + 12} fill="url(#ring)" />
        <circle cx={C} cy={C} r={R} fill="url(#orifice)" />
        <circle ref={glow} cx={C} cy={C} r={R} fill="url(#flowGlow)" opacity={0} />
        {/* valvas */}
        <g ref={top}>
          <path d={leaflet(1)} fill="url(#leaf)" />
          <path d={leaflet(1)} fill="none" stroke="#5d7389" strokeWidth={1} />
        </g>
        <g ref={bottom}>
          <path d={leaflet(-1)} fill="url(#leaf)" />
          <path d={leaflet(-1)} fill="none" stroke="#5d7389" strokeWidth={1} />
        </g>
        {/* bisagras */}
        {[-1, 1].map((sx) => (
          <rect key={sx} x={C + sx * (R + 2) - 5} y={C - 10} width={10} height={20} rx={3} fill="#9fb0c0" />
        ))}
      </svg>

      {/* goniómetro */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 4 }}>
        <svg width="80" height="52" viewBox="0 0 80 52" aria-hidden>
          <path d="M10 44 A30 30 0 0 1 70 44" fill="none" stroke="#e3e8ee" strokeWidth="6" strokeLinecap="round" />
          <path d="M10 44 A30 30 0 0 1 40 14" fill="none" stroke="#d7ebef" strokeWidth="6" strokeLinecap="round" />
          <line ref={needle} x1="40" y1="44" x2="10" y2="44" stroke="#0a6f95" strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="40" cy="44" r="3.5" fill="#0a6f95" />
        </svg>
        <div>
          <div className="kicker">Ángulo instantáneo</div>
          <svg width="90" height="30" aria-hidden>
            <text ref={angleText} x="0" y="24" fontSize="24" fontWeight="650" fill="#0b1f33" style={{ fontVariantNumeric: 'tabular-nums' }}>
              0°
            </text>
          </svg>
        </div>
        <span className="pill" style={{ height: 28 }}>
          <span ref={stateDot} className="dot" />
          <span ref={stateText}>Cerrada</span>
        </span>
      </div>
    </div>
  );
}
