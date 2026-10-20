import { useEffect, useRef, useState } from 'react';
import { EXPLAIN } from '../../content/explanations';
import { useDeck } from '../components/deck';
import { LiveSignals } from '../components/LiveSignals';
import { Explain, Screen } from '../components/screen';
import { ParamSliders } from '../components/SimControls';
import { StaticSignals } from '../components/StaticSignals';
import { ValveSVG } from '../components/ValveSVG';
import { bpmFromPeaks, detectR, effectiveOpen, isOpen, phaseName, RAMP_CLOSE, RAMP_OPEN, rPeak, rrOf, sampleEcg, type SimParams } from '../sim/model';
import { sim, useSim } from '../sim/store';

/** FC detectada (desde los picos R del ECG) + indicador de latido + estado de la válvula. */
function BeatMonitor() {
  const [bpm, setBpm] = useState<number | null>(null);
  const heart = useRef<HTMLDivElement>(null);
  const state = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let last = 0;
    return sim.onFrame((t) => {
      const p = sim.state.params;
      if (Math.abs(t - last) > 0.25) {
        last = t;
        const e = sampleEcg(t - 6, t, p, 250);
        setBpm(bpmFromPeaks(detectR(e.v, e.fs), e.fs));
      }
      // latido detectado: el detector confirma el R ~40 ms después del pico
      const RR = rrOf(p);
      let b = Math.floor(t / RR) + 1;
      while (rPeak(b, p) > t) b--;
      const dt = t - rPeak(b, p);
      const on = dt > 0.04 && dt < 0.22;
      if (heart.current) heart.current.style.transform = on ? 'scale(1.18)' : 'scale(1)';
      if (heart.current) heart.current.style.opacity = on ? '1' : '.45';
      const open = isOpen(t, p);
      if (state.current) {
        state.current.textContent = open ? 'ABIERTA' : 'CERRADA';
        state.current.className = `v-tag ${open ? 'now' : 'off'}`;
      }
    });
  }, []);
  return (
    <div className="v-row" style={{ gap: 16, alignItems: 'center' }}>
      <div ref={heart} style={{ transition: 'transform .08s, opacity .08s', color: 'var(--sig-ecg)', fontSize: 40, lineHeight: 1 }} aria-hidden>
        ♥
      </div>
      <div>
        <div className="v-tiny">FC detectada (RR)</div>
        <div className="v-num" style={{ fontSize: 40, fontWeight: 800, lineHeight: 1 }}>
          {bpm ? bpm.toFixed(0) : '—'} <span style={{ fontSize: 18, color: 'var(--muted)', fontWeight: 600 }}>lpm</span>
        </div>
      </div>
      <div className="v-col" style={{ gap: 4, marginLeft: 'auto', alignItems: 'flex-end' }}>
        <span className="v-tiny">Válvula</span>
        <span ref={state} className="v-tag off">
          CERRADA
        </span>
      </div>
    </div>
  );
}

/** Línea de tiempo de un latido: R → τ → apertura → cierre (usa los parámetros actuales). */
function Timeline({ p, w, cursor }: { p: SimParams; w: number; cursor: boolean }) {
  const RR = rrOf(p);
  const { dOpen } = effectiveOpen(p);
  const tau = p.delayMs / 1000;
  const L = 20;
  const sx = (t: number) => L + (t / (RR * 1.02)) * (w - L - 20);
  const ref = useRef<SVGLineElement>(null);
  useEffect(() => {
    if (!cursor) return;
    return sim.onFrame((t) => {
      const ph = ((t % RR) + RR) % RR;
      ref.current?.setAttribute('x1', String(sx(ph)));
      ref.current?.setAttribute('x2', String(sx(ph)));
    });
  });
  const seg = (a: number, b: number, y: number, color: string, label: string, dash?: boolean) => (
    <g>
      <rect x={sx(a)} y={y} width={Math.max(2, sx(b) - sx(a))} height={22} rx={6} fill={dash ? 'transparent' : color} stroke={color} strokeWidth={2} strokeDasharray={dash ? '5 4' : undefined} opacity={dash ? 1 : 0.85} />
      <text x={(sx(a) + sx(b)) / 2} y={y + 16} textAnchor="middle" fontSize={13} fontWeight={700} fill={dash ? color : '#fff'}>
        {label}
      </text>
    </g>
  );
  const ms = (x: number) => `${Math.round(x * 1000)} ms`;
  return (
    <svg width={w} height={112} aria-label="Temporización del ciclo">
      <line x1={L} x2={w - 10} y1={70} y2={70} stroke="var(--line)" />
      {[0, RR].map((x) => (
        <g key={x}>
          <line x1={sx(x)} x2={sx(x)} y1={8} y2={78} stroke="var(--sig-ecg)" strokeWidth={2.5} />
          <text x={sx(x) + 5} y={18} fontSize={14} fontWeight={800} fill="var(--sig-ecg)">
            R
          </text>
        </g>
      ))}
      {seg(0, tau, 30, '#64748b', `τ ${ms(tau)}`, true)}
      {seg(tau, tau + RAMP_OPEN, 30, '#0891b2', 'abre')}
      {seg(tau + RAMP_OPEN, tau + dOpen, 30, '#0d9488', `abierta · D ${ms(dOpen)}`)}
      {seg(tau + dOpen, tau + dOpen + RAMP_CLOSE, 30, '#b45309', 'cierra')}
      <text x={sx(RR) - 6} y={98} textAnchor="end" fontSize={13} fill="var(--muted)">
        RR = {ms(RR)} → FC = 60/RR = {(60 / RR).toFixed(0)} lpm
      </text>
      <text x={L} y={98} fontSize={13} fill="var(--muted)">
        t_ap = t_R + τ · t_cierre = t_R + τ + D
      </text>
      {cursor && <line ref={ref} y1={4} y2={80} stroke="var(--amber)" strokeWidth={2} />}
    </svg>
  );
}

