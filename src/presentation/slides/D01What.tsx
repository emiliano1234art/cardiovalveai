import { useEffect, useState } from 'react';
import { PX } from '../explain';
import { useDeck } from '../components/deck';
import { Explain, Screen } from '../components/screen';
import { ProblemIcon } from '../components/Thumbs';
import { ValveSVG } from '../components/ValveSVG';

const CONCEPTS = [
  { id: 'valve', t: 'Válvula', d: 'Aórtica experimental de tres valvas' },
  { id: 'sensors', t: 'Sensores', d: 'Vibración y sonido de cada ciclo' },
  { id: 'ai', t: 'IA', d: 'Reconoce cambios respecto de una referencia' },
];

const FLOW = [
  { t: 'Válvula', s: 'abre y cierra' },
  { t: 'Piezo + MEMS', s: 'vibración + sonido' },
  { t: 'ESP32', s: 'adquiere y envía' },
  { t: 'Análisis', s: 'compara ciclos' },
  { t: 'Dashboard', s: 'muestra cambios' },
];

export function D01What() {
  const { print, openDashboard } = useDeck();
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (print) return;
    const id = setInterval(() => setStep((s) => (s + 1) % FLOW.length), 1400);
    return () => clearInterval(id);
  }, [print]);

  return (
    <Screen num={1} kicker="CardioValveAI" title="¿Qué es CardioValveAI?" actions={<Explain label="¿Cómo funciona?" content={PX.what} />}>
      <div className="v-col" style={{ gap: 26, height: '100%', justifyContent: 'space-around' }}>
        <div className="v-concepts">
          {CONCEPTS.map((c, i) => (
            <div key={c.id} className="v-concept-wrap">
              <div className="v-concept">
                <div className="v-concept-visual">
                  {c.id === 'valve' && <ValveSVG view="top" size={170} />}
                  {c.id === 'sensors' && (
                    <div className="v-concept-sensors">
                      <ProblemIcon kind="waves" size={130} />
                      <div>
                        <span style={{ color: 'var(--sig-vib)' }}>Piezo · vibración</span>
                        <span style={{ color: 'var(--sig-snd)' }}>MEMS · sonido</span>
                      </div>
                    </div>
                  )}
                  {c.id === 'ai' && (
                    <svg viewBox="0 0 120 120" width={150} height={150} aria-hidden>
                      <circle cx="60" cy="60" r="44" fill="#ecfeff" stroke="#0891b2" strokeWidth="3" />
                      {[
                        [40, 44],
                        [80, 44],
                        [60, 60],
                        [42, 80],
                        [78, 80],
                      ].map(([x, y], k, arr) => (
                        <g key={k}>
                          {arr.slice(k + 1).map(([x2, y2], j) => (
                            <line key={j} x1={x} y1={y} x2={x2} y2={y2} stroke="#0891b2" strokeWidth="1.4" opacity=".5" />
                          ))}
                          <circle cx={x} cy={y} r="6" fill="#0d9488" className="v-anim-pulse" style={{ animationDelay: `${k * 0.25}s` }} />
                        </g>
                      ))}
                    </svg>
                  )}
                </div>
                <b>{c.t}</b>
                <span>{c.d}</span>
              </div>
              {i < CONCEPTS.length - 1 && <div className="v-concept-arrow">→</div>}
            </div>
          ))}
        </div>
        <p className="v-statement">Analizamos los sonidos y vibraciones de una válvula experimental para reconocer cambios en su funcionamiento.</p>
        <div className="v-flowline" role="list" aria-label="Flujo de datos">
          {FLOW.map((f, i) => (
            <div key={f.t} className={`v-flowline-node${!print && i === step ? ' on' : ''}${!print && i < step ? ' done' : ''}`} role="listitem">
              <i>{i + 1}</i>
              <b>{f.t}</b>
              <span>{f.s}</span>
              {i < FLOW.length - 1 && <em className="v-flowline-link" />}
            </div>
          ))}
          <button className="v-btn sm" onClick={openDashboard} style={{ marginLeft: 16, flex: 'none' }}>
            Abrir dashboard experimental
          </button>
        </div>
      </div>
    </Screen>
  );
}
