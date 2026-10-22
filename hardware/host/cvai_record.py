"""
CardioVal AI v2 — registro (y vista en vivo opcional) desde el ESP32 por USB.

Ejemplos (Mac):
  python cvai_record.py --port /dev/cu.usbserial-0001 --modo NORMAL --ciclos 20 --live
  python cvai_record.py --port /dev/cu.SLAB_USBtoUART --modo RESTRINGIDA_60 --ciclos 30 --nota "tope 60 en valva 1"
  python cvai_record.py --port /dev/ttys012 --ciclos 5          # con cvai_emulator.py (datos SINTÉTICOS)

Guarda en <salida>/<fecha>_<modo>/:
  raw.bin       todo lo recibido, sin modificar (fuente primaria)
  session.json  metadatos: fuente (ESP32 o EMULADOR), modo declarado, parámetros, INFO del firmware, estado del enlace
  session.npz   señales decodificadas (tiempos en s del reloj del ESP32)
  audio.wav     micrófono (si hubo audio)
El modo mecánico (piezas instaladas) lo declara el operador con --modo: el firmware no puede verlo.
"""
from __future__ import annotations
import argparse
import json
import os
import sys
import threading
import time
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import cvai_proto as P   # noqa: E402

MODES = ['NORMAL', 'RESTRINGIDA_60', 'RESTRINGIDA_45', 'CIERRE_INCOMPLETO', 'ASIMETRICO', 'OTRO']


class Link:
    def __init__(self, port, baud):
        import serial
        self.ser = serial.Serial(port, baud, timeout=0.05)
        self.ser.reset_input_buffer()
        self.wlock = threading.Lock()

    def send(self, line: str):
        with self.wlock:
            self.ser.write((line.strip() + '\n').encode('ascii'))

    def read(self):
        return self.ser.read(8192)

    def close(self):
        self.ser.close()


class Recorder:
    def __init__(self, link: Link, raw_path: str):
        self.link = link
        self.raw = open(raw_path, 'wb')
        self.parser = P.Parser()
        self.stop = threading.Event()
        self.info = None
        self.texts = []
        self.events = []
        self.live = {'hall_t': [], 'hall': [], 'fast_t': [], 'fast': [], 'aud_t': [], 'aud_rms': [], 'cmd': [], 'status': None}
        self.lock = threading.Lock()
        self.bytes = 0

    def rx_loop(self):
        while not self.stop.is_set():
            d = self.link.read()
            if not d:
                continue
            self.raw.write(d)
            self.bytes += len(d)
            for ftype, seq, pl in self.parser.feed(d):
                self.on_frame(ftype, pl)

    def on_frame(self, ftype, pl):
        if ftype == P.FR_INFO:
            self.info = json.loads(pl.decode())
        elif ftype == P.FR_TEXT:
            s = pl.decode('utf-8', 'replace'); self.texts.append(s); print('  ESP32:', s)
        elif ftype == P.FR_EVENT:
            t, code, arg = P.EVENT.unpack(pl)
            name = P.EVENT_NAMES.get(code, str(code)); self.events.append((t * 1e-6, name, arg))
            if name.startswith('STOP') or name in ('ADC_POOL_OVF', 'I2S_OVF', 'SERVO_DETACHED'):
                print(f'  EVENTO {name} ({arg}) t={t * 1e-6:.3f}s')
        elif ftype in (P.FR_HALL, P.FR_FAST, P.FR_AUDIO, P.FR_CMD, P.FR_STATUS):
            with self.lock:
                L = self.live
                if ftype == P.FR_HALL:
                    t, i0, n, nch, fl = P.BLOCK_HDR.unpack_from(pl)
                    v = np.frombuffer(pl, '<u2', offset=16).reshape(n, nch)
                    L['hall_t'].append(t * 1e-6 - (n - 1 - np.arange(n)) / 1000.0); L['hall'].append(v)
                elif ftype == P.FR_FAST:
                    t, i0, n, nch, fl = P.BLOCK_HDR.unpack_from(pl)
                    v = np.frombuffer(pl, '<i2', offset=16).reshape(n, nch)[::8]       # vista reducida
                    L['fast_t'].append(t * 1e-6 - (n - 1 - np.arange(0, n, 8)) / 8000.0); L['fast'].append(v)
                elif ftype == P.FR_AUDIO:
                    t, i0, n, fmt, fl = P.BLOCK_HDR.unpack_from(pl)
                    v = np.frombuffer(pl, '<i2', offset=16).astype(float)
                    L['aud_t'].append(t * 1e-6); L['aud_rms'].append(float(np.sqrt(np.mean(v ** 2))))
                elif ftype == P.FR_CMD:
                    t, dx, us, ph, cyc = P.CMD.unpack(pl); L['cmd'].append((t * 1e-6, dx / 100))
                elif ftype == P.FR_STATUS:
                    L['status'] = dict(zip(P.STATUS_FIELDS, P.STATUS.unpack(pl)))
                for k in ('hall_t', 'hall', 'fast_t', 'fast'):
                    if len(L[k]) > 400:
                        del L[k][:len(L[k]) - 400]
                for k in ('aud_t', 'aud_rms', 'cmd'):
                    if len(L[k]) > 4000:
                        del L[k][:len(L[k]) - 4000]

    def hb_loop(self):
        while not self.stop.is_set():
            self.link.send('HB')
            time.sleep(0.5)


