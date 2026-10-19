import type { ReactNode } from 'react';
import { JOINT_DECISIONS, TOOLKIT_FINDINGS } from '../content';
import { Cite, Field, SlideHead } from '../components/deck';

function Discipline({ title, color, items }: { title: string; color: string; items: { t: string; d: ReactNode }[] }) {
  return (
    <div className="v-panel" style={{ borderColor: color, borderWidth: 2 }}>
      <div style={{ fontSize: 15, letterSpacing: '.14em', textTransform: 'uppercase', fontWeight: 800, color, marginBottom: 12 }}>{title}</div>
      <div className="v-col" style={{ gap: 18 }}>
        {items.map((x) => (
          <div key={x.t}>
            <div style={{ fontSize: 23, fontWeight: 700 }}>{x.t}</div>
            <div className="v-small" style={{ fontSize: 19 }}>
              {x.d}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function S03Interdisciplinary() {
  return (
    <div className="v-slide">
      <SlideHead num={3} kicker="Wicked problem · integración interdisciplinaria" title="Dos disciplinas, una pregunta compartida" />
      <div className="v-body" style={{ display: 'grid', gridTemplateColumns: '1fr 560px 1fr', gap: 22, alignItems: 'stretch' }}>
        <Discipline
          title="Ingeniería Civil en Biomedicina"
          color="var(--cyan)"
          items={[
            { t: 'Mecanismo', d: 'Válvula trivalva a escala, transmisión desde el servo.' },
            { t: 'Electrónica y sensores', d: <>Piezo (vibración) y MEMS I²S (sonido) sobre ESP32.<Cite ids={['inmp441', 'esp32']} /></> },
            { t: 'Adquisición y procesamiento', d: <>Eventos de apertura/cierre, Eₓ, RMS. El sonido de válvulas mecánicas ya se ha analizado para monitoreo.<Cite ids={['fritzsche2007']} /></> },
            { t: 'Modelación matemática', d: <>θ(t), ω(t) y señal acumulada; antecedentes en señales vibratorias cardíacas.<Cite ids={['taebi2019']} /></> },
          ]}
        />

        <div className="v-col" style={{ gap: 12 }}>
          <div
            className="v-panel"
            style={{ background: 'linear-gradient(135deg, rgba(34,211,238,.16), rgba(251,191,36,.10))', borderColor: 'var(--cyan)', borderWidth: 2, textAlign: 'center', padding: '18px 22px' }}
          >
            <div className="v-panel-title" style={{ color: 'var(--cyan)' }}>
              Pregunta compartida
            </div>
            <div style={{ fontSize: 25, fontWeight: 750, lineHeight: 1.22 }}>
              ¿Cómo relacionar cambios del funcionamiento valvular con la respuesta funcional para orientar un seguimiento más personalizado?
            </div>
          </div>
          <div className="v-panel flat" style={{ padding: '12px 18px' }}>
            <div className="v-panel-title" style={{ marginBottom: 8 }}>Decisiones construidas en conjunto</div>
            <div className="v-col" style={{ gap: 6 }}>
              {JOINT_DECISIONS.map((d) => (
                <div key={d.decision} style={{ fontSize: 15.5, lineHeight: 1.3 }}>
                  <span style={{ color: 'var(--text)' }}>{d.decision}</span> <span className="v-tiny">· {d.from}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="v-panel flat" style={{ padding: '12px 18px', borderStyle: 'dashed' }}>
            <div className="v-panel-title" style={{ marginBottom: 8 }}>Hallazgos del Toolkit (Encargo 1)</div>
            <div className="v-col" style={{ gap: 4, fontSize: 15 }}>
              {TOOLKIT_FINDINGS.map((f, i) => (
                <Field key={i} value={f} />
              ))}
            </div>
          </div>
        </div>

        <Discipline
          title="Kinesiología"
          color="var(--amber)"
          items={[
            { t: 'Variables funcionales', d: 'Frecuencia cardíaca, SpO₂ y respuesta a la actividad.' },
            { t: 'Interpretación del esfuerzo', d: <>Percepción de esfuerzo con la escala de Borg.<Cite ids={['borg1982']} /></> },
            { t: 'Recuperación', d: <>Recuperación de la FC tras el ejercicio, marcador estudiado en pruebas de esfuerzo.<Cite ids={['cole1999']} /></> },
            { t: 'Necesidades de rehabilitación', d: <>Programas integrales y modalidades centro/domicilio.<Cite ids={['ambrosetti2021', 'mcdonagh2023']} /></> },
          ]}
        />
      </div>
    </div>
  );
}
