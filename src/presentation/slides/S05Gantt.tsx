import type { CSSProperties } from 'react';
import { GANTT, GANTT_IS_PROPOSAL, MILESTONES, type TaskStatus } from '../content';
import { SlideHead, useDeck } from '../components/deck';

const START = new Date('2026-09-14T00:00:00');
const END = new Date('2026-11-09T00:00:00');
const DAY = 86400000;
const NAME_W = 380;
const OWNER_W = 120;
const CHART_W = 1456 - NAME_W - OWNER_W;
const ROW_H = 50;

const x = (iso: string | Date) => {
  const d = typeof iso === 'string' ? new Date(iso + 'T00:00:00') : iso;
  return ((d.getTime() - START.getTime()) / (END.getTime() - START.getTime())) * CHART_W;
};

const STYLE: Record<TaskStatus, CSSProperties> = {
  realizado: { background: 'var(--green)', border: '2px solid var(--green)' },
  'en curso': { background: 'repeating-linear-gradient(135deg, var(--cyan) 0 10px, rgba(34,211,238,.55) 10px 20px)', border: '2px solid var(--cyan)' },
  pendiente: { background: 'transparent', border: '2px solid var(--cyan)' },
  'por confirmar': { background: 'rgba(138,160,187,.18)', border: '2px dashed var(--muted)' },
};

export function S05Gantt() {
  const { print } = useDeck();
  const weeks: Date[] = [];
  for (let t = START.getTime(); t <= END.getTime(); t += 7 * DAY) weeks.push(new Date(t));
  const today = new Date();
  const showToday = today >= START && today <= END;
  const chartH = GANTT.length * ROW_H;

  return (
    <div className="v-slide">
      <SlideHead
        num={5}
        kicker="Línea de tiempo"
        title="Carta Gantt resumida"
        right={
          GANTT_IS_PROPOSAL ? (
            <span className="v-tag pending" style={{ height: 36 }}>
              Propuesta editable · reemplazar con Encargo 2
            </span>
          ) : undefined
        }
      />
      <div className="v-body v-col" style={{ gap: 16 }}>
        <div className="v-panel" style={{ padding: '18px 22px 14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: `${NAME_W}px ${OWNER_W}px ${CHART_W}px`, alignItems: 'end', marginBottom: 6 }}>
            <div className="v-tiny">ACTIVIDAD</div>
            <div className="v-tiny">RESPONSABLE</div>
            <div style={{ position: 'relative', height: 26 }}>
              {weeks.slice(1, -1).map((w) => (
                <span key={w.getTime()} className="v-tiny v-num" style={{ position: 'absolute', left: x(w), transform: 'translateX(-50%)', fontSize: 14, whiteSpace: 'nowrap' }}>
                  {w.getDate()} {w.toLocaleDateString('es-CL', { month: 'short' }).replace('.', '')}
                </span>
              ))}
            </div>
          </div>
          <div style={{ position: 'relative' }}>
            {/* líneas verticales de semana, hitos y hoy */}
            <div style={{ position: 'absolute', left: NAME_W + OWNER_W, top: 0, width: CHART_W, height: chartH }}>
              {weeks.map((w) => (
                <div key={w.getTime()} style={{ position: 'absolute', left: x(w), top: 0, bottom: 0, borderLeft: '1px solid var(--grid)' }} />
              ))}
              {MILESTONES.map((m, i) => {
                const d = new Date(m.date + 'T00:00:00');
                const right = x(m.date) > CHART_W * 0.7;
                const row = MILESTONES.length - 1 - i;
                return (
                  <div key={m.date} style={{ position: 'absolute', left: x(m.date), top: -4, height: chartH + 12 + row * 26, borderLeft: '3px solid var(--coral)' }}>
                    <span
                      style={{
                        position: 'absolute',
                        bottom: -4,
                        [right ? 'right' : 'left']: right ? 8 : 6,
                        whiteSpace: 'nowrap',
                        fontSize: 15,
                        fontWeight: 700,
                        color: 'var(--coral)',
                      }}
                    >
                      ◆ {d.getDate()}/{d.getMonth() + 1} · {m.label}
                    </span>
                  </div>
                );
              })}
              {showToday && !print && (
                <div style={{ position: 'absolute', left: x(today), top: 0, bottom: 0, borderLeft: '2px dotted var(--amber)' }}>
                  <span style={{ position: 'absolute', top: 6, right: 6, fontSize: 13, color: 'var(--amber)', fontWeight: 700 }}>hoy</span>
                </div>
              )}
            </div>
            {GANTT.map((t) => (
              <div key={t.name} style={{ display: 'grid', gridTemplateColumns: `${NAME_W}px ${OWNER_W}px ${CHART_W}px`, height: ROW_H, alignItems: 'center', borderBottom: '1px solid var(--line-soft)' }}>
                <div style={{ fontSize: 19, fontWeight: 600, paddingRight: 12 }}>{t.name}</div>
                <div className="v-tiny">{t.owner ?? '—'}</div>
                <div style={{ position: 'relative', height: '100%' }}>
                  <div
                    title={t.evidence ?? 'Estado por confirmar con el Encargo 2'}
                    style={{ position: 'absolute', left: x(t.start), width: Math.max(10, x(t.end) - x(t.start)), top: 12, bottom: 12, borderRadius: 8, ...STYLE[t.status] }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div style={{ height: 76 }} />
        </div>
        <div className="v-row" style={{ justifyContent: 'space-between', gap: 20 }}>
          <div className="v-legend">
            {(['realizado', 'en curso', 'pendiente', 'por confirmar'] as TaskStatus[]).map((s) => (
              <span key={s}>
                <i className="box" style={{ ...STYLE[s], width: 26, height: 14 }} />
                {s}
              </span>
            ))}
            <span>
              <i className="box" style={{ background: 'var(--coral)', width: 4, height: 18 }} />
              hito
            </span>
          </div>
          <div className="v-tiny" style={{ maxWidth: 760, textAlign: 'right' }}>
            Estados marcados solo con respaldo: «en curso» = dashboard y presentación en el repositorio. Responsables: completar desde el Encargo 2.
          </div>
        </div>
      </div>
    </div>
  );
}
