import { useMemo, useState } from 'react';
import { EXPLAIN } from '../../content/explanations';
import { useDeck } from '../components/deck';
import { Explain, Screen } from '../components/screen';
import { StaticSignals } from '../components/StaticSignals';
import { ValveSVG } from '../components/ValveSVG';
import { summarize } from '../sim/analysis';
import { CONDITIONS, DEFAULT_PARAMS, type Condition, type SimParams } from '../sim/model';
import { useSim } from '../sim/store';

const ALTERED: Condition[] = ['restricted', 'incomplete', 'irregular', 'asymmetric'];

const pct = (a: number, b: number) => (b ? ((a - b) / Math.abs(b)) * 100 : 0);

function Side({ title, ok, p, compare, hl }: { title: string; ok: boolean; p: SimParams; compare?: SimParams; hl: number | null }) {
  const { print } = useDeck();
  const still = print ? [80, 80, 80] : undefined;
  return (
    <div className={`v-panel v-cmp ${ok ? 'ok' : 'alt'}`}>
      <div className="v-cmp-head">
        <span className="v-cmp-icon">{ok ? '✓' : '!'}</span>
        <b>{title}</b>
      </div>
      <div className="v-row" style={{ gap: 6, justifyContent: 'center', flexWrap: 'nowrap' }}>
        <ValveSVG view="top" size={200} params={p} highlight={hl} angles={still} numbers />
        <ValveSVG view="side" size={210} params={p} highlight={hl} angles={still} />
      </div>
      <StaticSignals params={p} compareTo={compare} width={660} height={230} lanes={['vib', 'snd']} />
    </div>
  );
}

export function S06Changes() {
  const { params } = useSim();
  const [cond, setCond] = useState<Condition>('restricted');
  const [target, setTarget] = useState<0 | 1 | 2>(0);
  const base: SimParams = { ...DEFAULT_PARAMS, bpm: params.bpm, delayMs: params.delayMs, openMs: params.openMs, thetaMax: params.thetaMax, condition: 'normal' };
  const alt: SimParams = { ...base, condition: cond, target };
  const diff = useMemo(() => {
    const a = summarize(alt);
    const b = summarize(base);
    return [
      { k: 'Energía de vibración', v: pct(a.eClose + a.eOpen, b.eClose + b.eOpen) },
      { k: 'Tono principal del sonido', v: pct(a.fDom, b.fDom) },
      { k: 'Apertura media', v: pct(a.angle, b.angle) },
      { k: 'Desfase entre valvas', v: a.spreadMs - b.spreadMs, ms: true },
    ];
  }, [cond, target, params.bpm, params.delayMs, params.openMs, params.thetaMax]); // eslint-disable-line react-hooks/exhaustive-deps
  const label = CONDITIONS.find((c) => c.id === cond)!;
  const hl = cond === 'asymmetric' ? null : target;

  return (
    <Screen
      num={6}
      kicker="Comparación"
      title="¿Cómo reconocemos cambios?"
      lead="Cuando cambia el movimiento de una valva, cambian sus vibraciones y sonidos."
      states={['synthetic']}
      actions={<Explain label="¿Qué estamos observando?" content={EXPLAIN.p_changes_obs} />}
    >
      <div className="v-col" style={{ gap: 12, height: '100%' }}>
        <div className="v-row" style={{ gap: 8 }}>
          {ALTERED.map((c) => (
            <button key={c} className={`v-chip alt${cond === c ? ' active' : ''}`} style={{ height: 40, fontSize: 15.5 }} onClick={() => setCond(c)}>
              {CONDITIONS.find((x) => x.id === c)!.short}
            </button>
          ))}
          <span style={{ flex: 1 }} />
          <span className="v-tiny">Valva afectada</span>
          <div className="v-seg">
            {([0, 1, 2] as const).map((i) => (
              <button key={i} className={target === i ? 'active' : ''} onClick={() => setTarget(i)}>
                {i + 1}
              </button>
            ))}
          </div>
        </div>
        <div className="v-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          <Side title="Funcionamiento de referencia" ok p={base} hl={null} />
          <Side title={label.label} ok={false} p={alt} compare={base} hl={hl} />
        </div>
        <div className="v-diffs">
          {diff.map((d) => (
            <div key={d.k} className="v-diff">
              <span>{d.k}</span>
              <b className={Math.abs(d.v) > (d.ms ? 8 : 10) ? 'big' : ''}>
                {d.v > 0 ? '+' : d.v < 0 ? '−' : '±'}
                {Math.abs(d.v).toFixed(0)}
                {d.ms ? ' ms' : ' %'}
              </b>
            </div>
          ))}
          <span className="v-tiny" style={{ alignSelf: 'center' }}>
            vs. referencia · gris = referencia
          </span>
        </div>
      </div>
    </Screen>
  );
}
