import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { flushSync } from 'react-dom';
import { ModeSwitch, rememberSlide } from '../components/shared/ModeSwitch';
import { NOTES } from './content';
import { Deck } from './components/deck';
import { PlanPanel } from './components/PlanPanel';
import { sim, useSim, type MotionPref } from './sim/store';
import { Bibliography } from './slides/Bibliography';
import { Cover } from './slides/Cover';
import { S01Problem } from './slides/S01Problem';
import { S02Aortic } from './slides/S02Aortic';
import { S03Prototype } from './slides/S03Prototype';
import { S04Ecg } from './slides/S04Ecg';
import { S05Sensors } from './slides/S05Sensors';
import { S06Changes } from './slides/S06Changes';
import { S07AI } from './slides/S07AI';
import { S08Dashboard } from './slides/S08Dashboard';
import { S09Future } from './slides/S09Future';
import './styles/presentation.css';
import './styles/presentation2.css';

interface SlideDef {
  id: string;
  num: number | null;
  /** nombre corto para la pestaña */
  tab: string;
  title: string;
  C: ComponentType;
}

/** Portada + 9 pantallas de contenido + bibliografía. */
export const SLIDES: SlideDef[] = [
  { id: 'cover', num: null, tab: 'Inicio', title: 'Portada', C: Cover },
  { id: 's1', num: 1, tab: 'Problema', title: '¿Cuál es el problema?', C: S01Problem },
  { id: 's2', num: 2, tab: 'Válvula aórtica', title: '¿Cómo funciona una válvula aórtica?', C: S02Aortic },
  { id: 's3', num: 3, tab: 'Prototipo', title: 'Nuestro prototipo ValveSense', C: S03Prototype },
  { id: 's4', num: 4, tab: 'ECG', title: '¿Podemos sincronizarla con nuestro corazón?', C: S04Ecg },
  { id: 's5', num: 5, tab: 'Sensores', title: '¿Qué escuchan nuestros sensores?', C: S05Sensors },
  { id: 's6', num: 6, tab: 'Cambios', title: '¿Cómo reconocemos cambios?', C: S06Changes },
  { id: 's7', num: 7, tab: 'IA', title: '¿Qué hace nuestra inteligencia artificial?', C: S07AI },
  { id: 's8', num: 8, tab: 'Dashboard', title: 'Dashboard y Kinesiología', C: S08Dashboard },
  { id: 's9', num: 9, tab: 'Futuro', title: 'Impacto y futuro', C: S09Future },
  { id: 'biblio', num: null, tab: 'Fuentes', title: 'Bibliografía', C: Bibliography },
];
const N_CONTENT = SLIDES.filter((s) => s.num).length;

const MOTION_LABEL: Record<MotionPref, string> = { full: 'Animación completa', reduced: 'Animación reducida', paused: 'Animación en pausa' };
const MOTION_NEXT: Record<MotionPref, MotionPref> = { full: 'reduced', reduced: 'paused', paused: 'full' };

function readHash() {
  const id = location.hash.replace(/^#\/?/, '');
  const i = SLIDES.findIndex((s) => s.id === id);
  return i >= 0 ? i : 0;
}

function useStageScale(ref: React.RefObject<HTMLDivElement | null>) {
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setScale(Math.min(el.clientWidth / 1600, el.clientHeight / 900));
    const ro = new ResizeObserver(update);
    ro.observe(el);
    update();
    return () => ro.disconnect();
  }, [ref]);
  return scale;
}

function Logo() {
  return (
    <svg viewBox="0 0 40 40" width="34" height="34" aria-hidden>
      <defs>
        <linearGradient id="vsg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0a6f95" />
          <stop offset="1" stopColor="#10a2a0" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill="url(#vsg)" />
      <circle cx="20" cy="20" r="11" fill="none" stroke="#fff" strokeWidth="2.2" />
      <path d="M20 20L20 9M20 20l9.5 5.5M20 20l-9.5 5.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" opacity=".85" />
    </svg>
  );
}

