import { WINDOW_S, type EngineSnapshot, type ValveSenseEngine } from '../../engine/ValveSenseEngine';
import { dev } from '../../lib/assessment';
import { COLORS } from '../charts/chartTheme';
import { SignalChart } from '../charts/SignalChart';
import { SPECTRO_GRADIENT, Spectrogram } from '../charts/Spectrogram';
import { MetricCard } from '../ui/MetricCard';
import { Section } from '../ui/Section';

export function AudioSection({ snap, engine }: { snap: EngineSnapshot; engine: ValveSenseEngine }) {
  const L = snap.latest;
  const f = L?.features;
  return (
    <Section index="03" title="Audio" subtitle="Micrófono digital MEMS (I²S) · 8 kHz" aside="Análisis espectral Welch · ventana Hann 512">
      <div className="grid g-signal">
        <div className="card">
          <div className="card-head">
            <div>
              <h3 className="card-title">Señal acústica vs tiempo</h3>
              <p className="card-sub">Clics de apertura y cierre · amplitud normalizada</p>
            </div>
            <div className="legend">
              <span>
                <i style={{ background: COLORS.audio }} />
                Micrófono
              </span>
              <span>
                <i className="box" style={{ background: 'rgba(16,162,160,.16)' }} />
                Válvula abierta
              </span>
            </div>
          </div>
          <SignalChart data={snap.audio} open={snap.open} color={COLORS.audio} name="Audio" windowS={WINDOW_S} />
        </div>
        <div className="stack">
          <MetricCard compact label="Frecuencia dominante" value={f?.dominant_frequency} unit="Hz" decimals={0} {...dev(L, 'dominant_frequency')} accent={COLORS.audio} />
          <MetricCard compact label="Spectral centroid" value={f?.spectral_centroid} unit="Hz" decimals={0} {...dev(L, 'spectral_centroid')} accent={COLORS.audio} />
          <MetricCard compact label="Audio RMS" value={f?.audio_rms} decimals={4} {...dev(L, 'audio_rms')} accent={COLORS.audio} />
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <h3 className="card-title">Espectrograma frecuencia–tiempo</h3>
            <p className="card-sub">STFT 256 puntos · salto 16 ms · escala dB relativa (rango 50 dB)</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--muted)' }}>
            <span>−50 dB</span>
            <span style={{ width: 120, height: 8, borderRadius: 4, background: SPECTRO_GRADIENT, border: '1px solid var(--border)' }} />
            <span>0 dB</span>
          </div>
        </div>
        <Spectrogram spectro={engine.spectro} version={snap.version} marker={f?.dominant_frequency} />
      </div>
    </Section>
  );
}
