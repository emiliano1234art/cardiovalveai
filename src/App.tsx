import { useCallback } from 'react';
import { ControlBar } from './components/layout/ControlBar';
import { Header } from './components/layout/Header';
import { AiSection } from './components/sections/AiSection';
import { AudioSection } from './components/sections/AudioSection';
import { HistorySection } from './components/sections/HistorySection';
import { PatientSection } from './components/sections/PatientSection';
import { ValveSection } from './components/sections/ValveSection';
import { VibrationSection } from './components/sections/VibrationSection';
import { useValveSense } from './hooks/useValveSense';

export default function App() {
  const { snap, engine, setMode, setBpm, connectSimulation, connectEsp32, recaptureBaseline } = useValveSense();
  const getAngle = useCallback(() => engine.angleNow(), [engine]);
  const exportRecords = useCallback(() => engine.exportRecords(), [engine]);

  return (
    <div className="app">
      <Header snap={snap} onSimulation={connectSimulation} onEsp32={connectEsp32} onBpm={setBpm} />
      <ControlBar snap={snap} onMode={setMode} onRecalibrate={() => void recaptureBaseline()} />
      <main className="container">
        <ValveSection snap={snap} getAngle={getAngle} />
        <VibrationSection snap={snap} />
        <AudioSection snap={snap} engine={engine} />
        <AiSection snap={snap} />
        <PatientSection snap={snap} />
        <HistorySection snap={snap} onExport={exportRecords} />
      </main>
      <footer className="footer">
        <div className="container">
          <span>
            <b style={{ color: 'var(--text-2)' }}>ValveSense</b> · Prototipo académico — Ingeniería Biomédica + Kinesiología
          </span>
          <span>
            Herramienta experimental de investigación. Los valores son sintéticos o provienen de un modelo a escala; no constituyen información
            clínica ni diagnóstico.
          </span>
        </div>
      </footer>
    </div>
  );
}
