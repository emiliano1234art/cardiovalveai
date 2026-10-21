import { useEffect, useRef } from 'react';
import { phaseName, rPeak, rrOf } from '../sim/model';
import { sim } from '../sim/store';
import { LiveSignals } from './LiveSignals';
import { ValveSVG } from './ValveSVG';

/** Tiempo (s) desde el último pico R del ECG simulado. */
function sinceR(t: number) {
  const p = sim.state.params;
  let k = Math.floor(t / rrOf(p)) + 1;
  while (rPeak(k, p) > t) k--;
  return t - rPeak(k, p);
}

/**
 * Demostración del sistema en tiempo real con una persona (PROPUESTA):
 * electrodos → módulo ECG aislado a batería → enlace inalámbrico → ESP32 →
 * detección del pico R → retardo τ → servo → válvula. El ECG es simulado.
 */
export function PersonEcgLink({ width = 1110, live = true }: { width?: number; live?: boolean }) {
  const heart = useRef<SVGGElement>(null);
  const mod = useRef<SVGRectElement>(null);
  const esp = useRef<SVGRectElement>(null);
  const servo = useRef<SVGRectElement>(null);
  const espTxt = useRef<SVGTextElement>(null);

  useEffect(() => {
    if (!live) return;
    return sim.onFrame((t) => {
      const dt = sinceR(t);
      const tau = sim.state.params.delayMs / 1000;
      const beat = Math.exp(-dt / 0.09);
      heart.current?.setAttribute('transform', `translate(176 196) scale(${1 + 0.18 * beat})`);
      mod.current?.classList.toggle('on', dt < 0.16);
      esp.current?.classList.toggle('on', dt < tau + 0.05);
      if (espTxt.current) espTxt.current.textContent = dt < tau ? 'R detectado · esperando τ' : 'Comando al servo';
      const ph = phaseName(t, sim.state.params);
      servo.current?.classList.toggle('on', ph === 'apertura' || ph === 'cierre');
    });
  }, [live]);

  return (
    <div className="v-person" style={{ width }}>
      <svg
        viewBox="0 0 1110 360"
        width={width}
        height={(width * 360) / 1110}
        aria-label="Persona con ECG conectada de forma segura al ESP32 que mueve la válvula"
      >
        {/* persona */}
        <g className="v-person-body">
          <circle cx="176" cy="70" r="36" />
          <path d="M96 352 L104 168 Q108 124 150 116 L202 116 Q244 124 248 168 L256 352 Z" />
          <path d="M104 170 L66 290 M248 170 L286 290" className="arm" />
        </g>
        <g ref={heart} transform="translate(176 196)">
          <path d="M0 18 C-26 0 -26 -22 -12 -24 C-6 -25 -2 -21 0 -16 C2 -21 6 -25 12 -24 C26 -22 26 0 0 18 Z" fill="#e11d48" />
        </g>
        {/* electrodos y cables */}
        {[
          [128, 150, 'RA'],
          [224, 150, 'LA'],
          [214, 300, 'LL'],
        ].map(([x, y, l]) => (
          <g key={l as string}>
            <path
              d={`M${x} ${y} C ${(x as number) + 90} ${(y as number) + 30}, 300 ${280 - (l === 'LL' ? -10 : 0)}, 352 ${270 + (l === 'RA' ? -10 : l === 'LA' ? 0 : 10)}`}
              className="v-person-lead"
            />
            <circle cx={x} cy={y} r="9" className="v-person-electrode" />
            <text x={(x as number) - 14} y={(y as number) - 14} className="v-person-small">
              {l}
            </text>
          </g>
        ))}
        {/* módulo ECG aislado */}
        <rect ref={mod} x="352" y="236" width="150" height="70" rx="12" className="v-person-node ecg" />
        <text x="427" y="264" textAnchor="middle" className="v-person-label">
          Módulo ECG
        </text>
        <text x="427" y="286" textAnchor="middle" className="v-person-small">
          aislado · a batería
        </text>
        {/* enlace inalámbrico */}
        <g className="v-person-waves">
          {[0, 1, 2].map((k) => (
            <path key={k} d={`M${528 + k * 18} ${246 - k * 6} q 12 25 0 50`} style={{ animationDelay: `${k * 0.25}s` }} />
          ))}
        </g>
        <text x="555" y="226" textAnchor="middle" className="v-person-small">
          inalámbrico
        </text>
        {/* ESP32 */}
        <rect ref={esp} x="600" y="236" width="170" height="70" rx="12" className="v-person-node esp" />
        <text x="685" y="264" textAnchor="middle" className="v-person-label" style={{ fill: '#fff' }}>
          ESP32
        </text>
        <text ref={espTxt} x="685" y="286" textAnchor="middle" className="v-person-small" style={{ fill: '#a5f3fc' }}>
          detecta el pico R
        </text>
        {/* servo */}
        <path d="M770 271 H 818" className="v-person-wire" />
        <rect ref={servo} x="818" y="246" width="96" height="50" rx="10" className="v-person-node servo" />
        <text x="866" y="276" textAnchor="middle" className="v-person-label" style={{ fill: '#fff' }}>
          Servo
        </text>
        <path d="M914 271 H 944" className="v-person-wire" />
        <text x="1030" y="350" textAnchor="middle" className="v-person-small">
          válvula trivalva
        </text>
        <foreignObject x="950" y="196" width="160" height="150">
          <div style={{ display: 'grid', placeItems: 'center', height: '100%' }}>
            <ValveSVG view="top" size={140} />
          </div>
        </foreignObject>
        {/* cadena */}
        <text x="352" y="200" className="v-person-chain">
          ECG → pico R → retardo τ → servo → apertura y cierre
        </text>
      </svg>
      <div className="v-person-ecg">{live && <LiveSignals width={width - 24} height={96} windowS={3} lanes={['ecg']} />}</div>
      <p className="v-person-safety">
        Seguridad: el ECG de una persona solo se conectaría mediante un módulo aislado, a batería y con enlace inalámbrico. Nunca electrodos conectados a un
        circuito alimentado por USB o la red sin aislamiento. Hoy la demostración usa un ECG simulado.
      </p>
    </div>
  );
}
