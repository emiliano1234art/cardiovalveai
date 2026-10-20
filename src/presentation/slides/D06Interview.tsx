import { INTERVIEW } from '../content';
import { PX } from '../explain';
import { Field } from '../components/deck';
import { Explain, Screen } from '../components/screen';

const FIELDS: { k: 'extract' | 'observations' | 'impact'; t: string; i: string }[] = [
  { k: 'extract', t: 'Extracto de la entrevista', i: '❝' },
  { k: 'observations', t: 'Observaciones', i: '◎' },
  { k: 'impact', t: 'Impacto en el proyecto', i: '↗' },
];

export function D06Interview() {
  const I = INTERVIEW;
  const base = import.meta.env.BASE_URL;
  return (
    <Screen
      num={6}
      kicker="Entrevista"
      title="Validación interdisciplinaria"
      lead="Un académico revisa nuestras decisiones desde su experiencia."
      actions={<Explain label="¿Qué significa?" content={PX.interview} />}
    >
      <div className="v-grid" style={{ gridTemplateColumns: '400px 1fr', gap: 28, height: '100%' }}>
        <div className="v-panel v-iv-person">
          <div className="v-iv-photo">
            {I.photo ? (
              <img src={`${base}${I.photo}`} alt={`Fotografía de ${I.name}`} />
            ) : (
              <svg viewBox="0 0 100 100" width="120" height="120" aria-hidden>
                <circle cx="50" cy="38" r="18" fill="#cbd5e1" />
                <path d="M16 92c4-20 18-30 34-30s30 10 34 30" fill="#cbd5e1" />
              </svg>
            )}
            {!I.photo && <span className="v-pending-text">[FOTO PENDIENTE]</span>}
          </div>
          <div className="v-iv-field">
            <span>Nombre</span>
            <Field value={I.name} />
          </div>
          <div className="v-iv-field">
            <span>Área</span>
            <Field value={I.area} />
          </div>
          <span className={`v-tag ${I.status === 'pendiente' ? 'pending' : 'done'}`} style={{ alignSelf: 'center' }}>
            {I.status === 'pendiente' ? 'Entrevista pendiente' : 'Entrevista realizada'}
          </span>
        </div>
        <div className="v-col" style={{ gap: 16 }}>
          <div className="v-iv-flow">
            {FIELDS.map((f, i) => (
              <div key={f.k} className="v-panel v-iv-card">
                <div className="v-iv-card-head">
                  <i>{f.i}</i>
                  <b>{f.t}</b>
                </div>
                <Field value={I[f.k]} />
                {i < FIELDS.length - 1 && <em className="v-iv-arrow">→</em>}
              </div>
            ))}
          </div>
          {I.status === 'pendiente' && (
            <div className="v-panel v-iv-guide">
              <div className="v-panel-title">Guion preparado · preguntas, no respuestas</div>
              <ol>
                {I.questions.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>
    </Screen>
  );
}
