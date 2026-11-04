import { useEffect, useRef, useState } from 'react';
import { LiveEngine, type LiveSnapshot } from './LiveEngine';

/** Hook React: expone el motor y refresca la interfaz a 10 Hz. */
export function useLive() {
  const ref = useRef<LiveEngine | null>(null);
  if (!ref.current) ref.current = new LiveEngine();
  const engine = ref.current;
  const [snap, setSnap] = useState<LiveSnapshot>(() => engine.snapshot());

  useEffect(() => {
    const id = setInterval(() => setSnap(engine.snapshot()), 100);
    return () => {
      clearInterval(id);
      void engine.disconnect();
    };
  }, [engine]);

  return { engine, snap };
}
