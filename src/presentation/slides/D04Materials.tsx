import { useState } from 'react';
import { MATERIALS } from '../content';
import { PX } from '../explain';
import { Explain, Screen } from '../components/screen';
import { MaterialThumb } from '../components/Thumbs';

const QA: { k: 'what' | 'why' | 'where' | 'how'; q: string }[] = [
  { k: 'what', q: '¿Qué es?' },
  { k: 'why', q: '¿Para qué sirve?' },
  { k: 'where', q: '¿Dónde se ubica?' },
  { k: 'how', q: '¿Cómo participa?' },
];

export function D04Materials() {
  const [sel, setSel] = useState(0);
  const m = MATERIALS[sel];
  return (
    <Screen
      num={4}
      kicker="Materiales"
      title="¿Con qué lo construimos?"
      states={['proposed']}
      actions={<Explain label="¿Cómo funciona?" content={PX.materials} />}
    >
      <div className="v-grid" style={{ gridTemplateColumns: '1fr 450px', gap: 24, height: '100%' }}>
        <div className="v-mat-grid" role="listbox" aria-label="Materiales">
          {MATERIALS.map((x, i) => (
            <button
              key={x.id}
              role="option"
              aria-selected={i === sel}
              className={`v-mat-card${i === sel ? ' on' : ''}`}
              onClick={() => setSel(i)}
              style={{ animationDelay: `${i * 0.05}s` }}
            >
              <MaterialThumb id={x.id} size={172} />
              <b>{x.name}</b>
            </button>
          ))}
        </div>
        <div className="v-panel v-mat-detail" key={m.id}>
          <div className="v-mat-detail-head">
            <MaterialThumb id={m.id} size={130} />
            <h3>{m.name}</h3>
          </div>
          {QA.map((q) => (
            <div key={q.k} className="v-mat-qa">
              <span>{q.q}</span>
              <p>{m[q.k]}</p>
            </div>
          ))}
        </div>
      </div>
    </Screen>
  );
}
