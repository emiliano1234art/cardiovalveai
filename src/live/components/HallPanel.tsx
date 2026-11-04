import type { LiveSnapshot } from '../LiveEngine';

interface Props {
  snap: LiveSnapshot;
  onCommand: (c: 'CAL_ZERO' | 'CAL_CURVE') => void;
  onDemoHall: (on: boolean) => void;
}

const NAMES = ['Hall 1', 'Hall 2', 'Hall 3'];
const PINS = ['GPIO 34', 'GPIO 35', 'GPIO 32'];

export function HallPanel({ snap, onCommand, onDemoHall }: Props) {
  const s = snap.sample;
  const w = s?.hallW ?? [0, 0, 0];
  const raw = s?.hallRaw ?? [0, 0, 0];
  const total = w[0] + w[1] + w[2];
  const neutral = total < 0.05;
  const usb = snap.link === 'connected' && snap.linkKind === 'usb';

  return (
    <section className="lv-card">
      <div className="lv-card-head">
        <div>
          <h2 className="lv-card-title">Sensores Hall</h2>
          <p className="lv-card-sub">Detectan los imanes pegados a las valvas. Cuando las valvas se mueven, las barras se llenan.</p>
        </div>
        <span className={`lv-chip ${neutral ? '' : 'ok'}`}>{neutral ? 'Neutro · sin imán' : 'Imán detectado'}</span>
      </div>

      <div className="lv-hall-main">
        <div>
          <div className="lv-big num">
            {snap.hallShown.toFixed(1)}
            <span>°</span>
          </div>
          <div className="lv-kicker">{snap.demoHall ? 'Ángulo de apertura · demostración' : 'Ángulo medido por los Hall'}</div>
        </div>
        <div className="lv-hall-bars">
          {NAMES.map((n, i) => (
            <div className="lv-hall-row" key={n}>
              <span className="lv-hall-name">
                {n} <small>{PINS[i]}</small>
              </span>
              <div className="lv-track">
                <div className="lv-fill" style={{ width: `${Math.round(w[i] * 100)}%` }} />
              </div>
              <span className="num lv-hall-val">{raw[i] ? raw[i] : '—'}</span>
            </div>
          ))}
        </div>
      </div>

      <label className="lv-check" style={{ marginTop: 0, marginBottom: 6 }}>
        <input type="checkbox" checked={snap.demoHall} onChange={(e) => onDemoHall(e.target.checked)} />
        Modo demostración: mostrar el valor del modo elegido (normal 80–90°, incompleta 50–60°)
      </label>
      {snap.demoHall && (
        <p className="lv-demo-note">
          El ángulo de arriba es un <b>valor de demostración</b> según el modo, no la lectura del sensor. Los números de las barras sí son lecturas reales de los Hall.
        </p>
      )}

      <div className="lv-actions">
        <button className="lv-btn" onClick={() => onCommand('CAL_ZERO')} disabled={!usb || snap.calibrating} title="Con la válvula cerrada y quieta, vuelve a medir el valor neutro">
          1 · Calibrar neutro
        </button>
        <button
          className="lv-btn primary"
          disabled={!usb || snap.calibrating}
          title="El servo recorre todo su rango y el ESP32 aprende qué leen los sensores en cada ángulo"
          onClick={() => {
            if (window.confirm(`El servo se moverá solo de 0° a ${snap.angles.SANO.toFixed(0)}° durante unos 30 segundos.\n\nAntes: válvula cerrada, libre de obstáculos y ya calibrado el neutro.\n\n¿Empezar?`)) onCommand('CAL_CURVE');
          }}
        >
          2 · Calibrar curva (≈30 s)
        </button>
      </div>
      {snap.calibrating ? (
        <p className="lv-note">
          <b>Calibrando… {snap.calProgress} %</b> · el servo se mueve solo, no lo toques. Pulsa «Detener» arriba si quieres cancelar.
        </p>
      ) : (
        <p className="lv-note">
          Curva de ángulo: <b>{snap.calibrated ? 'calibrada ✓ (los sensores miden el ángulo real)' : 'sin calibrar (aproximado)'}</b>
        </p>
      )}
      {snap.info && <p className="lv-note">ESP32: {snap.info}</p>}
      {!usb && <p className="lv-note">La calibración está disponible con el ESP32 conectado por USB.</p>}
    </section>
  );
}
