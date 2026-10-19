import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { flushSync } from 'react-dom';
import { NOTES } from './content';
import { Deck, type DeckMode } from './components/deck';
import { sim, useSim, type MotionPref } from './sim/store';
import { Bibliography } from './slides/Bibliography';
import { Cover } from './slides/Cover';
import { S01Problem } from './slides/S01Problem';
import { S02RealValve } from './slides/S02RealValve';
import { S03Solution } from './slides/S03Solution';
import { S04Prototype } from './slides/S04Prototype';
import { S05Ecg } from './slides/S05Ecg';
import { S06SignalsAI } from './slides/S06SignalsAI';
import { S07Math } from './slides/S07Math';
import { S08Dashboard } from './slides/S08Dashboard';
import { S09Impact } from './slides/S09Impact';
import { S10Close } from './slides/S10Close';
import './styles/presentation.css';

interface SlideDef {
  id: string;
  num: number | null;
  title: string;
  C: ComponentType;
}

/** Portada + 10 diapositivas de contenido (numeradas) + bibliografía. */
export const SLIDES: SlideDef[] = [
  { id: 'cover', num: null, title: 'Portada', C: Cover },
  { id: 's1', num: 1, title: 'Problema clínico', C: S01Problem },
  { id: 's2', num: 2, title: 'Cómo funciona una válvula real', C: S02RealValve },
  { id: 's3', num: 3, title: 'Solución ValveSense', C: S03Solution },
  { id: 's4', num: 4, title: 'Prototipo con sensores integrados', C: S04Prototype },
  { id: 's5', num: 5, title: 'Sincronización con ECG', C: S05Ecg },
  { id: 's6', num: 6, title: 'Vibración, sonido e IA', C: S06SignalsAI },
  { id: 's7', num: 7, title: 'Matemática aplicada', C: S07Math },
  { id: 's8', num: 8, title: 'Dashboard actualizado', C: S08Dashboard },
  { id: 's9', num: 9, title: 'Integración clínica e impacto', C: S09Impact },
  { id: 's10', num: 10, title: 'Plan, validación y cierre', C: S10Close },
  { id: 'biblio', num: null, title: 'Bibliografía', C: Bibliography },
];

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

