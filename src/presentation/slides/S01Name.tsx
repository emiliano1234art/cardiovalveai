import { META } from '../content';
import { SlideHead, useDeck } from '../components/deck';

const STEPS = [
  { t: 'Movimiento valvular', d: 'Servo + 3 valvas', now: true },
  { t: 'Vibración y sonido', d: 'Piezo · MEMS', now: true },
  { t: 'Análisis', d: 'Eventos, Eₓ, línea basal', now: true },
  { t: 'Integración funcional', d: 'FC · SpO₂ · Borg', now: false },
  { t: 'Seguimiento de rehabilitación', d: 'Personalizado', now: false },
];

const QA = [
  {
    q: '¿Qué buscamos resolver?',
    a: 'Comprender la recuperación de una persona con prótesis valvular exige mirar a la vez cómo funciona la prótesis y cómo responde la persona durante la actividad.',
  },
  {
    q: '¿Qué estamos desarrollando?',
    a: 'Un prototipo trivalvo a escala, movido por un servo, que registra la vibración y el sonido de cada apertura y cierre, y un dashboard que analiza esos registros.',
  },
  {
    q: '¿Qué aportaría en el futuro?',
    a: 'Una base para estudiar si integrar datos valvulares con variables funcionales ayuda a personalizar la rehabilitación cardiorrespiratoria.',
  },
];

export function S01Name() {
  const { print } = useDeck();
  const W = 1398;
  const nodeW = 232;
  const gap = (W - nodeW * STEPS.length) / (STEPS.length - 1);
  const cx = (i: number) => i * (nodeW + gap) + nodeW / 2;
  return (
    <div className="v-slide">
      <SlideHead num={1} kicker="Nombre y propuesta" title={<>ValveSense</>} lead={META.focus} />
      <div className="v-body v-col" style={{ gap: 28 }}>
        <div className="v-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          {QA.map((x) => (
            <div key={x.q} className="v-panel">
              <div className="v-strong" style={{ fontSize: 24, marginBottom: 10, color: 'var(--cyan)' }}>
                {x.q}
              </div>
              <div style={{ fontSize: 21, color: 'var(--text-2)' }}>{x.a}</div>
            </div>
          ))}
        </div>

        <div className="v-panel" style={{ padding: '26px 28px 22px' }}>
          <div className="v-row" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
            <div className="v-panel-title" style={{ margin: 0 }}>
              Secuencia del sistema
            </div>
            <div className="v-row" style={{ gap: 10 }}>
              <span className="v-tag now">Actual · prototipo académico</span>
              <span className="v-tag future">Proyección futura</span>
            </div>
          </div>
          <div style={{ position: 'relative', height: 150 }}>
            <svg width={W} height={150} style={{ position: 'absolute', inset: 0 }} aria-hidden>
              {STEPS.slice(0, -1).map((_, i) => {
                const x1 = cx(i) + nodeW / 2 + 6;
                const x2 = cx(i + 1) - nodeW / 2 - 6;
                const future = !STEPS[i + 1].now;
                return (
                  <g key={i}>
                    <line
                      x1={x1}
                      x2={x2 - 8}
                      y1={75}
                      y2={75}
                      stroke={future ? 'var(--amber)' : 'var(--cyan)'}
                      strokeWidth={3}
                      strokeDasharray="8 4"
                      className="v-anim-optional"
                      style={print ? undefined : { animation: 'v-flow 1s linear infinite' }}
                    />
                    <path d={`M${x2 - 10} 68 L${x2} 75 L${x2 - 10} 82`} fill="none" stroke={future ? 'var(--amber)' : 'var(--cyan)'} strokeWidth={3} />
                  </g>
                );
              })}
            </svg>
            {STEPS.map((s, i) => (
              <div
                key={s.t}
                style={{
                  position: 'absolute',
                  left: cx(i) - nodeW / 2,
                  top: 18,
                  width: nodeW,
                  height: 114,
                  borderRadius: 18,
                  padding: '14px 16px',
                  border: s.now ? '2px solid var(--cyan)' : '2px dashed var(--amber)',
                  background: s.now ? 'var(--cyan-soft)' : 'transparent',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                }}
              >
                <div className="v-tiny" style={{ fontFamily: 'var(--mono)' }}>
                  {String(i + 1).padStart(2, '0')}
                </div>
                <div style={{ fontSize: 21, fontWeight: 700, lineHeight: 1.15, color: s.now ? 'var(--text)' : 'var(--amber)' }}>{s.t}</div>
                <div className="v-tiny">{s.d}</div>
              </div>
            ))}
          </div>
          <p className="v-small" style={{ margin: '10px 0 0' }}>
            Hoy: válvula trivalva a escala sin circuito de presión ni flujo — el movimiento lo impone el servo. La detección de cambios del patrón mecánico es un beneficio
            complementario; el propósito es conectar función valvular, capacidad funcional y rehabilitación.
          </p>
        </div>
      </div>
    </div>
  );
}
