import { useEffect, useMemo, useRef } from 'react';
import { Cite, SlideHead, useDeck } from '../components/deck';
import { PhaseCursor, Plot, pathFrom } from '../components/Plot';
import { ValveSVG } from '../components/ValveSVG';
import { Visual3D } from '../components/Visual3D';
import { ecgAt, rPeak, rrOf, type SimParams } from '../sim/model';
import { pressures } from '../sim/physiology';
import { sim, useSim } from '../sim/store';

/** Esquema anatómico simplificado: ventrículo izquierdo, válvula aórtica (3 valvas) y aorta. */
function Anatomy({ static: isStatic }: { static?: boolean }) {
  const cusps = useRef<(SVGPathElement | null)[]>([]);
  const lvT = useRef<SVGTextElement>(null);
  const aoT = useRef<SVGTextElement>(null);
  const flow = useRef<SVGGElement>(null);
  const state = useRef<SVGTextElement>(null);

  useEffect(() => {
    const draw = (t: number) => {
      const p = sim.state.params;
      const pr = isStatic ? { lv: 118, ao: 115, open: true } : pressures(t, p);
      // apertura (0–1) suavizada según el gradiente de presión
      const k = isStatic ? 1 : Math.max(0, Math.min(1, (pr.lv - pr.ao + 4) / 8)) * (pr.open ? 1 : 0.15);
      const a = 70 * k;
      cusps.current.forEach((el, i) => {
        if (!el) return;
        const s = i === 0 ? -1 : 1;
        const hx = 210 + s * 46;
        const ang = ((90 - a) * Math.PI) / 180;
        const tx = hx - s * 44 * Math.sin(ang);
        const ty = 150 - 44 * Math.cos(ang);
        el.setAttribute('d', `M${hx} 150 Q ${(hx + tx) / 2} ${ty + 22} ${tx} ${ty}`);
      });
      if (lvT.current) lvT.current.textContent = `P VI ${pr.lv.toFixed(0)} mmHg`;
      if (aoT.current) aoT.current.textContent = `P Ao ${pr.ao.toFixed(0)} mmHg`;
      if (flow.current) flow.current.style.opacity = String(k * 0.9);
      if (state.current) state.current.textContent = pr.open ? 'P VI > P Ao → ABIERTA' : 'P VI < P Ao → CERRADA';
    };
    if (isStatic) {
      draw(0);
      return;
    }
    return sim.onFrame(draw);
  }, [isStatic]);

  return (
    <svg viewBox="0 0 420 350" width="100%" role="img" aria-label="Esquema: ventrículo izquierdo, válvula aórtica y aorta">
      <defs>
        <linearGradient id="lvg" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#fecdd3" />
          <stop offset="1" stopColor="#fda4af" />
        </linearGradient>
        <linearGradient id="aog" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#fee2e2" />
          <stop offset="1" stopColor="#fecaca" />
        </linearGradient>
      </defs>
      {/* aorta */}
      <path d="M164 150 L164 40 Q164 14 190 14 L230 14 Q256 14 256 40 L256 150 Z" fill="url(#aog)" stroke="#e11d48" strokeWidth={2} opacity={0.9} />
      {/* ventrículo */}
      <path d="M150 150 L270 150 Q330 170 320 230 Q300 312 210 318 Q120 312 100 230 Q90 170 150 150 Z" fill="url(#lvg)" stroke="#e11d48" strokeWidth={2} />
      {/* anillo valvular */}
      <line x1="160" x2="260" y1="150" y2="150" stroke="#9f1239" strokeWidth={4} strokeLinecap="round" />
      {/* valvas (vista de corte: 2 de las 3 visibles) */}
      {[0, 1].map((i) => (
        <path
          key={i}
          ref={(el) => {
            cusps.current[i] = el;
          }}
          d="M164 150 Q 190 172 210 150"
          fill="none"
          stroke="#881337"
          strokeWidth={4}
          strokeLinecap="round"
        />
      ))}
      <g ref={flow} style={{ opacity: 0 }}>
        {[190, 210, 230].map((x) => (
          <path key={x} d={`M${x} 250 L${x} 70 m-7 12 l7 -12 l7 12`} fill="none" stroke="#0891b2" strokeWidth={3} strokeLinecap="round" />
        ))}
      </g>
      <text x="268" y="62" fontSize="15" fontWeight="700" fill="#9f1239">
        Aorta
      </text>
      <text ref={aoT} x="268" y="82" fontSize="14" fill="#334155">
        P Ao
      </text>
      <text x="8" y="262" fontSize="15" fontWeight="700" fill="#9f1239">
        Ventrículo
      </text>
      <text x="8" y="279" fontSize="15" fontWeight="700" fill="#9f1239">
        izquierdo
      </text>
      <text ref={lvT} x="8" y="298" fontSize="14" fill="#334155">
        P VI
      </text>
      <text x="8" y="112" fontSize="14" fontWeight="650" fill="#334155">
        Válvula aórtica
      </text>
      <text x="8" y="129" fontSize="13" fill="#64748b">
        3 valvas (vista de corte)
      </text>
      <text ref={state} x="210" y="344" fontSize="14" fontWeight="700" fill="#0891b2" textAnchor="middle" />
    </svg>
  );
}

