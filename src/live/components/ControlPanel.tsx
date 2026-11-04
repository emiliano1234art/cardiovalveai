import { MODE_LABEL } from '../config';
import type { AngleSource, LiveSnapshot } from '../LiveEngine';
import type { ValveMode } from '../types';

interface Props {
  snap: LiveSnapshot;
  onMode: (m: ValveMode) => void;
  onSource: (s: AngleSource) => void;
  onCommand: (c: 'START' | 'STOP') => void;
}

const MODES: { id: ValveMode; sub: string }[] = [
  { id: 'SANO', sub: 'Abre completamente, como debería' },
  { id: 'INCOMPLETA', sub: 'Abre solo una parte' },
];

export function ControlPanel({ snap, onMode, onSource, onCommand }: Props) {
  const paused = snap.sample ? !snap.sample.active : false;
  return (
    <section className="lv-card">
      <div className="lv-card-head">
        <div>
          <h2 className="lv-card-title">Modo de la válvula</h2>
          <p className="lv-card-sub">Cambia cómo se abre el servo y lo que muestra el dashboard</p>
        </div>
      </div>
      <div className="lv-modes" role="radiogroup" aria-label="Modo de la válvula">
        {MODES.map((m) => (
          <button
            key={m.id}
            role="radio"
            aria-checked={snap.mode === m.id}
            className={`lv-mode ${snap.mode === m.id ? 'active' : ''} ${m.id === 'INCOMPLETA' ? 'bad' : ''}`}
            onClick={() => onMode(m.id)}
          >
            <span className="lv-mode-name">{MODE_LABEL[m.id]}</span>
            <span className="lv-mode-sub">{m.sub}</span>
            <span className="lv-mode-deg">{snap.angles[m.id].toFixed(0)}°</span>
          </button>
        ))}
      </div>

      <div className="lv-row">
        <span className="lv-kicker">Ángulo mostrado según</span>
        <div className="lv-seg" role="radiogroup" aria-label="Fuente del ángulo mostrado">
          <button role="radio" aria-checked={snap.angleSource === 'hall'} className={snap.angleSource === 'hall' ? 'active' : ''} onClick={() => onSource('hall')}>
            Imanes (Hall)
          </button>
          <button role="radio" aria-checked={snap.angleSource === 'servo'} className={snap.angleSource === 'servo' ? 'active' : ''} onClick={() => onSource('servo')}>
            Servo
          </button>
        </div>
      </div>

      <div className="lv-row">
        <span className="lv-kicker">Movimiento del servo</span>
        <div className="lv-actions">
          <button className="lv-btn" onClick={() => onCommand('START')} disabled={snap.link !== 'connected' || !paused}>
            ▶ Iniciar
          </button>
          <button className="lv-btn" onClick={() => onCommand('STOP')} disabled={snap.link !== 'connected' || paused}>
            ■ Detener
          </button>
        </div>
      </div>
      <p className="lv-note">
        Modo demostración: con cualquier señal del imán se informa el ángulo del modo elegido. El ángulo que realmente miden los sensores se muestra aparte, en “Sensores Hall”.
      </p>
    </section>
  );
}
