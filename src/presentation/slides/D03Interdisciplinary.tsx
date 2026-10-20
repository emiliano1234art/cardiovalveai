import { useState } from 'react';
import { BIOMED, JOINT, KINE, META, TOOLKIT_FINDINGS } from '../content';
import { PX } from '../explain';
import { Field } from '../components/deck';
import { Explain, Screen } from '../components/screen';

// geometría fija del diagrama (el escenario mide siempre 1600 × 900)
const W = 1472;
const H = 470;
const COL = 330;
const MID_L = 470;
const MID_R = W - MID_L;
const chipY = (i: number) => 36 + 30 + i * 82;
const jointY = (i: number) => 22 + 44 + i * 108;

const curve = (x1: number, y1: number, x2: number, y2: number) => {
  const mx = (x1 + x2) / 2;
  return `M${x1} ${y1}C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`;
};

export function D03Interdisciplinary() {
  const [sel, setSel] = useState(0);
  const j = JOINT[sel];
  return (
    <Screen
      num={3}
      kicker="Integración interdisciplinaria"
      title="Dos carreras, un mismo proyecto"
      actions={<Explain label="¿Qué significa?" content={PX.interdisc} />}
    >
      <div className="v-col" style={{ gap: 16, height: '100%' }}>
        <div className="v-disc-heads" style={{ width: W }}>
          <div className="bio">{META.careers[0]}</div>
          <div className="joint">Aporte conjunto · toca uno</div>
          <div className="kine">{META.careers[1]}</div>
        </div>
        <div className="v-disc" style={{ width: W, height: H }}>
          <svg className="v-disc-lines" width={W} height={H} aria-hidden>
            {JOINT.map((jj, ji) => (
              <g key={jj.t} className={ji === sel ? 'on' : ''}>
                {jj.bio.map((b) => {
                  const i = BIOMED.findIndex((x) => x.id === b);
                  return <path key={b} d={curve(COL, chipY(i), MID_L, jointY(ji))} />;
                })}
                {jj.kine.map((k) => {
                  const i = KINE.findIndex((x) => x.id === k);
                  return <path key={k} d={curve(MID_R, jointY(ji), W - COL, chipY(i))} />;
                })}
              </g>
            ))}
          </svg>
          {BIOMED.map((b, i) => (
            <div key={b.id} className={`v-disc-chip bio${j.bio.includes(b.id) ? ' on' : ''}`} style={{ left: 0, top: chipY(i) - 30, width: COL }}>
              {b.t}
            </div>
          ))}
          {KINE.map((k, i) => (
            <div key={k.id} className={`v-disc-chip kine${j.kine.includes(k.id) ? ' on' : ''}`} style={{ left: W - COL, top: chipY(i) - 30, width: COL }}>
              {k.t}
            </div>
          ))}
          {JOINT.map((jj, i) => (
            <button
              key={jj.t}
              className={`v-disc-joint${i === sel ? ' on' : ''}`}
              style={{ left: MID_L, top: jointY(i) - 44, width: MID_R - MID_L }}
              onClick={() => setSel(i)}
              aria-pressed={i === sel}
            >
              <span>{i + 1}</span>
              {jj.t}
            </button>
          ))}
        </div>
        <div className="v-disc-detail" key={sel}>
          <b>{j.t}:</b> {j.d}
        </div>
        <div className="v-tiny" style={{ fontSize: 14 }}>
          Toolkit (Encargo 1): <Field value={TOOLKIT_FINDINGS[0]} />
        </div>
      </div>
    </Screen>
  );
}
