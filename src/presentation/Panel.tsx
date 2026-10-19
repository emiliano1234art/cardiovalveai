import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { NOTES } from './content';
import { Deck } from './components/deck';
import { LiveSignals } from './components/LiveSignals';
import { ConditionChips, ParamSliders, PhaseReadout } from './components/SimControls';
import { ValveSVG } from './components/ValveSVG';
import { SLIDES } from './Presentation';
import { assess } from './sim/analysis';
import { CONDITIONS, rrOf } from './sim/model';
import { sim, useSim, type MotionPref } from './sim/store';
import { VERDICT } from './slides/S06SignalsAI';
import './styles/presentation.css';
import './styles/panel.css';

const MOTION_LABEL: Record<MotionPref, string> = { full: 'Animación completa', reduced: 'Animación reducida', paused: 'Animación en pausa' };
const MOTION_NEXT: Record<MotionPref, MotionPref> = { full: 'reduced', reduced: 'paused', paused: 'full' };

function readHash() {
  const id = location.hash.replace(/^#\/panel\/?/, '');
  const i = SLIDES.findIndex((s) => s.id === id);
  return i >= 0 ? i : 0;
}

/** Escala la diapositiva (1600 × 900) al ancho disponible de la tarjeta. */
function useFit(ref: React.RefObject<HTMLDivElement | null>) {
  const [scale, setScale] = useState(0.5);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / 1600);
    const ro = new ResizeObserver(update);
    ro.observe(el);
    update();
    return () => ro.disconnect();
  }, [ref]);
  return scale;
}

/** Ancho disponible de un contenedor (para los canvas del panel lateral). */
function useWidth(ref: React.RefObject<HTMLDivElement | null>, fallback: number) {
  const [w, setW] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.max(200, Math.floor(el.clientWidth))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

function Kpi({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="p-kpi">
      <span className="p-kpi-label">{label}</span>
      <b className="v-num" style={color ? { color } : undefined}>
        {value}
      </b>
      {sub && <span className="p-kpi-sub">{sub}</span>}
    </div>
  );
}

/** Panel lateral: la simulación sincronizada, visible en todos los temas. */
function LiveRail() {
  const { params } = useSim();
  const a = useMemo(() => assess(params), [params]);
  const V = VERDICT[a.verdict];
  const box = useRef<HTMLDivElement>(null);
  const w = useWidth(box, 300);
  return (
    <aside className="p-rail" aria-label="Simulación en vivo">
      <div className="p-card">
        <div className="p-card-head">
          <h3>Válvula bileaflet</h3>
          <span className="v-tag sim">SIMULACIÓN</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 4 }}>
          <ValveSVG view="top" size={150} title="Vista superior" />
          <ValveSVG view="side" size={150} title="Corte lateral" />
        </div>
        <PhaseReadout showAngles={false} />
      </div>

      <div className="p-card" ref={box}>
        <div className="p-card-head">
          <h3>ECG · vibración · sonido</h3>
          <span className="v-tiny">ventana 2,5 s</span>
        </div>
        {/* se dibuja a escala de diapositiva (560 px) y se reduce al ancho de la tarjeta */}
        <div style={{ height: (400 * (w - 2)) / 560, overflow: 'hidden' }}>
          <div style={{ width: 560, transform: `scale(${(w - 2) / 560})`, transformOrigin: '0 0' }}>
            <LiveSignals width={560} height={400} lanes={['ecg', 'vib', 'snd']} />
          </div>
        </div>
        <div className="p-legend">
          <span>
            <i style={{ background: 'var(--sig-ecg)' }} />
            ECG
          </span>
          <span>
            <i style={{ background: 'var(--sig-vib)' }} />
            Piezo
          </span>
          <span>
            <i style={{ background: 'var(--sig-snd)' }} />
            MEMS
          </span>
        </div>
      </div>

      <div className="p-card" style={{ background: V.bg, borderColor: V.color }}>
        <div className="p-card-head">
          <h3>IA experimental</h3>
          <span className="v-tiny">heurística · no diagnóstico</span>
        </div>
        <div style={{ fontSize: 17, fontWeight: 800, color: V.color }}>
          {V.icon} {V.label}
        </div>
        <div className="v-tiny v-num" style={{ fontSize: 13 }}>
          Similitud con la basal <b>{a.similarity.toFixed(0)} %</b> · score <b>{a.score.toFixed(2).replace('.', ',')}</b>
        </div>
      </div>

      <div className="p-card">
        <div className="p-card-head">
          <h3>Controles</h3>
        </div>
        <ConditionChips compact />
        <div style={{ marginTop: 10 }}>
          <ParamSliders />
        </div>
        <div className="v-row" style={{ gap: 6, marginTop: 8 }}>
          <button className="v-btn sm" onClick={() => sim.setParams({ bpm: 72 })}>
            Reposo · 72
          </button>
          <button className="v-btn sm" onClick={() => sim.setParams({ bpm: 110 })}>
            ♥ Ejercicio · 110
          </button>
        </div>
      </div>
    </aside>
  );
}

