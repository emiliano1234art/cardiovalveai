import { useState } from 'react';
import type { EngineSnapshot } from '../../engine/ValveSenseEngine';
import { dev } from '../../lib/assessment';
import { COLORS } from '../charts/chartTheme';
import { InteractiveSignalChart, SignalCard, type PickInfo, type PickText } from '../charts/InteractiveSignalChart';
import { IconVibration } from '../ui/icons';
import { MetricCard } from '../ui/MetricCard';
import { Section } from '../ui/Section';

/** Texto del punto elegido: solo se nombra apertura/cierre si el ángulo del actuador lo confirma. */
export function describePeak(source: 'vib' | 'snd') {
  const what = source === 'vib' ? 'vibración' : 'sonido';
  const who = source === 'vib' ? 'el sensor' : 'el micrófono';
  return (p: PickInfo): PickText => {
    if (p.rel < 0.15) return { title: 'Casi en reposo', text: `Aquí casi no hay ${what}: en este instante las piezas no hacen contacto.` };
    if (p.event === 'cierre') return { title: `Pico de ${what} · cierre`, text: 'Este pico coincide con el cierre de la válvula: las valvas tocan su asiento.' };
    if (p.event === 'apertura') return { title: `Pico de ${what} · apertura`, text: 'Este pico coincide con el final de la apertura: las valvas llegan a su tope.' };
    return { title: `Pico de ${what}`, text: `Este pico representa un momento de ${what} intensa registrado por ${who}.` };
  };
}

export function VibrationSection({ snap }: { snap: EngineSnapshot }) {
  const L = snap.latest;
  const f = L?.features;
  const [zoom, setZoom] = useState(3);
  const isSim = snap.sourceKind === 'simulation';
  const energy = dev(L, 'piezo_energy');
  return (
    <Section index="03" icon={<IconVibration />} kinds={isSim ? ['synthetic'] : ['experimental']} title="Vibración" subtitle="Lo que «siente» el sensor pegado al anillo.">
      <div className="grid g-signal">
        <SignalCard
          id="learn-vibration"
          icon={<IconVibration />}
          title="Vibración de la válvula"
          sub="Sensor piezoeléctrico · toca un pico para explorarlo"
          explain="vibration"
          zoom={zoom}
          onZoom={setZoom}
          legend={[
            { key: 'signal', label: 'Vibración', color: COLORS.piezo },
            { key: 'open', label: 'Válvula abierta', color: 'rgba(16,162,160,.25)', type: 'band' },
            { key: 'events', label: 'Abre / cierra', color: '#0a6f95', type: 'tick' },
          ]}
        >
          {(hidden, hl) => (
            <InteractiveSignalChart
              data={snap.piezo}
              open={snap.open}
              color={COLORS.piezo}
              name="Vibración"
              unit="u.a."
              zoom={zoom}
              hidden={hidden}
              highlight={hl}
              describe={describePeak('vib')}
              emptyText="Esperando datos del prototipo"
            />
          )}
        </SignalCard>
        <div className="stack">
          <MetricCard compact label="Intensidad media (RMS)" value={f?.piezo_rms} unit="u.a." decimals={3} {...dev(L, 'piezo_rms')} accent={COLORS.piezo} />
          <MetricCard compact label="Pico más alto" value={f?.piezo_peak} unit="u.a." decimals={3} {...dev(L, 'piezo_peak')} accent={COLORS.piezo} />
          <MetricCard
            compact
            label="Energía del ciclo"
            value={f ? f.piezo_energy * 1000 : undefined}
            unit="u.a.²·ms"
            decimals={2}
            baseline={energy.baseline !== undefined ? energy.baseline * 1000 : undefined}
            z={energy.z}
            accent={COLORS.piezo}
          />
        </div>
      </div>
    </Section>
  );
}
