import { useEffect, useRef } from 'react';
import { leafletCenter, leafletContour, openFrac, project, R_IN, R_OUT, RING_H, Y_COM, type ViewName } from '../geometry/trileaflet';
import { LEAF_IDX, leafletBeat, leafletState, type SimParams } from '../sim/model';
import { sim } from '../sim/store';

interface Props {
  view?: ViewName;
  /** ángulos fijos de las 3 valvas (estático). Si se omite, sigue al reloj. */
  angles?: number[];
  params?: SimParams;
  size?: number;
  /** valva destacada (0–2) */
  highlight?: number | null;
  title?: string;
  /** colores de tejido (válvula natural) en vez de impresión 3D */
  tissue?: boolean;
  /** reloj externo (s): p. ej. el del laboratorio */
  clock?: () => number;
  /** apertura manual 0–1 (control «Abierta ↔ Cerrada») */
  manual?: number | null;
  /** muestra los números de las valvas */
  numbers?: boolean;
  /** fuente directa de aperturas (0–1) por cuadro; tiene prioridad sobre el reloj */
  getOpen?: () => number[];
}

const N = 72;
const toPts = (i: number, s: number, view: ViewName) =>
  leafletContour(i, s, 20)
    .map((v) =>
      project(v, view)
        .map((c) => c.toFixed(2))
        .join(','),
    )
    .join(' ');

function ring(view: ViewName, r: number, y = 0) {
  let d = '';
  for (let k = 0; k <= N; k++) {
    const a = (k / N) * Math.PI * 2;
    const [x, yy] = project([r * Math.cos(a), y, r * Math.sin(a)], view);
    d += `${k ? 'L' : 'M'}${x.toFixed(2)} ${yy.toFixed(2)}`;
  }
  return d + 'Z';
}

/** Aperturas (0–1) de las tres valvas en t, o según el control manual. */
export function openingsAt(t: number, p: SimParams, manual: number | null = null) {
  if (manual !== null)
    return LEAF_IDX.map((i) => {
      const lb = leafletBeat(p, i, 3);
      return openFrac(lb.min + (lb.max - lb.min) * manual);
    });
  return LEAF_IDX.map((i) => openFrac(leafletState(t, p, i).theta));
}

/** Válvula aórtica trivalva en SVG: vista desde la aorta (top), lateral o isométrica. */
export function ValveSVG({
  view = 'top',
  angles,
  params,
  size = 220,
  highlight = null,
  title,
  tissue = false,
  clock,
  manual = null,
  numbers = false,
  getOpen,
}: Props) {
  const polys = useRef<(SVGPolygonElement | null)[]>([]);
  const live = !angles;
  const mref = useRef(manual);
  mref.current = manual;

  useEffect(() => {
    if (!live) return;
    const draw = (t: number) => {
      const p = params ?? sim.state.params;
      openingsAt(t, p, mref.current).forEach((s, i) => polys.current[i]?.setAttribute('points', toPts(i, s, view)));
    };
    if (getOpen) {
      let raf = 0;
      const loop = () => {
        getOpen().forEach((s, i) => polys.current[i]?.setAttribute('points', toPts(i, s, view)));
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
      return () => cancelAnimationFrame(raf);
    }
    if (clock) {
      let raf = 0;
      const loop = () => {
        draw(clock());
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
      return () => cancelAnimationFrame(raf);
    }
    return sim.onFrame(draw);
  }, [live, params, view, clock, getOpen]);

  // estático o con control manual mientras la simulación está en pausa
  useEffect(() => {
    if (!live || manual === null) return;
    const p = params ?? sim.state.params;
    openingsAt(0, p, manual).forEach((s, i) => polys.current[i]?.setAttribute('points', toPts(i, s, view)));
  }, [manual, live, params, view]);

  const init = (angles ?? [0, 0, 0]).map(openFrac);
  const leafFill = tissue ? '#e9c9a3' : 'var(--valve-leaf, #38bdf8)';
  const leafEdge = tissue ? '#a07850' : 'var(--valve-leaf-edge, #0369a1)';
  const ringFill = tissue ? '#f5e1c8' : 'var(--valve-ring, #e2e8f0)';
  const edge = 'var(--valve-edge, #64748b)';
  const pad = 6;
  // orden de dibujo: de atrás hacia adelante
  const order = view === 'top' ? [0, 1, 2] : [...LEAF_IDX].sort((a, b) => Math.sin(leafletCenter(a)) - Math.sin(leafletCenter(b)));

  const vb =
    view === 'top'
      ? `${-R_OUT - pad} ${-R_OUT - pad} ${2 * (R_OUT + pad)} ${2 * (R_OUT + pad)}`
      : view === 'side'
        ? `${-R_OUT - pad} ${-Y_COM - 14} ${2 * (R_OUT + pad)} ${RING_H + 26}`
        : `-50 -40 100 80`;
  const h = view === 'top' ? size : view === 'side' ? (size * (RING_H + 26)) / (2 * (R_OUT + pad)) : size * 0.8;

  return (
    <svg viewBox={vb} width={size} height={h} role="img" aria-label={title ?? 'Válvula aórtica trivalva'}>
      {title && <title>{title}</title>}
      {view === 'side' ? (
        <rect x={-R_OUT} y={-RING_H / 2} width={2 * R_OUT} height={RING_H} rx={2} fill={ringFill} stroke={edge} strokeWidth={0.5} opacity={0.55} />
      ) : (
        <>
          <path d={ring(view, R_OUT)} fill={ringFill} stroke={edge} strokeWidth={0.6} />
          <path d={ring(view, R_IN)} fill="var(--valve-orifice, #fff)" stroke={edge} strokeWidth={0.6} />
        </>
      )}
      {order.map((i) => (
        <polygon
          key={i}
          ref={(el) => {
            polys.current[i] = el;
          }}
          points={toPts(i, init[i], view)}
          fill={highlight === i ? 'var(--coral, #ea580c)' : leafFill}
          stroke={leafEdge}
          strokeWidth={0.55}
          strokeLinejoin="round"
          opacity={view === 'side' ? 0.92 : 0.96}
        />
      ))}
      {numbers &&
        view === 'top' &&
        LEAF_IDX.map((i) => {
          const a = leafletCenter(i);
          return (
            <text
              key={i}
              x={(R_IN * 0.72 * Math.cos(a)).toFixed(1)}
              y={(R_IN * 0.72 * Math.sin(a) + 2).toFixed(1)}
              textAnchor="middle"
              fontSize={6}
              fontWeight={700}
              fill={tissue ? '#7c5a36' : '#075985'}
            >
              {i + 1}
            </text>
          );
        })}
    </svg>
  );
}
