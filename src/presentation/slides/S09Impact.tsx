import { KEY_IDEA } from '../content';
import { Cite, SlideHead } from '../components/deck';
import { Visual3D } from '../components/Visual3D';

const POTENTIAL = [
  { t: 'Seguimiento posterior a cirugía valvular', d: 'Registrar el comportamiento de la prótesis a lo largo del tiempo.', refs: ['otto2021'] },
  { t: 'Cambios que justifiquen evaluación profesional', d: 'Alertar desviaciones respecto de la propia línea basal para consultar al equipo clínico.', refs: [] },
  { t: 'Integración con la respuesta funcional', d: 'FC, actividad, síntomas, esfuerzo percibido y recuperación tras el ejercicio.', refs: ['borg1982', 'cole1999'] },
  { t: 'Rehabilitación más personalizada', d: 'Apoyar al kinesiólogo con información objetiva y continua.', refs: ['ambrosetti2021', 'mcdonagh2023'] },
];

const RESULTS = [
  { tag: 'done', title: 'Ya demostrado (simulación)', items: ['Modelo bileaflet sincronizado con ECG simulado.', 'Detección de R y FC desde los RR.', 'Detector experimental que separa desviación mecánica de cambio de FC.', 'Dashboard v1 y formato de dataset por ciclo.'] },
  { tag: 'pending', title: 'Pendiente de probar', items: ['Prototipo físico con piezo y MEMS integrados.', 'Repetibilidad del movimiento (CV del ciclo y del ángulo).', 'Detección real de apertura y cierre.', 'Línea basal y condiciones controladas con sensores fijos.'] },
  { tag: 'future', title: 'Proyección', items: ['ECG real con adquisición aislada.', 'Accionamiento pasivo por presión (alternativa B).', 'Estudios con datos reales y validación clínica.'] },
] as const;

export function S09Impact() {
  return (
    <div className="v-slide" style={{ paddingTop: 44 }}>
      <SlideHead num={9} kicker="Integración clínica · resultados esperados · impacto futuro" title="De la señal mecánica al seguimiento funcional" />
      <div className="v-body" style={{ display: 'grid', gridTemplateColumns: '500px 1fr 470px', gap: 18, minHeight: 0 }}>
        <div className="v-col" style={{ gap: 10 }}>
          <div className="v-viewer" style={{ height: 460, border: '2px dashed var(--violet)' }}>
            <Visual3D kind="future" render="future" alt="Concepto futuro: prótesis con sensores miniaturizados y receptor externo" camera="iso" showLabels />
            <div className="v-viewer-tools">
              <span className="v-tag clin" style={{ background: '#fff' }}>
                Concepto futuro
              </span>
            </div>
          </div>
          <div className="v-tiny" style={{ fontSize: 13.5, lineHeight: 1.35 }}>
            Visión hipotética: prótesis de tamaño real con sensores miniaturizados en el anillo y un receptor externo. <b>No es una prótesis implantable validada.</b>
          </div>
        </div>

        <div className="v-col" style={{ gap: 10 }}>
          <div className="v-panel-title" style={{ margin: 0 }}>
            Potencial para Kinesiología y cirugía cardíaca
          </div>
          {POTENTIAL.map((x, i) => (
            <div key={x.t} className="v-panel" style={{ padding: '10px 16px', display: 'grid', gridTemplateColumns: '36px 1fr', gap: 10, alignItems: 'start' }}>
              <div className="v-badge" style={{ width: 34, height: 34, borderRadius: 10, fontSize: 15 }}>
                {i + 1}
              </div>
              <div>
                <div style={{ fontSize: 17.5, fontWeight: 750 }}>
                  {x.t}
                  {x.refs.length > 0 && <Cite ids={x.refs} />}
                </div>
                <div className="v-small" style={{ fontSize: 15 }}>
                  {x.d}
                </div>
              </div>
            </div>
          ))}
          <div className="v-warn" style={{ fontSize: 14.5 }}>
            <b>No afirmamos</b> que el prototipo indique si una cirugía es necesaria, evite intervenciones, determine intensidades seguras de ejercicio ni entregue diagnósticos.
          </div>
        </div>

        <div className="v-col" style={{ gap: 8 }}>
          {RESULTS.map((c) => (
            <div key={c.title} className="v-panel" style={{ padding: '10px 14px', borderStyle: c.tag === 'future' ? 'dashed' : 'solid' }}>
              <span className={`v-tag ${c.tag}`} style={{ height: 24, fontSize: 11.5 }}>
                {c.title}
              </span>
              <ul className="v-list" style={{ fontSize: 14.5, gap: 2, marginTop: 6 }}>
                {c.items.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="v-key" style={{ marginTop: 12, fontSize: 18, padding: '12px 22px' }}>
        <b>Conclusión.</b> {KEY_IDEA}
      </div>
    </div>
  );
}
