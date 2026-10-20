import { createContext, useContext } from 'react';

export interface Playback {
  paused: boolean;
  setPaused: (p: boolean) => void;
}

/** Pausa/reanudación de las señales, compartida por todos los gráficos. */
export const PlaybackCtx = createContext<Playback>({ paused: false, setPaused: () => {} });
export const usePlayback = () => useContext(PlaybackCtx);
