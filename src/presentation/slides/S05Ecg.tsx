import { useEffect, useRef, useState } from 'react';
import { Cite, SimTag, SlideHead, useDeck } from '../components/deck';
import { LiveSignals } from '../components/LiveSignals';
import { ParamSliders, PlaybackButtons } from '../components/SimControls';
import { StaticSignals } from '../components/StaticSignals';
import { ValveSVG } from '../components/ValveSVG';
import { bpmFromPeaks, detectR, effectiveOpen, isOpen, RAMP_CLOSE, RAMP_OPEN, rPeak, rrOf, sampleEcg, type SimParams } from '../sim/model';
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

/** Arquitectura segura propuesta para ECG real. */
function SafeSystem({ w }: { w: number }) {
  const box = (x: number, label: string, sub: string, color: string, dashed = false) => (
    <g>
      <rect x={x} y={44} width={150} height={66} rx={14} fill="#fff" stroke={color} strokeWidth={2} strokeDasharray={dashed ? '6 4' : undefined} />
      <text x={x + 75} y={72} textAnchor="middle" fontSize={14.5} fontWeight={750} fill="#0b1f33">
        {label}
      </text>
      <text x={x + 75} y={92} textAnchor="middle" fontSize={12} fill="#64748b">
        {sub}
      </text>
    </g>
  );
  const arrow = (x1: number, x2: number, wireless = false) => (
    <g>
      <line x1={x1} x2={x2 - 8} y1={77} y2={77} stroke="#0891b2" strokeWidth={2.5} strokeDasharray={wireless ? '3 5' : undefined} />
      <path d={`M${x2 - 10} 71 L${x2} 77 L${x2 - 10} 83`} fill="none" stroke="#0891b2" strokeWidth={2.5} />
      {wireless && (
        <g fill="none" stroke="#0891b2" strokeWidth={2}>
          <path d={`M${(x1 + x2) / 2 - 8} 60 q8 -10 16 0`} />
          <path d={`M${(x1 + x2) / 2 - 14} 54 q14 -16 28 0`} />
        </g>
      )}
    </g>
  );
  return (
    <svg width={w} height={128} viewBox={`0 0 ${w} 128`} aria-label="Arquitectura segura propuesta">
      {/* persona */}
      <circle cx={48} cy={30} r={16} fill="#e2e8f0" stroke="#94a3b8" />
      <path d="M14 118 Q16 58 48 54 Q80 58 82 118 Z" fill="#e2e8f0" stroke="#94a3b8" />
      {[
        [34, 70],
        [62, 70],
        [56, 100],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={5} fill="#e11d48" />
      ))}
      <text x={48} y={126} textAnchor="middle" fontSize={11} fill="#64748b">
        electrodos
      </text>
      {arrow(86, 120)}
      {box(120, 'Módulo ECG aislado', 'a batería · certificado', '#e11d48')}
      {arrow(270, 330, true)}
      {box(330, 'ESP32', 'detección R · control', '#0891b2')}
      {arrow(480, 510)}
      {box(510, 'Actuador', 'servo → valvas', '#0891b2')}
      {arrow(660, 690)}
      {box(690, 'Válvula + sensores', 'piezo · MEMS', '#0891b2')}
    </svg>
  );
}

export function S05Ecg() {
  const { print } = useDeck();
  const { params } = useSim();
  const [mode, setMode] = useState<'sim' | 'real'>('sim');
  return (
    <div className="v-slide" style={{ paddingTop: 44 }}>
      <SlideHead
        num={5}
        kicker="Nueva función · sincronización con ECG"
        title="La válvula late al ritmo de un ECG"
        right={
          <>
            <div className="v-seg v-no-print">
              <button className={mode === 'sim' ? 'active' : ''} onClick={() => setMode('sim')}>
                ECG simulado
              </button>
              <button className={mode === 'real' ? 'active' : ''} onClick={() => setMode('real')}>
                ECG real (propuesto)
              </button>
            </div>
            <SimTag label="ECG sintético" />
          </>
        }
      />
      <div className="v-body" style={{ display: 'grid', gridTemplateColumns: '930px 1fr', gap: 20, minHeight: 0 }}>
        <div className="v-col" style={{ gap: 10, minHeight: 0 }}>
          <div className="v-panel" style={{ padding: '10px 14px 6px' }}>
            <div className="v-row" style={{ justifyContent: 'space-between', marginBottom: 2 }}>
              <div className="v-panel-title" style={{ margin: 0 }}>
                ECG → pico R → válvula → vibración y sonido
              </div>
              <div className="v-legend" style={{ fontSize: 13 }}>
                <span>
                  <i className="box" style={{ background: 'rgba(8,145,178,.15)' }} />
                  válvula abierta
                </span>
                <span>▲ R detectado</span>
              </div>
            </div>
            {print ? <StaticSignals params={params} width={900} height={300} lanes={['ecg', 'vib', 'snd']} /> : <LiveSignals width={900} height={300} windowS={3} lanes={['ecg', 'vib', 'snd']} />}
          </div>
          <div className="v-panel" style={{ padding: '6px 14px' }}>
            <Timeline p={params} w={900} cursor={!print} />
          </div>
          <div className="v-panel flat" style={{ padding: '8px 14px 4px' }}>
            <div className="v-row" style={{ justifyContent: 'space-between' }}>
              <div className="v-panel-title" style={{ margin: 0 }}>
                ECG real: arquitectura segura propuesta
              </div>
              <span className="v-tag future">Propuesto · no implementado</span>
            </div>
            <SafeSystem w={880} />
          </div>
        </div>

        <div className="v-col" style={{ gap: 12, minHeight: 0 }}>
          <div className="v-panel" style={{ padding: '14px 18px' }}>
            <BeatMonitor />
            <div style={{ display: 'grid', placeItems: 'center', marginTop: 6 }}>
              <ValveSVG view="side" size={330} angles={print ? [80, 80] : undefined} title="Corte de la válvula: las dos valvas" />
            </div>
            <div className="v-tiny" style={{ textAlign: 'center' }}>
              Corte de la válvula bileaflet (valvas en celeste)
            </div>
          </div>
          <div className="v-panel" style={{ padding: '12px 16px' }}>
            <PlaybackButtons small />
            <div style={{ marginTop: 6 }}>
              <ParamSliders angle={false} />
            </div>
          </div>
          {mode === 'real' && !print ? (
            <div className="v-warn">
              <b>ECG real no implementado.</b> Requiere un módulo de adquisición aislado, a batería y preferentemente inalámbrico. No conectar electrodos a circuitos alimentados por USB o red sin aislamiento.
              <Cite ids={['iec60601']} />
            </div>
          ) : (
            <div className="v-warn" style={{ borderLeftColor: 'var(--cyan)', background: '#ecfeff', color: '#164e63' }}>
              El ECG mide actividad <b>eléctrica</b>, no la apertura valvular: por eso τ es configurable. Es una <b>representación educativa sincronizada</b>, no una reproducción de la fisiología.
              <Cite ids={['pan1985']} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