export function Presentation() {
  const [index, setIndex] = useState(readHash);
  const [mode, setMode] = useState<DeckMode>('explore');
  const [showIndex, setShowIndex] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [toolbarVisible, setToolbarVisible] = useState(true);
  const { motion } = useSim();
  const wrap = useRef<HTMLDivElement>(null);
  const scale = useStageScale(wrap);
  const slide = SLIDES[index];

  const go = useCallback((i: number) => {
    const n = Math.max(0, Math.min(SLIDES.length - 1, i));
    setIndex(n);
    history.replaceState(null, '', `#/${SLIDES[n].id}`);
  }, []);
  const goTo = useCallback((id: string) => go(SLIDES.findIndex((s) => s.id === id)), [go]);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.();
  }, []);

  const doPrint = useCallback(() => {
    flushSync(() => setPrinting(true));
    // esperar a que los QR/SVG asíncronos se rendericen
    setTimeout(() => window.print(), 400);
  }, []);

  // navegación por URL (#/s7, enlaces directos, botón atrás)
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
      else if (k === 'e' || k === 'E') setMode((m) => (m === 'present' ? 'explore' : 'present'));
      else if (k === 'n' || k === 'N') setShowNotes((v) => !v);
      else if (k === 'i' || k === 'I') setShowIndex((v) => !v);
      else if (k === 'a' || k === 'A') sim.setMotion(MOTION_NEXT[sim.state.motion]);
      else if (k === 'Escape') setShowIndex(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, go, toggleFullscreen]);

  // gesto táctil: deslizar para cambiar de diapositiva (fuera de controles interactivos)
  useEffect(() => {
    let x0: number | null = null;
    const start = (e: TouchEvent) => {
      const t = e.target as HTMLElement;
      x0 = t.closest('canvas, input, button, .scene') ? null : e.touches[0].clientX;
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

  // modo presentación: la barra se oculta tras unos segundos sin mover el mouse
  useEffect(() => {
    if (mode !== 'present') {
      setToolbarVisible(true);
      return;
    }
    let t: ReturnType<typeof setTimeout>;
    const show = () => {
      setToolbarVisible(true);
      clearTimeout(t);
      t = setTimeout(() => setToolbarVisible(false), 2500);
    };
    show();
    window.addEventListener('mousemove', show);
    window.addEventListener('touchstart', show);
    return () => {
      clearTimeout(t);
      window.removeEventListener('mousemove', show);
      window.removeEventListener('touchstart', show);
    };
  }, [mode]);

  const contentNum = slide.num;
  const progress = (index / (SLIDES.length - 1)) * 100;
  const rootClass = `v-root v-${mode} v-motion-${motion}`;
  const ctx = useMemo(() => ({ mode, print: false, goTo, active: true }), [mode, goTo]);

  if (printing) {
    return (
      <div className="v-root v-print-root v-theme-print v-explore">
        {SLIDES.map((s) => (
          <Deck.Provider key={s.id} value={{ mode: 'explore', print: true, goTo, active: false }}>
            <section className="v-print-page" aria-label={s.title}>
              <s.C />
              <div style={{ position: 'absolute', right: 28, bottom: 18, fontSize: 13, color: 'var(--muted)' }}>
                ValveSense · CardioValveAI {s.num ? `· ${s.num} / 10` : ''}
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
    <div className={rootClass}>
      <div className="v-progress v-no-print" style={{ width: `${progress}%` }} />
      <div className="v-stage-wrap" ref={wrap}>
        <div className="v-stage" style={{ transform: `scale(${scale}) translate(-50%, -50%)` }}>
          <Deck.Provider value={ctx}>
            <div key={slide.id} className="v-slide-enter" style={{ position: 'absolute', inset: 0 }}>
              <slide.C />
            </div>
          </Deck.Provider>
          {contentNum && (
            <div style={{ position: 'absolute', right: 30, top: 22, fontSize: 15, color: 'var(--muted)' }} className="v-num">
              {contentNum} / 10
            </div>
          )}
        </div>
      </div>

      {showIndex && <div className="v-scrim" onClick={() => setShowIndex(false)} />}
      <nav className={`v-index${showIndex ? ' open' : ''}`} aria-label="Índice" aria-hidden={!showIndex}>
        <h3>Índice · ValveSense</h3>
        {SLIDES.map((s, i) => (
          <button
            key={s.id}
            className={i === index ? 'active' : ''}
            tabIndex={showIndex ? 0 : -1}
            onClick={() => {
              go(i);
              setShowIndex(false);
            }}
          >
            <span className="n">{s.num ? String(s.num).padStart(2, '0') : '—'}</span>
            {s.title}
          </button>
        ))}
        <div className="v-tiny" style={{ marginTop: 'auto', padding: 10, lineHeight: 1.6 }}>
          Teclas: ← → navegar · I índice · E modo · N notas · A animación · F pantalla completa
        </div>
      </nav>

      {showNotes && (
        <div className="v-notes v-no-print" role="note">
          <b>Notas del expositor</b>
          {NOTES[slide.id] ?? '—'}
        </div>
      )}

      <div className={`v-toolbar v-no-print${toolbarVisible ? '' : ' hidden'}`} role="toolbar" aria-label="Controles de la presentación">
        <button className="v-btn sm icon" onClick={() => setShowIndex((v) => !v)} aria-label="Índice" title="Índice (I)">
          ☰
        </button>
        <button className="v-btn sm icon" onClick={() => go(index - 1)} disabled={index === 0} aria-label="Anterior" title="Anterior (←)">
          ‹
        </button>
        <div className="counter">
          <b>{contentNum ? `${contentNum} / 10` : slide.title}</b>
          {contentNum ? ` · ${slide.title}` : ''}
        </div>
        <button className="v-btn sm icon" onClick={() => go(index + 1)} disabled={index === SLIDES.length - 1} aria-label="Siguiente" title="Siguiente (→)">
          ›
        </button>
        <span className="sep" />
        <div className="v-seg" style={{ padding: 3 }}>
          <button className={mode === 'present' ? 'active' : ''} onClick={() => setMode('present')} style={{ height: 32, fontSize: 14 }} title="Oculta controles secundarios (E)">
            Presentación
          </button>
          <button className={mode === 'explore' ? 'active' : ''} onClick={() => setMode('explore')} style={{ height: 32, fontSize: 14 }} title="Muestra herramientas interactivas (E)">
            Exploración
          </button>
        </div>
        <button className="v-btn sm" onClick={() => sim.setMotion(MOTION_NEXT[motion])} aria-pressed={motion !== 'full'} aria-label={MOTION_LABEL[motion]} title="Cambiar animación (A)">
          {motion === 'paused' ? '▶' : motion === 'reduced' ? '◐' : '●'}<span className="lbl">{MOTION_LABEL[motion]}</span>
        </button>
        <button className="v-btn sm" aria-pressed={showNotes} aria-label="Notas del expositor" onClick={() => setShowNotes((v) => !v)} title="Notas del expositor (N)">
          ✎<span className="lbl">Notas</span>
        </button>
        <button className="v-btn sm icon" onClick={toggleFullscreen} aria-label="Pantalla completa" title="Pantalla completa (F)">
          ⛶
        </button>
        <button className="v-btn sm" onClick={doPrint} title="Imprimir / Guardar como PDF" aria-label="Imprimir / Guardar como PDF">
          ⎙<span className="lbl">Imprimir / PDF</span>
        </button>
      </div>
    </div>
  );
}