export function Presentation() {
  const [index, setIndex] = useState(readHash);
  const [showNotes, setShowNotes] = useState(false);
  const [printing, setPrinting] = useState(false);
  const { motion } = useSim();
  const wrap = useRef<HTMLDivElement>(null);
  const tabs = useRef<HTMLDivElement>(null);
  const scale = useStageScale(wrap);
  const slide = SLIDES[index];

  const go = useCallback((i: number) => {
    const n = Math.max(0, Math.min(SLIDES.length - 1, i));
    setIndex(n);
    history.replaceState(null, '', `#/${SLIDES[n].id}`);
  }, []);
  const goTo = useCallback((id: string) => go(SLIDES.findIndex((s) => s.id === id)), [go]);

  useEffect(() => {
    rememberSlide(slide.id);
    tabs.current?.querySelector('.active')?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [slide.id]);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.();
  }, []);

  const doPrint = useCallback(() => {
    flushSync(() => setPrinting(true));
    // esperar a que los QR/SVG asíncronos se rendericen
    setTimeout(() => window.print(), 400);
  }, []);

  // navegación por URL (#/s4, enlaces directos, botón atrás)
  useEffect(() => {
    const on = () => setIndex(readHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  useEffect(() => {
    const before = () => flushSync(() => setPrinting(true));
    const after = () => setPrinting(false);
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', after);
    };
  }, []);

  // teclado
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.metaKey || e.ctrlKey || e.altKey) return;
      if (document.querySelector('.explain-pop')) return;
      const k = e.key;
      if (k === 'ArrowRight' || k === 'PageDown' || (k === ' ' && tag !== 'BUTTON')) {
        e.preventDefault();
        go(index + 1);
      } else if (k === 'ArrowLeft' || k === 'PageUp') {
        e.preventDefault();
        go(index - 1);
      } else if (k === 'Home') go(0);
      else if (k === 'End') go(SLIDES.length - 1);
      else if (k === 'f' || k === 'F') toggleFullscreen();
      else if (k === 'n' || k === 'N') setShowNotes((v) => !v);
      else if (k === 'a' || k === 'A') sim.setMotion(MOTION_NEXT[sim.state.motion]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, go, toggleFullscreen]);

  // gesto táctil: deslizar para cambiar de pantalla (fuera de controles interactivos)
  useEffect(() => {
    let x0: number | null = null;
    const start = (e: TouchEvent) => {
      const t = e.target as HTMLElement;
      x0 = t.closest('canvas, input, button, .scene, .v-tabs-bar') ? null : e.touches[0].clientX;
    };
    const end = (e: TouchEvent) => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 70) go(index + (dx < 0 ? 1 : -1));
      x0 = null;
    };
    window.addEventListener('touchstart', start, { passive: true });
    window.addEventListener('touchend', end);
    return () => {
      window.removeEventListener('touchstart', start);
      window.removeEventListener('touchend', end);
    };
  }, [index, go]);

  const ctx = useMemo(() => ({ mode: 'explore' as const, print: false, goTo, active: true }), [goTo]);
  const progress = (index / (SLIDES.length - 1)) * 100;

  if (printing) {
    const pages = [...SLIDES.slice(0, -1), { id: 'plan', num: null, tab: 'Anexo', title: 'Anexo: plan y próximos pasos', C: PlanAppendix }, SLIDES[SLIDES.length - 1]];
    return (
      <div className="v-root v-print-root v-theme-print v-explore">
        {pages.map((s) => (
          <Deck.Provider key={s.id} value={{ mode: 'explore', print: true, goTo, active: false }}>
            <section className="v-print-page" aria-label={s.title}>
              <s.C />
              <div style={{ position: 'absolute', right: 28, bottom: 18, fontSize: 13, color: 'var(--muted)' }}>
                ValveSense · CardioValveAI {s.num ? `· ${s.num} / ${N_CONTENT}` : ''}
              </div>
            </section>
          </Deck.Provider>
        ))}
        <button className="v-btn v-no-print" style={{ position: 'fixed', right: 20, top: 20, zIndex: 9 }} onClick={() => setPrinting(false)}>
          Volver a la presentación
        </button>
      </div>
    );
  }

  return (
    <div className={`v-root v-explore v-app v-motion-${motion}`}>
      <header className="v-appbar v-no-print">
        <div className="v-appbar-brand">
          <Logo />
          <div>
            <b>
              Valve<span>Sense</span>
            </b>
            <small>CardioValveAI</small>
          </div>
        </div>
        <nav className="v-tabs-bar" ref={tabs} aria-label="Pantallas">
          {SLIDES.map((s, i) => (
            <button key={s.id} className={i === index ? 'active' : ''} onClick={() => go(i)} aria-current={i === index ? 'page' : undefined} title={s.title}>
              {s.num ? <span className="n">{s.num}</span> : null}
              {s.tab}
            </button>
          ))}
        </nav>
        <ModeSwitch active="presentation" />
        <div className="v-appbar-tools">
          <button className="v-iconbtn" onClick={() => sim.setMotion(MOTION_NEXT[motion])} title={`${MOTION_LABEL[motion]} (A)`} aria-label={MOTION_LABEL[motion]}>
            {motion === 'paused' ? '▶' : motion === 'reduced' ? '◐' : '●'}
          </button>
          <button className="v-iconbtn" aria-pressed={showNotes} onClick={() => setShowNotes((v) => !v)} title="Notas del expositor (N)" aria-label="Notas del expositor">
            ✎
          </button>
          <button className="v-iconbtn" onClick={doPrint} title="Imprimir / Guardar como PDF" aria-label="Imprimir / Guardar como PDF">
            ⎙
          </button>
          <button className="v-iconbtn" onClick={toggleFullscreen} title="Pantalla completa (F)" aria-label="Pantalla completa">
            ⛶
          </button>
        </div>
        <div className="v-progress" style={{ width: `${progress}%` }} />
      </header>

      <div className="v-stage-wrap" ref={wrap}>
        <div className="v-stage" style={{ transform: `scale(${scale}) translate(-50%, -50%)` }}>
          <Deck.Provider value={ctx}>
            <div key={slide.id} className="v-slide-enter" style={{ position: 'absolute', inset: 0 }}>
              <slide.C />
            </div>
          </Deck.Provider>
        </div>
      </div>

      {showNotes && (
        <div className="v-notes v-no-print" role="note">
          <b>Notas del expositor</b>
          {NOTES[slide.id] ?? '—'}
        </div>
      )}

      <footer className="v-navbar v-no-print">
        <button className="v-btn sm" onClick={() => go(index - 1)} disabled={index === 0}>
          ← Anterior
        </button>
        <div className="v-navbar-mid">
          <span className="v-navbar-count">{slide.num ? `${slide.num} / ${N_CONTENT}` : slide.title}</span>
          <div className="v-dots" aria-hidden>
            {SLIDES.map((s, i) => (
              <i key={s.id} className={i === index ? 'on' : i < index ? 'done' : ''} />
            ))}
          </div>
        </div>
        <button className="v-btn sm primary" onClick={() => go(index + 1)} disabled={index === SLIDES.length - 1}>
          Siguiente →
        </button>
      </footer>
    </div>
  );
}

/** Anexo impreso: plan de trabajo, entrevista, Toolkit y souvenir (en pantalla, dentro de «Plan y próximos pasos»). */
function PlanAppendix() {
  return (
    <div className="v-slide" style={{ paddingTop: 40 }}>
      <div className="v-kicker">Anexo</div>
      <h2 className="v-h2" style={{ marginBottom: 14 }}>
        Plan, entrevista y próximos pasos
      </h2>
      <PlanPanel />
    </div>
  );
}
