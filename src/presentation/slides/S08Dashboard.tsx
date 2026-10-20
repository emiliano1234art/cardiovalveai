import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { PatientSimulator } from '../../simulation/PatientSimulator';
import type { PatientSnapshot } from '../../types/valvesense';
import { GraphExplanation } from '../../components/explain/GraphExplanation';
import { EXPLAIN } from '../../content/explanations';
import { VERDICT } from '../../lib/verdict';
import { useDeck } from '../components/deck';
import { Explain, Screen } from '../components/screen';
import { LiveSignals } from '../components/LiveSignals';
import { ConditionChips } from '../components/SimControls';
import { StaticSignals } from '../components/StaticSignals';
import { ValveSVG } from '../components/ValveSVG';
import { assess, summarize } from '../sim/analysis';
import { bpmFromPeaks, CONDITIONS, detectR, effectiveOpen, isOpen, sampleEcg } from '../sim/model';
import { sim, useSim } from '../sim/store';
import { Spectrogram } from '../components/SoundMap';

type Kind = 'sint' | 'exp' | 'clin';
const BADGE: Record<Kind, { cls: string; label: string }> = {
  sint: { cls: 'sim', label: 'Simulado' },
  exp: { cls: 'exp', label: 'Experimento · pendiente' },
  clin: { cls: 'clin', label: 'Visión futura' },
};

function Card({ title, kinds, children, style, info }: { title: string; kinds: Kind[]; children: ReactNode; style?: CSSProperties; info?: 'vibration' | 'sound' | 'spectrogram' | 'ecg' | 'ai' | 'patient' }) {
  return (
    <div className="v-panel" style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 4, minHeight: 0, ...style }}>
      <div className="v-row" style={{ justifyContent: 'space-between', gap: 6, flexWrap: 'nowrap' }}>
        <b style={{ fontSize: 14.5, whiteSpace: 'nowrap' }}>{title}</b>
        <span className="v-row" style={{ gap: 4, flexWrap: 'nowrap' }}>
          {info && <GraphExplanation id={info} compact />}
          {kinds.map((k) => (
            <span key={k} className={`v-tag ${BADGE[k].cls}`} style={{ height: 20, fontSize: 9.5, padding: '0 7px', letterSpacing: '.06em' }}>
              {BADGE[k].label}
            </span>
          ))}
        </span>
      </div>
      {children}
    </div>
  );
}

function usePatient(run: boolean) {
  const ps = useRef<PatientSimulator | null>(null);
  if (!ps.current) ps.current = new PatientSimulator();
  const [hist, setHist] = useState<PatientSnapshot[]>(() => Array.from({ length: 120 }, () => ps.current!.step(1)));
  useEffect(() => {
    if (!run) return;
    const id = setInterval(() => setHist((h) => [...h.slice(-119), ps.current!.step(1)]), 1000);
    return () => clearInterval(id);
  }, [run]);
  return hist;
}

function useValveStatus() {
  const ref = useRef<HTMLSpanElement>(null);
  const bpmRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let last = -1;
    return sim.onFrame((t) => {
      const p = sim.state.params;
      const o = isOpen(t, p);
      if (ref.current) {
        ref.current.textContent = o ? 'ABIERTA' : 'CERRADA';
        ref.current.className = `v-tag ${o ? 'now' : 'off'}`;
      }
      if (Math.abs(t - last) > 0.3 && bpmRef.current) {
        last = t;
        const e = sampleEcg(t - 6, t, p, 250);
        const b = bpmFromPeaks(detectR(e.v, e.fs), e.fs);
        bpmRef.current.textContent = b ? b.toFixed(0) : '—';
      }
    });
  }, []);
  return { ref, bpmRef };
}

