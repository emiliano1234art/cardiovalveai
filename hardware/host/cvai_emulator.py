"""
CardioValveAI v3 — EMULADOR del ESP32 (DATOS SINTÉTICOS, solo para probar el software sin hardware).

Crea un puerto serie virtual (pty) y habla el MISMO protocolo que el firmware. Las señales se generan con:
  - la cinemática del CAD (kinematics.py) y un retardo de primer orden del servo (τ supuesto),
  - el modelo dipolar de los imanes (sensing.py) → tensión del sensor Hall elegido (--sensor) → cuentas de ADC,
  - ruido y una interferencia del servo INVENTADA (no medida).
Nada de lo que produce este programa es una medición. La trama INFO lo declara ("fuente": "EMULADOR …")
y el registrador lo copia a session.json; los gráficos llevan la marca «SINTÉTICO».

Uso:  python cvai_emulator.py [--modo NORMAL] [--sensor 'DRV5055A1 @3,3 V'] [--falla atasco:5] [--falla asimetria:3] [--falla cierre:7]
      → imprime la ruta del puerto (p. ej. /dev/ttys012) para usar con cvai_record.py
"""
from __future__ import annotations
import argparse
import json
import math
import os
import struct
import sys
import threading
import time
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'cad'))
import config as C            # noqa: E402
import kinematics as K        # noqa: E402
import sensing as S           # noqa: E402
import cvai_proto as P        # noqa: E402

SOURCE = 'EMULADOR — DATOS SINTÉTICOS (no es una medición)'


def mv_to_raw(mv):
    """Aproximación lineal de la curva del ADC a 12 dB (≈ 142 mV en 0 y ≈ 3110 mV en 4095)."""
    return np.clip((np.asarray(mv) - 142.0) / ((3110.0 - 142.0) / 4095.0), 0, 4095)


class Model:
    def __init__(self, mode: str, faults: dict, seed: int = 1, sensor: str = 'DRV5055A1 @3,3 V'):
        self.mode = mode
        self.faults = faults
        self.rng = np.random.default_rng(seed)
        self.sensor = S.SENSORS[sensor]
        th = np.linspace(-6, 88, 189)
        h = S.HALL_LEAF
        _, B = S.leaflet_response(np.array([h['x'], h['y'], h['z']]), 0, h['s'], h['mag'], thetas=th)
        self.th_tab, self.B_tab = th, np.abs(B)
        self.gain = 1 + 0.08 * self.rng.standard_normal(3)          # dispersión de imanes/montaje (supuesta)
        self.offs = 15 * self.rng.standard_normal(3)                 # mV de desvío por sensor (supuesto)
        self.beta = K.SWEEP                                          # posición real de la palanca (°)
        self.tau = 0.045                                             # s, retardo del servo (supuesto)

    def leaf_angles(self, beta: float, cycle: int):
        p = K.pose(beta, self.mode)
        th = [s['theta'] for s in p['leaves']]
        f = self.faults
        if 'asimetria' in f and cycle >= f['asimetria']:
            th[1] = min(th[1], 45.0)
        if 'cierre' in f and cycle >= f['cierre']:
            th[0] = max(th[0], 12.0)
        return th

    def step(self, cmd_deg: float, dt: float, cycle: int, moving: bool):
        target = cmd_deg - 90.0
        f = self.faults
        if 'atasco' in f and cycle == f['atasco']:
            target = max(target, 0.0)                                # en ese ciclo la palanca no pasa de la mitad (atasco inventado)
        self.beta += (target - self.beta) * (1 - math.exp(-dt / self.tau))
        return self.beta

    def raw_for_theta(self, th_list):
        p = self.sensor
        mv = [(p['vq'] - np.interp(th_list[i], self.th_tab, self.B_tab) * self.gain[i] * p['s'] / 1000.0) * 1000.0 + self.offs[i] for i in range(3)]
        return mv_to_raw(mv)

    def hall_raw(self, beta: float, cycle: int):
        th = self.leaf_angles(beta, cycle)
        return self.raw_for_theta(th), th


