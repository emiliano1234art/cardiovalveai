import { MODES } from '../../config/modes';
import type { EngineSnapshot } from '../../engine/ValveSenseEngine';
import { dev } from '../../lib/assessment';
import { fmt } from '../../lib/format';
import { GraphExplanation } from '../explain/GraphExplanation';
import { IconRotate, IconValve } from '../ui/icons';
import { MetricCard } from '../ui/MetricCard';
import { Section } from '../ui/Section';
import { ValveAnimation } from './ValveAnimation';

interface Props {
  snap: EngineSnapshot;
  getAngle: () => number;
}

export function ValveSection({ snap, getAngle }: Props) {
  const r = snap.latest?.record;
  const L = snap.latest;
  const isSim = snap.sourceKind === 'simulation';

  return (
    <Section index="02" icon={<IconRotate />} kinds={isSim ? ['synthetic'] : ['experimental']} title="La válvula en movimiento" subtitle="Cuánto se abre y cuánto tarda en cada ciclo.">
      <div className="grid g-valve">
        <div className="card sig-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="sig-head">
            <span className="sig-icon">
              <IconValve />
            </span>
            <div className="sig-titles">
              <h3>Vista de frente</h3>
              <p>{isSim ? `Condición: ${MODES[snap.mode].label}` : snap.hasData ? 'Ángulo medido del actuador' : 'Esperando datos del prototipo'}</p>
            </div>
            <GraphExplanation id="valveMotion" />
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ValveAnimation getAngle={getAngle} />
          </div>
        </div>

        <div className="grid g-3" style={{ alignContent: 'start' }}>
          <MetricCard label="Ciclos por minuto" value={r?.bpm} unit="ciclos/min" decimals={0} foot={<span>Latidos del ECG: {fmt(r?.ecg_bpm, 0)} lpm</span>} accent="var(--brand)" />
          <MetricCard label="Apertura máxima" value={r?.servo_angle} unit="°" decimals={0} {...dev(L, 'servo_angle')} accent="var(--brand)" />
          <MetricCard label="Tiempo en abrir" value={r?.opening_duration_ms} unit="ms" decimals={0} {...dev(L, 'opening_duration_ms')} accent="var(--brand)" />
          <MetricCard label="Tiempo en cerrar" value={r?.closing_duration_ms} unit="ms" decimals={0} {...dev(L, 'closing_duration_ms')} accent="var(--brand)" />
          <MetricCard label="Ciclos registrados" value={r?.cycle_number ?? 0} foot={<span>Último: {fmt(r?.cycle_duration_ms, 0)} ms</span>} accent="var(--brand)" />
          <MetricCard
            label="Regularidad"
            value={r?.regularity}
            unit="%"
            decimals={0}
            foot={<span>{r?.rr_ms ? 'Respecto de los latidos' : 'Entre ciclos'}</span>}
            z={r && r.regularity < 50 ? -5 : r && r.regularity < 80 ? -3 : undefined}
            accent="var(--brand)"
          />
        </div>
      </div>
    </Section>
  );
}