function PressurePlot({ p, w, h, cursor }: { p: SimParams; w: number; h: number; cursor: boolean }) {
  const b = 3;
  const r0 = rPeak(b, p);
  const RR = rrOf(p);
  const data = useMemo(() => {
    const ts = Array.from({ length: 400 }, (_, i) => (i / 399) * RR);
    const pr = ts.map((x) => pressures(r0 + x, p));
    return { ts, lv: pr.map((q) => q.lv), ao: pr.map((q) => q.ao), ecg: ts.map((x) => ecgAt(r0 + x, p)), open: pr };
  }, [p, r0, RR]);
  const o0 = data.open.findIndex((q) => q.open);
  const o1 = data.open.length - 1 - [...data.open].reverse().findIndex((q) => q.open);
  return (
    <div>
      <Plot width={w} height={70} x={[0, RR]} y={[-0.4, 1.3]} xTicks={[]} margin={{ l: 70, r: 16, t: 6, b: 4 }} yLabel="ECG">
        {(s) => (
          <>
            <path d={pathFrom(data.ts, data.ecg, s.sx, s.sy)} fill="none" stroke="var(--sig-ecg)" strokeWidth={1.6} />
            <text x={s.sx(0) + 6} y={s.y0 + 12} style={{ fill: 'var(--sig-ecg)', fontWeight: 700 }}>
              R
            </text>
            <PhaseCursor s={s} T={RR} show={cursor} />
          </>
        )}
      </Plot>
      <Plot width={w} height={h} x={[0, RR]} y={[0, 130]} yTicks={[0, 40, 80, 120]} xTicks={[0, RR / 2, RR]} xFmt={(v) => `${(v * 1000).toFixed(0)} ms`} xLabel="tiempo desde el pico R" yLabel="mmHg (ilustrativo)">
        {(s) => (
          <>
            {o0 >= 0 && <rect x={s.sx(data.ts[o0])} y={s.y0} width={s.sx(data.ts[o1]) - s.sx(data.ts[o0])} height={s.h} fill="rgba(8,145,178,.08)" />}
            {o0 >= 0 && (
              <text x={(s.sx(data.ts[o0]) + s.sx(data.ts[o1])) / 2} y={s.y0 + 14} textAnchor="middle" style={{ fill: 'var(--cyan)', fontWeight: 700 }}>
                válvula abierta
              </text>
            )}
            <path d={pathFrom(data.ts, data.ao, s.sx, s.sy)} fill="none" stroke="#e11d48" strokeWidth={2.4} />
            <path d={pathFrom(data.ts, data.lv, s.sx, s.sy)} fill="none" stroke="#2563eb" strokeWidth={2.4} />
            <PhaseCursor s={s} T={RR} show={cursor} />
          </>
        )}
      </Plot>
      <div className="v-legend" style={{ fontSize: 14, paddingLeft: 70 }}>
        <span>
          <i style={{ background: '#2563eb' }} />P ventrículo izq.
        </span>
        <span>
          <i style={{ background: '#e11d48' }} />P aórtica
        </span>
      </div>
    </div>
  );
}

