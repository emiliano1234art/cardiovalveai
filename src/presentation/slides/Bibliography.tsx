import { REFERENCES, type Reference } from '../content';
import { SlideHead, useDeck } from '../components/deck';

const TOPICS: Reference['topic'][] = ['Prótesis valvulares', 'Rehabilitación y respuesta funcional', 'Análisis acústico y vibracional', 'Componentes electrónicos'];

export function Bibliography() {
  const { print } = useDeck();
  return (
    <div className="v-slide" style={{ paddingTop: 44 }}>
      <SlideHead kicker="Bibliografía" title="Referencias" right={<span className="v-tiny">Estilo Vancouver · numeración según aparición en la lista</span>} />
      <div className="v-body" style={{ columnCount: 2, columnGap: 36, fontSize: print ? 14.5 : 15.5, lineHeight: 1.38 }}>
        {TOPICS.map((t) => (
          <div key={t} style={{ breakInside: 'avoid', marginBottom: 12 }}>
            <div className="v-panel-title" style={{ color: 'var(--cyan)', marginBottom: 6, fontSize: 13 }}>
              {t}
            </div>
            {REFERENCES.filter((r) => r.topic === t).map((r) => {
              const n = REFERENCES.indexOf(r) + 1;
              return (
                <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '34px 1fr', gap: 4, marginBottom: 8, breakInside: 'avoid' }}>
                  <span className="v-num v-cyan" style={{ fontWeight: 700 }}>
                    [{n}]
                  </span>
                  <span>
                    {r.text}{' '}
                    {r.url && (
                      <a href={r.url} target="_blank" rel="noreferrer" style={{ color: 'var(--cyan)', wordBreak: 'break-all' }}>
                        {r.url.replace('https://', '')}
                      </a>
                    )}{' '}
                    {r.status === 'pendiente de verificación' && (
                      <span className="v-tag pending" style={{ height: 22, fontSize: 11, padding: '0 8px', verticalAlign: 'middle' }}>
                        pendiente de verificación
                      </span>
                    )}
                    {r.note && <span className="v-tiny"> — {r.note}</span>}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
