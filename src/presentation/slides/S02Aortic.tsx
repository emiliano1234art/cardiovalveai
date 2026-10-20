import { useEffect, useMemo, useRef, useState } from 'react';
import { EXPLAIN } from '../../content/explanations';
import { useDeck } from '../components/deck';
import { PhaseCursor, Plot, pathFrom } from '../components/Plot';
import { Explain, Screen } from '../components/screen';
import { Visual3D } from '../components/Visual3D';
import { ecgAt, rPeak, rrOf, type SimParams } from '../sim/model';
import { pressures } from '../sim/physiology';
import { sim, useSim } from '../sim/store';

function PressurePlot({ p, w, h, cursor }: { p: SimParams; w: number; h: number; cursor: boolean }) {
  const b = 3;
  const r0 = rPeak(b, p);
  const RR = rrOf(p);
  const data = useMemo(() => {
    const ts = Array.from({ length: 400 }, (_, i) => (i / 399) * RR);
    const pr = ts.map((x) => pressures(r0 + x, p));
    return { ts, lv: pr.map((q) => q.lv), ao: pr.map((q) => q.ao), ecg: ts.map((x) => ecgAt(r0 + x, p)), open: pr };
  }, [p, r0, RR]);
  const o0 = data.open.findIndex((q) => q.open);
  const o1 = data.open.length - 1 - [...data.open].reverse().findIndex((q) => q.open);
  return (
    <div>
      <Plot width={w} height={70} x={[0, RR]} y={[-0.4, 1.3]} xTicks={[]} margin={{ l: 70, r: 16, t: 6, b: 4 }} yLabel="ECG">
        {(s) => (
          <>
            <path d={pathFrom(data.ts, data.ecg, s.sx, s.sy)} fill="none" stroke="var(--sig-ecg)" strokeWidth={1.6} />
            <text x={s.sx(0) + 6} y={s.y0 + 12} style={{ fill: 'var(--sig-ecg)', fontWeight: 700 }}>
              R
            </text>
            <PhaseCursor s={s} T={RR} show={cursor} />
          </>
        )}
      </Plot>
      <Plot width={w} height={h} x={[0, RR]} y={[0, 130]} yTicks={[0, 40, 80, 120]} xTicks={[0, RR / 2, RR]} xFmt={(v) => `${(v * 1000).toFixed(0)} ms`} xLabel="tiempo desde el pico R" yLabel="mmHg (ilustrativo)">
        {(s) => (
          <>
            {o0 >= 0 && <rect x={s.sx(data.ts[o0])} y={s.y0} width={s.sx(data.ts[o1]) - s.sx(data.ts[o0])} height={s.h} fill="rgba(8,145,178,.08)" />}
            {o0 >= 0 && (
              <text x={(s.sx(data.ts[o0]) + s.sx(data.ts[o1])) / 2} y={s.y0 + 14} textAnchor="middle" style={{ fill: 'var(--cyan)', fontWeight: 700 }}>
                válvula abierta
              </text>
            )}
            <path d={pathFrom(data.ts, data.ao, s.sx, s.sy)} fill="none" stroke="#e11d48" strokeWidth={2.4} />
            <path d={pathFrom(data.ts, data.lv, s.sx, s.sy)} fill="none" stroke="#2563eb" strokeWidth={2.4} />
            <PhaseCursor s={s} T={RR} show={cursor} />
          </>
        )}
      </Plot>
      <div className="v-legend" style={{ fontSize: 14, paddingLeft: 70 }}>
        <span>
          <i style={{ background: '#2563eb' }} />P ventrículo izq.
        </span>
        <span>
          <i style={{ background: '#e11d48' }} />P aórtica
        </span>
      </div>
    </div>
  );
}

const STEPS = [
  { t: 'El ventrículo se contrae', d: 'Su presión sube rápidamente.' },
  { t: 'La presión supera a la aórtica', d: 'Las tres valvas se abren hacia la pared.' },
  { t: 'La sangre sale hacia la aorta', d: 'La válvula permanece abierta.' },
  { t: 'La presión cae y la válvula se cierra', d: 'Las valvas se juntan en el centro y limitan el retroceso.' },
];

/** Paso actual del ciclo según las presiones ilustrativas. */
function stepAt(t: number, p: SimParams) {
  const q = pressures(t, p);
  if (q.open) return t - q.tOpen < 0.06 ? 1 : 2;
  if (t >= q.tCloseStart) return 3;
  return t - q.r > 0.03 ? 0 : 3;
}

export function S02Aortic() {
  const { print } = useDeck();
  const { params } = useSim();
  const [manual, setManual] = useState<number | null>(null);
  const rows = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    const mark = (k: number) => rows.current.forEach((el, i) => el?.classList.toggle('on', i === k));
    if (manual !== null) {
      mark(manual > 0.55 ? 2 : manual > 0.1 ? 1 : 3);
      return;
    }
    return sim.onFrame((t) => mark(stepAt(t, sim.state.params)));
  }, [manual]);

  return (
    <Screen
      num={2}
      kicker="Fisiología"
      title="¿Cómo funciona una válvula aórtica?"
      lead="Se abre cuando el ventrículo empuja la sangre y se cierra para que no regrese."
      actions={
        <>
          <Explain label="¿Cómo funciona?" content={EXPLAIN.p_aortic_how} />
          <Explain label="¿Por qué se mueve sin motores?" content={EXPLAIN.p_no_motor} />
        </>
      }
    >
      <div className="v-grid" style={{ gridTemplateColumns: '820px 1fr', gap: 24, height: '100%' }}>
        <div className="v-viewer" style={{ height: '100%' }}>
          <Visual3D kind="aortic" render="aortic-hero" alt="Válvula aórtica de tres valvas" camera="hero" showLabels manualOpen={manual} />
          <div className="v-viewer-foot">
            <div className="v-readout v-row" style={{ gap: 12 }}>
              <div className="v-seg" role="group" aria-label="Modo">
                <button className={manual === null ? 'active' : ''} onClick={() => setManual(null)}>
                  Animación
                </button>
                <button className={manual !== null ? 'active' : ''} onClick={() => setManual(manual ?? 0)}>
                  Manual
                </button>
              </div>
              {manual !== null && (
                <label className="v-row" style={{ gap: 10, fontSize: 16, color: 'var(--text-2)' }}>
                  Cerrada
                  <input type="range" min={0} max={1} step={0.01} value={manual} onChange={(e) => setManual(Number(e.target.value))} style={{ width: 220, accentColor: 'var(--cyan)' }} aria-label="Abierta ↔ Cerrada" />
                  Abierta
                </label>
              )}
            </div>
            <span className="v-hint">Teoría fisiológica · animación ilustrativa</span>
          </div>
        </div>
        <div className="v-col" style={{ gap: 18 }}>
          <ol className="v-steps">
            {STEPS.map((s, i) => (
              <li
                key={s.t}
                ref={(el) => {
                  rows.current[i] = el;
                }}
              >
                <span className="n">{i + 1}</span>
                <div>
                  <b>{s.t}</b>
                  <span>{s.d}</span>
                </div>
              </li>
            ))}
          </ol>
          <div className="v-panel" style={{ padding: '12px 16px 6px' }}>
            <div className="v-panel-title" style={{ margin: 0, fontSize: 13 }}>
              Presiones durante un latido (ilustrativas)
            </div>
            <PressurePlot p={params} w={600} h={190} cursor={!print && manual === null} />
          </div>
        </div>
      </div>
    </Screen>
  );
}
