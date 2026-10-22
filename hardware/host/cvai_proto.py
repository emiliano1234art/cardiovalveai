"""
CardioVal AI v2 — decodificador del protocolo serie (ver firmware/.../main/proto.h).

Trama:  A5 5A | tipo u8 | largo u16 | secuencia u16 | carga | CRC16-CCITT u16 (sobre tipo..carga)
"""
from __future__ import annotations
import json
import struct
from dataclasses import dataclass, field
import numpy as np

SYNC = b'\xA5\x5A'
FR_INFO, FR_FAST, FR_HALL, FR_AUDIO, FR_CMD, FR_EVENT, FR_STATUS, FR_TEXT, FR_INA = range(1, 10)
TYPE_NAMES = {FR_INFO: 'INFO', FR_FAST: 'FAST', FR_HALL: 'HALL', FR_AUDIO: 'AUDIO', FR_CMD: 'CMD', FR_EVENT: 'EVENT',
              FR_STATUS: 'STATUS', FR_TEXT: 'TEXT', FR_INA: 'INA'}
EVENT_NAMES = {1: 'CYCLE_START', 2: 'OPEN_CMD_START', 3: 'OPEN_CMD_END', 4: 'CLOSE_CMD_START', 5: 'CLOSE_CMD_END',
               6: 'SYNC_LED_ON', 7: 'SYNC_LED_OFF', 8: 'RUN_START', 9: 'RUN_END', 10: 'STOP_USER', 11: 'STOP_ESTOP',
               12: 'STOP_HEARTBEAT', 13: 'STOP_STALL', 14: 'STOP_ACQ_FAULT', 15: 'SERVO_DETACHED', 16: 'SERVO_ATTACHED',
               17: 'STOP_OVERCURRENT', 18: 'ESTOP_RELEASED', 20: 'ADC_POOL_OVF', 21: 'I2S_OVF', 22: 'ADC_PATTERN_ERR', 23: 'TX_DROP'}
PHASES = ['DETACHED', 'IDLE', 'OPENING', 'DWELL_OPEN', 'CLOSING', 'DWELL_CLOSED', 'MOVING', 'STOPPING']

BLOCK_HDR = struct.Struct('<qIHBB')          # t_last_us, idx0, n, nch|fmt, flags
CMD = struct.Struct('<qhHBI')
EVENT = struct.Struct('<qBi')
INA_HDR = struct.Struct('<qIHH')
STATUS = struct.Struct('<q8I6IIIHHHHhBBIh')


def crc16(data: bytes, crc: int = 0xFFFF) -> int:
    for b in data:
        crc ^= b << 8
        for _ in range(8):
            crc = ((crc << 1) ^ 0x1021) & 0xFFFF if crc & 0x8000 else (crc << 1) & 0xFFFF
    return crc


def encode(ftype: int, seq: int, payload: bytes) -> bytes:
    """Arma una trama (lo usa el emulador y las pruebas)."""
    body = struct.pack('<BHH', ftype, len(payload), seq & 0xFFFF) + payload
    return SYNC + body + struct.pack('<H', crc16(body))


@dataclass
class Parser:
    """Analizador incremental: tolera basura (p. ej. el texto del cargador de arranque) y tramas corruptas."""
    buf: bytearray = field(default_factory=bytearray)
    crc_errors: int = 0
    resyncs: int = 0
    last_seq: dict = field(default_factory=dict)
    seq_gaps: dict = field(default_factory=dict)

    def feed(self, data: bytes):
        self.buf += data
        out = []
        while True:
            i = self.buf.find(SYNC)
            if i < 0:
                if len(self.buf) > 1:
                    del self.buf[:-1]
                break
            if i > 0:
                self.resyncs += 1
                del self.buf[:i]
            if len(self.buf) < 7:
                break
            ftype, ln, seq = struct.unpack_from('<BHH', self.buf, 2)
            if ftype not in TYPE_NAMES or ln > 4096:
                self.resyncs += 1
                del self.buf[:2]
                continue
            total = 7 + ln + 2
            if len(self.buf) < total:
                break
            body = bytes(self.buf[2:7 + ln])
            (crc,) = struct.unpack_from('<H', self.buf, 7 + ln)
            if crc16(body) != crc:
                self.crc_errors += 1
                del self.buf[:2]
                continue
            prev = self.last_seq.get(ftype)
            if prev is not None and seq != (prev + 1) & 0xFFFF:
                self.seq_gaps[ftype] = self.seq_gaps.get(ftype, 0) + ((seq - prev - 1) & 0xFFFF)
            self.last_seq[ftype] = seq
            out.append((ftype, seq, body[5:]))
            del self.buf[:total]
        return out


