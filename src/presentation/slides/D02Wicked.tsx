import { useState } from 'react';
import { WICKED_POINTS, WICKED_QUESTION, WICKED_TRAITS } from '../content';
import { PX } from '../explain';
import { Cite } from '../components/deck';
import { Explain, Screen } from '../components/screen';
import { ProblemIcon } from '../components/Thumbs';

const ICONS = [
  { k: 'heart' as const, t: 'Corazón' },
  { k: 'valve' as const, t: 'Prótesis valvular' },
  { k: 'waves' as const, t: 'Señales' },
  { k: 'rehab' as const, t: 'Rehabilitación' },
];
const FLOW = ['Problema clínico', 'Necesidad de información', 'Propuesta tecnológica'];

export function D02Wicked() {
  const [traits, setTraits] = useState(false);
  return (
    <Screen
      num={2}
      kicker="Wicked problem"
      title="Un problema complejo"
      actions={
        <>
          <Explain label="¿Qué significa?" content={PX.wicked} />
          <button className={`v-btn sm${traits ? ' primary' : ''}`} onClick={() => setTraits((v) => !v)} aria-expanded={traits}>
            ¿Por qué es un wicked problem?
          </button>
        </>
      }
    >
      <div className="v-col" style={{ gap: 22, height: '100%' }}>
        <div className="v-question">
          <div className="v-question-mark">?</div>
          <p style={{ fontSize: 29 }}>{WICKED_QUESTION}</p>
        </div>
        <div className="v-grid" style={{ gridTemplateColumns: '1fr 560px', gap: 26, flex: 1, minHeight: 0 }}>
          <div className="v-col" style={{ gap: 18 }}>
            <div className="v-icons-row">
              {ICONS.map((i) => (
                <figure key={i.k}>
                  <div>
                    <ProblemIcon kind={i.k} size={96} />
                  </div>
                  <figcaption>{i.t}</figcaption>
                </figure>
              ))}
            </div>
            <div className="v-flow3">
              {FLOW.map((f, i) => (
                <div key={f} className="v-flow3-step" style={{ animationDelay: `${0.25 + i * 0.35}s` }}>
                  <span>{i + 1}</span>
                  {f}
                </div>
              ))}
            </div>
          </div>
          {traits ? (
            <div className="v-panel v-traits" key="traits">
              <div className="v-panel-title">
                Rasgos de un «wicked problem» <Cite ids={['rittel1973']} />
              </div>
              {WICKED_TRAITS.map((t) => (
                <div key={t.t} className="v-trait">
                  <b>{t.t}</b>
                  <span>{t.d}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="v-points" key="points">
              {WICKED_POINTS.map((p, i) => (
                <div key={p.t} className="v-point" style={{ animationDelay: `${i * 0.12}s` }}>
                  <b>
                    {p.t} <Cite ids={p.refs} />
                  </b>
                  <span>{p.d}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Screen>
  );
}
