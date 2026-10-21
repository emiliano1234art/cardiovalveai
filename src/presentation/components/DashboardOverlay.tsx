import { useEffect, useState } from 'react';
import { DataBadge, type DataKind } from '../../components/layout/ControlBar';
import { DASHBOARD_URL } from '../content';
import { PX } from '../explain';
import { Explain } from './screen';

const STATE: { k: DataKind; t: string }[] = [
  { k: 'synthetic', t: 'Válvula trivalva 2D y 3D sincronizada' },
  { k: 'synthetic', t: 'ECG simulado con detección del pico R' },
  { k: 'synthetic', t: 'Vibración (piezo) y sonido (MEMS) simulados' },
  { k: 'implemented', t: 'IA experimental: comparación con la referencia' },
  { k: 'proposed', t: 'Datos reales del ESP32: programado, por probar con el prototipo' },
];

/** URL del laboratorio dentro de este mismo archivo (funciona sin conexión). */
const localLab = () => `${location.pathname}${location.search}#/dashboard`;

/** Vista previa del dashboard experimental, con apertura en pestaña nueva y regreso. */
export function DashboardOverlay({ onClose }: { onClose: () => void }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setFailed((f) => f || !loaded), 9000);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', onKey);
    };
  }, [loaded, onClose]);

  return (
    <div className="v-dash-overlay" role="dialog" aria-modal="true" aria-label="Dashboard experimental CardioValveAI">
      <div className="v-dash-card">
        <header className="v-dash-head">
          <div>
            <b>Dashboard experimental</b>
            <span>Vista previa del laboratorio interactivo de CardioValveAI</span>
          </div>
          <div className="v-row" style={{ gap: 8 }}>
            <Explain label="¿Qué está implementado?" content={PX.dashboard} />
            <a className="v-btn sm" href={localLab()} target="_blank" rel="noreferrer">
              Abrir en pestaña nueva ↗
            </a>
            <a className="v-btn sm" href={DASHBOARD_URL} target="_blank" rel="noreferrer" title="Versión publicada en GitHub Pages">
              Versión en línea ↗
            </a>
            <button className="v-btn sm primary" onClick={onClose} autoFocus>
              ← Volver a la presentación
            </button>
          </div>
        </header>
        <div className="v-dash-body">
          <div className="v-dash-frame">
            {!failed ? (
              <iframe title="Dashboard CardioValveAI" src={localLab()} onLoad={() => setLoaded(true)} />
            ) : (
              <div className="v-dash-fallback">
                <p>La vista previa no se pudo cargar en este navegador.</p>
                <a className="v-btn primary" href={localLab()} target="_blank" rel="noreferrer">
                  Abrir el dashboard en una pestaña nueva ↗
                </a>
              </div>
            )}
            {!loaded && !failed && <div className="v-dash-loading">Cargando el laboratorio…</div>}
          </div>
          <aside className="v-dash-side">
            <div className="v-panel-title">Estado del dashboard</div>
            <ul>
              {STATE.map((s) => (
                <li key={s.t}>
                  <DataBadge kind={s.k} />
                  <span>{s.t}</span>
                </li>
              ))}
            </ul>
            <p className="v-tiny">
              La versión en línea (<span className="v-mono">{DASHBOARD_URL.replace('https://', '')}</span>) se actualiza al integrar estos cambios a la rama
              principal; hasta entonces puede mostrar una versión anterior. La vista previa usa el laboratorio incluido en este archivo.
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}
