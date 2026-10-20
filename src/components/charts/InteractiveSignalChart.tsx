import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceArea, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ExplainId } from '../../content/explanations';
import type { XY } from '../../lib/RingBuffer';
import { fmt } from '../../lib/format';
import { GraphExplanation } from '../explain/GraphExplanation';
import { InteractiveChartLegend, toggleIn, type LegendItem } from '../explain/InteractiveChartLegend';
import { usePlayback } from '../explain/playback';
import { IconClose, IconPause, IconPlay, IconTarget } from '../ui/icons';
import { axis, COLORS, grid, margin } from './chartTheme';
import { ChartTooltip } from './ChartTooltip';

/** Lo que se sabe del punto que tocó el usuario. */
export interface PickInfo {
  /** instante del pico más cercano (s, relativo a «ahora») */
  t: number;
  v: number;
  /** amplitud relativa al máximo visible (0–1) */
  rel: number;
  /** evento mecánico identificado con el ángulo del actuador (si hay datos sincronizados) */
  event: 'cierre' | 'apertura' | null;
  inOpen: boolean;
  /** pico R más cercano (s) a menos de 100 ms */
  nearR: number | null;
}

export interface PickText {
  title: string;
  text: string;
  /** reubica la marca (p. ej. sobre el pico R) */
  at?: { t: number; v: number };
}

interface ChartProps {
  data: XY[];
  open: [number, number][];
  color: string;
  name: string;
  unit: string;
  zoom: number;
  hidden: Set<string>;
  height?: number;
  decimals?: number;
  yDomain?: [number, number];
  yTicks?: number[];
  rMarks?: number[];
  highlight?: boolean;
  describe: (p: PickInfo) => PickText;
  emptyText?: string;
}

const niceCeil = (v: number) => {
  const p = 10 ** Math.floor(Math.log10(v));
  const m = v / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
};

const Y_W = 46;
const TICK_STEP: Record<number, number> = { 3: 0.5, 1: 0.2, 0.5: 0.1 };

/**
 * Señal en tiempo real con: bandas de válvula abierta, marcas de apertura y
 * cierre (del ángulo del actuador), picos R opcionales, zoom temporal,
 * tooltip y selección de un punto con explicación breve.
 */