const ROWS: [string, string, string, string][] = [
  ['Valvas', '3 valvas de tejido', '2 valvas rígidas', '2 valvas impresas en 3D'],
  ['Qué la mueve', 'Gradiente de presión (pasiva)', 'Gradiente de presión (pasiva)', 'Actuador (servo) — sin presión'],
  ['Sonido y vibración', 'Ruidos cardíacos', 'Clics característicos de apertura y cierre', 'Clics registrados por piezo y MEMS'],
  ['Para qué la usamos', 'Referencia fisiológica', 'Inspiración del diseño', 'Prototipo experimental'],
];

export function S02RealValve() {
  const { print } = useDeck();
  const { params } = useSim();
  return (
    <div className="v-slide" style={{ paddingTop: 44 }}>
      <SlideHead num={2} kicker="Funcionamiento real de la válvula" title="Las válvulas reales no tienen motor: las mueve la presión" />
      <div className="v-body" style={{ display: 'grid', gridTemplateColumns: '430px 1fr 470px', gap: 20, minHeight: 0 }}>
        <div className="v-panel" style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div className="v-panel-title" style={{ margin: 0 }}>
            Válvula aórtica natural
          </div>
          <Anatomy static={print} />
          <ul className="v-list" style={{ fontSize: 15.5, gap: 4 }}>
            <li>
              <b>Sístole:</b> cuando la presión del ventrículo supera la aórtica, la válvula se abre.
            </li>
            <li>
              <b>Fin de la eyección:</b> el gradiente se invierte y la válvula se cierra.
              <Cite ids={['statpearls']} />
            </li>
          </ul>
        </div>

        <div className="v-col" style={{ gap: 12, minHeight: 0 }}>
          <div className="v-panel" style={{ padding: '10px 14px 6px' }}>
            <div className="v-row" style={{ justifyContent: 'space-between' }}>
              <div className="v-panel-title" style={{ margin: 0 }}>
                El ECG precede a la apertura
              </div>
              <span className="v-tag sim">Curvas ilustrativas</span>
            </div>
            <PressurePlot p={params} w={496} h={250} cursor={!print} />
            <div className="v-tiny" style={{ fontSize: 13.5 }}>
              La actividad eléctrica (pico R) inicia la contracción; la válvula abre recién cuando la presión ventricular supera la aórtica.
            </div>
          </div>
          <div className="v-panel" style={{ padding: '10px 16px', display: 'grid', gridTemplateColumns: '210px 1fr', gap: 12, alignItems: 'center', borderLeft: '5px solid var(--cyan)' }}>
            <ValveSVG view="side" size={200} angles={print ? [80, 80] : undefined} title="Modelo ValveSense: corte de las dos valvas" />
            <div style={{ fontSize: 15.5, lineHeight: 1.4 }}>
              <b className="v-cyan">Nuestro modelo experimental</b>
              <div className="v-small" style={{ fontSize: 14.5 }}>
                Dos valvas como la prótesis bileaflet, pero <b>sin presión ni flujo</b>: un actuador reproduce la misma temporización (apertura tras el pico R y cierre al final de la eyección) para registrar sus clics.
              </div>
            </div>
          </div>
        </div>

        <div className="v-col" style={{ gap: 12, minHeight: 0 }}>
          <div className="v-viewer" style={{ height: 320 }}>
            <Visual3D kind="prosthesis" render="prosthesis-iso" alt="Prótesis aórtica mecánica bileaflet" camera="hero" showLabels />
            <div className="v-viewer-tools">
              <span className="v-tag exp" style={{ background: '#fff' }}>
                Prótesis mecánica bileaflet
              </span>
            </div>
            <div className="v-viewer-foot">
              <span className="v-hint">Representación 3D · mismo ritmo que la simulación</span>
            </div>
          </div>
          <table className="v-table" style={{ fontSize: 13.5 }}>
            <thead>
              <tr>
                <th />
                <th>Natural</th>
                <th>Prótesis mecánica</th>
                <th style={{ color: 'var(--cyan)' }}>Modelo ValveSense</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map(([k, a, b, c]) => (
                <tr key={k}>
                  <td style={{ fontWeight: 650 }}>{k}</td>
                  <td>{a}</td>
                  <td>
                    {b}
                    {k === 'Sonido y vibración' && <Cite ids={['fritzsche2007']} />}
                  </td>
                  <td style={{ color: 'var(--cyan)', fontWeight: 600 }}>{c}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