export function S08Dashboard() {
  const { print, active } = useDeck();
  const { params, motion } = useSim();
  const a = useMemo(() => assess(params), [params]);
  const eff = effectiveOpen(params);
  const hist = usePatient(active && !print && motion !== 'paused');
  const pt = hist[hist.length - 1];
  const { ref, bpmRef } = useValveStatus();
  const bars = useMemo(() => CONDITIONS.map((c) => ({ c, e: summarize({ ...params, condition: c.id }).eClose })), [params]);
  const eMax = Math.max(...bars.map((b) => b.e));
  const V = VERDICT[a.verdict];
  const W = 300;
  const hr = hist.map((x) => x.heart_rate);
  const path = hr.map((v, i) => `${i ? 'L' : 'M'}${((i / (hr.length - 1)) * W).toFixed(1)} ${(46 - ((v - 60) / 60) * 46).toFixed(1)}`).join('');

  return (
    <Screen
      num={8}
      kicker="Dashboard · Kinesiología"
      title="Dashboard y aplicaciones en Kinesiología"
      lead="Señales, ECG, IA y respuesta al ejercicio en una sola vista. Los datos del paciente son sintéticos."
      states={['implemented', 'synthetic', 'future']}
      actions={
        <>
          <Explain label="¿Y Kinesiología?" content={EXPLAIN.p_kine} />
          <a className="v-btn sm" href="#/dashboard" style={{ textDecoration: 'none' }}>
            Abrir laboratorio interactivo ↗
          </a>
        </>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: '560px 470px 1fr', gridTemplateRows: '1fr 1fr 1fr', gap: 10, height: '100%', minHeight: 0 }}>
        <Card title="Latidos del corazón (ECG)" kinds={['sint']} info="ecg">
          <div className="v-row" style={{ gap: 12, flexWrap: 'nowrap', alignItems: 'center' }}>
            <div style={{ minWidth: 92 }}>
              <div className="v-tiny">FC (RR)</div>
              <div className="v-num" style={{ fontSize: 34, fontWeight: 800, color: 'var(--sig-ecg)', lineHeight: 1 }}>
                <span ref={bpmRef}>{print ? params.bpm : '—'}</span>
              </div>
              <div className="v-tiny">lpm</div>
            </div>
            {print ? <StaticSignals params={params} width={430} height={140} lanes={['ecg']} /> : <LiveSignals width={430} height={140} windowS={3} lanes={['ecg']} />}
          </div>
        </Card>
        <Card title="Movimiento de las tres valvas" kinds={['sint']}>
          <div className="v-row" style={{ gap: 10, flexWrap: 'nowrap' }}>
            <ValveSVG view="top" size={150} numbers angles={print ? [80, 80, 80] : undefined} />
            <div className="v-col" style={{ gap: 4, fontSize: 14 }}>
              <span ref={ref} className="v-tag off">
                CERRADA
              </span>
              <span className="v-num">τ = {params.delayMs} ms</span>
              <span className="v-num">D = {Math.round(eff.dOpen * 1000)} ms</span>
              <span className="v-num">θ máx = {params.thetaMax}°</span>
            </div>
          </div>
        </Card>
        <Card title="Análisis inteligente" kinds={['sint']} info="ai" style={{ background: V.bg, borderColor: V.color }}>
          <div style={{ fontSize: 19, fontWeight: 800, color: V.color }}>
            {V.icon} {V.label}
          </div>
          <div className="v-row v-num" style={{ gap: 18, fontSize: 15 }}>
            <span>
              Similitud <b style={{ fontSize: 22 }}>{a.similarity.toFixed(0)} %</b>
            </span>
            <span>
              Cambios <b style={{ fontSize: 22 }}>{a.score.toFixed(2).replace('.', ',')}</b>
            </span>
          </div>
          <ConditionChips compact only={['normal', 'restricted', 'asymmetric']} />
        </Card>

        <Card title="Vibración de la válvula" kinds={['sint']} info="vibration">
          {print ? <StaticSignals params={params} width={530} height={150} lanes={['vib']} /> : <LiveSignals width={530} height={150} windowS={3} lanes={['vib']} />}
        </Card>
        <Card title="Sonido de la válvula" kinds={['sint']} info="sound">
          {print ? <StaticSignals params={params} width={440} height={150} lanes={['snd']} /> : <LiveSignals width={440} height={150} windowS={3} lanes={['snd']} />}
        </Card>
        <Card title="Mapa de sonidos" kinds={['sint']} info="spectrogram">
          <Spectrogram p={params} w={380} h={128} />
        </Card>

        <Card title="Normal vs. alterado · energía del cierre" kinds={['sint']}>
          {bars.map((b) => (
            <div key={b.c.id} style={{ display: 'grid', gridTemplateColumns: '170px 1fr 54px', alignItems: 'center', gap: 8, fontSize: 13.5 }}>
              <span style={{ fontWeight: b.c.id === params.condition ? 750 : 500, color: b.c.id === params.condition ? 'var(--text)' : 'var(--muted)' }}>{b.c.label}</span>
              <div style={{ height: 11, background: 'var(--bg-2)', borderRadius: 4 }}>
                <div style={{ width: `${(b.e / eMax) * 100}%`, height: '100%', borderRadius: 4, background: b.c.id === 'normal' ? 'var(--cyan)' : 'var(--coral)', opacity: b.c.id === params.condition ? 1 : 0.45 }} />
              </div>
              <span className="v-num" style={{ textAlign: 'right' }}>
                {(b.e * 1000).toFixed(1).replace('.', ',')}
              </span>
            </div>
          ))}
          <div className="v-tiny" style={{ fontSize: 12 }}>
            Eₓ del cierre (×10⁻³ V²·s), misma posición de sensores
          </div>
        </Card>
        <Card title="Paciente simulado · ejercicio" kinds={['sint', 'clin']} info="patient">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
            {[
              ['FC', `${pt.heart_rate}`, 'lpm'],
              ['SpO₂', pt.spo2.toFixed(1).replace('.', ','), '%'],
              ['Borg', `${pt.borg}`, '/20'],
              ['Recup.', pt.hr_recovery_1min !== null ? `${pt.hr_recovery_1min}` : '—', pt.hr_recovery_1min !== null ? 'lpm' : ''],
            ].map(([k, v, u]) => (
              <div key={k}>
                <div className="v-tiny" style={{ fontSize: 12 }}>
                  {k}
                </div>
                <div className="v-num" style={{ fontSize: 22, fontWeight: 800 }}>
                  {v}
                  <span className="v-tiny" style={{ fontSize: 11 }}>
                    {' '}
                    {u}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <svg width="100%" height={46} viewBox={`0 0 ${W} 46`} preserveAspectRatio="none" aria-label="FC sintética">
            <path d={path} fill="none" stroke="var(--violet)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
          </svg>
          <div className="v-tiny" style={{ fontSize: 12 }}>
            Etapa: {pt.session_stage} · paciente ficticio, no son mediciones del prototipo.
          </div>
        </Card>
        <Card title="Dashboard completo" kinds={['sint']}>
          <div style={{ fontSize: 14.5, color: 'var(--text-2)', lineHeight: 1.35 }}>
            Válvula 3D trivalva, ECG, vibración, sonido, mapa de sonidos, IA y paciente simulado, con explicaciones ⓘ en cada gráfico.
          </div>
          <a className="v-btn sm v-no-print" href="#/dashboard" style={{ textDecoration: 'none', alignSelf: 'flex-start', marginTop: 4 }}>
            Abrir laboratorio ↗
          </a>
          <div className="v-tiny v-mono" style={{ fontSize: 12 }}>
            #/dashboard
          </div>
        </Card>
      </div>
    </Screen>
  );
}
