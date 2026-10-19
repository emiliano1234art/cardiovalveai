import { INTERVIEW, isPending } from '../content';
import { Field, SlideHead } from '../components/deck';

export function S06Interview() {
  const I = INTERVIEW;
  const pending = I.status === 'pendiente';
  return (
    <div className="v-slide">
      <SlideHead
        num={6}
        kicker="Entrevista a docente"
        title="Validación académica de la propuesta"
        right={pending ? <span className="v-tag pending" style={{ height: 36 }}>Entrevista pendiente</span> : <span className="v-tag done">Realizada</span>}
      />
      <div className="v-body" style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: 24 }}>
        <div className="v-col" style={{ gap: 16 }}>
          <div className="v-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 12 }}>
            {I.photo ? (
              <img src={I.photo} alt={`Fotografía institucional de ${I.name}`} style={{ width: 200, height: 200, borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              <div style={{ width: 200, height: 200, borderRadius: '50%', border: '2px dashed var(--pending)', display: 'grid', placeItems: 'center', color: 'var(--pending)', fontSize: 16, padding: 20 }}>
                [Fotografía institucional]
              </div>
            )}
            <div style={{ fontSize: 26, fontWeight: 750 }}>
              <Field value={I.name} />
            </div>
            <div className="v-small">
              <Field value={I.role} />
            </div>
            <div className="v-tiny">
              <Field value={I.date} />
            </div>
          </div>
          <div className="v-panel flat" style={{ padding: '16px 20px' }}>
            <div className="v-panel-title">La observación…</div>
            <div className="v-row" style={{ gap: 8 }}>
              {(['valida', 'complementa', 'cuestiona'] as const).map((v) => (
                <span key={v} className={`v-tag ${I.verdict === v ? 'now' : 'off'}`}>
                  {v}
                </span>
              ))}
            </div>
            <div className="v-tiny" style={{ marginTop: 8 }}>
              Se marcará al registrar la entrevista.
            </div>
          </div>
        </div>

        <div className="v-col" style={{ gap: 18 }}>
          <div className="v-panel" style={{ borderLeft: '6px solid var(--cyan)' }}>
            <div className="v-panel-title">Extracto de la entrevista</div>
            <div style={{ fontSize: 28, fontStyle: 'italic', lineHeight: 1.35 }}>
              {isPending(I.quote) ? <Field value={I.quote} /> : <>“{I.quote}”</>}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 40px 1fr 40px 1fr', alignItems: 'stretch' }}>
            {[
              ['Observación del académico', I.observation],
              ['Implicación para el proyecto', I.implication],
              ['Ajuste propuesto', I.adjustment],
            ].map(([t, v], i) => (
              <div key={t} style={{ display: 'contents' }}>
                {i > 0 && <div style={{ display: 'grid', placeItems: 'center', fontSize: 30, color: 'var(--cyan)' }}>→</div>}
                <div className="v-panel flat" style={{ padding: '16px 18px' }}>
                  <div className="v-panel-title" style={{ fontSize: 13 }}>
                    {t}
                  </div>
                  <div style={{ fontSize: 19 }}>
                    <Field value={v} />
                  </div>
                </div>
              </div>
            ))}
          </div>
          {pending && (
            <div className="v-panel flat" style={{ borderStyle: 'dashed', padding: '16px 22px' }}>
              <div className="v-panel-title">Guion preparado (preguntas, no respuestas)</div>
              <ol style={{ margin: 0, paddingLeft: 26, fontSize: 18, lineHeight: 1.45, color: 'var(--text-2)' }}>
                {I.questions.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
