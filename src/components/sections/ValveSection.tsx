import { MODES } from '../../config/modes';
import type { EngineSnapshot } from '../../engine/ValveSenseEngine';
import { dev } from '../../lib/assessment';
import { fmt } from '../../lib/format';
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
    <Section
      index="02"
      kinds={snap.sourceKind === 'simulation' ? ['synthetic'] : ['experimental']}
      title="Estado de válvula"
      subtitle="Prótesis bileaflet (2 valvas) a escala · accionada por servomotor sincronizado con el ECG"
      aside={
        isSim ? (
          <>
            Perfil activo: <strong style={{ color: 'var(--text)' }}>{MODES[snap.mode].label}</strong>
            <br />
            {MODES[snap.mode].description}
          </>
        ) : (
          'Datos en vivo del ESP32'
        )
      }
    >
      <div className="grid g-valve">
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card-head">
            <div>
              <h3 className="card-title">Válvula en tiempo real</h3>
              <p className="card-sub">Sincronizada con el ángulo del actuador (valva 1)</p>
            </div>
            <span className="pill num" style={{ height: 28 }}>
              {fmt(r?.bpm ?? snap.bpmProgrammed, 0)} lpm
            </span>
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ValveAnimation getAngle={getAngle} />
          </div>
        </div>

        <div className="grid g-3" style={{ alignContent: 'start' }}>
          <MetricCard
            label="Frecuencia valvular"
            value={r?.bpm}
            unit="ciclos/min"
            decimals={1}
            foot={<span>ECG {fmt(r?.ecg_bpm, 0)} lpm · la válvula sigue al ritmo</span>}
            accent="var(--brand)"
          />
          <MetricCard label="Ángulo de apertura" value={r?.servo_angle} unit="°" decimals={1} {...dev(L, 'servo_angle')} accent="var(--brand)" />
          <MetricCard label="Tiempo de apertura" value={r?.opening_duration_ms} unit="ms" decimals={0} {...dev(L, 'opening_duration_ms')} accent="var(--brand)" />
          <MetricCard label="Tiempo de cierre" value={r?.closing_duration_ms} unit="ms" decimals={0} {...dev(L, 'closing_duration_ms')} accent="var(--brand)" />
          <MetricCard
            label="Ciclos registrados"
            value={r?.cycle_number ?? 0}
            foot={<span>Duración último ciclo {fmt(r?.cycle_duration_ms, 0)} ms</span>}
            accent="var(--brand)"
          />
          <MetricCard
            label="Regularidad"
            value={r?.regularity}
            unit="%"
            decimals={1}
            foot={<span>{r?.rr_ms ? 'Ciclo valvular respecto del RR · 12 ciclos' : 'Variabilidad del período · 12 ciclos'}</span>}
            z={r && r.regularity < 50 ? -5 : r && r.regularity < 80 ? -3 : undefined}
            accent="var(--brand)"
          />
        </div>
      </div>
      <p className="note" style={{ margin: 0 }}>
        Tiempos de apertura y cierre medidos como transición 10 %–90 % del ángulo máximo de cada ciclo.
      </p>
    </Section>
  );
}
