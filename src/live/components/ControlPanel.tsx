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
  { id: 'SANO', sub: 'Se abre completa, como una válvula sana' },
  { id: 'INCOMPLETA', sub: 'Se abre solo una parte: deja pasar menos sangre' },
];

export function ControlPanel({ snap, onMode, onSource, onCommand }: Props) {
  const connected = snap.link === 'connected';
  const paused = snap.sample ? !snap.sample.active : true;
  return (
    <section className="lv-card">
      <div className={`lv-start ${connected && !paused ? 'running' : ''}`}>
        <div>
          <div className="lv-start-title">
            {!connected ? 'Conecta el ESP32 para comenzar' : paused ? 'Servo detenido en 0°' : 'Servo en movimiento'}
          </div>
          <div className="lv-start-sub">
            {!connected ? 'Arriba a la derecha: «Conectar ESP32 (USB)» o «Modo demo»' : paused ? 'No se moverá hasta que pulses el botón' : 'Pulsa detener cuando quieras parar'}
          </div>
        </div>
        <button className="lv-btn primary big" disabled={!connected} onClick={() => onCommand(paused ? 'START' : 'STOP')}>
          {paused ? '▶ Iniciar movimiento' : '■ Detener'}
        </button>
      </div>

      <div className="lv-card-head" style={{ marginTop: 16 }}>
        <div>
          <h2 className="lv-card-title">¿Cómo quieres que se abra?</h2>
          <p className="lv-card-sub">Cambia cómo se abre la válvula del prototipo. Puedes cambiarlo en cualquier momento.</p>
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
        <span className="lv-kicker">El ángulo se calcula con</span>
        <div className="lv-seg" role="radiogroup" aria-label="Fuente del ángulo mostrado">
          <button role="radio" aria-checked={snap.angleSource === 'hall'} className={snap.angleSource === 'hall' ? 'active' : ''} onClick={() => onSource('hall')}>
            Imanes (Hall)
          </button>
          <button role="radio" aria-checked={snap.angleSource === 'servo'} className={snap.angleSource === 'servo' ? 'active' : ''} onClick={() => onSource('servo')}>
            Servo
          </button>
        </div>
      </div>

      <p className="lv-note">
        {snap.calibrated
          ? 'El ángulo mostrado es el que miden los imanes: si la válvula abre poco, marca poco; si abre completa, marca completa.'
          : 'Los sensores todavía no están calibrados: en «Sensores Hall» pulsa «Calibrar curva» para que midan el ángulo real.'}
      </p>
    </section>
  );
}
