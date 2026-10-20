import { useState } from 'react';
import type { EngineSnapshot, ValveSenseEngine } from '../../engine/ValveSenseEngine';
import { dev } from '../../lib/assessment';
import { COLORS } from '../charts/chartTheme';
import { InteractiveSignalChart, SignalCard } from '../charts/InteractiveSignalChart';
import { Spectrogram, SpectroLegend } from '../charts/Spectrogram';
import { GraphExplanation } from '../explain/GraphExplanation';
import { IconSound, IconSpectrum } from '../ui/icons';
import { MetricCard } from '../ui/MetricCard';
import { Section } from '../ui/Section';
import { describePeak } from './VibrationSection';

export function AudioSection({ snap, engine }: { snap: EngineSnapshot; engine: ValveSenseEngine }) {
  const L = snap.latest;
  const f = L?.features;
  const [zoom, setZoom] = useState(3);
  const isSim = snap.sourceKind === 'simulation';
  return (
    <Section index="04" icon={<IconSound />} kinds={isSim ? ['synthetic'] : ['experimental']} title="Sonido" subtitle="Lo que «escucha» el micrófono cuando la válvula se abre y se cierra.">
      <div className="grid g-signal">
        <SignalCard
          id="learn-sound"
          icon={<IconSound />}
          title="Sonido de la válvula"
          sub="Micrófono MEMS · cada onda corta es un clic"
          explain="sound"
          zoom={zoom}
          onZoom={setZoom}
          legend={[
            { key: 'signal', label: 'Sonido', color: COLORS.audio },
            { key: 'open', label: 'Válvula abierta', color: 'rgba(16,162,160,.25)', type: 'band' },
            { key: 'events', label: 'Abre / cierra', color: '#0a6f95', type: 'tick' },
          ]}
        >
          {(hidden, hl) => (
            <InteractiveSignalChart
              data={snap.audio}
              open={snap.open}
              color={COLORS.audio}
              name="Sonido"
              unit=""
              zoom={zoom}
              hidden={hidden}
              highlight={hl}
              decimals={3}
              describe={describePeak('snd')}
              emptyText="Esperando datos del prototipo"
            />
          )}
        </SignalCard>
        <div className="stack">
          <MetricCard compact label="Tono principal" value={f?.dominant_frequency} unit="Hz" decimals={0} {...dev(L, 'dominant_frequency')} accent={COLORS.audio} />
          <MetricCard compact label="Centro del sonido" value={f?.spectral_centroid} unit="Hz" decimals={0} {...dev(L, 'spectral_centroid')} accent={COLORS.audio} />
          <MetricCard compact label="Volumen medio (RMS)" value={f?.audio_rms} decimals={4} {...dev(L, 'audio_rms')} accent={COLORS.audio} />
        </div>
      </div>

      <div className="card sig-card" id="learn-spectro">
        <div className="sig-head">
          <span className="sig-icon">
            <IconSpectrum />
          </span>
          <div className="sig-titles">
            <h3>Mapa de sonidos</h3>
            <p>Grave abajo, agudo arriba · toca una zona para entenderla</p>
          </div>
          <GraphExplanation id="spectrogram" />
        </div>
        <div className="sig-tools">
          <SpectroLegend />
        </div>
        <Spectrogram spectro={engine.spectro} version={snap.version} marker={f?.dominant_frequency} />
      </div>
    </Section>
  );
}
