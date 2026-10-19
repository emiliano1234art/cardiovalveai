import { useSyncExternalStore } from 'react';
import { DEFAULT_PARAMS, type SimParams } from './model';

export type MotionPref = 'full' | 'reduced' | 'paused';

interface SimUiState {
  params: SimParams;
  playing: boolean;
  /** 1 = tiempo real, 0.25 = cámara lenta */
  speed: number;
  motion: MotionPref;
}

/**
 * Estado ÚNICO de simulación. Un solo reloj (t) avanza con requestAnimationFrame;
 * modelo 3D, señales y gráficos leen el mismo `t` y los mismos parámetros.
 * Pausar detiene todo a la vez.
 */
class SimStore {
  t = 0.05;
  private ui: SimUiState;
  private listeners = new Set<() => void>();
  private frameListeners = new Set<(t: number) => void>();
  private last = 0;
  private raf = 0;

  constructor() {
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    this.ui = { params: { ...DEFAULT_PARAMS }, playing: true, speed: 1, motion: reduce ? 'reduced' : 'full' };
    if (typeof window !== 'undefined') this.loop = this.loop.bind(this);
  }

  get state() {
    return this.ui;
  }

  /** ¿Avanza el reloj? (pausa explícita o preferencia de movimiento) */
  get running() {
    return this.ui.playing && this.ui.motion !== 'paused';
  }

  private set(patch: Partial<SimUiState>) {
    this.ui = { ...this.ui, ...patch };
    this.listeners.forEach((l) => l());
  }

  setParams(patch: Partial<SimParams>) {
    // continuidad de fase: al cambiar la FC se reescala el reloj (t/RR constante)
    if (patch.bpm && patch.bpm !== this.ui.params.bpm) this.t *= this.ui.params.bpm / patch.bpm;
    this.set({ params: { ...this.ui.params, ...patch } });
    this.emitFrame();
  }
  setPlaying(playing: boolean) {
    this.set({ playing });
  }
  toggle() {
    this.set({ playing: !this.ui.playing });
  }
  setSpeed(speed: number) {
    this.set({ speed });
  }
  setMotion(motion: MotionPref) {
    this.set({ motion });
  }
  reset() {
    this.t = 0.05;
    this.emitFrame();
  }
  /** Fija un instante (p. ej. para estados estáticos de impresión). */
  seek(t: number) {
    this.t = t;
    this.emitFrame();
  }

  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };

  /** Suscripción por cuadro (para canvas/WebGL sin re-render de React). */
  onFrame(l: (t: number) => void) {
    this.frameListeners.add(l);
    this.start();
    l(this.t);
    return () => {
      this.frameListeners.delete(l);
    };
  }

  private emitFrame() {
    this.frameListeners.forEach((l) => l(this.t));
  }

  private start() {
    if (this.raf || typeof window === 'undefined') return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  private loop(now: number) {
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    if (this.running) {
      // movimiento reducido: animación a media velocidad
      const k = this.ui.motion === 'reduced' ? 0.5 : 1;
      this.t += dt * this.ui.speed * k;
      this.emitFrame();
    }
    this.raf = requestAnimationFrame(this.loop);
  }
}

export const sim = new SimStore();

export function useSim() {
  return useSyncExternalStore(sim.subscribe, () => sim.state);
}
