/**
 * Genera el dataset sintético de ejemplo usando el mismo sintetizador y el
 * mismo pipeline de análisis que el dashboard.
 *
 *   npm run dataset
 *
 * Salida: public/data/valvesense_sample_dataset.{json,csv}
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { calibrateSimulatedBaseline } from '../src/analysis/calibration';
import { ValveAnalysisPipeline } from '../src/analysis/ValveAnalysisPipeline';
import { MODE_ORDER } from '../src/config/modes';
import { toCsv } from '../src/lib/export';
import { ValveSignalSynth } from '../src/simulation/ValveSignalSynth';
import type { CycleRecord } from '../src/types/valvesense';

const CYCLES_PER_MODE = 40;
const EPOCH = Date.parse('2026-09-01T10:00:00Z');

const baseline = calibrateSimulatedBaseline(40);
const synth = new ValveSignalSynth(2026);
const pipeline = new ValveAnalysisPipeline(baseline);
const rows: CycleRecord[] = [];

// secuencia: normal → apertura limitada → normal → cierre alterado → normal → ritmo irregular
const plan = MODE_ORDER.slice(1).flatMap((m) => ['normal', m] as const);
for (const mode of [...plan, 'normal' as const]) {
  synth.setMode(mode);
  let n = 0;
  while (n < CYCLES_PER_MODE) {
    for (const r of pipeline.process(synth.generate(100), 'simulation', mode)) {
      rows.push({ ...r.record, timestamp: EPOCH + r.record.timestamp });
      n++;
    }
  }
}

mkdirSync('public/data', { recursive: true });
writeFileSync(
  'public/data/valvesense_sample_dataset.json',
  JSON.stringify(
    {
      description: 'ValveSense — dataset SINTÉTICO de ejemplo. No contiene datos clínicos.',
      generated_with: 'scripts/generate-dataset.ts',
      sampling: { fs_piezo_hz: 1000, fs_audio_hz: 8000 },
      baseline: { cycles: baseline.cycles, stats: baseline.stats },
      records: rows,
    },
    null,
    1,
  ),
);
writeFileSync('public/data/valvesense_sample_dataset.csv', toCsv(rows));
console.log(`OK · ${rows.length} ciclos → public/data/valvesense_sample_dataset.{json,csv}`);
