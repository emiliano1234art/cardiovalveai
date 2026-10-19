import { useEffect, useRef } from 'react';
import { HALF_CHORD, leafletAngle, leafletVertices, P, project, R_IN, R_OUT, type ViewName } from '../geometry/trivalve';
import { leafletProfiles, leafletState, type SimParams } from '../sim/model';
import { sim } from '../sim/store';

interface Props {
  view?: ViewName;
  /** ángulos fijos (estático). Si se omite, sigue al reloj de simulación. */
  angles?: [number, number, number];
  params?: SimParams;
  size?: number;
  highlight?: number | null;
  showLabels?: boolean;
  className?: string;
  title?: string;
}

const N = 64;

function ringPath(view: ViewName, r: number, y = 0) {
  const pts: string[] = [];
  for (let k = 0; k <= N; k++) {
    const a = (k / N) * Math.PI * 2;
    const [x, yy] = project([r * Math.cos(a), y, r * Math.sin(a)], view);
    pts.push(`${k ? 'L' : 'M'}${x.toFixed(2)} ${yy.toFixed(2)}`);
  }
  return pts.join(' ') + 'Z';
}

/** Segmento circular fijo (asiento) entre la cuerda y el anillo. */
function seatPath(i: number, view: ViewName) {
  const a = leafletAngle(i);
  const half = Math.asin(HALF_CHORD / R_IN);
  const pts: string[] = [];
  for (let k = 0; k <= 16; k++) {
    const ang = a - half + (k / 16) * 2 * half;
    const [x, y] = project([R_IN * Math.cos(ang), 0, R_IN * Math.sin(ang)], view);
    pts.push(`${k ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  return pts.join(' ') + 'Z';
}

const polyPoints = (i: number, theta: number, view: ViewName) =>
  leafletVertices(i, theta)
    .map((v) => project(v, view).map((c) => c.toFixed(2)).join(','))
    .join(' ');

/**
 * Válvula trivalva en SVG (vista superior, lateral o isométrica). Comparte la
 * geometría con el modelo 3D; se usa en impresión y vistas pequeñas.
 */
export function TrivalveSVG({ view = 'top', angles, params, size = 220, highlight = null, showLabels = false, className, title }: Props) {
  const polys = useRef<(SVGPolygonElement | null)[]>([]);
  const live = !angles;

  useEffect(() => {
    if (!live) return;
    return sim.onFrame((t) => {
      const p = params ?? sim.state.params;
      const prof = leafletProfiles(p);
      prof.forEach((lp, i) => {
        const th = leafletState(t, p, lp).theta;
        polys.current[i]?.setAttribute('points', polyPoints(i, th, view));
      });
    });
  }, [live, params, view]);

  const init = angles ?? [0, 0, 0];
  const pad = 6;
  const vb = view === 'top' ? `${-R_OUT - pad} ${-R_OUT - pad} ${2 * (R_OUT + pad)} ${2 * (R_OUT + pad)}` : view === 'side' ? `${-R_OUT - pad} ${-R_IN - 4} ${2 * (R_OUT + pad)} ${R_IN + 14}` : `-40 -40 80 70`;
  const order = view === 'top' ? [0, 1, 2] : [1, 2, 0];

  return (
    <svg viewBox={vb} width={size} height={size} className={className} role="img" aria-label={title ?? 'Válvula trivalva'}>
      {title && <title>{title}</title>}
      <path d={ringPath(view, R_OUT)} fill="var(--valve-ring)" stroke="var(--valve-edge)" strokeWidth={0.5} />
      <path d={ringPath(view, R_IN)} fill="var(--valve-orifice)" stroke="var(--valve-edge)" strokeWidth={0.5} />
      {[0, 1, 2].map((i) => (
        <path key={`s${i}`} d={seatPath(i, view)} fill="var(--valve-seat)" stroke="var(--valve-edge)" strokeWidth={0.3} />
      ))}
      {order.map((i) => (
        <polygon
          key={i}
          ref={(el) => {
            polys.current[i] = el;
          }}
          points={polyPoints(i, init[i], view)}
          fill={highlight === i ? 'var(--coral)' : 'var(--valve-leaf)'}
          stroke="var(--valve-leaf-edge)"
          strokeWidth={0.6}
          strokeLinejoin="round"
          opacity={0.95}
        />
      ))}
      {showLabels &&
        [0, 1, 2].map((i) => {
          const a = leafletAngle(i);
          const [x, y] = project([P * 1.35 * Math.cos(a), 0, P * 1.35 * Math.sin(a)], view);
          return (
            <text key={`l${i}`} x={x} y={y} fontSize={5} textAnchor="middle" dominantBaseline="middle" fill="var(--text)" fontWeight={700}>
              {i + 1}
            </text>
          );
        })}
    </svg>
  );
}
