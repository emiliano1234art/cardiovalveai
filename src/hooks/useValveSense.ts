import { useCallback, useEffect, useRef, useState } from 'react';
import { ValveSenseEngine, type EngineSnapshot } from '../engine/ValveSenseEngine';
import { sim } from '../presentation/sim/store';
import type { ExperimentalMode } from '../types/valvesense';

const UI_HZ = 10;

/** Hook React que expone el motor de CardioValveAI con refresco a 10 Hz. */
export function useValveSense() {
  const engineRef = useRef<ValveSenseEngine | null>(null);
  if (!engineRef.current) engineRef.current = new ValveSenseEngine();
  const engine = engineRef.current;
  const [snap, setSnap] = useState<EngineSnapshot>(() => engine.snapshot());
  const [paused, setPausedState] = useState(false);
  const pausedRef = useRef(false);

  useEffect(() => {
    sim.setPlaying(true);
    engine.connectSimulation();
    let ticks = 0;
    const id = setInterval(() => {
      // en pausa, la vista queda congelada (también con datos reales del ESP32)
      if (pausedRef.current) return;
      if (++ticks % UI_HZ === 0) engine.tickPatient(1);
      setSnap(engine.snapshot());
    }, 1000 / UI_HZ);
    return () => {
      clearInterval(id);
      engine.stop();
    };
  }, [engine]);

  const setMode = useCallback((m: ExperimentalMode) => engine.setMode(m), [engine]);
  const setBpm = useCallback((b: number) => engine.setBpm(b), [engine]);
  const connectSimulation = useCallback(() => engine.connectSimulation(), [engine]);
  const connectEsp32 = useCallback((url: string) => engine.connectEsp32(url), [engine]);
  const recaptureBaseline = useCallback(() => engine.recaptureBaseline(), [engine]);
  const setTarget = useCallback((t: 0 | 1 | 2) => engine.setTarget(t), [engine]);
  const setTiming = useCallback((patch: Parameters<ValveSenseEngine['setTiming']>[0]) => engine.setTiming(patch), [engine]);

  const setFollowPatient = useCallback((on: boolean) => engine.setFollowPatient(on), [engine]);

  /** Pausa/reanuda las señales: detiene la simulación y congela la vista. */
  const setPaused = useCallback(
    (p: boolean) => {
      pausedRef.current = p;
      setPausedState(p);
      sim.setPlaying(!p);
      if (!p) setSnap(engine.snapshot());
    },
    [engine],
  );

  return { snap, setTarget, paused, setPaused, setFollowPatient, engine, setMode, setBpm, setTiming, connectSimulation, connectEsp32, recaptureBaseline };
}
