import type { ReactNode } from 'react';
import { JOINT_DECISIONS, TOOLKIT_FINDINGS } from '../content';
import { Cite, Field, SlideHead, useDeck } from '../components/deck';

type Status = 'sim' | 'dev' | 'future';

const NODES: { t: string; d: string; s: Status; who: 'B' | 'K' | 'BK' }[] = [
  { t: 'Válvula + actuador', d: '2 valvas · servo', s: 'dev', who: 'B' },
  { t: 'Piezo + MEMS', d: 'integrados al soporte', s: 'dev', who: 'B' },
  { t: 'ECG → pico R', d: 'simulado · real aislado', s: 'sim', who: 'BK' },
  { t: 'ESP32', d: 'adquisición y control', s: 'dev', who: 'B' },
  { t: 'IA: línea basal', d: 'detección de desviaciones', s: 'sim', who: 'B' },
  { t: 'Dashboard', d: 'señales + ECG + IA', s: 'sim', who: 'BK' },
  { t: 'Respuesta funcional', d: 'FC · actividad · síntomas', s: 'future', who: 'K' },
  { t: 'Rehabilitación personalizada', d: 'seguimiento integrado', s: 'future', who: 'K' },
];

const STYLE: Record<Status, { border: string; bg: string; color: string; label: string }> = {
  sim: { border: '2px solid var(--cyan)', bg: 'var(--cyan-soft)', color: 'var(--text)', label: 'Implementado en simulación' },
  dev: { border: '2px dashed var(--cyan)', bg: '#fff', color: 'var(--text)', label: 'Prototipo en desarrollo / propuesta' },
  future: { border: '2px dashed var(--violet)', bg: 'var(--violet-soft)', color: 'var(--violet)', label: 'Visión futura' },
};

function Discipline({ title, color, items }: { title: string; color: string; items: ReactNode[] }) {
  return (
    <div className="v-panel" style={{ borderTop: `5px solid ${color}`, padding: '14px 20px' }}>
      <div style={{ fontSize: 15, letterSpacing: '.12em', textTransform: 'uppercase', fontWeight: 800, color, marginBottom: 8 }}>{title}</div>
      <ul className="v-list" style={{ fontSize: 17, gap: 6 }}>
        {items.map((x, i) => (
          <li key={i}>{x}</li>
        ))}
      </ul>
    </div>
  );
}

export function S03Solution() {
  const { print } = useDeck();
  const W = 1400;
  const nodeW = 162;
  const gap = (W - nodeW * NODES.length) / (NODES.length - 1);
  return (
    <div className="v-slide" style={{ paddingTop: 44 }}>
      <SlideHead num={3} kicker="Solución ValveSense · integración interdisciplinaria" title="Un sistema que une válvula, señales y respuesta funcional" />
      <div className="v-body v-col" style={{ gap: 16 }}>
        <div className="v-panel" style={{ padding: '16px 0 12px' }}>
          <div style={{ position: 'relative', height: 120, margin: '0 0' }}>
            {NODES.map((n, i) => {
              const st = STYLE[n.s];
              const x = i * (nodeW + gap);
              return (
                <div key={n.t}>
                  <div
                    style={{ position: 'absolute', left: x + 14, top: 0, width: nodeW - 8, height: 104, borderRadius: 16, border: st.border, background: st.bg, padding: '10px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
                  >
                    <div className="v-tiny v-mono" style={{ fontSize: 12 }}>
                      {n.who === 'B' ? 'BIOMEDICINA' : n.who === 'K' ? 'KINESIOLOGÍA' : 'AMBAS'}
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 750, lineHeight: 1.15, color: st.color }}>{n.t}</div>
                    <div className="v-tiny" style={{ fontSize: 13.5 }}>
                      {n.d}
                    </div>
                  </div>
                  {i < NODES.length - 1 && (
                    <svg style={{ position: 'absolute', left: x + 14 + nodeW - 8, top: 40, width: gap + 8, height: 24 }} aria-hidden>
                      <line x1={2} x2={gap + 2} y1={12} y2={12} stroke={NODES[i + 1].s === 'future' ? 'var(--violet)' : 'var(--cyan)'} strokeWidth={2.5} strokeDasharray="6 4" className="v-anim-optional" style={print ? undefined : { animation: 'v-flow 1s linear infinite' }} />
                      <path d={`M${gap - 4} 6 L${gap + 4} 12 L${gap - 4} 18`} fill="none" stroke={NODES[i + 1].s === 'future' ? 'var(--violet)' : 'var(--cyan)'} strokeWidth={2.5} />
                    </svg>
                  )}
                </div>
              );
            })}
          </div>
          <div className="v-row" style={{ gap: 18, justifyContent: 'center', fontSize: 14.5, color: 'var(--text-2)' }}>
            {(Object.keys(STYLE) as Status[]).map((k) => (
              <span key={k} className="v-row" style={{ gap: 8 }}>
                <span style={{ width: 26, height: 14, borderRadius: 4, border: STYLE[k].border, background: STYLE[k].bg }} />
                {STYLE[k].label}
              </span>
            ))}
          </div>
        </div>

        <div className="v-grid" style={{ gridTemplateColumns: '1fr 520px 1fr', gap: 18 }}>
          <Discipline
            title="Ingeniería Civil en Biomedicina"
            color="var(--cyan)"
            items={[
              'Mecanismo bileaflet y actuador.',
              <>
                Sensores, adquisición y sincronización ECG.
                <Cite ids={['inmp441', 'esp32', 'pan1985']} />
              </>,
              <>
                Procesamiento: RMS, energía, Fourier y línea basal.
                <Cite ids={['fritzsche2007', 'taebi2019']} />
              </>,
              'Modelación matemática y dashboard.',
            ]}
          />
          <div className="v-col" style={{ gap: 10 }}>
            <div className="v-key" style={{ textAlign: 'center', fontSize: 21, padding: '14px 20px' }}>
              <div className="v-kicker" style={{ fontSize: 12, marginBottom: 4 }}>
                Pregunta compartida
              </div>
              ¿Cómo relacionar cambios del funcionamiento valvular con la respuesta funcional para orientar un seguimiento más personalizado?
            </div>
            <div className="v-panel flat" style={{ padding: '10px 16px' }}>
              <div className="v-panel-title" style={{ marginBottom: 4, fontSize: 13 }}>
                Decisiones construidas en conjunto
              </div>
              {JOINT_DECISIONS.slice(0, 5).map((d) => (
                <div key={d.decision} style={{ fontSize: 14, lineHeight: 1.3, marginBottom: 3 }}>
                  · {d.decision}
                </div>
              ))}
              <div style={{ fontSize: 13.5, marginTop: 6 }}>
                <span className="v-tiny">Toolkit (Encargo 1): </span>
                <Field value={TOOLKIT_FINDINGS[0]} />
              </div>
            </div>
          </div>
          <Discipline
            title="Kinesiología"
            color="var(--teal)"
            items={[
              'Variables funcionales: FC, SpO₂, actividad.',
              <>
                Esfuerzo percibido (Borg) y síntomas.
                <Cite ids={['borg1982']} />
              </>,
              <>
                Recuperación de la FC tras el ejercicio.
                <Cite ids={['cole1999']} />
              </>,
              <>
                Necesidades de rehabilitación post cirugía valvular.
                <Cite ids={['abraham2021', 'ambrosetti2021']} />
              </>,
            ]}
          />
        </div>
      </div>
    </div>
  );
}
