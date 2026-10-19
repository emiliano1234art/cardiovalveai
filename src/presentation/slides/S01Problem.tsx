import { useState } from 'react';
import { KEY_IDEA } from '../content';
import { Cite, SlideHead, useDeck } from '../components/deck';

interface Factor {
  id: string;
  label: string;
  actor: string;
  text: string;
  refs: string[];
  /** posición en el mapa (grados) */
  angle: number;
}

/**
 * Afirmaciones clínicas: solo las respaldadas por la bibliografía verificada.
 * Los supuestos del equipo se marcan como tales.
 */
const FACTORS: Factor[] = [
  {
    id: 'cv',
    label: 'Condición cardiovascular',
    actor: 'Paciente · cardiología',
    text: 'Las personas con prótesis valvular requieren seguimiento clínico periódico; la ecocardiografía es el método de primera línea para evaluar la función protésica.',
    refs: ['otto2021', 'zoghbi2024'],
    angle: -90,
  },
  {
    id: 'func',
    label: 'Respuesta funcional',
    actor: 'Kinesiología',
    text: 'La rehabilitación basada en ejercicio después de la cirugía valvular se ha estudiado, pero la evidencia sobre sus efectos aún es incierta y se necesitan más ensayos de calidad.',
    refs: ['abraham2021'],
    angle: -30,
  },
  {
    id: 'symp',
    label: 'Síntomas y percepción de esfuerzo',
    actor: 'Paciente · kinesiología',
    text: 'La percepción de esfuerzo (escala de Borg) complementa las medidas fisiológicas para entender cómo vive la persona el ejercicio.',
    refs: ['borg1982'],
    angle: 30,
  },
  {
    id: 'adh',
    label: 'Actividad y adherencia',
    actor: 'Paciente · familia',
    text: 'La rehabilitación integral es central en prevención secundaria; el desafío actual es llevarla «del conocimiento a la implementación».',
    refs: ['ambrosetti2021'],
    angle: 90,
  },
  {
    id: 'team',
    label: 'Equipo clínico',
    actor: 'Cardiología · kinesiología · enfermería',
    text: 'Las guías recomiendan decisiones con equipo multidisciplinario en enfermedad valvular grave, y la rehabilitación integra varios componentes y profesionales.',
    refs: ['otto2021', 'ambrosetti2021'],
    angle: 150,
  },
  {
    id: 'access',
    label: 'Contexto y acceso al seguimiento',
    actor: 'Sistema de salud · territorio',
    text: 'Existen modalidades domiciliarias —incluidas digitales o de telesalud— que se comparan con la rehabilitación supervisada en centro.',
    refs: ['mcdonagh2023'],
    angle: 210,
  },
];

const LINKS: [string, string][] = [
  ['cv', 'func'],
  ['func', 'symp'],
  ['symp', 'adh'],
  ['adh', 'access'],
  ['access', 'team'],
  ['team', 'cv'],
  ['func', 'adh'],
  ['cv', 'symp'],
];

const CX = 430;
const CY = 300;
const RAD = 232;
const pos = (deg: number) => [CX + RAD * Math.cos((deg * Math.PI) / 180), CY + RAD * Math.sin((deg * Math.PI) / 180)] as const;

