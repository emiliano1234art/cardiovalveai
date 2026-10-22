"""
CardioVal AI v2 — EMULADOR del ESP32 (DATOS SINTÉTICOS, solo para probar el software sin hardware).

Crea un puerto serie virtual (pty) y habla el MISMO protocolo que el firmware. Las señales se generan con:
  - la cinemática del CAD (kinematics.py) y un retardo de primer orden del servo (τ supuesto),
  - el modelo dipolar de los imanes (sensing.py) → tensión del DRV5055 → cuentas de ADC,
  - ruido y una vibración del servo INVENTADA (no medida).
Nada de lo que produce este programa es una medición. La trama INFO lo declara ("fuente": "EMULADOR …")
y el registrador lo copia a session.json; los gráficos llevan la marca «SINTÉTICO».

Uso:  python cvai_emulator.py [--modo NORMAL] [--falla atasco:5] [--falla asimetria:3] [--falla cierre:7]
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
    def __init__(self, mode: str, faults: dict, seed: int = 1):
        self.mode = mode
        self.faults = faults
        self.rng = np.random.default_rng(seed)
        th = np.linspace(-6, 88, 189)
        h = S.HALL_LEAF
        _, B = S.leaflet_response(np.array([h['x'], h['y'], h['z']]), 'xyz'.index(h['axis']), h['s'], h['mag'], thetas=th)
        self.th_tab, self.B_tab = th, np.abs(B)
        tr, Bz = S.plate_response(S.HALL_PLATE['gap_closed'], S.HALL_PLATE['mag'])
        self.tr_tab, self.Bz_tab = tr, Bz
        self.gain = 1 + 0.08 * self.rng.standard_normal(3)          # dispersión de imanes/montaje (supuesta)
        self.offs = 15 * self.rng.standard_normal(4)                 # mV de desvío por sensor (supuesto)
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
        return th, p['zp']

    def step(self, cmd_deg: float, dt: float, cycle: int, moving: bool):
        target = cmd_deg - 90.0
        f = self.faults
        if 'atasco' in f and cycle == f['atasco']:
            target = max(target, 0.0)                                # en ese ciclo la palanca no pasa de la mitad (atasco inventado)
        self.beta += (target - self.beta) * (1 - math.exp(-dt / self.tau))
        return self.beta

    def hall_raw(self, beta: float, cycle: int):
        th, zp = self.leaf_angles(beta, cycle)
        mv = []
        travel = K.Z_TOP - zp
        bz = np.interp(travel, self.tr_tab, self.Bz_tab)
        mv.append(1650 - bz * 30.0 + self.offs[0])                   # H0: DRV5055A2, 30 mV/mT, salida baja con el campo
        for i in range(3):
            b = np.interp(th[i], self.th_tab, self.B_tab) * self.gain[i]
            mv.append(1650 - b * 60.0 + self.offs[i + 1])            # H1–H3: DRV5055A1, 60 mV/mT
        return mv_to_raw(mv), th


class Emulator:
    def __init__(self, fd, args):
        self.fd = fd
        self.m = Model(args.modo, args.faults, args.seed)
        self.seq = {}
        self.stream = False
        self.lock = threading.Lock()
        self.cfg = dict(closed=130.0, open=50.0, t_open=400, t_dwell_open=300, t_close=400, t_dwell_closed=900)
        self.phase = 0; self.cycle = 0; self.req_cycles = 0; self.cmd = 130.0
        self.t0 = time.monotonic(); self.ph_t0 = 0.0; self.ph_from = 130.0; self.ph_to = 130.0; self.ph_dur = 1.0
        self.last_hb = 0.0; self.attached = False
        self.idx = {'fast': 0, 'hall': 0, 'audio': 0}

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

    def info(self):
        js = {'fw': 'EMULADOR cvai_emulator.py', 'fuente': SOURCE, 'proto': 2, 'idf': '-', 'baud': 921600,
              'adc': {'total_rate': 64000, 'pattern': ['P1', 'H1', 'P2', 'H2', 'P1', 'H3', 'P2', 'H0'], 'atten_db': 12, 'bits': 12,
                      'fast_rate': 8000, 'fast_fir_delay_us': 937, 'hall_rate': 1000, 'hall_sum_of': 8, 'skew_p1_p2_us': 31.25,
                      'cali_scheme': 'emulador_lineal', 'cali_raw_step': 256, 'cali_mv': [int(142 + k * 256 * (3110 - 142) / 4095) for k in range(16)] + [3110]},
              'audio': {'in_rate': 16000, 'out_rate': 8000, 'shift': 8, 'slot': 0},
              'servo': {**self.cfg, 'min': 45, 'max': 135, 'us0': 500, 'us180': 2500, 'pwm_hz': 50, 'update_ms': 5},
              'ina219': True, 'modo_emulado': self.m.mode, 'fallas_emuladas': self.m.faults}
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
        hall_acc, fast_acc, aud_acc = [], [], []
        status_t = 0.0
        while True:
            next_t += blk
            t_end_us = self.now_us()
            # servo y modelo (pasos de 1 ms dentro del bloque)
            halls = []
            moving = []
            for k in range(16):
                self.servo_tick() if k % 5 == 0 else None
                mv = self.phase in (2, 4, 6, 7)
                beta = self.m.step(self.cmd, 0.001, self.cycle, mv)
                raw, th = self.m.hall_raw(beta, self.cycle)
                halls.append(raw); moving.append(mv)
            halls = np.array(halls)
            if self.stream:
                n = 16
                hsum = np.round(halls * 8 + rng.normal(0, 6, halls.shape)).clip(0, 32760).astype('<u2')
                hall_acc.append(hsum)
                # piezo: polarización ≈ 1,32 V + ruido + vibración del servo INVENTADA durante el movimiento
                tt = np.arange(128) / 8000.0 + t_end_us * 1e-6
                mvmask = np.repeat(np.array(moving, float), 8)
                vib = np.sin(2 * np.pi * 180 * tt) + 0.5 * np.sin(2 * np.pi * 540 * tt)
                p1 = 1550 + rng.normal(0, 3, 128) + 6 * vib * mvmask
                p2 = 1550 + rng.normal(0, 3, 128) + 22 * vib * mvmask
                fast_acc.append(np.stack([p1, p2], 1).round().astype('<i2'))
                a = rng.normal(0, 30, 128) + rng.normal(0, 300, 128) * mvmask
                aud_acc.append(a.round().clip(-32768, 32767).astype('<i2'))
                cmd_pl = P.CMD.pack(t_end_us, int(round(self.cmd * 100)), int(500 + 2000 * self.cmd / 180), self.phase, self.cycle)
                if self.phase not in (0,):
                    for j in range(3):                       # ~200 Hz
                        self.send(P.FR_CMD, P.CMD.pack(t_end_us - (2 - j) * 5000, int(round(self.cmd * 100)),
                                                        int(500 + 2000 * self.cmd / 180), self.phase, self.cycle))
                if len(fast_acc) == 1:
                    v = fast_acc.pop()
                    self.send(P.FR_FAST, P.BLOCK_HDR.pack(t_end_us - 937, self.idx['fast'], 128, 2, 0) + v.tobytes()); self.idx['fast'] += 128
                if len(hall_acc) == 2:
                    v = np.concatenate(hall_acc); hall_acc = []
                    self.send(P.FR_HALL, P.BLOCK_HDR.pack(t_end_us, self.idx['hall'], 32, 4, 0) + v.tobytes()); self.idx['hall'] += 32
                if len(aud_acc) == 2:
                    v = np.concatenate(aud_acc); aud_acc = []
                    self.send(P.FR_AUDIO, P.BLOCK_HDR.pack(t_end_us - 1437, self.idx['audio'], 256, 1, 0) + v.tobytes()); self.idx['audio'] += 256
                if time.monotonic() - status_t > 0.5:
                    status_t = time.monotonic()
                    ma = 210 if any(moving) else 9
                    st = P.STATUS.pack(t_end_us, self.idx['fast'] // 32, 0, 0, 0, self.idx['audio'] // 256, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 200000,
                                       *[int(x) for x in halls[-1] * 8], int(self.cmd * 100), self.phase, 0, self.cycle, ma)
                    self.send(P.FR_STATUS, st)
                    ina = (np.full(50, ma * 10) + rng.normal(0, 20, 50)).astype('<i2')
                    self.send(P.FR_INA, P.INA_HDR.pack(t_end_us, 0, 50, 100) + ina.tobytes())
            # LED de sincronización (eventos del firmware)
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
