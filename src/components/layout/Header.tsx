import { useState, type ReactNode } from 'react';
import { ModeSwitch } from '../shared/ModeSwitch';
import { IconBrain, IconHeart, IconHistory, IconPause, IconPerson, IconPlay, IconRotate, IconSound, IconSpark, IconValve, IconVibration } from '../ui/icons';
import type { EngineSnapshot } from '../../engine/ValveSenseEngine';
import type { ConnectionStatus } from '../../types/valvesense';

interface Props {
  snap: EngineSnapshot;
  onSimulation: () => void;
  onEsp32: (url: string) => void;
}

const STATUS: Record<ConnectionStatus, { dot: string; text: string }> = {
  simulated: { dot: 'sim', text: 'Simulación activa' },
  disconnected: { dot: '', text: 'Desconectado' },
  connecting: { dot: 'warn', text: 'Conectando…' },
  connected: { dot: 'live', text: 'Conectado' },
  error: { dot: 'err', text: 'Sin conexión con el ESP32' },
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

export const NAV: { id: string; label: string; icon: ReactNode }[] = [
  { id: 'sec-hero', label: 'Válvula', icon: <IconValve size={15} /> },
  { id: 'sec-01', label: 'Latidos', icon: <IconHeart size={15} /> },
  { id: 'sec-02', label: 'Movimiento', icon: <IconRotate size={15} /> },
  { id: 'sec-03', label: 'Vibración', icon: <IconVibration size={15} /> },
  { id: 'sec-04', label: 'Sonido', icon: <IconSound size={15} /> },
  { id: 'sec-05', label: 'Análisis', icon: <IconBrain size={15} /> },
  { id: 'sec-06', label: 'Paciente', icon: <IconPerson size={15} /> },
  { id: 'sec-07', label: 'Historial', icon: <IconHistory size={15} /> },
];

export const scrollToSection = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

interface HeaderProps extends Props {
  paused: boolean;
  onPause: (p: boolean) => void;
  onLearn: () => void;
}

export function Header({ snap, onSimulation, onEsp32, paused, onPause, onLearn }: HeaderProps) {
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
            <div className="brand-tag">Laboratorio interactivo · válvula aórtica trivalva</div>
          </div>
        </div>

        <ModeSwitch active="lab" />

        <div className="header-meta">
          <div className="segmented" role="tablist" aria-label="Origen de los datos">
            <button className={isSim ? 'active' : ''} onClick={onSimulation} role="tab" aria-selected={isSim}>
              Simulación
            </button>
            <button className={!isSim ? 'active' : ''} onClick={() => onEsp32(url)} role="tab" aria-selected={!isSim} title="Datos del prototipo (ESP32)">
              Prototipo
            </button>
          </div>
          {!isSim && (
            <span className="pill" title={snap.statusDetail}>
              <span className={`dot ${st.dot}`} />
              <strong>{st.text}</strong>
            </span>
          )}
          <button type="button" className={`btn${paused ? ' on' : ''}`} onClick={() => onPause(!paused)} aria-pressed={paused}>
            {paused ? <IconPlay size={13} /> : <IconPause size={13} />}
            <span className="hide-sm">{paused ? 'Reanudar' : 'Pausar'}</span>
          </button>
          <button type="button" className="btn primary" onClick={onLearn}>
            <IconSpark size={15} />
            <span>
              Aprender<span className="hide-sm"> cómo funciona</span>
            </span>
          </button>
        </div>
      </div>
      <nav className="container section-nav" aria-label="Secciones">
        {NAV.map((n) => (
          <button key={n.id} type="button" onClick={() => scrollToSection(n.id)}>
            {n.icon}
            {n.label}
          </button>
        ))}
      </nav>

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
            <span className="note">{snap.statusDetail ?? 'WebSocket JSON — ver README §4'}</span>
          </div>
        </div>
      )}
    </header>
  );
}
