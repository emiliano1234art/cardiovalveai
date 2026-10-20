import { useCallback, useMemo, useState } from 'react';
import { LearnMode } from './components/explain/LearnMode';
import { PlaybackCtx } from './components/explain/playback';
import { ControlBar } from './components/layout/ControlBar';
import { Header } from './components/layout/Header';
import { AiSection } from './components/sections/AiSection';
import { AudioSection } from './components/sections/AudioSection';
import { EcgSection } from './components/sections/EcgSection';
import { HeroSection } from './components/sections/HeroSection';
import { HistorySection } from './components/sections/HistorySection';
import { PatientSection } from './components/sections/PatientSection';
import { ValveSection } from './components/sections/ValveSection';
import { VibrationSection } from './components/sections/VibrationSection';
import { useValveSense } from './hooks/useValveSense';

export default function App() {
  const { snap, setTarget, paused, setPaused, setFollowPatient, engine, setMode, setBpm, setTiming, connectSimulation, connectEsp32, recaptureBaseline } = useValveSense();
  const [learn, setLearn] = useState(false);
  const exportRecords = useCallback(() => engine.exportRecords(), [engine]);
  const playback = useMemo(() => ({ paused, setPaused }), [paused, setPaused]);
  const recalibrate = useCallback(() => void recaptureBaseline(), [recaptureBaseline]);
  const startLearn = useCallback(() => {
    if (paused) setPaused(false);
    setLearn(true);
  }, [paused, setPaused]);

  return (
    <PlaybackCtx.Provider value={playback}>
      <div className="app">
        <Header snap={snap} onSimulation={connectSimulation} onEsp32={connectEsp32} paused={paused} onPause={setPaused} onLearn={startLearn} />
        <ControlBar snap={snap} onTarget={setTarget} onMode={setMode} onBpm={setBpm} onTiming={setTiming} onRecalibrate={recalibrate} />
        <main className="container">
          <HeroSection snap={snap} engine={engine} onLearn={startLearn} />
          <EcgSection snap={snap} />
          <ValveSection snap={snap} engine={engine} />
          <VibrationSection snap={snap} />
          <AudioSection snap={snap} engine={engine} />
          <AiSection snap={snap} onRecalibrate={recalibrate} />
          <PatientSection snap={snap} onFollow={setFollowPatient} />
          <HistorySection snap={snap} onExport={exportRecords} />
        </main>
        <footer className="footer">
          <div className="container">
            <span>
              <b style={{ color: 'var(--text-2)' }}>ValveSense</b> · Proyecto universitario — Ingeniería Biomédica + Kinesiología
            </span>
            <span>Herramienta experimental de investigación · no es un dispositivo médico ni entrega diagnósticos.</span>
          </div>
        </footer>
        <LearnMode open={learn} onClose={() => setLearn(false)} onTry={snap.sourceKind === 'simulation' ? setMode : undefined} />
      </div>
    </PlaybackCtx.Provider>
  );
}