const CHAIN = [
  { id: 'ecg', label: 'ECG', sub: 'pico R detectado' },
  { id: 'esp', label: 'ESP32', sub: 'espera τ' },
  { id: 'act', label: 'Actuador', sub: 'servo + leva' },
  { id: 'valve', label: 'Válvula', sub: 'abre y cierra' },
];

/** Cadena ECG → ESP32 → actuador → válvula, iluminada según el instante del ciclo. */
function Chain() {
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  useEffect(
    () =>
      sim.onFrame((t) => {
        const p = sim.state.params;
        let b = Math.floor(t / rrOf(p)) + 1;
        while (rPeak(b, p) > t) b--;
        const dt = t - rPeak(b, p);
        const ph = phaseName(t, p);
        const on = [dt < 0.12, dt > 0.03 && dt < p.delayMs / 1000 + 0.05, ph === 'apertura' || ph === 'cierre', ph !== 'cerrada'];
        refs.current.forEach((el, i) => el?.classList.toggle('on', on[i]));
      }),
    [],
  );
  return (
    <div className="v-chain">
      {CHAIN.map((c, i) => (
        <div key={c.id} className="v-chain-step">
          <div
            className="v-chain-node"
            ref={(el) => {
              refs.current[i] = el;
            }}
          >
            <b>{c.label}</b>
            <span>{c.sub}</span>
          </div>
          {i < CHAIN.length - 1 && <span className="v-chain-arrow">→</span>}
        </div>
      ))}
    </div>
  );
}

export function S04Ecg() {
  const { print } = useDeck();
  const { params } = useSim();
  return (
    <Screen
      num={4}
      kicker="Nueva función · ECG"
      title="¿Podemos sincronizarla con nuestro corazón?"
      lead="Cada latido del ECG le indica al ESP32 cuándo mover la válvula, con un pequeño retraso."
      states={['implemented', 'synthetic']}
      actions={
        <>
          <Explain label="¿Qué estamos observando?" content={EXPLAIN.p_ecg_obs} />
          <Explain label="¿Y con un ECG real?" content={EXPLAIN.p_ecg_real} />
        </>
      }
    >
      <div className="v-grid" style={{ gridTemplateColumns: '1fr 430px', gap: 22, height: '100%' }}>
        <div className="v-col" style={{ gap: 14, minHeight: 0 }}>
          <div className="v-panel" style={{ padding: '14px 18px 10px' }}>
            <div className="v-row" style={{ justifyContent: 'space-between' }}>
              <div className="v-panel-title" style={{ margin: 0 }}>
                ECG simulado · picos R detectados
              </div>
              <span className="v-tiny">franjas: válvula abierta</span>
            </div>
            {print ? <StaticSignals params={params} width={940} height={220} lanes={['ecg']} /> : <LiveSignals width={940} height={220} windowS={3} lanes={['ecg']} />}
          </div>
          <Chain />
          <div className="v-panel" style={{ padding: '10px 18px 4px' }}>
            <div className="v-panel-title" style={{ margin: 0, fontSize: 13 }}>
              Temporización de un latido
            </div>
            <Timeline p={params} w={940} cursor={!print} />
          </div>
        </div>
        <div className="v-col" style={{ gap: 14 }}>
          <div className="v-panel" style={{ padding: '14px 18px' }}>
            <BeatMonitor />
          </div>
          <div className="v-panel" style={{ padding: 10, display: 'grid', placeItems: 'center' }}>
            <ValveSVG view="top" size={250} numbers angles={print ? [80, 80, 80] : undefined} />
          </div>
          <div className="v-panel" style={{ padding: '12px 16px' }}>
            <ParamSliders angle={false} />
          </div>
        </div>
      </div>
    </Screen>
  );
}