export function Panel() {
  const [index, setIndex] = useState(readHash);
  const [notes, setNotes] = useState(false);
  const s = useSim();
  const slide = SLIDES[index];
  const fit = useRef<HTMLDivElement>(null);
  const scale = useFit(fit);
  const cond = CONDITIONS.find((c) => c.id === s.params.condition)!;
  const a = useMemo(() => assess(s.params), [s.params]);

  const go = useCallback((i: number) => {
    const n = Math.max(0, Math.min(SLIDES.length - 1, i));
    setIndex(n);
    history.replaceState(null, '', `#/panel/${SLIDES[n].id}`);
    document.querySelector('.p-main')?.scrollTo({ top: 0 });
  }, []);
  const goTo = useCallback((id: string) => go(SLIDES.findIndex((x) => x.id === id)), [go]);
  const ctx = useMemo(() => ({ mode: 'explore' as const, print: false, goTo, active: true }), [goTo]);

  useEffect(() => {
    const on = () => setIndex(readHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') go(index + 1);
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') go(index - 1);
      else if (e.key === 'a' || e.key === 'A') sim.setMotion(MOTION_NEXT[sim.state.motion]);
      else if (e.key === 'n' || e.key === 'N') setNotes((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, go]);

  return (
    <div className={`p-root v-root v-explore v-motion-${s.motion}`}>
      <nav className="p-side" aria-label="Temas de la presentación">
        <div className="p-brand">
          <svg viewBox="0 0 40 40" width="34" height="34" aria-hidden>
            <rect width="40" height="40" rx="11" fill="#0891b2" />
            <circle cx="20" cy="20" r="11" fill="none" stroke="#fff" strokeWidth="2.2" />
            <path d="M8 22h6l2.5-6 3.5 11 3-8 2 3h7" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div>
            <b>ValveSense</b>
            <span>Panel de la presentación</span>
          </div>
        </div>
        <div className="p-nav">
          {SLIDES.map((x, i) => (
            <button key={x.id} className={i === index ? 'active' : ''} onClick={() => go(i)} aria-current={i === index ? 'page' : undefined}>
              <span className="n">{x.num ? String(x.num).padStart(2, '0') : '·'}</span>
              <span className="t">{x.title}</span>
            </button>
          ))}
        </div>
        <div className="p-side-foot">
          <a href={`#/${slide.id}`}>▭ Ver como diapositivas</a>
          <a href="#/dashboard">▦ Dashboard de señales</a>
          <span>← → temas · A animación · N notas</span>
        </div>
      </nav>

      <div className="p-body">
        <header className="p-top">
          <div className="p-title">
            <span className="v-kicker">{slide.num ? `Tema ${slide.num} de 10` : 'ValveSense'}</span>
            <h1>{slide.title}</h1>
          </div>
          <div className="p-kpis">
            <Kpi label="FC (ECG)" value={`${s.params.bpm} lpm`} sub={`RR ${(rrOf(s.params) * 1000).toFixed(0)} ms`} color="var(--sig-ecg)" />
            <Kpi label="Condición" value={cond.short} sub={`τ ${s.params.delayMs} ms · D ${s.params.openMs} ms`} />
            <Kpi label="IA" value={VERDICT[a.verdict].label.split(' · ')[0]} sub={`similitud ${a.similarity.toFixed(0)} %`} color={VERDICT[a.verdict].color} />
          </div>
          <div className="p-actions">
            <button className="v-btn sm" onClick={() => sim.toggle()} aria-label={s.playing ? 'Pausar' : 'Reproducir'}>
              {s.playing ? '❚❚' : '▶'}
            </button>
            <button className="v-btn sm" aria-pressed={s.speed < 1} onClick={() => sim.setSpeed(s.speed < 1 ? 1 : 0.25)} title="Cámara lenta ×¼">
              🐢 ×¼
            </button>
            <button className="v-btn sm" onClick={() => sim.setMotion(MOTION_NEXT[s.motion])} title={MOTION_LABEL[s.motion]} aria-label={MOTION_LABEL[s.motion]}>
              {s.motion === 'paused' ? '▶' : s.motion === 'reduced' ? '◐' : '●'}
            </button>
            <button className="v-btn sm icon" onClick={() => go(index - 1)} disabled={index === 0} aria-label="Tema anterior">
              ‹
            </button>
            <button className="v-btn sm icon" onClick={() => go(index + 1)} disabled={index === SLIDES.length - 1} aria-label="Tema siguiente">
              ›
            </button>
          </div>
        </header>

        <div className="p-grid">
          <main className="p-main">
            <div className="p-card p-slide-card">
              <div className="p-fit" ref={fit} style={{ height: 900 * scale }}>
                <div className="v-stage p-stage" style={{ transform: `scale(${scale})` }}>
                  <Deck.Provider value={ctx}>
                    <div key={slide.id} className="v-slide-enter" style={{ position: 'absolute', inset: 0 }}>
                      <slide.C />
                    </div>
                  </Deck.Provider>
                </div>
              </div>
            </div>
            <div className="p-card">
              <button className="p-notes-toggle" onClick={() => setNotes((v) => !v)} aria-expanded={notes}>
                {notes ? '▾' : '▸'} Notas del expositor
              </button>
              {notes && <p className="p-notes">{NOTES[slide.id] ?? '—'}</p>}
            </div>
            <div className="p-pager">
              {index > 0 && (
                <button className="v-btn sm" onClick={() => go(index - 1)}>
                  ‹ {SLIDES[index - 1].title}
                </button>
              )}
              <span style={{ flex: 1 }} />
              {index < SLIDES.length - 1 && (
                <button className="v-btn sm" onClick={() => go(index + 1)}>
                  {SLIDES[index + 1].title} ›
                </button>
              )}
            </div>
          </main>
          <LiveRail />
        </div>
      </div>
    </div>
  );
}