export function InteractiveSignalChart({
  data,
  open,
  color,
  name,
  unit,
  zoom,
  hidden,
  height = 240,
  decimals = 3,
  yDomain,
  yTicks,
  rMarks = [],
  highlight = false,
  describe,
  emptyText,
}: ChartProps) {
  const { paused, setPaused } = usePlayback();
  const [pick, setPick] = useState<(PickText & { t: number; v: number }) | null>(null);
  const scale = useRef(0);

  const view = useMemo(() => data.filter((p) => p.t >= -zoom), [data, zoom]);
  let mx = 0;
  for (const p of view) mx = Math.max(mx, Math.abs(p.v));
  if (!yDomain) scale.current = mx > scale.current ? mx : scale.current * 0.985 + mx * 0.015;
  const lim = niceCeil(Math.max(scale.current * 1.1, 1e-3));
  const dom: [number, number] = yDomain ?? [-lim, lim];
  const step = TICK_STEP[zoom] ?? 0.5;
  const ticks = Array.from({ length: Math.round(zoom / step) + 1 }, (_, i) => +(-zoom + i * step).toFixed(2));
  const bands = open.filter(([, b]) => b >= -zoom).map(([a, b]) => [Math.max(a, -zoom), b] as [number, number]);

  // al reanudar, la marca deja de corresponder al dato: se borra
  useEffect(() => {
    if (!paused) setPick(null);
  }, [paused]);

  const peak = useMemo(() => {
    if (!highlight || !view.length) return null;
    return view.reduce((m, p) => (Math.abs(p.v) > Math.abs(m.v) ? p : m), view[0]);
  }, [highlight, view]);

  const onPick = (t: number) => {
    if (!view.length) return;
    // pico más cercano dentro de ±60 ms
    let best: XY | null = null;
    for (const p of view) if (Math.abs(p.t - t) <= 0.06 && (!best || Math.abs(p.v) > Math.abs(best.v))) best = p;
    if (!best) best = view.reduce((m, p) => (Math.abs(p.t - t) < Math.abs(m.t - t) ? p : m), view[0]);
    const tp = best.t;
    let event: PickInfo['event'] = null;
    let inOpen = false;
    for (const [a, b] of open) {
      if (tp >= a && tp <= b) inOpen = true;
      if (b < -0.005 && tp >= b - 0.02 && tp <= b + 0.07) event = 'cierre';
      else if (tp >= a + 0.05 && tp <= a + 0.16) event = 'apertura';
    }
    const nearR = rMarks.reduce<number | null>((m, r) => (Math.abs(r - t) <= 0.1 && (m === null || Math.abs(r - t) < Math.abs(m - t)) ? r : m), null);
    const info: PickInfo = {
      t: tp,
      v: best.v,
      rel: mx ? Math.abs(best.v) / mx : 0,
      event,
      inOpen,
      nearR,
    };
    const d = describe(info);
    setPick({ ...d, t: d.at?.t ?? tp, v: d.at?.v ?? best.v });
    if (!paused) setPaused(true);
  };

  if (!data.length)
    return (
      <div className="chart-empty" style={{ height }}>
        {emptyText ?? 'Sin datos'}
      </div>
    );

  return (
    <div>
      <div
        className="ichart"
        onClick={(ev) => {
          // tiempo a partir de la posición del toque (no depende del tooltip; funciona en pantallas táctiles)
          const r = ev.currentTarget.getBoundingClientRect();
          const x0 = margin.left + Y_W;
          const w = r.width - x0 - margin.right;
          const u = (ev.clientX - r.left - x0) / w;
          if (u >= 0 && u <= 1) onPick(-zoom + u * zoom);
        }}
      >
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={view} margin={margin} style={{ cursor: 'crosshair' }}>
            <CartesianGrid {...grid} />
            {!hidden.has('open') &&
              bands.map(([a, b], i) => (
                <ReferenceArea
                  key={`o${i}`}
                  x1={a}
                  x2={b}
                  y1={dom[0]}
                  y2={dom[1]}
                  fill={COLORS.openFill}
                  fillOpacity={1}
                  strokeOpacity={0}
                  ifOverflow="hidden"
                />
              ))}
            {!hidden.has('events') &&
              open.flatMap(([a, b], i) => [
                a >= -zoom ? (
                  <ReferenceLine
                    key={`a${i}`}
                    x={a}
                    stroke="#10a2a0"
                    strokeWidth={1.2}
                    strokeDasharray="2 3"
                    label={{
                      value: '▲ abre',
                      position: 'insideTopLeft',
                      fontSize: 10,
                      fill: '#0f8c8a',
                    }}
                  />
                ) : null,
                b >= -zoom && b < -0.005 ? (
                  <ReferenceLine
                    key={`b${i}`}
                    x={b}
                    stroke="#0a6f95"
                    strokeWidth={1.2}
                    strokeDasharray="2 3"
                    label={{
                      value: '▼ cierra',
                      position: 'insideTopLeft',
                      fontSize: 10,
                      fill: '#0a6f95',
                    }}
                  />
                ) : null,
              ])}
            <XAxis
              dataKey="t"
              type="number"
              domain={[-zoom, 0]}
              ticks={ticks}
              allowDataOverflow
              tickFormatter={(v: number) => (Math.abs(v) < 1e-6 ? 'ahora' : `${fmt(v, zoom < 1 ? 1 : 1)} s`)}
              {...axis}
            />
            <YAxis
              domain={dom}
              allowDataOverflow
              width={Y_W}
              ticks={yTicks ?? [dom[0], dom[0] / 2, 0, dom[1] / 2, dom[1]]}
              tickFormatter={(v: number) => fmt(v, Math.abs(dom[1]) < 0.1 ? 3 : Math.abs(dom[1]) < 2 ? 1 : 0)}
              {...axis}
            />
            <Tooltip
              isAnimationActive={false}
              cursor={{ stroke: '#9fb0c0', strokeDasharray: '3 3' }}
              content={(p) => (
                <ChartTooltip {...p} decimals={decimals} units={{ v: unit }} labelFormatter={(l) => `t = ${fmt(Number(l), 3)} s · toca para explorar`} />
              )}
            />
            {!hidden.has('signal') && <Line dataKey="v" name={name} stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} type="linear" />}
            {!hidden.has('r') &&
              rMarks
                .filter((r) => r >= -zoom)
                .map((r, i) => (
                  <ReferenceDot
                    key={`r${i}`}
                    x={r}
                    y={dom[1] * 0.9}
                    r={0}
                    ifOverflow="hidden"
                    shape={(sp: { cx?: number; cy?: number }) => (
                      <g className={highlight ? 'pulse' : undefined}>
                        <circle cx={sp.cx} cy={sp.cy} r={9} fill="#fff" stroke={color} strokeWidth={1.6} />
                        <text x={sp.cx} y={(sp.cy ?? 0) + 3.5} textAnchor="middle" fontSize={10} fontWeight={700} fill={color}>
                          R
                        </text>
                      </g>
                    )}
                  />
                ))}
            {peak && !pick && (
              <ReferenceDot
                x={peak.t}
                y={peak.v}
                r={0}
                ifOverflow="hidden"
                shape={(sp: { cx?: number; cy?: number }) => (
                  <g className="pulse">
                    <circle cx={sp.cx} cy={sp.cy} r={12} fill="none" stroke="#f59e0b" strokeWidth={2.5} />
                    <text x={(sp.cx ?? 0) + 15} y={(sp.cy ?? 0) + (peak.v > 0 ? 4 : 10)} fontSize={11} fontWeight={700} fill="#b45309">
                      pico
                    </text>
                  </g>
                )}
              />
            )}
            {pick && (
              <ReferenceDot
                x={pick.t}
                y={Math.max(dom[0], Math.min(dom[1], pick.v))}
                r={0}
                ifOverflow="hidden"
                shape={(sp: { cx?: number; cy?: number }) => (
                  <g>
                    <circle cx={sp.cx} cy={sp.cy} r={11} fill="rgba(245,158,11,.18)" stroke="#f59e0b" strokeWidth={2} />
                    <circle cx={sp.cx} cy={sp.cy} r={3} fill="#b45309" />
                  </g>
                )}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
      {pick && (
        <div className="pick-card" role="status">
          <span className="pick-icon">
            <IconTarget size={16} />
          </span>
          <div>
            <b>{pick.title}</b>
            <p>{pick.text}</p>
            <span className="pick-meta num">
              t = {fmt(pick.t, 2)} s · {fmt(pick.v, decimals)} {unit}
            </span>
          </div>
          <div className="pick-actions">
            {paused && (
              <button type="button" className="btn sm" onClick={() => setPaused(false)}>
                <IconPlay size={12} /> Reanudar
              </button>
            )}
            <button type="button" className="icon-btn" onClick={() => setPick(null)} aria-label="Cerrar">
              <IconClose size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export const ZOOMS = [3, 1, 0.5] as const;

interface CardProps {
  icon: ReactNode;
  title: string;
  sub: string;
  explain: ExplainId;
  legend: LegendItem[];
  zoom: number;
  onZoom: (z: number) => void;
  children: (hidden: Set<string>, highlight: boolean) => ReactNode;
  footer?: ReactNode;
  id?: string;
}

/** Tarjeta de señal: título corto, ⓘ, leyenda interactiva, zoom y pausa. */
export function SignalCard({ icon, title, sub, explain, legend, zoom, onZoom, children, footer, id }: CardProps) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [hl, setHl] = useState(false);
  const { paused, setPaused } = usePlayback();
  return (
    <div className="card sig-card" id={id}>
      <div className="sig-head">
        <span className="sig-icon">{icon}</span>
        <div className="sig-titles">
          <h3>{title}</h3>
          <p>{sub}</p>
        </div>
        <GraphExplanation id={explain} onOpenChange={setHl} />
      </div>
      <div className="sig-tools">
        <InteractiveChartLegend items={legend} hidden={hidden} onToggle={(k) => setHidden((h) => toggleIn(h, k))} />
        <div className="sig-tools-right">
          <div className="zoom" role="group" aria-label="Zoom de tiempo">
            {ZOOMS.map((z) => (
              <button key={z} type="button" className={zoom === z ? 'active' : ''} onClick={() => onZoom(z)} aria-pressed={zoom === z}>
                {fmt(z, z < 1 ? 1 : 0)} s
              </button>
            ))}
          </div>
          <button
            type="button"
            className={`icon-btn${paused ? ' on' : ''}`}
            onClick={() => setPaused(!paused)}
            aria-label={paused ? 'Reanudar señales' : 'Pausar señales'}
            title={paused ? 'Reanudar' : 'Pausar'}
          >
            {paused ? <IconPlay size={14} /> : <IconPause size={14} />}
          </button>
        </div>
      </div>
      {children(hidden, hl)}
      {footer}
    </div>
  );
}