export function S01Problem() {
  const { print } = useDeck();
  const [sel, setSel] = useState<string>('func');
  const f = FACTORS.find((x) => x.id === sel)!;
  const related = new Set(LINKS.filter((l) => l.includes(sel)).flat());

  return (
    <div className="v-slide">
      <SlideHead
        num={1}
        kicker="ValveSense · el problema clínico (wicked problem)"
        title="La recuperación no depende solo de la prótesis"
      />
      <div className="v-body" style={{ display: 'grid', gridTemplateColumns: '860px 1fr', gap: 24 }}>
        <div className="v-panel" style={{ padding: 0, position: 'relative' }}>
          <svg width={860} height={600} role="img" aria-label="Mapa de factores relacionados">
            {LINKS.map(([a, b]) => {
              const A = pos(FACTORS.find((x) => x.id === a)!.angle);
              const B = pos(FACTORS.find((x) => x.id === b)!.angle);
              const on = !print && (a === sel || b === sel);
              return <line key={a + b} x1={A[0]} y1={A[1]} x2={B[0]} y2={B[1]} stroke={on ? 'var(--cyan)' : 'var(--line)'} strokeWidth={on ? 3 : 1.5} strokeDasharray={on ? undefined : '5 6'} />;
            })}
            {FACTORS.map((x) => {
              const P = pos(x.angle);
              return <line key={x.id} x1={CX} y1={CY} x2={P[0]} y2={P[1]} stroke={!print && x.id === sel ? 'var(--cyan)' : 'var(--line-soft)'} strokeWidth={2} />;
            })}
            <circle cx={CX} cy={CY} r={108} fill="var(--panel-2)" stroke="var(--cyan)" strokeWidth={2} />
            <foreignObject x={CX - 100} y={CY - 70} width={200} height={140}>
              <div style={{ height: '100%', display: 'grid', placeItems: 'center', textAlign: 'center', fontSize: 19, fontWeight: 700, lineHeight: 1.2 }}>
                Recuperación de la persona con prótesis valvular
              </div>
            </foreignObject>
          </svg>
          {FACTORS.map((x) => {
            const [px, py] = pos(x.angle);
            const isSel = !print && x.id === sel;
            const isRel = !print && related.has(x.id) && !isSel;
            return (
              <button
                key={x.id}
                onClick={() => setSel(x.id)}
                aria-pressed={isSel}
                style={{
                  position: 'absolute',
                  left: px - 125,
                  top: py - 42,
                  width: 250,
                  minHeight: 84,
                  borderRadius: 18,
                  padding: '10px 14px',
                  cursor: 'pointer',
                  textAlign: 'center',
                  border: `2px solid ${isSel ? 'var(--cyan)' : isRel ? 'rgba(34,211,238,.5)' : 'var(--line)'}`,
                  background: isSel ? 'var(--cyan-soft)' : 'var(--panel)',
                  transition: 'all .2s',
                  boxShadow: isSel ? '0 0 0 6px rgba(34,211,238,.08)' : undefined,
                }}
              >
                <div style={{ fontSize: 19, fontWeight: 700, lineHeight: 1.2 }}>{x.label}</div>
                <div className="v-tiny">{x.actor}</div>
              </button>
            );
          })}
        </div>

        <div className="v-col" style={{ gap: print ? 10 : 18 }}>
          {print ? (
            <div className="v-panel" style={{ padding: '16px 20px' }}>
              <div className="v-panel-title">Fundamentación por factor</div>
              <div className="v-col" style={{ gap: 5 }}>
                {FACTORS.map((x) => (
                  <div key={x.id} style={{ fontSize: 13.5, lineHeight: 1.28 }}>
                    <b>{x.label}.</b> <span style={{ color: 'var(--text-2)' }}>{x.text}</span>
                    <Cite ids={x.refs} />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="v-panel" style={{ minHeight: 280, padding: '18px 24px' }}>
              <div className="v-panel-title">Factor seleccionado · elija un nodo del mapa</div>
              <div style={{ fontSize: 30, fontWeight: 750, lineHeight: 1.15, color: 'var(--cyan)' }}>{f.label}</div>
              <div className="v-tiny" style={{ marginTop: 4 }}>
                Actores: {f.actor}
              </div>
              <p style={{ fontSize: 22, lineHeight: 1.4, margin: '12px 0 0' }}>
                {f.text}
                <Cite ids={f.refs} />
              </p>
            </div>
          )}
          <div className="v-panel flat" style={{ padding: print ? '10px 18px' : '14px 20px' }}>
            <div className="v-panel-title">¿Por qué es un problema complejo?</div>
            <ul className="v-list" style={{ fontSize: print ? 14 : 17, gap: print ? 4 : 6 }}>
              <li>Ningún factor explica la recuperación por sí solo: cada uno influye en los demás.</li>
              <li>Participan actores con información distinta: paciente, equipo clínico, familia y sistema de salud.</li>
            </ul>
          </div>
          <div className="v-key" style={{ fontSize: print ? 16 : 19, padding: print ? '12px 18px' : '16px 22px' }}>
            <div className="v-kicker" style={{ fontSize: 13, marginBottom: 6 }}>
              Propuesta ValveSense
            </div>
            {KEY_IDEA}
          </div>
        </div>
      </div>
    </div>
  );
}
