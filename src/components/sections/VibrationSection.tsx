import { WINDOW_S, type EngineSnapshot } from '../../engine/ValveSenseEngine';
import { dev } from '../../lib/assessment';
import { COLORS } from '../charts/chartTheme';
import { SignalChart } from '../charts/SignalChart';
import { MetricCard } from '../ui/MetricCard';
import { Section } from '../ui/Section';

export function VibrationSection({ snap }: { snap: EngineSnapshot }) {
  const L = snap.latest;
  const f = L?.features;
  return (
    <Section index="02" title="Vibración" subtitle="Sensor piezoeléctrico acoplado a la carcasa · 1 kHz" aside="Descriptores del último ciclo completo">
      <div className="grid g-signal">
        <div className="card">
          <div className="card-head">
            <div>
              <h3 className="card-title">Amplitud de vibración vs tiempo</h3>
              <p className="card-sub">Ventana deslizante de {WINDOW_S} s · unidades arbitrarias (u.a.)</p>
            </div>
            <div className="legend">
              <span>
                <i style={{ background: COLORS.piezo }} />
                Piezo
              </span>
              <span>
                <i className="box" style={{ background: 'rgba(16,162,160,.16)' }} />
                Válvula abierta
              </span>
            </div>
          </div>
          <SignalChart data={snap.piezo} open={snap.open} color={COLORS.piezo} name="Vibración" windowS={WINDOW_S} />
        </div>
        <div className="stack">
          <MetricCard compact label="RMS" value={f?.piezo_rms} unit="u.a." decimals={3} {...dev(L, 'piezo_rms')} accent={COLORS.piezo} />
          <MetricCard compact label="Peak amplitude" value={f?.piezo_peak} unit="u.a." decimals={3} {...dev(L, 'piezo_peak')} accent={COLORS.piezo} />
          <MetricCard
            compact
            label="Energía de la señal"
            value={f ? f.piezo_energy * 1000 : undefined}
            unit="u.a.²·ms"
            decimals={2}
            foot={<span>∑x²·Δt sobre el ciclo</span>}
            accent={COLORS.piezo}
          />
        </div>
      </div>
    </Section>
  );
}
