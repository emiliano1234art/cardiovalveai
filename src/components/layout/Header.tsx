import { useState } from 'react';
import type { EngineSnapshot } from '../../engine/ValveSenseEngine';
import type { ConnectionStatus } from '../../types/valvesense';

interface Props {
  snap: EngineSnapshot;
  onSimulation: () => void;
  onEsp32: (url: string) => void;
  onBpm: (bpm: number) => void;
}

const STATUS: Record<ConnectionStatus, { dot: string; text: string }> = {
  simulated: { dot: 'sim', text: 'No conectado · simulación activa' },
  disconnected: { dot: '', text: 'Desconectado' },
  connecting: { dot: 'warn', text: 'Conectando…' },
  connected: { dot: 'live', text: 'Conectado' },
  error: { dot: 'err', text: 'Sin conexión' },
};

export function Logo() {
  return (
    <svg className="brand-mark" viewBox="0 0 40 40" aria-hidden>
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0a6f95" />
          <stop offset="1" stopColor="#10a2a0" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill="url(#lg)" />
      <circle cx="20" cy="20" r="11" fill="none" stroke="#fff" strokeWidth="2.2" opacity=".95" />
      <path d="M20 9.5v21" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity=".7" />
      <path d="M8 22h6l2.5-6 3.5 11 3-8 2 3h7" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Header({ snap, onSimulation, onEsp32, onBpm }: Props) {
  const [url, setUrl] = useState('ws://192.168.4.1:81');
  const st = STATUS[snap.status];
  const isSim = snap.sourceKind === 'simulation';

  return (
    <header className="header">
      <div className="container header-row">
        <div className="brand">
          <Logo />
          <div style={{ minWidth: 0 }}>
            <div className="brand-name">
              Valve<span>Sense</span>
            </div>
            <div className="brand-tag">Análisis inteligente de la firma mecánica y acústica valvular</div>
          </div>
        </div>

        <div className="header-meta">
          <span className="pill" title={snap.statusDetail}>
            <span className={`dot ${st.dot}`} />
            ESP32 <strong>{st.text}</strong>
          </span>

          <div className="segmented" role="tablist" aria-label="Origen de datos">
            <button className={isSim ? 'active' : ''} onClick={onSimulation}>
              SIMULACIÓN
            </button>
            <button className={!isSim ? 'active' : ''} onClick={() => onEsp32(url)}>
              DATOS REALES
            </button>
          </div>

          <span className="pill">
            Frecuencia programada
            <span className="stepper">
              <button disabled={!isSim || snap.bpmProgrammed <= 40} onClick={() => onBpm(snap.bpmProgrammed - 2)} aria-label="Disminuir">
                −
              </button>
              <strong className="num" style={{ minWidth: 52, textAlign: 'center' }}>
                {snap.bpmProgrammed} lpm
              </strong>
              <button disabled={!isSim || snap.bpmProgrammed >= 140} onClick={() => onBpm(snap.bpmProgrammed + 2)} aria-label="Aumentar">
                +
              </button>
            </span>
          </span>
        </div>
      </div>

      {!isSim && (
        <div className="controlbar">
          <div className="container controlbar-row">
            <span className="controlbar-label">Conexión ESP32</span>
            <div className="esp32-config">
              <input value={url} onChange={(e) => setUrl(e.target.value)} spellCheck={false} aria-label="URL WebSocket del ESP32" />
              <button className="btn primary" onClick={() => onEsp32(url)}>
                Conectar
              </button>
            </div>
            <span className="note">{snap.statusDetail ?? 'Protocolo WebSocket JSON — ver README §4'}</span>
          </div>
        </div>
      )}
    </header>
  );
}
