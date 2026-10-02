import { useCallback, useEffect, useRef, useState } from 'react';
import { ValveSenseEngine, type EngineSnapshot } from '../engine/ValveSenseEngine';
import type { ExperimentalMode } from '../types/valvesense';

const UI_HZ = 10;

/** Hook React que expone el motor de ValveSense con refresco a 10 Hz. */
export function useValveSense() {
  const engineRef = useRef<ValveSenseEngine | null>(null);
  if (!engineRef.current) engineRef.current = new ValveSenseEngine();
  const engine = engineRef.current;
  const [snap, setSnap] = useState<EngineSnapshot>(() => engine.snapshot());

  useEffect(() => {
    engine.connectSimulation();
    let ticks = 0;
    const id = setInterval(() => {
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

  return { snap, engine, setMode, setBpm, connectSimulation, connectEsp32, recaptureBaseline };
}