def decode_stream(raw: bytes) -> dict:
    """Decodifica una grabación .bin completa → diccionario de arreglos numpy con tiempos en segundos (esp_timer)."""
    p = Parser()
    frames = p.feed(raw)
    fast_t, fast_v, fast_flags = [], [], []
    hall_t, hall_v, hall_flags = [], [], []
    aud_t, aud_v, aud_rate, aud_flags = [], [], None, []
    cmd, events, status, texts, info, ina_t, ina_v = [], [], [], [], None, [], []
    fast_rate = hall_rate = None
    for ftype, seq, pl in frames:
        if ftype == FR_INFO:
            info = json.loads(pl.decode('utf-8'))
            fast_rate = info['adc']['fast_rate']
            hall_rate = info['adc']['hall_rate']
        elif ftype in (FR_FAST, FR_HALL, FR_AUDIO):
            t_last, idx0, n, nch, flags = BLOCK_HDR.unpack_from(pl)
            if ftype == FR_FAST:
                v = np.frombuffer(pl, '<i2', offset=BLOCK_HDR.size).reshape(n, nch)
                rate = fast_rate or 8000
                fast_t.append(t_last * 1e-6 - (n - 1 - np.arange(n)) / rate); fast_v.append(v); fast_flags.append((t_last, flags))
            elif ftype == FR_HALL:
                v = np.frombuffer(pl, '<u2', offset=BLOCK_HDR.size).reshape(n, nch)
                rate = hall_rate or 1000
                hall_t.append(t_last * 1e-6 - (n - 1 - np.arange(n)) / rate); hall_v.append(v); hall_flags.append((t_last, flags))
            else:
                v = np.frombuffer(pl, '<i2', offset=BLOCK_HDR.size)
                rate = 16000 if nch == 0 else 8000
                aud_rate = rate
                aud_t.append(t_last * 1e-6 - (n - 1 - np.arange(n)) / rate); aud_v.append(v); aud_flags.append((t_last, flags))
        elif ftype == FR_CMD:
            t, dx100, us, ph, cyc = CMD.unpack(pl)
            cmd.append((t * 1e-6, dx100 / 100.0, us, ph, cyc))
        elif ftype == FR_EVENT:
            t, code, arg = EVENT.unpack(pl)
            events.append((t * 1e-6, code, EVENT_NAMES.get(code, str(code)), arg))
        elif ftype == FR_STATUS:
            status.append(STATUS.unpack(pl))
        elif ftype == FR_TEXT:
            texts.append(pl.decode('utf-8', 'replace'))
        elif ftype == FR_INA:
            t_last, idx0, n, ua = INA_HDR.unpack_from(pl)
            v = np.frombuffer(pl, '<i2', offset=INA_HDR.size).astype(float) * ua / 1000.0
            ina_t.append(t_last * 1e-6 - (n - 1 - np.arange(n)) / 500.0); ina_v.append(v)
    cat = lambda L, shape: np.concatenate(L) if L else np.zeros(shape)
    d = {
        'info': info, 'texts': texts,
        'fast_t': cat(fast_t, (0,)), 'fast': cat(fast_v, (0, 2)),
        'hall_t': cat(hall_t, (0,)), 'hall': cat(hall_v, (0, 4)),
        'audio_t': cat(aud_t, (0,)), 'audio': cat(aud_v, (0,)), 'audio_rate': aud_rate,
        'cmd': np.array(cmd, float).reshape(-1, 5), 'events': events,
        'status': np.array(status, float) if status else np.zeros((0, len(STATUS.unpack(bytes(STATUS.size))))),
        'ina_t': cat(ina_t, (0,)), 'ina_ma': cat(ina_v, (0,)),
        'flags': {'fast': fast_flags, 'hall': hall_flags, 'audio': aud_flags},
        'link': {'crc_errors': p.crc_errors, 'resyncs': p.resyncs, 'seq_gaps': {TYPE_NAMES[k]: v for k, v in p.seq_gaps.items()}},
    }
    return d


STATUS_FIELDS = ['t_us', 'adc_frames', 'adc_ovf', 'adc_pat_err', 'adc_gaps', 'i2s_frames', 'i2s_ovf', 'tx_dropped', 'tx_bytes',
                 'sat_P1', 'sat_P2', 'sat_H0', 'sat_H1', 'sat_H2', 'sat_H3', 'audio_sat', 'free_heap',
                 'hall0', 'hall1', 'hall2', 'hall3', 'cmd_x100', 'phase', 'estop', 'cycle', 'servo_ma']
assert len(STATUS_FIELDS) == len(STATUS.unpack(bytes(STATUS.size)))
