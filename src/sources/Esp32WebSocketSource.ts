import type { ConnectionStatus, CycleFeatures, SignalChunk } from '../types/valvesense';
import type { ValveDataSource } from './DataSource';

/**
 * Fuente de DATOS REALES: ESP32 vía WebSocket.
 *
 * Protocolo (JSON, un mensaje por bloque — ver README §4):
 *
 *   { "type": "chunk", "t0_ms": 123456, "fs_piezo": 1000, "fs_audio": 8000,
 *     "piezo": [...], "servo": [...], "audio": [...] }
 *
 *   { "type": "cycle", ...CycleFeatures }          // opcional
 *   { "type": "status", "bpm_programmed": 72 }     // opcional
 *
 * `piezo` y `servo` tienen la misma longitud; `audio` = longitud × fs_audio / fs_piezo.
 */
export class Esp32WebSocketSource implements ValveDataSource {
  readonly kind = 'esp32' as const;
  private ws: WebSocket | null = null;
  private chunkCb: ((c: SignalChunk) => void) | null = null;
  private cycleCb: ((f: CycleFeatures) => void) | null = null;
  private statusCb: ((s: ConnectionStatus, d?: string) => void) | null = null;
  private bpmCb: ((bpm: number) => void) | null = null;
  private retry: ReturnType<typeof setTimeout> | null = null;
  private stopped = true;

  constructor(readonly url: string) {}

  onChunk(cb: (chunk: SignalChunk) => void) {
    this.chunkCb = cb;
  }
  onCycle(cb: (f: CycleFeatures) => void) {
    this.cycleCb = cb;
  }
  onStatus(cb: (s: ConnectionStatus, d?: string) => void) {
    this.statusCb = cb;
  }
  onProgrammedBpm(cb: (bpm: number) => void) {
    this.bpmCb = cb;
  }

  start() {
    this.stopped = false;
    this.connect();
  }

  stop() {
    this.stopped = true;
    if (this.retry) clearTimeout(this.retry);
    if (this.ws) {
      // desacoplar handlers: eventos tardíos del socket cerrado no deben afectar a la nueva fuente
      this.ws.onopen = this.ws.onerror = this.ws.onclose = this.ws.onmessage = null;
      this.ws.close();
    }
    this.ws = null;
    this.statusCb?.('disconnected');
    this.statusCb = null;
    this.chunkCb = null;
    this.cycleCb = null;
  }

  private connect() {
    this.statusCb?.('connecting', this.url);
    let ws: WebSocket;
    try {
      ws = new WebSocket(this.url);
    } catch (e) {
      this.statusCb?.('error', String(e));
      return;
    }
    this.ws = ws;
    ws.onopen = () => this.statusCb?.('connected', this.url);
    ws.onerror = () => this.statusCb?.('error', `No se pudo conectar a ${this.url}`);
    ws.onclose = () => {
      if (this.stopped) return;
      this.statusCb?.('error', `Conexión cerrada — reintentando…`);
      this.retry = setTimeout(() => this.connect(), 3000);
    };
    ws.onmessage = (ev) => this.handle(ev.data);
  }

  private handle(raw: unknown) {
    if (typeof raw !== 'string') return;
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (msg.type === 'chunk') {
      this.chunkCb?.({
        t0_ms: Number(msg.t0_ms),
        fs_piezo: Number(msg.fs_piezo),
        fs_audio: Number(msg.fs_audio),
        piezo: Float32Array.from(msg.piezo as number[]),
        servo: Float32Array.from(msg.servo as number[]),
        audio: Float32Array.from(msg.audio as number[]),
      });
    } else if (msg.type === 'cycle') {
      this.cycleCb?.(msg as unknown as CycleFeatures);
    } else if (msg.type === 'status' && typeof msg.bpm_programmed === 'number') {
      this.bpmCb?.(msg.bpm_programmed);
    }
  }
}
