import type { CycleRecord } from '../types/valvesense';

export const CSV_COLUMNS: (keyof CycleRecord)[] = [
  'timestamp',
  'cycle_number',
  'bpm',
  'servo_angle',
  'valve_state',
  'piezo_raw',
  'piezo_rms',
  'piezo_peak',
  'piezo_energy',
  'audio_rms',
  'dominant_frequency',
  'spectral_centroid',
  'cycle_duration_ms',
  'opening_duration_ms',
  'closing_duration_ms',
  'baseline_similarity',
  'anomaly_score',
  'regularity',
  'mode',
  'source',
];

export function toCsv(rows: CycleRecord[]): string {
  const lines = [CSV_COLUMNS.join(',')];
  for (const r of rows) lines.push(CSV_COLUMNS.map((c) => r[c] ?? '').join(','));
  return lines.join('\n') + '\n';
}

function download(content: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const downloadCsv = (rows: CycleRecord[], name: string) => download(toCsv(rows), name, 'text/csv');
export const downloadJson = (rows: CycleRecord[], name: string) => download(JSON.stringify(rows, null, 2), name, 'application/json');
