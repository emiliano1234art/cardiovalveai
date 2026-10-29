"""
CardioValveAI v4 — deja el servo en la posición de MONTAJE (comando 180°) y le corta los pulsos.

Con el servo en 180°, se calza el horn + manivela con el pasador hacia ABAJO (horn colgando) y se monta el servo en el cuerpo.
Así quedan valvas cerradas = comando 130° y abiertas = 50°, que son los valores por omisión del firmware
(no hace falta cambiar nada en el firmware ni en cvai_record.py / cvai_calibrate.py).

    python cvai_montaje.py --port /dev/cu.usbserial-0001

Conectar SOLO el servo (sin montar) y su fuente de 5 V. Al reiniciar el ESP32, los límites vuelven a 45–135°.
"""
from __future__ import annotations
import argparse
import time

from cvai_record import Link


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--port', required=True)
    ap.add_argument('--baud', type=int, default=921600)
    ap.add_argument('--angulo', type=float, default=180.0, help='comando de montaje (180 por omisión)')
    a = ap.parse_args(argv)
    link = Link(a.port, a.baud)
    try:
        for cmd in ('STOP', f'SET max {a.angulo:.0f}', f'MOVE {a.angulo:.0f} 1500'):
            link.send(cmd); time.sleep(0.3)
        time.sleep(2.0)
        link.send('DETACH'); time.sleep(0.2)
        link.send('SET max 135')
    finally:
        link.close()
    print(f'Servo en {a.angulo:.0f}° y sin pulsos. Calzar el horn con el brazo hacia ABAJO (pasador de la manivela abajo) y montar.')


if __name__ == '__main__':
    main()
