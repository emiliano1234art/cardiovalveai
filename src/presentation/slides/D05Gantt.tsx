import { useState } from 'react';
import { GANTT, GANTT_IS_PROPOSAL, MILESTONES } from '../content';
import { PX } from '../explain';
import { Explain, Screen } from '../components/screen';

const START = new Date('2026-09-07T00:00:00');
const END = new Date('2026-11-09T00:00:00');
const DAY = 86400000;
const NAME_W = 360;
const CHART_W = 1472 - NAME_W - 20;
const ROW_H = 54;
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const d = (iso: string) => new Date(iso + 'T00:00:00');
const x = (date: Date) => ((date.getTime() - START.getTime()) / (END.getTime() - START.getTime())) * CHART_W;
const fmt = (iso: string) => `${d(iso).getDate()} ${MONTHS[d(iso).getMonth()]}`;
const AREA_COLOR = {
  Ambas: 'linear-gradient(90deg, #0891b2, #0d9488)',
  Biomedicina: 'linear-gradient(90deg, #1d4ed8, #0891b2)',
  Kinesiología: 'linear-gradient(90deg, #0d9488, #16a34a)',
};

export function D05Gantt() {
  const [sel, setSel] = useState<number | null>(null);
  const weeks: Date[] = [];
  for (let t = START.getTime(); t <= END.getTime(); t += 7 * DAY) weeks.push(new Date(t));
  const half = x(new Date(START.getTime() + DAY)) / 2;
  const chartH = GANTT.length * ROW_H;
  return (
    <Screen
      num={5}
      kicker="Carta Gantt"
      title="Nuestro camino a la Feria"
      lead={GANTT_IS_PROPOSAL ? 'Cronograma propuesto · se reemplazará con las fechas del Encargo 2.' : undefined}
      actions={<Explain label="¿Qué significa?" content={PX.gantt} />}
    >
      <div className="v-gantt">
        <div className="v-gantt-axis" style={{ marginLeft: NAME_W, width: CHART_W }}>
          {weeks.map((w) => (
            <span key={w.getTime()} style={{ left: x(w) }}>
              {w.getDate()} {MONTHS[w.getMonth()]}
            </span>
          ))}
        </div>
        <div style={{ position: 'relative' }}>
          <div className="v-gantt-grid" style={{ left: NAME_W, width: CHART_W, height: chartH }}>
            {weeks.map((w) => (
              <i key={w.getTime()} style={{ left: x(w) }} />
            ))}
            {MILESTONES.map((m) => (
              <div key={m.date} className={`v-gantt-ms${m.label === 'Feria' ? ' feria' : ''}`} style={{ left: x(d(m.date)) + half }}>
                <span>
                  ◆ {fmt(m.date)} · {m.label}
                </span>
              </div>
            ))}
          </div>
          {GANTT.map((t, i) => {
            const milestone = t.start === t.end;
            const left = x(d(t.start));
            const width = Math.max(14, x(new Date(d(t.end).getTime() + DAY)) - left);
            return (
              <div key={t.name} className={`v-gantt-row${sel === i ? ' on' : ''}`} style={{ height: ROW_H, gridTemplateColumns: `${NAME_W}px ${CHART_W}px` }}>
                <div className="v-gantt-name">
                  <span>{i + 1}</span>
                  {t.name}
                </div>
                <div style={{ position: 'relative', height: '100%' }}>
                  {milestone ? (
                    <button
                      className="v-gantt-feria"
                      style={{ left: left + half - 17, animationDelay: `${0.2 + i * 0.12}s` }}
                      onClick={() => setSel(sel === i ? null : i)}
                      aria-label={`${t.name}: ${fmt(t.start)}`}
                    >
                      ★
                    </button>
                  ) : (
                    <button
                      className="v-gantt-bar"
                      style={{ left, width, background: AREA_COLOR[t.area], animationDelay: `${0.2 + i * 0.12}s` }}
                      onClick={() => setSel(sel === i ? null : i)}
                      aria-label={`${t.name}: ${fmt(t.start)} a ${fmt(t.end)}`}
                    >
                      {sel === i && (
                        <span className="v-gantt-tip">
                          {fmt(t.start)} → {fmt(t.end)} · {t.area}
                        </span>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="v-legend" style={{ marginTop: 84, marginLeft: NAME_W, fontSize: 15 }}>
          {(Object.keys(AREA_COLOR) as (keyof typeof AREA_COLOR)[]).map((a) => (
            <span key={a}>
              <i className="box" style={{ background: AREA_COLOR[a], width: 26, height: 12, borderRadius: 6 }} />
              {a}
            </span>
          ))}
          <span className="v-tiny">Toca una barra para ver sus fechas.</span>
        </div>
      </div>
    </Screen>
  );
}