class Emulator:
    def __init__(self, fd, args):
        self.fd = fd
        self.m = Model(args.modo, args.faults, args.seed, args.sensor)
        self.cal = [None, None, None]
        self.cal_edit = None
        self.seq = {}
        self.stream = False
        self.lock = threading.Lock()
        self.cfg = dict(closed=130.0, open=50.0, t_open=400, t_dwell_open=300, t_close=400, t_dwell_closed=900)
        self.phase = 0; self.cycle = 0; self.req_cycles = 0; self.cmd = 130.0
        self.t0 = time.monotonic(); self.ph_t0 = 0.0; self.ph_from = 130.0; self.ph_to = 130.0; self.ph_dur = 1.0
        self.last_hb = 0.0; self.attached = False
        self.idx = {'hall': 0, 'audio': 0}

    def now_us(self):
        return int((time.monotonic() - self.t0) * 1e6)

    def send(self, ftype, payload: bytes):
        s = self.seq.get(ftype, 0)
        self.seq[ftype] = s + 1
        with self.lock:
            os.write(self.fd, P.encode(ftype, s, payload))

    def text(self, s):
        self.send(P.FR_TEXT, s.encode())

    def event(self, code, arg=0):
        self.send(P.FR_EVENT, P.EVENT.pack(self.now_us(), code, arg))

    def cal_status(self, i):
        c = self.cal[i]
        if not c:
            return {'sensor': f'H{i+1}', 'valida': False, 'puntos': 0, 'crc': '00000000', 'min': 0, 'max': 0, 'estado': 'ausente'}
        return {'sensor': f'H{i+1}', 'valida': c['ok'], 'puntos': len(c['pts']), 'crc': c['crc'], 'min': c['min'], 'max': c['max'], 'estado': c['estado']}

    def info(self):
        js = {'fw': 'EMULADOR cvai_emulator.py', 'proyecto': 'CardioValveAI', 'fuente': SOURCE, 'proto': 3, 'idf': '-', 'baud': 921600,
              'adc': {'total_rate': 24000, 'pattern': ['H1', 'H2', 'H3'], 'atten_db': 12, 'bits': 12, 'hall_rate': 1000, 'hall_sum_of': 8,
                      'skew_us': [0, 41.67, 83.33], 'cali_scheme': 'emulador_lineal', 'cali_raw_step': 256,
                      'cali_mv': [int(142 + k * 256 * (3110 - 142) / 4095) for k in range(16)] + [3110]},
              'calibracion': [self.cal_status(i) for i in range(3)],
              'audio': {'in_rate': 16000, 'out_rate': 8000, 'shift': 8, 'slot': 0},
              'servo': {**self.cfg, 'min': 45, 'max': 135, 'us0': 500, 'us180': 2500, 'pwm_hz': 50, 'update_ms': 5, 'stall': 200, 'lim_min': -8, 'lim_max': 86},
              'modo_emulado': self.m.mode, 'fallas_emuladas': self.m.faults}
        self.send(P.FR_INFO, json.dumps(js).encode())

    # ── comandos ──
    def handle(self, line: str):
        w = line.split()
        if not w:
            return
        c = w[0].upper()
        if c == 'HB':
            self.last_hb = time.monotonic(); return
        if c == 'PING':
            self.text('OK PONG')
        elif c in ('INFO', 'GET'):
            self.info()
        elif c == 'STREAM':
            self.stream = len(w) > 1 and w[1].upper() == 'ON'; self.text(f'OK STREAM {"ON" if self.stream else "OFF"}')
        elif c == 'START':
            self.req_cycles = int(w[1]) if len(w) > 1 else 20
            self.cycle = 0; self.last_hb = time.monotonic()
            self.event(8, self.req_cycles); self.set_phase(5, self.cfg['closed'], self.cfg['closed'], self.cfg['t_dwell_closed'])
            if not self.attached:
                self.attached = True; self.event(16, int(self.cmd * 100))
            self.text(f'OK START {self.req_cycles}')
        elif c == 'STOP':
            self.event(10); self.set_phase(7, self.cmd, self.cfg['closed'], 800); self.text('OK STOP')
        elif c == 'MOVE' and len(w) >= 2:
            ms = int(w[2]) if len(w) > 2 else 500
            if not self.attached:
                self.attached = True; self.event(16, int(self.cmd * 100))
            self.set_phase(6, self.cmd, float(w[1]), ms); self.last_hb = time.monotonic(); self.text(f'OK MOVE {w[1]} {ms}')
        elif c == 'CAL' and len(w) >= 2:
            sub = w[1].upper()
            if sub == 'BEGIN':
                self.cal_edit = (int(w[2]) - 1, []); self.text(f'OK CAL BEGIN {w[2]}')
            elif sub == 'PT' and self.cal_edit:
                self.cal_edit[1].append((int(w[2]), float(w[3])))
            elif sub == 'END' and self.cal_edit:
                i, pts = self.cal_edit; pts.sort()
                r = [p[0] for p in pts]; t = [p[1] for p in pts]
                d = np.diff(t)
                ok = len(pts) >= 5 and len(set(r)) == len(r) and (np.all(d > 0) or np.all(d < 0)) and (max(t) - min(t)) >= 30
                estado = 'válida' if ok else 'rechazada (mín. 5 puntos, monótona, rango ≥ 30°)'
                import zlib
                crc = f'{zlib.crc32(json.dumps(pts).encode()) & 0xffffffff:08x}'
                if ok:
                    self.cal[i] = {'pts': pts, 'ok': True, 'crc': crc, 'min': min(t), 'max': max(t), 'estado': estado}
                self.text(('OK' if ok else 'ERR') + f' CAL H{i+1} {estado}'); self.cal_edit = None; self.info()
            elif sub == 'CLEAR':
                self.cal[int(w[2]) - 1] = None; self.text(f'OK CAL CLEAR {w[2]}'); self.info()
        elif c == 'SET' and len(w) >= 3:
            if w[1] in self.cfg:
                self.cfg[w[1]] = float(w[2]); self.text(f'OK SET {w[1]} {w[2]}'); self.info()
            else:
                self.text(f'OK SET {w[1]} {w[2]} (ignorado por el emulador)')
        else:
            self.text(f'ERR comando desconocido: {c}')

    def set_phase(self, ph, a, b, ms):
        self.phase, self.ph_from, self.ph_to, self.ph_dur, self.ph_t0 = ph, a, b, max(ms, 1) / 1000.0, time.monotonic()

    def servo_tick(self):
        if self.phase in (0, 1):
            return
        u = min(1.0, (time.monotonic() - self.ph_t0) / self.ph_dur)
        if self.phase in (2, 4, 6, 7):
            self.cmd = self.ph_from + (self.ph_to - self.ph_from) * (0.5 - 0.5 * math.cos(math.pi * u))
        if self.phase in (2, 3, 4, 5, 6) and self.phase != 6 and time.monotonic() - self.last_hb > 2.0:
            self.event(12); self.set_phase(7, self.cmd, self.cfg['closed'], 800); return
        if u < 1.0:
            return
        if self.phase == 2:
            self.event(3, self.cycle); self.set_phase(3, self.cmd, self.cmd, self.cfg['t_dwell_open'])
        elif self.phase == 3:
            self.event(4, self.cycle); self.set_phase(4, self.cmd, self.cfg['closed'], self.cfg['t_close'])
        elif self.phase == 4:
            self.event(5, self.cycle); self.cycle += 1; self.set_phase(5, self.cmd, self.cmd, self.cfg['t_dwell_closed'])
        elif self.phase == 5:
            if self.req_cycles and self.cycle >= self.req_cycles:
                self.event(9, self.cycle); self.phase = 1; return
            self.event(1, self.cycle); self.event(6, self.cycle); self.event(2, self.cycle)
            self.set_phase(2, self.cmd, self.cfg['open'], self.cfg['t_open'])
        elif self.phase == 6:
            self.phase = 1
        elif self.phase == 7:
            self.phase = 0; self.attached = False; self.event(15, 10)

    def run(self):
        rng = self.m.rng
        blk = 0.016                              # 16 ms por bloque
        next_t = time.monotonic()
        led_off = None
        hall_acc, aud_acc = [], []
        status_t = 0.0
        while True:
            next_t += blk
            t_end_us = self.now_us()
            halls, moving = [], []
            for k in range(16):
                self.servo_tick() if k % 5 == 0 else None
                mv = self.phase in (2, 4, 6, 7)
                beta = self.m.step(self.cmd, 0.001, self.cycle, mv)
                raw, th = self.m.hall_raw(beta, self.cycle)
                halls.append(raw); moving.append(mv)
            halls = np.array(halls)
            if self.stream:
                # interferencia del motor INVENTADA (≈ 0,02 mT equivalentes) solo mientras se mueve
                interf = np.repeat(np.array(moving, float)[:, None], 3, 1) * 1.0 * np.sin(2 * np.pi * 180 * (t_end_us * 1e-6 + np.arange(16)[:, None] / 1000))
                hsum = np.round(halls * 8 + interf * 8 + rng.normal(0, 7, halls.shape)).clip(0, 32760).astype('<u2')
                hall_acc.append(hsum)
                tt = np.arange(128) / 8000.0 + t_end_us * 1e-6
                mvmask = np.repeat(np.array(moving, float), 8)
                a = rng.normal(0, 30, 128) + rng.normal(0, 300, 128) * mvmask
                aud_acc.append(a.round().clip(-32768, 32767).astype('<i2'))
                if self.phase != 0:
                    for j in range(3):                       # ~200 Hz
                        self.send(P.FR_CMD, P.CMD.pack(t_end_us - (2 - j) * 5000, int(round(self.cmd * 100)),
                                                        int(500 + 2000 * self.cmd / 180), self.phase, self.cycle))
                if len(hall_acc) == 2:
                    v = np.concatenate(hall_acc); hall_acc = []
                    self.send(P.FR_HALL, P.BLOCK_HDR.pack(t_end_us, self.idx['hall'], 32, 3, 0) + v.tobytes()); self.idx['hall'] += 32
                if len(aud_acc) == 2:
                    v = np.concatenate(aud_acc); aud_acc = []
                    self.send(P.FR_AUDIO, P.BLOCK_HDR.pack(t_end_us - 1437, self.idx['audio'], 256, 1, 0) + v.tobytes()); self.idx['audio'] += 256
                if time.monotonic() - status_t > 0.5:
                    status_t = time.monotonic()
                    cal_mask = sum((1 << i) for i in range(3) if self.cal[i])
                    st = P.STATUS.pack(t_end_us, self.idx['hall'] // 32, 0, 0, 0, self.idx['audio'] // 256, 0, 0, 0, 0, 0, 0, 0, 200000,
                                       *[int(x) for x in halls[-1] * 8], int(self.cmd * 100), self.phase, 0, self.cycle, cal_mask)
                    self.send(P.FR_STATUS, st)
            if led_off is None and self.phase == 2 and time.monotonic() - self.ph_t0 < blk:
                led_off = time.monotonic() + 0.03
            if led_off is not None and time.monotonic() >= led_off:
                self.event(7, self.cycle); led_off = None
            dt = next_t - time.monotonic()
            if dt > 0:
                time.sleep(dt)
            else:
                next_t = time.monotonic()


