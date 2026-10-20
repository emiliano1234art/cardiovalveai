import { useEffect, useMemo, useState } from 'react';
import { EXPLAIN } from '../../content/explanations';
import { VERDICT } from '../../lib/verdict';
import { useDeck } from '../components/deck';
import { Explain, Screen } from '../components/screen';
import { StaticSignals } from '../components/StaticSignals';
import { assess } from '../sim/analysis';
import { sim, useSim } from '../sim/store';

const NODES = [
  { id: 'sensors', label: 'Sensores', icon: '◉' },
  { id: 'signals', label: 'Señales', icon: '∿' },
  { id: 'analysis', label: 'Análisis', icon: '∑' },
  { id: 'compare', label: 'Comparación', icon: '⇄' },
  { id: 'result', label: 'Resultado', icon: '✓' },
] as const;
type NodeId = (typeof NODES)[number]['id'];

const SCENARIOS = [
  { id: 'n', label: 'Normal', p: { condition: 'normal' as const, bpm: 72 } },
  { id: 'r', label: 'Una valva restringida', p: { condition: 'restricted' as const, bpm: 72 } },
  { id: 'a', label: 'Apertura asimétrica', p: { condition: 'asymmetric' as const, bpm: 72 } },
  { id: 'e', label: 'Ejercicio · 110 lpm', p: { condition: 'normal' as const, bpm: 110 } },
];

const f1 = (v: number, d = 0) => v.toFixed(d).replace('.', ',');

