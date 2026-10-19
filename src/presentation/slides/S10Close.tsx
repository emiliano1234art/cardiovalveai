import QRCode from 'qrcode';
import { useEffect, useState, type CSSProperties } from 'react';
import { DASHBOARD_URL, GANTT, GANTT_IS_PROPOSAL, INTERVIEW, KEY_IDEA, MILESTONES, type TaskStatus } from '../content';
import { Field, SlideHead, useDeck } from '../components/deck';
import { ValveSVG } from '../components/ValveSVG';

const START = new Date('2026-09-14T00:00:00');
const END = new Date('2026-11-09T00:00:00');
const DAY = 86400000;
const NAME_W = 300;
const CHART_W = 860 - NAME_W - 30;
const ROW_H = 37;

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


function Gantt() {
  const { print } = useDeck();
  const weeks: Date[] = [];
  for (let t = START.getTime(); t <= END.getTime(); t += 7 * DAY) weeks.push(new Date(t));
  const today = new Date();
  const chartH = GANTT.length * ROW_H;
  return (
    <div className="v-panel" style={{ padding: '12px 16px 8px' }}>
      <div className="v-row" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
        <div className="v-panel-title" style={{ margin: 0 }}>
          Carta Gantt resumida
        </div>
        {GANTT_IS_PROPOSAL && <span className="v-tag pending" style={{ height: 24, fontSize: 11 }}>Propuesta · reemplazar con Encargo 2</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `${NAME_W}px ${CHART_W}px`, alignItems: 'end' }}>
        <div />
        <div style={{ position: 'relative', height: 20 }}>
          {weeks.slice(1, -1).map((w) => (
            <span key={w.getTime()} className="v-tiny v-num" style={{ position: 'absolute', left: x(w), transform: 'translateX(-50%)', fontSize: 12, whiteSpace: 'nowrap' }}>
              {w.getDate()}/{w.getMonth() + 1}
            </span>
          ))}
        </div>
      </div>
      <div style={{ position: 'relative' }}>
        <div style={{ position: 'absolute', left: NAME_W, top: 0, width: CHART_W, height: chartH }}>
          {weeks.map((w) => (
            <div key={w.getTime()} style={{ position: 'absolute', left: x(w), top: 0, bottom: 0, borderLeft: '1px solid var(--grid)' }} />
          ))}
          {MILESTONES.map((m, i) => {
            const d = new Date(m.date + 'T00:00:00');
            const right = x(m.date) > CHART_W * 0.6;
            const row = MILESTONES.length - 1 - i;
            return (
              <div key={m.date} style={{ position: 'absolute', left: x(m.date), top: -2, height: chartH + 10 + row * 20, borderLeft: '2.5px solid var(--coral)' }}>
                <span style={{ position: 'absolute', bottom: -4, [right ? 'right' : 'left']: 6, whiteSpace: 'nowrap', fontSize: 12.5, fontWeight: 700, color: 'var(--coral)' }}>
                  ◆ {d.getDate()}/{d.getMonth() + 1} · {m.label}
                </span>
              </div>
            );
          })}
          {!print && today >= START && today <= END && <div style={{ position: 'absolute', left: x(today), top: 0, bottom: 0, borderLeft: '2px dotted var(--amber)' }} />}
        </div>
        {GANTT.map((t) => (
          <div key={t.name} style={{ display: 'grid', gridTemplateColumns: `${NAME_W}px ${CHART_W}px`, height: ROW_H, alignItems: 'center', borderBottom: '1px solid var(--line-soft)' }}>
            <div style={{ fontSize: 14.5, fontWeight: 600, paddingRight: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</div>
            <div style={{ position: 'relative', height: '100%' }}>
              <div title={t.evidence ?? 'Estado por confirmar con el Encargo 2'} style={{ position: 'absolute', left: x(t.start), width: Math.max(8, x(t.end) - x(t.start)), top: 7, bottom: 7, borderRadius: 6, ...STYLE[t.status] }} />
            </div>
          </div>
        ))}
      </div>
      <div style={{ height: 66 }} />
      <div className="v-legend" style={{ fontSize: 12.5 }}>
        {(['realizado', 'en curso', 'por confirmar'] as TaskStatus[]).map((s) => (
          <span key={s}>
            <i className="box" style={{ ...STYLE[s], width: 22, height: 11 }} />
            {s}
          </span>
        ))}
        <span className="v-tiny" style={{ fontSize: 12 }}>
          «en curso» solo con respaldo en el repositorio
        </span>
      </div>
    </div>
  );
}

function Keychain({ spin }: { spin: boolean }) {
  return (
    <div style={{ perspective: 700, display: 'grid', placeItems: 'center' }}>
      <div className="v-anim-optional" style={{ transformStyle: 'preserve-3d', animation: spin ? 'v-spin-y 9s linear infinite' : undefined, position: 'relative', width: 150, height: 180 }}>
        <svg width={150} height={44} viewBox="0 0 150 44" style={{ position: 'absolute', top: 0, left: 0 }} aria-hidden>
          <circle cx={75} cy={18} r={13} fill="none" stroke="#94a3b8" strokeWidth={3.5} />
          <rect x={70} y={30} width={10} height={12} rx={3} fill="#0891b2" />
        </svg>
        <div style={{ position: 'absolute', top: 40, left: 5, width: 140, height: 140, borderRadius: '50%', background: 'linear-gradient(135deg,#38bdf8,#0e7490)', display: 'grid', placeItems: 'center', boxShadow: '0 8px 20px rgba(8,145,178,.3)' }}>
          <div style={{ ['--valve-ring' as string]: '#e0f2fe', ['--valve-orifice' as string]: '#0b3a52', ['--valve-leaf' as string]: '#7dd3fc', ['--valve-leaf-edge' as string]: '#0b3a52', ['--valve-edge' as string]: '#0b3a52' } as CSSProperties}>
            <ValveSVG view="top" angles={[0, 0]} size={100} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function S10Close() {
  const { print } = useDeck();
  const I = INTERVIEW;
  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => {
    if (!DASHBOARD_URL) return;
    QRCode.toString(DASHBOARD_URL, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0b1f33', light: '#ffffff' } }).then(setQr);
  }, []);
  return (
    <div className="v-slide" style={{ paddingTop: 44 }}>
      <SlideHead num={10} kicker="Plan de trabajo · validación docente · souvenir y cierre" title="Próximos pasos hacia la Feria Científica" />
      <div className="v-body" style={{ display: 'grid', gridTemplateColumns: '880px 1fr', gap: 18, minHeight: 0 }}>
        <Gantt />
        <div className="v-col" style={{ gap: 12 }}>
          <div className="v-panel" style={{ padding: '12px 16px' }}>
            <div className="v-row" style={{ justifyContent: 'space-between' }}>
              <div className="v-panel-title" style={{ margin: 0 }}>
                Entrevista al docente
              </div>
              <span className={`v-tag ${I.status === 'pendiente' ? 'pending' : 'done'}`} style={{ height: 24, fontSize: 11 }}>
                {I.status === 'pendiente' ? 'Pendiente' : 'Realizada'}
              </span>
            </div>
            <div style={{ fontSize: 15, marginTop: 6 }}>
              <Field value={I.name} /> · <Field value={I.role} />
            </div>
            <div style={{ fontSize: 15, marginTop: 4 }}>
              <Field value={I.quote} />
            </div>
            <div className="v-tiny" style={{ marginTop: 6, fontSize: 12.5 }}>
              Observación → implicación → ajuste: <Field value={I.observation} />
            </div>
            {I.status === 'pendiente' && (
              <ol style={{ margin: '6px 0 0', paddingLeft: 20, fontSize: 13, color: 'var(--text-2)', lineHeight: 1.35 }}>
                {I.questions.slice(0, 3).map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ol>
            )}
          </div>
          <div className="v-panel" style={{ padding: '10px 14px', display: 'grid', gridTemplateColumns: '160px 1fr 120px', gap: 12, alignItems: 'center' }}>
            <Keychain spin={!print} />
            <div style={{ fontSize: 14, lineHeight: 1.35 }}>
              <b style={{ fontSize: 16 }}>Souvenir: llavero ValveSense</b>
              <div className="v-small" style={{ fontSize: 13.5 }}>
                Silueta de la válvula bileaflet impresa en 3D (PLA, propuesta) con tarjeta y QR a la presentación interactiva.
              </div>
            </div>
            {qr ? <div style={{ width: 116, height: 116 }} dangerouslySetInnerHTML={{ __html: qr }} aria-label="Código QR" /> : <div className="v-pending-text">[URL pendiente]</div>}
          </div>
        </div>
      </div>
      <div className="v-key" style={{ marginTop: 12, fontSize: 19, padding: '12px 22px', textAlign: 'center' }}>
        “Comprender cómo funciona una válvula es un paso; <span style={{ color: 'var(--cyan)' }}>comprender cómo se recupera una persona es nuestro propósito</span>”.
        <div style={{ fontSize: 14.5, fontWeight: 500, marginTop: 4, color: 'var(--text-2)' }}>{KEY_IDEA}</div>
      </div>
    </div>
  );
}
