import type { Hello, LinkStatus, LiveSource, Sample, ValveMode } from '../types';

/* Web Serial no está en los tipos de TypeScript: declaración mínima. */
interface SerialPortLike {
  open(o: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
}
interface SerialLike {
  requestPort(): Promise<SerialPortLike>;
}

export function webSerialAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'serial' in navigator;
}

/** Conexión por cable USB con el ESP32 (sin WiFi). */
export class SerialSource implements LiveSource {
  readonly kind = 'usb' as const;
  private port: SerialPortLike | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private running = false;
  private hb: ReturnType<typeof setInterval> | null = null;
  private cbSample: (s: Sample) => void = () => {};
  private cbStatus: (s: LinkStatus, d?: string) => void = () => {};
  private cbHello: (h: Hello) => void = () => {};
  private cbInfo: (m: string) => void = () => {};

  onSample(cb: (s: Sample) => void) { this.cbSample = cb; }
  onStatus(cb: (s: LinkStatus, d?: string) => void) { this.cbStatus = cb; }
  onHello(cb: (h: Hello) => void) { this.cbHello = cb; }
  onInfo(cb: (m: string) => void) { this.cbInfo = cb; }

  async start(): Promise<void> {
    if (!webSerialAvailable()) {
      this.cbStatus('error', 'Este navegador no permite conexión USB. Usa Chrome o Edge.');
      return;
    }
    try {
      this.cbStatus('connecting', 'Elige el puerto del ESP32…');
      const serial = (navigator as unknown as { serial: SerialLike }).serial;
      this.port = await serial.requestPort();
      await this.port.open({ baudRate: 115200 });
      if (!this.port.readable || !this.port.writable) throw new Error('El puerto no se pudo abrir');
      this.writer = this.port.writable.getWriter();
      this.running = true;
      this.cbStatus('connected', 'Conectado por USB');
      this.send('HELLO');
      this.hb = setInterval(() => this.send('HB'), 1000);
      void this.readLoop();
    } catch (e) {
      this.running = false;
      const msg = e instanceof Error ? e.message : String(e);
      this.cbStatus('error', /No port selected/i.test(msg) ? 'No se eligió ningún puerto' : `No se pudo conectar: ${msg}`);
      await this.cleanup();
    }
  }

  async stop(): Promise<void> {
    this.running = false;
    await this.cleanup();
    this.cbStatus('idle', 'Desconectado');
  }

  send(cmd: string): void {
    if (!this.writer) return;
    this.writer.write(new TextEncoder().encode(cmd + '\n')).catch(() => {});
  }

  private async cleanup(): Promise<void> {
    if (this.hb) clearInterval(this.hb);
    this.hb = null;
    try { await this.reader?.cancel(); } catch { /* ya cerrado */ }
    try { this.reader?.releaseLock(); } catch { /* ya liberado */ }
    try { this.writer?.releaseLock(); } catch { /* ya liberado */ }
    try { await this.port?.close(); } catch { /* ya cerrado */ }
    this.reader = null;
    this.writer = null;
    this.port = null;
  }

  private async readLoop(): Promise<void> {
    if (!this.port?.readable) return;
    this.reader = this.port.readable.getReader();
    const dec = new TextDecoder();
    let buf = '';
    try {
      while (this.running) {
        const { value, done } = await this.reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i: number;
        while ((i = buf.indexOf('\n')) >= 0) {
          this.handleLine(buf.slice(0, i).trim());
          buf = buf.slice(i + 1);
        }
        if (buf.length > 2000) buf = '';
      }
    } catch (e) {
      if (this.running) this.cbStatus('error', `Se perdió la conexión: ${e instanceof Error ? e.message : e}`);
    }
    if (this.running) {
      this.running = false;
      await this.cleanup();
      this.cbStatus('error', 'El ESP32 se desconectó');
    }
  }

  private handleLine(line: string) {
    if (!line.startsWith('{')) return;
    let o: Record<string, unknown>;
    try { o = JSON.parse(line); } catch { return; }
    if (o.hello) {
      this.cbHello({ normal: Number(o.normal), incompleta: Number(o.incompleta), fw: String(o.fw ?? '') });
      return;
    }
    if (typeof o.info === 'string') { this.cbInfo(o.info); return; }
    const h = o.h as number[] | undefined;
    const w = o.w as number[] | undefined;
    if (typeof o.t !== 'number' || !Array.isArray(h) || !Array.isArray(w)) return;
    this.cbSample({
      t: o.t,
      servoDeg: Number(o.sv) || 0,
      hallRaw: [h[0] ?? 0, h[1] ?? 0, h[2] ?? 0],
      hallW: [w[0] ?? 0, w[1] ?? 0, w[2] ?? 0],
      hallDeg: Number(o.hd) || 0,
      mode: o.m === 'INCOMPLETA' ? 'INCOMPLETA' : ('SANO' as ValveMode),
      phase: String(o.f ?? ''),
      cycle: Number(o.c) || 0,
      active: o.on !== 0,
      calibrated: o.cv === 1,
      calProgress: o.cp === undefined ? 100 : Number(o.cp) || 0,
    });
  }
}
