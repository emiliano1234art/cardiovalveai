import { useRef, useState } from 'react';
import { MODE_LABEL } from '../config';
import type { LiveSnapshot } from '../LiveEngine';
import { cyclesToCsv, downloadText } from '../storage';
import type { CycleRecord } from '../types';

interface Props {
  snap: LiveSnapshot;
  onClear: () => void;
  onImport: (c: CycleRecord[]) => number;
}

export function HistoryPanel({ snap, onClear, onImport }: Props) {
  const file = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState('');
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  const rows = snap.cycles.slice(-12).reverse();

  const handleFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      const list = Array.isArray(data) ? data : data.cycles;
      setMsg(`${onImport(Array.isArray(list) ? list : [])} ciclos importados`);
    } catch {
      setMsg('El archivo no es válido');
    }
    if (file.current) file.current.value = '';
  };

  return (
    <section className="lv-card">
      <div className="lv-card-head">
        <div>
          <h2 className="lv-card-title">Registros guardados</h2>
          <p className="lv-card-sub">
            {snap.cycles.length} ciclos guardados en este navegador · se conservan al cerrar la página
          </p>
        </div>
        <div className="lv-actions">
          <button className="lv-btn" disabled={!snap.cycles.length} onClick={() => downloadText(`valvesense-${stamp}.csv`, cyclesToCsv(snap.cycles), 'text/csv')}>
            Exportar CSV
          </button>
          <button className="lv-btn" disabled={!snap.cycles.length} onClick={() => downloadText(`valvesense-${stamp}.json`, JSON.stringify({ exported: new Date().toISOString(), cycles: snap.cycles }, null, 1), 'application/json')}>
            Exportar JSON
          </button>
          <button className="lv-btn" onClick={() => file.current?.click()}>
            Importar JSON
          </button>
          <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => void handleFile(e.target.files?.[0])} />
          <button
            className="lv-btn danger"
            disabled={!snap.cycles.length}
            onClick={() => {
              if (window.confirm('¿Borrar todos los registros guardados? Esta acción no se puede deshacer.')) onClear();
            }}
          >
            Borrar
          </button>
        </div>
      </div>
      {msg && <p className="lv-note">{msg}</p>}
      <div className="lv-table-wrap">
        <table className="lv-table">
          <thead>
            <tr>
              <th>Ciclo</th><th>Hora</th><th>Modo</th><th>Apertura</th><th>Medido Hall</th><th>Servo</th><th>Apertura (ms)</th><th>Ciclos/min</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={8} className="lv-empty">Todavía no hay registros</td></tr>
            )}
            {rows.map((c) => (
              <tr key={c.id}>
                <td>{c.n}</td>
                <td>{new Date(c.ts).toLocaleTimeString('es-CL')}</td>
                <td>{MODE_LABEL[c.mode]}</td>
                <td className="num">{c.peak.toFixed(0)}° ({Math.round((c.peak / snap.angles.SANO) * 100)} %)</td>
                <td className="num">{c.hallPeak.toFixed(0)}°</td>
                <td className="num">{c.servoPeak.toFixed(0)}°</td>
                <td className="num">{Math.round(c.openMs)}</td>
                <td className="num">{c.bpm.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
