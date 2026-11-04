import type { LiveSnapshot } from '../LiveEngine';
import { webSerialAvailable } from '../sources/SerialSource';

interface Props {
  snap: LiveSnapshot;
  onUsb: () => void;
  onDemo: () => void;
  onDisconnect: () => void;
}

export function Logo() {
  return (
    <svg className="lv-logo" viewBox="0 0 40 40" aria-hidden>
      <defs>
        <linearGradient id="lvlg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4cc3ff" />
          <stop offset="1" stopColor="#1fd1c4" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill="url(#lvlg)" />
      <circle cx="20" cy="20" r="11" fill="none" stroke="#04131a" strokeWidth="2.2" />
      <path d="M20 9.5v21" stroke="#04131a" strokeWidth="2" strokeLinecap="round" opacity=".7" />
      <path d="M8 22h6l2.5-6 3.5 11 3-8 2 3h7" fill="none" stroke="#04131a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function TopBar({ snap, onUsb, onDemo, onDisconnect }: Props) {
  const connected = snap.link === 'connected';
  const live = connected && snap.lastSampleAgeMs < 1500;
  const dot = snap.link === 'error' ? 'err' : snap.link === 'connecting' ? 'warn' : live ? 'live' : connected ? 'warn' : '';
  const label =
    snap.link === 'connecting' ? 'Conectando…'
    : connected ? (snap.linkKind === 'demo' ? 'Demo · datos simulados' : live ? 'ESP32 conectado por USB' : 'Conectado · esperando datos…')
    : snap.link === 'error' ? 'Sin conexión'
    : 'Desconectado';

  return (
    <header className="lv-top">
      <div className="lv-wrap lv-top-row">
        <div className="lv-brand">
          <Logo />
          <div>
            <div className="lv-brand-name">
              Valve<span>Sense</span>
            </div>
            <div className="lv-brand-tag">Monitor de apertura valvular · Servo + sensores Hall</div>
          </div>
        </div>
        <div className="lv-top-actions">
          <span className="lv-pill" title={snap.linkDetail}>
            <span className={`lv-dot ${dot}`} />
            {label}
          </span>
          {!connected ? (
            <>
              <button className="lv-btn primary" onClick={onUsb} disabled={snap.link === 'connecting' || !webSerialAvailable()} title="Conecta el ESP32 con el cable USB">
                Conectar ESP32 (USB)
              </button>
              <button className="lv-btn" onClick={onDemo}>
                Modo demo
              </button>
            </>
          ) : (
            <button className="lv-btn" onClick={onDisconnect}>
              Desconectar
            </button>
          )}
        </div>
      </div>
      {(snap.link === 'error' || !webSerialAvailable()) && (
        <div className="lv-notice">
          {!webSerialAvailable()
            ? 'Este navegador no permite la conexión USB directa. Abre el dashboard en Chrome o Edge (computador). El modo demo funciona en cualquiera.'
            : snap.linkDetail}
        </div>
      )}
    </header>
  );
}
