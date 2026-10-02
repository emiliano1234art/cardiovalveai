import type { ConnectionStatus, CycleFeatures, DataSourceKind, SignalChunk } from '../types/valvesense';

/**
 * Contrato común para cualquier origen de datos.
 *
 * Para conectar hardware real basta con implementar esta interfaz
 * (ver `Esp32WebSocketSource`). El resto de la aplicación no cambia.
 */
export interface ValveDataSource {
  readonly kind: DataSourceKind;
  start(): void;
  stop(): void;
  /** Bloques de muestras crudas (piezo, servo, audio). */
  onChunk(cb: (chunk: SignalChunk) => void): void;
  /** Descriptores por ciclo calculados en el propio dispositivo (opcional). */
  onCycle?(cb: (features: CycleFeatures) => void): void;
  onStatus(cb: (status: ConnectionStatus, detail?: string) => void): void;
  /** Frecuencia programada informada por la fuente (lpm). */
  onProgrammedBpm?(cb: (bpm: number) => void): void;
}
