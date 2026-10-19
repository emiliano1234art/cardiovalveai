import { useEffect, useMemo, useRef, useState } from 'react';
import { PatientSimulator } from '../../simulation/PatientSimulator';
import type { PatientSnapshot } from '../../types/valvesense';
import { Cite, SimTag, SlideHead, useDeck } from '../components/deck';
import { differenceIndex } from '../sim/model';
import { useSim } from '../sim/store';

const COLUMNS = [
  {
    title: 'Ya demostrado',
    tag: 'done',
    items: ['Modelo cinemático trivalvo y señales sintéticas sincronizadas (esta aplicación).', 'Dashboard v1 de análisis de señales y formato de dataset por ciclo (repositorio).'],
  },
  {
    title: 'Pendiente de probar',
    tag: 'pending',
    items: [
      'Movimiento programable y repetible en el prototipo físico.',
      'Registro de eventos de apertura y cierre con piezo y MEMS.',
      'Línea basal de funcionamiento.',
      'Comparación de condiciones mecánicas controladas.',
      'Dataset real con etiquetas experimentales.',
    ],
  },
  {
    title: 'Proyección futura',
    tag: 'future',
    items: ['Dashboard que integre movimiento, señales y variables funcionales.', 'Estudiar su utilidad para un seguimiento de rehabilitación personalizado.'],
  },
] as const;

const CRITERIA = [
  ['Repetibilidad del movimiento', 'Variación (CV) de la duración del ciclo y del ángulo máximo entre ciclos', 'Umbral a definir tras ensayo piloto'],
  ['Identificación del evento de cierre', '% de cierres detectados respecto de las marcas temporales del control', 'Umbral a definir'],
  ['Comparación entre condiciones', 'Diferencia de Eₓ, RMS y tiempos entre condiciones, con los sensores en posición fija', 'Mismo montaje y ubicación'],
];

function useSyntheticPatient(run: boolean) {
  const simRef = useRef<PatientSimulator | null>(null);
  if (!simRef.current) simRef.current = new PatientSimulator();
  const [hist, setHist] = useState<PatientSnapshot[]>(() => {
    const out: PatientSnapshot[] = [];
    for (let i = 0; i < 120; i++) out.push(simRef.current!.step(1));
    return out;
  });
  useEffect(() => {
    if (!run) return;
    const id = setInterval(() => setHist((h) => [...h.slice(-119), simRef.current!.step(1)]), 1000);
    return () => clearInterval(id);
  }, [run]);
  return hist;
}

export function S09Results() {
  const { print, active } = useDeck();
  const { params, motion } = useSim();
  const diff = useMemo(() => differenceIndex(params), [params]);
  const hist = useSyntheticPatient(active && !print && motion !== 'paused');
  const p = hist[hist.length - 1];
  const W = 300;
  const H = 54;
  const hr = hist.map((x) => x.heart_rate);
  const path = hr.map((v, i) => `${i ? 'L' : 'M'}${((i / (hr.length - 1)) * W).toFixed(1)} ${(H - ((v - 60) / 60) * H).toFixed(1)}`).join('');

  return (
    <div className="v-slide" style={{ paddingTop: 44 }}>
      <SlideHead num={9} kicker="Resultados esperados y conclusiones" title="Qué esperamos demostrar y qué queda abierto" />
      <div className="v-body v-col" style={{ gap: 12 }}>
        <div className="v-grid" style={{ gridTemplateColumns: '1fr 1.25fr 1fr', gap: 16 }}>
          {COLUMNS.map((c) => (
            <div key={c.title} className="v-panel" style={{ padding: '12px 18px', borderStyle: c.tag === 'future' ? 'dashed' : 'solid' }}>
              <span className={`v-tag ${c.tag}`} style={{ marginBottom: 10 }}>
                {c.title}
              </span>
              <ul className="v-list" style={{ fontSize: 16, gap: 4, marginTop: 8 }}>
                {c.items.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 520px', gap: 16 }}>
          <div className="v-panel" style={{ padding: '14px 18px' }}>
            <div className="v-panel-title">Criterios de evaluación propuestos</div>
            <table className="v-table" style={{ fontSize: 14.5 }}>
              <thead>
                <tr>
                  <th>Criterio</th>
                  <th>Cómo se mide</th>
                  <th>Referencia</th>
                </tr>
              </thead>
              <tbody>
                {CRITERIA.map(([a, b, c]) => (
                  <tr key={a}>
                    <td style={{ fontWeight: 650 }}>{a}</td>
                    <td>{b}</td>
                    <td className="v-tiny">{c}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="v-row" style={{ marginTop: 6, gap: 14, alignItems: 'baseline' }}>
              <span className="v-tag sim">Heurística demostrativa</span>
              <span style={{ fontSize: 16 }}>
                Diferencia vs. condición normal ({params.condition === 'normal' ? 'normal' : 'condición actual'}):{' '}
                <b className="v-num" style={{ fontSize: 22, color: params.condition === 'normal' ? 'var(--cyan)' : 'var(--coral)' }}>
                  {diff.index.toFixed(0)} %
                </b>
              </span>
            </div>
            <div className="v-tiny" style={{ fontSize: 13.5, marginTop: 4 }}>
              Promedio de diferencias relativas de Eₓ de cierre, Eₓ de apertura, ángulo medio máximo y dispersión temporal de los cierres. No es IA entrenada ni diagnóstico.
            </div>
          </div>

          <div className="v-panel" style={{ padding: '14px 18px', borderStyle: 'dashed', borderColor: 'var(--amber)' }}>
            <div className="v-row" style={{ justifyContent: 'space-between' }}>
              <div className="v-panel-title" style={{ margin: 0, color: 'var(--amber)' }}>
                Integración funcional futura
              </div>
              <SimTag label="Datos sintéticos" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, margin: '10px 0' }}>
              {[
                ['FC', `${p.heart_rate}`, 'lpm'],
                ['SpO₂', p.spo2.toFixed(1).replace('.', ','), '%'],
                ['Borg', `${p.borg}`, '/20'],
                ['Recup. FC', p.hr_recovery_1min !== null ? `${p.hr_recovery_1min}` : '—', p.hr_recovery_1min !== null ? 'lpm' : ''],
              ].map(([k, v, u]) => (
                <div key={k}>
                  <div className="v-tiny">{k}</div>
                  <div className="v-num" style={{ fontSize: 26, fontWeight: 750 }}>
                    {v}
                    <span className="v-tiny"> {u}</span>
                  </div>
                </div>
              ))}
            </div>
            <svg width={W} height={H} style={{ display: 'block', width: '100%' }} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-label="FC sintética">
              <path d={path} fill="none" stroke="var(--amber)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
            </svg>
            <div className="v-tiny" style={{ fontSize: 13.5, marginTop: 6 }}>
              Etapa: {p.session_stage}. Ilustra la idea futura: no son mediciones del prototipo ni evidencia de una relación clínica validada.
              <Cite ids={['borg1982', 'cole1999']} />
            </div>
          </div>
        </div>

        <div className="v-panel flat" style={{ padding: '10px 20px', borderLeft: '6px solid var(--cyan)' }}>
          <span style={{ fontSize: 18 }}>
            <b className="v-cyan">Conclusión.</b> Si el prototipo logra registros repetibles y sensibles a cambios mecánicos controlados, tendremos la base técnica para investigar —con datos reales y
            validación clínica— si mirar juntos la función valvular y la respuesta funcional ayuda a personalizar la rehabilitación: el núcleo de nuestro wicked problem.
          </span>
        </div>
      </div>
    </div>
  );
}
