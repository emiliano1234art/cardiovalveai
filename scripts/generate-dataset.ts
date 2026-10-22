/**
 * Genera el dataset sintético de ejemplo usando el mismo modelo sincronizado
 * con ECG y el mismo pipeline de análisis que el dashboard.
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
import { DEFAULT_PARAMS } from '../src/presentation/sim/model';
import { sim } from '../src/presentation/sim/store';
import { SyncedSynth } from '../src/sources/SyncedSimSource';
import type { CycleRecord, ExperimentalMode } from '../src/types/valvesense';

const CYCLES_PER_STEP = 40;
const EPOCH = Date.parse('2026-09-01T10:00:00Z');

const baseline = calibrateSimulatedBaseline(40);
const synth = new SyncedSynth();
const pipeline = new ValveAnalysisPipeline(baseline);
const rows: CycleRecord[] = [];

// secuencia: normal → variación de FC (110 lpm) → normal → cada condición alterada intercalada con normal
const plan: { mode: ExperimentalMode; bpm: number }[] = [
  { mode: 'normal', bpm: 72 },
  { mode: 'normal', bpm: 110 },
  ...MODE_ORDER.slice(1).flatMap((m) => [
    { mode: 'normal' as const, bpm: 72 },
    { mode: m, bpm: 72 },
  ]),
  { mode: 'normal', bpm: 72 },
];
for (const step of plan) {
  sim.setParams({ ...DEFAULT_PARAMS, condition: step.mode, bpm: step.bpm });
  let n = 0;
  while (n < CYCLES_PER_STEP) {
    for (const r of pipeline.process(synth.generate(100), 'simulation', step.mode)) {
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
      description: 'CardioVal AI — dataset SINTÉTICO de ejemplo (modelo sincronizado con ECG simulado). No contiene datos clínicos ni experimentales.',
      generated_with: 'scripts/generate-dataset.ts',
      sampling: { fs_piezo_hz: 1000, fs_ecg_hz: 1000, fs_audio_hz: 8000 },
      timing: { delay_ms: DEFAULT_PARAMS.delayMs, open_ms: DEFAULT_PARAMS.openMs, theta_max_deg: DEFAULT_PARAMS.thetaMax },
      plan,
      baseline: { cycles: baseline.cycles, bpm: baseline.bpm, stats: baseline.stats },
      records: rows,
    },
    null,
    1,
  ),
);
writeFileSync('public/data/valvesense_sample_dataset.csv', toCsv(rows));
console.log(`OK · ${rows.length} ciclos → public/data/valvesense_sample_dataset.{json,csv}`);
