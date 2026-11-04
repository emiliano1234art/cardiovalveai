import { useState } from 'react';
import { AiPanel } from './components/AiPanel';
import { ClaudePanel } from './components/ClaudePanel';
import { ControlPanel } from './components/ControlPanel';
import { HallPanel } from './components/HallPanel';
import { HistoryPanel } from './components/HistoryPanel';
import { LiveChart } from './components/LiveChart';
import { RehabPanel } from './components/RehabPanel';
import { TopBar } from './components/TopBar';
import { ValveView } from './components/ValveView';
import { useLive } from './useLive';

export default function LiveApp() {
  const { engine, snap } = useLive();
  const [win, setWin] = useState<'10' | 'session' | 'all'>('10');
  const alert = snap.alert;
  const lastPeak = snap.cycles.at(-1);

  return (
    <div className="lv-app">
      <TopBar snap={snap} onUsb={() => void engine.connectUsb()} onDemo={() => void engine.connectDemo()} onDisconnect={() => void engine.disconnect()} />

      {(alert.level === 'incomplete' || alert.level === 'limited') && (
        <div className={`lv-alert ${alert.level}`} role="alert">
          <div className="lv-wrap">
            <b>{alert.level === 'incomplete' ? 'ALERTA' : 'ATENCIÓN'}</b> {alert.message}
            <a href="#plan">Ver plan de rehabilitación →</a>
          </div>
        </div>
      )}

      <main className="lv-wrap lv-main">
        <div className="lv-grid lv-top-grid">
          <ValveView snap={snap} getAngle={engine.getAngle} />
          <div className="lv-stack">
            <ControlPanel snap={snap} onMode={(m) => engine.setMode(m)} onSource={(s) => engine.setAngleSource(s)} onCommand={(c) => engine.command(c)} />
            <HallPanel snap={snap} onCommand={(c) => engine.command(c)} onDemoHall={(on) => engine.setDemoHall(on)} />
          </div>
        </div>

        <div className="lv-stats">
          <Stat label="Ciclos de esta sesión" value={String(snap.sessionCycles)} />
          <Stat label="Último ciclo" value={lastPeak ? `${lastPeak.peak.toFixed(0)}°` : '—'} foot={lastPeak ? `${Math.round((lastPeak.peak / snap.angles.SANO) * 100)} % de lo normal` : 'sin datos'} />
          <Stat label="Ritmo" value={lastPeak ? lastPeak.bpm.toFixed(1) : '—'} unit="ciclos/min" />
          <Stat label="Registros guardados" value={String(snap.cycles.length)} foot="en este navegador" />
        </div>

        <LiveChart snap={snap} />
        <AiPanel snap={snap} win={win} onWin={setWin} />
        <RehabPanel snap={snap} win={win} />
        <ClaudePanel snap={snap} win={win} />
        <HistoryPanel snap={snap} onClear={() => engine.clearHistory()} onImport={(c) => engine.importCycles(c)} />
      </main>

      <footer className="lv-footer">
        <div className="lv-wrap">
          <b>ValveSense</b> · Prototipo académico — Ingeniería Biomédica + Kinesiología. Herramienta experimental con un modelo a escala: no es un dispositivo médico ni entrega diagnósticos.
        </div>
      </footer>
    </div>
  );
}

function Stat({ label, value, unit, foot }: { label: string; value: string; unit?: string; foot?: string }) {
  return (
    <div className="lv-card lv-stat">
      <div className="lv-kicker">{label}</div>
      <div className="lv-stat-value num">
        {value}
        {unit && <span>{unit}</span>}
      </div>
      {foot && <div className="lv-stat-foot">{foot}</div>}
    </div>
  );
}
