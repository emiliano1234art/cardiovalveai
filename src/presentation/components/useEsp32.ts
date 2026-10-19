import { useCallback, useEffect, useRef, useState } from 'react';
import { RingBuffer } from '../../lib/RingBuffer';
import { Esp32WebSocketSource } from '../../sources/Esp32WebSocketSource';
import type { ConnectionStatus } from '../../types/valvesense';

export interface RealBuffers {
  count: () => number;
  snapshot: (windowS: number) => { piezo: Float32Array; audio: Float32Array };
}

/**
 * Conexión real al prototipo (conservada del dashboard v1): WebSocket del ESP32
 * con el protocolo JSON documentado en el README. Sin conexión → estado
 * «Sin conexión al prototipo» y las señales mostradas son SIMULACIÓN.
 */
export function useEsp32() {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [detail, setDetail] = useState<string | undefined>();
  const [chunks, setChunks] = useState(0);
  const src = useRef<Esp32WebSocketSource | null>(null);
  const bufs = useRef({ piezo: new RingBuffer(1000 * 4), audio: new RingBuffer(8000 * 4), fsP: 1000, fsA: 8000, n: 0 });

  const disconnect = useCallback(() => {
    src.current?.stop();
    src.current = null;
    setStatus('disconnected');
    setDetail(undefined);
    bufs.current.n = 0;
    setChunks(0);
  }, []);

  const connect = useCallback(
    (url: string) => {
      disconnect();
      const s = new Esp32WebSocketSource(url);
      s.onStatus((st, d) => {
        setStatus(st);
        setDetail(d);
      });
      s.onChunk((c) => {
        const b = bufs.current;
        b.fsP = c.fs_piezo;
        b.fsA = c.fs_audio;
        b.piezo.push(c.piezo);
        b.audio.push(c.audio);
        b.n++;
        if (b.n % 10 === 1) setChunks(b.n);
      });
      src.current = s;
      s.start();
    },
    [disconnect],
  );

  useEffect(() => () => src.current?.stop(), []);

  const real: RealBuffers = {
    count: () => bufs.current.n,
    snapshot: (w) => {
      const b = bufs.current;
      const tail = (r: RingBuffer, n: number) => {
        const all = r.toArray();
        return all.subarray(Math.max(0, all.length - n));
      };
      return { piezo: tail(b.piezo, Math.round(w * b.fsP)), audio: tail(b.audio, Math.round(w * b.fsA)) };
    },
  };

  return { status, detail, chunks, connect, disconnect, real: status === 'connected' ? real : null };
}
