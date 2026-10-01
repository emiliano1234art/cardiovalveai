import { MODES, MODE_ORDER } from '../../config/modes';
import type { EngineSnapshot } from '../../engine/ValveSenseEngine';
import type { ExperimentalMode } from '../../types/valvesense';

interface Props {
  snap: EngineSnapshot;
  onMode: (m: ExperimentalMode) => void;
  onRecalibrate: () => void;
}

const SUB: Record<ExperimentalMode, string> = {
  normal: 'Apertura completa · regular',
  limited_opening: 'Menor ángulo de apertura',
  altered_closing: 'Cierre lento · rebote',
  irregular_rhythm: 'Variabilidad entre ciclos',
};

export function ControlBar({ snap, onMode, onRecalibrate }: Props) {
  const isSim = snap.sourceKind === 'simulation';
  const capturing = snap.captureProgress !== null;
  return (
    <>
      <div className="controlbar">
        <div className="container controlbar-row">
          <span className="controlbar-label">Estado experimental</span>
          <div className="modes" role="radiogroup" aria-label="Estado experimental">
            {MODE_ORDER.map((m) => (
              <button
                key={m}
                role="radio"
                aria-checked={snap.mode === m}
                className={`mode-btn${snap.mode === m && isSim ? ' active' : ''}`}
                onClick={() => onMode(m)}
                disabled={!isSim}
                title={MODES[m].description}
              >
                <span className="mode-name">{MODES[m].label}</span>
                <span className="mode-sub">{SUB[m]}</span>
              </button>
            ))}
          </div>
          <div className="controlbar-right">
            <span>
              Línea basal:{' '}
              <strong style={{ color: 'var(--text)' }}>
                {capturing
                  ? `capturando ${Math.round((snap.captureProgress ?? 0) * 100)} %`
                  : snap.baseline
                    ? `${snap.baseline.origin === 'simulated' ? 'calibrada' : 'capturada'} · ${snap.baseline.cycles} ciclos`
                    : '—'}
              </strong>
            </span>
            <button className="btn" onClick={onRecalibrate} disabled={capturing} title="Registrar una nueva línea basal con los próximos 30 ciclos">
              ↻ Recapturar basal
            </button>
          </div>
        </div>
      </div>
      {isSim && (
        <div className="sim-banner">
          <b>SIMULACIÓN</b> Señales sintéticas generadas en el navegador · Prototipo experimental a escala · No es un dispositivo médico ni
          entrega diagnósticos
        </div>
      )}
    </>
  );
}