export function S07AI() {
  const { print } = useDeck();
  const { params } = useSim();
  const a = useMemo(() => assess(params), [params]);
  const [node, setNode] = useState<NodeId>('compare');
  const [auto, setAuto] = useState(!print);
  const V = VERDICT[a.verdict];

  useEffect(() => {
    if (!auto) return;
    const id = setInterval(() => setNode((n) => NODES[(NODES.findIndex((x) => x.id === n) + 1) % NODES.length].id), 2600);
    return () => clearInterval(id);
  }, [auto]);

  const pick = (id: NodeId) => {
    setAuto(false);
    setNode(id);
  };
  const scenario = SCENARIOS.find((s) => s.p.condition === params.condition && s.p.bpm === params.bpm)?.id;

  return (
    <Screen
      num={7}
      kicker="Inteligencia artificial experimental"
      title="¿Qué hace nuestra inteligencia artificial?"
      lead="Compara cada ciclo con una línea basal experimental y señala cambios. No diagnostica enfermedades."
      states={['implemented', 'synthetic']}
      actions={<Explain label="¿Cambio mecánico o enfermedad?" content={EXPLAIN.p_ai_diag} />}
    >
      <div className="v-col" style={{ gap: 18, height: '100%' }}>
        <div className="v-flow" role="tablist" aria-label="Etapas del análisis">
          {NODES.map((n, i) => (
            <div key={n.id} className="v-flow-step">
              <button role="tab" aria-selected={node === n.id} className={`v-flow-node${node === n.id ? ' on' : ''}`} onClick={() => pick(n.id)}>
                <span className="i">{n.icon}</span>
                {n.label}
              </button>
              {i < NODES.length - 1 && (
                <svg width={64} height={20} viewBox="0 0 64 20" aria-hidden>
                  <path d="M2 10h52" stroke="var(--cyan)" strokeWidth={3} strokeDasharray="7 6" className="v-anim-optional" style={{ animation: 'v-flow 1s linear infinite' }} />
                  <path d="M48 3l10 7-10 7" fill="none" stroke="var(--cyan)" strokeWidth={3} strokeLinecap="round" />
                </svg>
              )}
            </div>
          ))}
        </div>

        <div className="v-grid" style={{ gridTemplateColumns: '1fr 400px', gap: 20, flex: 1, minHeight: 0 }}>
          <div className="v-panel v-flow-detail" key={node}>
            {node === 'sensors' && (
              <div className="v-col" style={{ gap: 14 }}>
                <h3>Dos sensores, un mismo ciclo</h3>
                <div className="v-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="v-mini-card">
                    <b style={{ color: 'var(--sig-vib)' }}>Piezoeléctrico</b>
                    <span>Siente la vibración del anillo.</span>
                  </div>
                  <div className="v-mini-card">
                    <b style={{ color: 'var(--sig-snd)' }}>Micrófono MEMS</b>
                    <span>Escucha los clics de apertura y cierre.</span>
                  </div>
                </div>
                <span className="v-tiny">El ECG marca cuándo empieza cada ciclo.</span>
              </div>
            )}
            {node === 'signals' && (
              <div>
                <h3>Un latido de vibración y sonido</h3>
                <StaticSignals params={params} width={980} height={300} lanes={['vib', 'snd']} />
              </div>
            )}
            {node === 'analysis' && (
              <div>
                <h3>Medimos cada evento</h3>
                <div className="v-metrics">
                  <div>
                    <span>Energía del cierre</span>
                    <b>{f1(a.cur.eClose * 1000, 2)}</b>
                    <i>×10⁻³ V²·s</i>
                  </div>
                  <div>
                    <span>RMS del cierre</span>
                    <b>{f1(a.cur.rmsClose, 3)}</b>
                    <i>V</i>
                  </div>
                  <div>
                    <span>Tono principal (FFT)</span>
                    <b>{f1(a.cur.fDom)}</b>
                    <i>Hz</i>
                  </div>
                  <div>
                    <span>Apertura media</span>
                    <b>{f1(a.cur.angle)}</b>
                    <i>°</i>
                  </div>
                  <div>
                    <span>Desfase entre valvas</span>
                    <b>{f1(a.cur.spreadMs)}</b>
                    <i>ms</i>
                  </div>
                  <div>
                    <span>Ciclo vs latido (RR)</span>
                    <b>{f1(a.cur.syncErrMs)}</b>
                    <i>ms</i>
                  </div>
                </div>
              </div>
            )}
            {node === 'compare' && (
              <div>
                <h3>¿Cuánto se aleja de la línea basal?</h3>
                {a.devs.map((d) => (
                  <div key={d.key} className="v-dev-row">
                    <span>{d.label}</span>
                    <div className="track">
                      <div style={{ width: `${Math.min(100, (d.z / 5) * 100)}%`, background: d.z >= 2.2 ? 'var(--coral)' : d.z >= 1 ? '#f59e0b' : '#7dd3fc' }} />
                    </div>
                    <b className="v-num">{d.value}</b>
                  </div>
                ))}
              </div>
            )}
            {node === 'result' && (
              <div className="v-col" style={{ gap: 14 }}>
                <h3>Resultado del análisis</h3>
                <div className="v-verdict" style={{ borderColor: V.color, background: V.bg }}>
                  <span style={{ color: V.color }}>
                    {V.icon} {V.label}
                  </span>
                  <p>{V.text}</p>
                </div>
              </div>
            )}
          </div>

          <div className="v-col" style={{ gap: 14 }}>
            <div className="v-panel" style={{ padding: '16px 18px', textAlign: 'center' }}>
              <div className="v-panel-title" style={{ fontSize: 13 }}>
                Similitud con la línea basal
              </div>
              <svg width={200} height={200} viewBox="0 0 200 200" role="img" aria-label={`Similitud ${a.similarity.toFixed(0)} %`}>
                <circle cx={100} cy={100} r={80} fill="none" stroke="var(--bg-2)" strokeWidth={16} />
                <circle
                  cx={100}
                  cy={100}
                  r={80}
                  fill="none"
                  stroke={V.color}
                  strokeWidth={16}
                  strokeLinecap="round"
                  strokeDasharray={`${(a.similarity / 100) * 502.6} 502.6`}
                  transform="rotate(-90 100 100)"
                  style={{ transition: 'stroke-dasharray .6s' }}
                />
                <text x={100} y={108} textAnchor="middle" fontSize={40} fontWeight={800} fill="#0b1f33">
                  {a.similarity.toFixed(0)} %
                </text>
              </svg>
              <div style={{ fontSize: 20, fontWeight: 800, color: V.color }}>{V.label}</div>
              <div className="v-tiny" style={{ marginTop: 4 }}>
                Simulación: no son resultados experimentales
              </div>
            </div>
            <div className="v-col" style={{ gap: 8 }}>
              <span className="v-tiny">Prueba un escenario</span>
              {SCENARIOS.map((s) => (
                <button key={s.id} className={`v-chip${scenario === s.id ? ' active' : ''}${s.id !== 'n' ? ' alt' : ''}`} style={{ height: 40, fontSize: 15.5, textAlign: 'left' }} onClick={() => sim.setParams(s.p)}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Screen>
  );
}
