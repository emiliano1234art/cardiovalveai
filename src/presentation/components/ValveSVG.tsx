import { useEffect, useRef } from 'react';
import { H, leafletPoints, project, R_IN, R_OUT, RING_H, type ViewName } from '../geometry/bileaflet';
import { leafletState, type SimParams } from '../sim/model';
import { sim } from '../sim/store';

interface Props {
  view?: ViewName;
  /** ángulos fijos (estático). Si se omite, sigue al reloj de simulación. */
  angles?: [number, number];
  params?: SimParams;
  size?: number;
  highlight?: number | null;
  title?: string;
  /** colores de prótesis real (carbono) en vez de impresión 3D */
  carbon?: boolean;
}

const N = 72;
const pts = (i: number, th: number, view: ViewName) =>
  leafletPoints(i, th)
    .map((v) => project(v, view).map((c) => c.toFixed(2)).join(','))
    .join(' ');

function ring(view: ViewName, r: number) {
  let d = '';
  for (let k = 0; k <= N; k++) {
    const a = (k / N) * Math.PI * 2;
    const [x, y] = project([r * Math.cos(a), 0, r * Math.sin(a)], view);
    d += `${k ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  return d + 'Z';
}

/** Válvula bileaflet en SVG: vista superior, de corte (lateral) o isométrica. */
export function ValveSVG({ view = 'top', angles, params, size = 220, highlight = null, title, carbon = false }: Props) {
  const polys = useRef<(SVGPolygonElement | null)[]>([]);
  const live = !angles;

  useEffect(() => {
    if (!live) return;
    return sim.onFrame((t) => {
      const p = params ?? sim.state.params;
      [0, 1].forEach((i) => {
        const th = leafletState(t, p, i).theta;
        polys.current[i]?.setAttribute('points', view === 'side' ? sidePts(i, th) : pts(i, th, view));
      });
    });
  }, [live, params, view]);

  const init = angles ?? [0, 0];
  const leafFill = carbon ? 'var(--carbon)' : 'var(--valve-leaf)';
  const leafEdge = carbon ? '#1f2937' : 'var(--valve-leaf-edge)';
  const pad = 6;

  if (view === 'side') {
    // corte transversal: carcasa como dos paredes, valvas como placas que giran
    const w = R_OUT + pad;
    return (
      <svg viewBox={`${-w} ${-R_IN - 4} ${2 * w} ${R_IN * 1.7}`} width={size} height={size * 0.8} role="img" aria-label={title ?? 'Corte de la válvula bileaflet'}>
        {title && <title>{title}</title>}
        {[-1, 1].map((s) => (
          <rect key={s} x={s > 0 ? R_IN : -R_OUT} y={-RING_H / 2} width={R_OUT - R_IN} height={RING_H} rx={1.5} fill="var(--valve-ring)" stroke="var(--valve-edge)" strokeWidth={0.5} />
        ))}
        {[0, 1].map((i) => (
          <circle key={`p${i}`} cx={i === 0 ? H : -H} cy={0} r={1.4} fill="var(--valve-edge)" />
        ))}
        {[0, 1].map((i) => (
          <polygon
            key={i}
            ref={(el) => {
              polys.current[i] = el;
            }}
            points={sidePts(i, init[i])}
            fill={highlight === i ? 'var(--coral)' : leafFill}
            stroke={leafEdge}
            strokeWidth={0.5}
          />
        ))}
      </svg>
    );
  }

  const vb = view === 'top' ? `${-R_OUT - pad} ${-R_OUT - pad} ${2 * (R_OUT + pad)} ${2 * (R_OUT + pad)}` : `-52 -52 104 92`;
  return (
    <svg viewBox={vb} width={size} height={size * (view === 'iso' ? 0.9 : 1)} role="img" aria-label={title ?? 'Válvula bileaflet'}>
      {title && <title>{title}</title>}
      <path d={ring(view, R_OUT)} fill="var(--valve-ring)" stroke="var(--valve-edge)" strokeWidth={0.6} />
      <path d={ring(view, R_IN)} fill="var(--valve-orifice)" stroke="var(--valve-edge)" strokeWidth={0.6} />
      {[0, 1].map((i) => (
        <polygon
          key={i}
          ref={(el) => {
            polys.current[i] = el;
          }}
          points={pts(i, init[i], view)}
          fill={highlight === i ? 'var(--coral)' : leafFill}
          stroke={leafEdge}
          strokeWidth={0.6}
          strokeLinejoin="round"
          opacity={0.95}
        />
      ))}
      {view === 'top' && <line x1={-R_IN} x2={R_IN} y1={0} y2={0} stroke="var(--valve-edge)" strokeWidth={0.3} strokeDasharray="1.5 1.5" opacity={0.7} />}
    </svg>
  );
}

/** Placa vista de canto en el corte: segmento con espesor. */
function sidePts(i: number, th: number) {
  const R = R_IN - 0.8;
  const a = (th * Math.PI) / 180;
  const sgn = i === 0 ? 1 : -1;
  const dIn = 0.45 - H;
  const dOut = R - H;
  const P = (d: number, off: number): [number, number] => [sgn * (H + d * Math.cos(a)) - off * Math.sin(a) * sgn, -(d * Math.sin(a) + off * Math.cos(a))];
  const t = 0.9;
  return [P(dIn, t), P(dOut, t), P(dOut, -t), P(dIn, -t)].map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
}