def live_plot(rec: Recorder, calib: dict | None, synthetic: bool, title: str):
    import matplotlib.pyplot as plt
    from matplotlib.animation import FuncAnimation
    sys.path.insert(0, HERE)
    import cvai_analyze as A
    fig, ax = plt.subplots(4, 1, figsize=(11, 8.5), sharex=True)
    fig.canvas.manager.set_window_title(title)
    if synthetic:
        fig.text(0.5, 0.5, 'SINTÉTICO — EMULADOR', fontsize=46, color='red', alpha=0.15, ha='center', va='center', rotation=20)
    alert = fig.text(0.01, 0.005, '', fontsize=9, color='crimson')

    def upd(_):
        with rec.lock:
            L = rec.live
            ht = np.concatenate(L['hall_t']) if L['hall_t'] else np.zeros(0)
            hv = np.concatenate(L['hall']) if L['hall'] else np.zeros((0, 4))
            ft = np.concatenate(L['fast_t']) if L['fast_t'] else np.zeros(0)
            fv = np.concatenate(L['fast']) if L['fast'] else np.zeros((0, 2))
            at, ar = np.array(L['aud_t']), np.array(L['aud_rms'])
            cm = np.array(L['cmd']).reshape(-1, 2)
            st = L['status']
        if len(ht) == 0:
            return
        t1 = ht[-1]; t0 = t1 - 6.0
        for a in ax:
            a.cla()
        if calib:
            ang = A.hall_to_angles(hv, calib)
            for i in range(3):
                ax[0].plot(ht, ang[:, i], label=f'θ{i+1} medido (calibrado)')
            ax[0].set_ylabel('ángulo (°)')
        else:
            for i in range(1, 4):
                ax[0].plot(ht, hv[:, i] / 8, label=f'H{i} crudo (sin calibrar)')
            ax[0].set_ylabel('cuentas ADC')
        ax0b = ax[0].twinx()
        if len(cm):
            ax0b.plot(cm[:, 0], cm[:, 1], 'k--', lw=1, label='comando (no es posición)')
        ax0b.set_ylabel('comando servo (°)')
        ax[0].legend(loc='upper left', fontsize=7)
        ax[1].plot(ht, hv[:, 0] / 8, color='tab:purple'); ax[1].set_ylabel('H0 plato (cuentas)')
        if len(ft):
            ax[2].plot(ft, fv[:, 0], lw=0.6, label='P1 anillo'); ax[2].plot(ft, fv[:, 1], lw=0.6, label='P2 soporte servo')
        ax[2].set_ylabel('piezo (cuentas)'); ax[2].legend(loc='upper left', fontsize=7)
        if len(at):
            ax[3].plot(at, ar, color='tab:green'); ax[3].set_ylabel('audio RMS/bloque')
        ax[3].set_xlabel('tiempo ESP32 (s)')
        ax[3].set_xlim(t0, t1)
        msg = []
        if st:
            sat = [k for k in ('sat_P1', 'sat_P2', 'sat_H0', 'sat_H1', 'sat_H2', 'sat_H3', 'audio_sat') if st[k] > 0]
            if sat: msg.append('SATURACIÓN: ' + ', '.join(sat))
            if st['adc_ovf'] or st['i2s_ovf']: msg.append(f"PÉRDIDA en ESP32: adc_ovf={st['adc_ovf']} i2s_ovf={st['i2s_ovf']}")
            if st['tx_dropped']: msg.append(f"tramas descartadas en ESP32: {st['tx_dropped']}")
            if st['estop']: msg.append('PARADA DE EMERGENCIA ACTIVA')
        gaps = rec.parser.seq_gaps
        if gaps: msg.append('saltos de secuencia: ' + str({P.TYPE_NAMES[k]: v for k, v in gaps.items()}))
        if rec.parser.crc_errors: msg.append(f'CRC errados: {rec.parser.crc_errors}')
        alert.set_text(' · '.join(msg))

    anim = FuncAnimation(fig, upd, interval=250, cache_frame_data=False)
    plt.tight_layout()
    plt.show()
    return anim


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--port', required=True)
    ap.add_argument('--baud', type=int, default=921600)
    ap.add_argument('--salida', default=os.path.join(HERE, 'sesiones'))
    ap.add_argument('--modo', default='NORMAL', choices=MODES, help='piezas instaladas (lo declara el operador)')
    ap.add_argument('--ciclos', type=int, default=10, help='0 = solo registrar, sin mover el servo')
    ap.add_argument('--t-open', type=int); ap.add_argument('--t-close', type=int)
    ap.add_argument('--t-dwell-open', type=int); ap.add_argument('--t-dwell-closed', type=int)
    ap.add_argument('--duracion', type=float, help='segundos máximos de registro')
    ap.add_argument('--nota', default='')
    ap.add_argument('--calib', help='archivo de calibración Hall (cvai_calibrate.py) para la vista en vivo')
    ap.add_argument('--live', action='store_true')
    args = ap.parse_args(argv)

    stamp = time.strftime('%Y%m%d_%H%M%S')
    out = os.path.join(args.salida, f'{stamp}_{args.modo}')
    os.makedirs(out, exist_ok=True)
    link = Link(args.port, args.baud)
    rec = Recorder(link, os.path.join(out, 'raw.bin'))
    threading.Thread(target=rec.rx_loop, daemon=True).start()
    link.send('STREAM OFF'); time.sleep(0.2)
    link.send('INFO')
    t_wait = time.time()
    while rec.info is None and time.time() - t_wait < 3:
        time.sleep(0.05)
    if rec.info is None:
        print('ERROR: no llegó la trama INFO (¿puerto/baudios correctos? ¿firmware v2 cargado?)'); rec.stop.set(); link.close(); return 2
    source = rec.info.get('fuente', 'ESP32 (firmware ' + rec.info.get('fw', '?') + ')')
    synthetic = 'EMULADOR' in source
    print('Fuente de datos:', source)
    for k, v in (('t_open', args.t_open), ('t_close', args.t_close), ('t_dwell_open', args.t_dwell_open), ('t_dwell_closed', args.t_dwell_closed)):
        if v is not None:
            link.send(f'SET {k} {v}'); time.sleep(0.05)
    link.send('INFO'); time.sleep(0.2)
    threading.Thread(target=rec.hb_loop, daemon=True).start()
    link.send('STREAM ON'); time.sleep(0.3)
    if args.ciclos > 0:
        link.send(f'START {args.ciclos}')
    calib = json.load(open(args.calib)) if args.calib else None
    t_start = time.time()
    try:
        if args.live:
            live_plot(rec, calib, synthetic, f'CardioVal AI v2 · {args.modo} · {source}')
        else:
            while True:
                time.sleep(0.2)
                ended = any(e[1] in ('RUN_END', 'SERVO_DETACHED') for e in rec.events)
                if args.ciclos > 0 and ended:
                    time.sleep(0.5); break
                if args.duracion and time.time() - t_start > args.duracion:
                    break
    except KeyboardInterrupt:
        print('Interrumpido por el usuario')
    finally:
        link.send('STOP'); time.sleep(1.0)
        link.send('STREAM OFF'); time.sleep(0.3)
        rec.stop.set(); time.sleep(0.2)
        rec.raw.close(); link.close()

    raw = open(os.path.join(out, 'raw.bin'), 'rb').read()
    d = P.decode_stream(raw)
    meta = {
        'proyecto': 'CardioVal AI', 'revision': 'v2', 'fecha': stamp, 'puerto': args.port, 'baudios': args.baud,
        'fuente': source, 'sintetico': synthetic, 'modo_declarado': args.modo, 'ciclos_pedidos': args.ciclos, 'nota': args.nota,
        'info_firmware': d['info'], 'enlace': d['link'], 'bytes_recibidos': len(raw), 'eventos': len(d['events']),
        'archivos': ['raw.bin', 'session.npz'] + (['audio.wav'] if len(d['audio']) else []),
        'advertencia': 'Prototipo académico sin fluido. No es un dispositivo médico ni diagnóstico.',
    }
    save_npz(os.path.join(out, 'session.npz'), d)
    if len(d['audio']):
        from scipy.io import wavfile
        wavfile.write(os.path.join(out, 'audio.wav'), int(d['audio_rate']), d['audio'].astype(np.int16))
    json.dump(meta, open(os.path.join(out, 'session.json'), 'w'), indent=1, ensure_ascii=False)
    st = d['status'][-1] if len(d['status']) else None
    print(f'Sesión guardada en {out}')
    print(f"  enlace: CRC errados {d['link']['crc_errors']}, resincronizaciones {d['link']['resyncs']}, saltos {d['link']['seq_gaps']}")
    if st is not None:
        s = dict(zip(P.STATUS_FIELDS, st))
        print(f"  ESP32: adc_ovf {int(s['adc_ovf'])}, i2s_ovf {int(s['i2s_ovf'])}, tramas descartadas {int(s['tx_dropped'])}, "
              f"saturaciones P1/P2/H0..H3 {[int(s[k]) for k in ('sat_P1', 'sat_P2', 'sat_H0', 'sat_H1', 'sat_H2', 'sat_H3')]}")
    return 0


def save_npz(path, d):
    ev = d['events']
    np.savez_compressed(path, fast_t=d['fast_t'], fast=d['fast'], hall_t=d['hall_t'], hall=d['hall'], audio_t=d['audio_t'], audio=d['audio'],
                        audio_rate=np.array(d['audio_rate'] or 0), cmd=d['cmd'], status=d['status'], ina_t=d['ina_t'], ina_ma=d['ina_ma'],
                        ev_t=np.array([e[0] for e in ev]), ev_code=np.array([e[1] for e in ev]), ev_arg=np.array([e[3] for e in ev]),
                        info=np.array(json.dumps(d['info'] or {})))


if __name__ == '__main__':
    sys.exit(main())