def reader(fd, emu: Emulator):
    buf = b''
    while True:
        try:
            d = os.read(fd, 256)
        except OSError:
            return
        buf += d
        while b'\n' in buf:
            line, buf = buf.split(b'\n', 1)
            emu.handle(line.decode('ascii', 'ignore').strip())


def parse_faults(items):
    out = {}
    for it in items or []:
        k, _, v = it.partition(':')
        out[k] = int(v or 0)
    return out


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--modo', default='NORMAL', choices=list(K.MODES))
    ap.add_argument('--falla', action='append', help='atasco:N | asimetria:N | cierre:N (desde el ciclo N, inventadas)')
    ap.add_argument('--seed', type=int, default=1)
    ap.add_argument('--sensor', default='DRV5055A1 @3,3 V', choices=list(S.SENSORS))
    ap.add_argument('--link', help='crea además un enlace simbólico a la ruta del pty')
    args = ap.parse_args(argv)
    args.faults = parse_faults(args.falla)
    import pty
    import tty
    master, slave = pty.openpty()
    tty.setraw(slave)
    path = os.ttyname(slave)
    if args.link:
        if os.path.lexists(args.link):
            os.remove(args.link)
        os.symlink(path, args.link)
    print(path, flush=True)
    print(f'# {SOURCE} · modo {args.modo} · fallas {args.faults}', file=sys.stderr, flush=True)
    emu = Emulator(master, args)
    threading.Thread(target=reader, args=(master, emu), daemon=True).start()
    time.sleep(0.2)
    emu.info()
    emu.text('EMULADOR listo (datos sintéticos)')
    emu.run()


if __name__ == '__main__':
    main()
