import { useEffect, useMemo, useRef } from 'react';
import photo from '../assets/pablo-reyes.jpg';
import { INTERVIEW } from '../content';
import { PX } from '../explain';
import { useDeck } from '../components/deck';
import { PhaseCursor, Plot, pathFrom } from '../components/Plot';
import { Explain, Screen } from '../components/screen';
import { Visual3D } from '../components/Visual3D';
import { ecgAt, rPeak, rrOf, type SimParams } from '../sim/model';
import { pressures } from '../sim/physiology';
import { sim, useSim } from '../sim/store';

const BEAT = 3;
const W = 780;
const LV = '#2563eb';
const AO = '#e11d48';

/** Diagrama de Wiggers simplificado: ECG + presiones del VI y de la aorta + estado de la válvula aórtica. */
function Wiggers({ p, live }: { p: SimParams; live: boolean }) {
  const r0 = rPeak(BEAT, p);
  const RR = rrOf(p);
  const d = useMemo(() => {
    const ts = Array.from({ length: 420 }, (_, i) => (i / 419) * RR);
    const pr = ts.map((x) => pressures(r0 + x, p));
    return {
      ts,
      lv: pr.map((q) => q.lv),
      ao: pr.map((q) => q.ao),
      ecg: ts.map((x) => ecgAt(r0 + x, p)),
      tOpen: pr[0].tOpen - r0,
      tClose: pr[0].tCloseStart - r0,
    };
  }, [p, r0, RR]);
  const marks = [
    { t: d.tOpen, l: 'Apertura aórtica', c: 'var(--teal)' },
    { t: d.tClose, l: 'Cierre aórtico', c: 'var(--amber)' },
  ];
  const vlines = (s: { sx: (v: number) => number; y0: number; h: number }) =>
    marks.map((m) => <line key={m.l} x1={s.sx(m.t)} x2={s.sx(m.t)} y1={s.y0} y2={s.y0 + s.h} stroke={m.c} strokeWidth={1.6} strokeDasharray="5 4" />);
  return (
    <div className="v-wiggers">
      <Plot width={W} height={92} x={[0, RR]} y={[-0.45, 1.3]} xTicks={[]} margin={{ l: 78, r: 16, t: 8, b: 4 }} yLabel="ECG">
        {(s) => (
          <>
            {vlines(s)}
            <path d={pathFrom(d.ts, d.ecg, s.sx, s.sy)} fill="none" stroke="var(--sig-ecg)" strokeWidth={2} />
            <text x={s.sx(0) + 8} y={s.y0 + 14} style={{ fill: 'var(--sig-ecg)', fontWeight: 800 }}>
              R
            </text>
            <PhaseCursor s={s} T={RR} show={live} />
          </>
        )}
      </Plot>
      <Plot
        width={W}
        height={330}
        x={[0, RR]}
        y={[0, 150]}
        yTicks={[0, 40, 80, 120]}
        xTicks={[0, 0.2, 0.4, 0.6, 0.8].filter((v) => v < RR)}
        xFmt={(v) => `${Math.round(v * 1000)} ms`}
        xLabel="tiempo desde el pico R"
        yLabel="Presión [mmHg]"
        margin={{ l: 78, r: 16, t: 10, b: 52 }}
      >
        {(s) => (
          <>
            <rect x={s.sx(d.tOpen)} y={s.y0} width={s.sx(d.tClose) - s.sx(d.tOpen)} height={s.h} fill="rgba(13,148,136,.09)" />
            <text x={(s.sx(d.tOpen) + s.sx(d.tClose)) / 2} y={s.y0 + s.h - 10} textAnchor="middle" style={{ fill: 'var(--teal)', fontWeight: 800 }}>
              válvula aórtica abierta
            </text>
            {vlines(s)}
            {marks.map((m) => (
              <text key={m.l} x={s.sx(m.t) + 8} y={s.y0 + 18} style={{ fill: m.c, fontWeight: 800, fontSize: 15 }}>
                {m.l}
              </text>
            ))}
            <path d={pathFrom(d.ts, d.ao, s.sx, s.sy)} fill="none" stroke={AO} strokeWidth={3} />
            <path d={pathFrom(d.ts, d.lv, s.sx, s.sy)} fill="none" stroke={LV} strokeWidth={3} />
            {marks.map((m, i) => (
              <circle
                key={m.l}
                cx={s.sx(m.t)}
                cy={s.sy(i ? d.ao[Math.round((m.t / RR) * 419)] : d.lv[Math.round((m.t / RR) * 419)])}
                r={6}
                fill="#fff"
                stroke={m.c}
                strokeWidth={3}
              />
            ))}
            <PhaseCursor s={s} T={RR} show={live} />
          </>
        )}
      </Plot>
      <div className="v-legend" style={{ fontSize: 15, paddingLeft: 78 }}>
        <span>
          <i style={{ background: 'var(--sig-ecg)' }} />
          ECG
        </span>
        <span>
          <i style={{ background: LV }} />
          Presión ventrículo izquierdo
        </span>
        <span>
          <i style={{ background: AO }} />
          Presión aórtica
        </span>
        <span className="v-tiny">Diagrama simplificado · ilustrativo</span>
      </div>
    </div>
  );
}

/** Estado de la válvula según el diagrama, actualizado cada cuadro. */
function ValveState({ p }: { p: SimParams }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(
    () =>
      sim.onFrame((t) => {
        const open = pressures(t, p).open;
        const el = ref.current;
        if (!el || el.dataset.open === String(open)) return;
        el.dataset.open = String(open);
        el.textContent = open ? 'Abierta · P(VI) > P(Ao)' : 'Cerrada · P(VI) < P(Ao)';
      }),
    [p],
  );
  return <div ref={ref} className="v-wg-state" />;
}

export function D06Interview() {
  const { print } = useDeck();
  const { params } = useSim();
  const p = useMemo(() => ({ ...params, condition: 'normal' as const }), [params]);
  const I = INTERVIEW;
  return (
    <Screen num={6} kicker="Entrevista docente" title={I.topic} actions={<Explain label="¿Cómo se relaciona con CardioVal AI?" content={PX.interview} />}>
      <div className="v-col" style={{ gap: 18, height: '100%' }}>
        <div className="v-grid" style={{ gridTemplateColumns: '300px 1fr 330px', gap: 20, flex: 1, minHeight: 0 }}>
          <div className="v-panel v-wg-person">
            <img src={photo} alt={`Fotografía de ${I.name}`} />
            <b>{I.name}</b>
            <span>{I.role}</span>
            <span className="v-tiny">{I.institution}</span>
            <p>{I.context}</p>
          </div>
          <div className="v-panel" style={{ padding: '10px 6px 8px', display: 'grid', placeItems: 'center' }}>
            <Wiggers p={p} live={!print} />
          </div>
          <div className="v-col" style={{ gap: 10, minHeight: 0 }}>
            <div className="v-viewer" style={{ height: 400, flex: 'none' }}>
              <Visual3D
                kind="university"
                render="university-hero"
                alt="Válvula aórtica trivalva experimental de CardioVal AI"
                camera="hero"
                showLabels={false}
              />
              <div className="v-viewer-foot">
                <span className="v-hint">Nuestra válvula trivalva</span>
              </div>
            </div>
            {!print && <ValveState p={p} />}
            <p className="v-wg-sync">Abre y cierra en los mismos instantes que marca el diagrama.</p>
          </div>
        </div>
        <div className="v-wg-phrase">
          <b>{I.phrase}</b>
          <em>Aplicación al prototipo: interpretación de nuestro equipo.</em>
        </div>
      </div>
    </Screen>
  );
}
