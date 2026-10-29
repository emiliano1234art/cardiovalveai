"""
CardioValveAI v4 — esquema básico de alimentación y conexiones (una sola hoja, schemdraw).
Hardware: ESP32 DevKit V1 por USB · servo MG90S con fuente 5 V aparte · 3 Hall LINEALES (uno por valva). Sin micrófono ni piezos.
Pines iguales a los del firmware v3 (board_pins.h): H1 GPIO36, H2 GPIO39, H3 GPIO32, servo GPIO18.
Salida: hardware/out_v4/Electronica/Esquema_v4.svg/.png
"""
import os
import schemdraw
import schemdraw.elements as elm

import config4 as C

OUT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', C.OUT_DIR, 'Electronica'))


def main():
    os.makedirs(OUT, exist_ok=True)
    d = schemdraw.Drawing(show=False)
    d.config(fontsize=10, unit=2.4)
    T = lambda txt, x, y, fs=9, **k: elm.Label().label(txt, fontsize=fs, halign=k.pop('ha', 'left'), **k).at((x, y))
    d += T(f'{C.PREFIX} · Alimentación y conexiones (banco académico, sin fluido)', 0, 11.0, fs=13)

    # ── ESP32 ──
    esp = elm.Ic(pins=[elm.IcPin('GND', side='left', slot='1/3', anchorname='GND'), elm.IcPin('3V3', side='left', slot='3/3', anchorname='V33'),
                       elm.IcPin('GPIO18', side='right', slot='4/4', anchorname='P18'), elm.IcPin('GPIO36 (VP)', side='right', slot='3/4', anchorname='P36'),
                       elm.IcPin('GPIO39 (VN)', side='right', slot='2/4', anchorname='P39'), elm.IcPin('GPIO32', side='right', slot='1/4', anchorname='P32')],
                 size=(5.0, 8.0), pinspacing=1.8)
    d += esp.at((0, 0))
    d += T('ESP32 DevKit V1', 0.6, 8.6, fs=11)
    d += T('USB a la computadora: alimenta SOLO\nal ESP32 y transmite los datos', 0.0, 10.0)
    d += elm.Line().left(1.0).at(esp.V33)
    d += T('3V3 → VCC de los\n3 Hall', esp.V33[0] - 2.6, esp.V33[1] + 0.9, fs=8)

    # ── PWM → servo (línea recta) ──
    d += elm.Line().right(1.0).at(esp.P18)
    d += elm.Resistor().right(3.0).label('R1 220 Ω', loc='top')
    d += elm.Line().right(8.0)
    sv = elm.Ic(pins=[elm.IcPin('PWM (naranjo)', side='left', slot='1/1', anchorname='P'),
                      elm.IcPin('+5V (rojo)', side='right', slot='2/2', anchorname='V'), elm.IcPin('GND (café)', side='right', slot='1/2', anchorname='G')],
                size=(4.6, 3.0))
    d += sv.anchor('P')
    d += T('Servo MG90S', sv.P[0] + 1.2, sv.P[1] + 2.0, fs=11)

    # ── fuente del servo, a la derecha ──
    d += elm.Line().right(1.2).at(sv.V)
    d += (n5 := elm.Dot())
    d += T('+5V_SERVO', n5.center[0] - 0.3, n5.center[1] + 0.45)
    d += elm.Line().right(2.6)
    d += (nc := elm.Dot())
    d += elm.Capacitor(polar=True).down().at(nc.center)
    d += (ncb := elm.Dot())
    d += T('C1 470–1000 µF\n10 V, en los\nbornes del servo', nc.center[0] + 0.4, nc.center[1] - 0.7, fs=8)
    d += elm.Line().right(2.4).at(nc.center)
    d += (sw := elm.Switch().right())
    d += T('S1 interruptor\n(corta el servo)', sw.center[0] - 1.1, sw.center[1] + 1.3, fs=8)
    d += elm.Line().right(0.6)
    d += (src := elm.SourceV().down().reverse())
    d += T('Fuente\n5 V ≥ 2 A', src.center[0] + 0.7, src.center[1] + 0.3)
    d += elm.Line().down(1.2).at(src.end)
    d += elm.Line().tox(ncb.center[0])
    d += elm.Line().at(sv.G).right(1.2)
    d += (sg := elm.Dot())
    d += elm.Line().toy(src.end[1] - 1.2)
    d += (gs := elm.Dot())
    d += elm.Line().tox(ncb.center[0]).at(gs.center)
    d += elm.Line().toy(ncb.center[1]).at((ncb.center[0], gs.center[1]))
    # masa común
    d += elm.Line().toy(esp.P32[1] - 3.5).at(gs.center)
    d += (gstar := elm.Dot())
    d += elm.Ground()
    d += elm.Line().left(1.0).at(esp.GND)
    d += elm.Line().down(gstar.center[1] * 0 + (esp.GND[1] - gstar.center[1]))
    d += elm.Line().tox(gstar.center[0])
    d += T('★ MASA COMÚN: un cable une el GND de la fuente del servo con el GND del ESP32. El +5 V de la fuente NO se conecta al ESP32.',
           -1.0, gstar.center[1] - 1.6, fs=9)

    # ── entradas Hall (RC) ──
    for pin, gp in (('P36', 'H1 · valva 1'), ('P39', 'H2 · valva 2'), ('P32', 'H3 · valva 3')):
        a = getattr(esp, pin)
        d += elm.Line().right(1.0).at(a)
        d += elm.Resistor().right(2.2).label('1 kΩ', loc='top', fontsize=8)
        d += (n := elm.Dot())
        d += elm.Capacitor().down(1.1).at(n.center).label('100 nF', loc='bottom', fontsize=8)
        d += elm.Ground(lead=False)
        d += elm.Line().right(1.4).at(n.center)
        d += T(f'← OUT de {gp}', n.center[0] + 1.5, n.center[1])

    # ── un sensor (se repite ×3) ──
    HX, HY = 2.0, gstar.center[1] - 6.0
    d += T('Cada Hall (×3, uno por valva) · cable de 3 hilos ≤ 40 cm', HX - 2.0, HY + 3.0, fs=10)
    h = elm.Ic(pins=[elm.IcPin('VCC (1)', side='left', slot='2/2', anchorname='V'), elm.IcPin('GND (2)', side='left', slot='1/2', anchorname='G'),
                     elm.IcPin('OUT (3)', side='right', slot='1/1', anchorname='O')], size=(3.6, 2.4))
    d += h.at((HX + 3.0, HY - 1.2))
    d += T('Hall lineal TO-92', HX + 3.2, HY + 1.7, fs=9)
    d += elm.Line().left(1.4).at(h.V)
    d += (hv := elm.Dot())
    d += elm.Vdd().label('3V3')
    d += elm.Line().left(1.4).at(h.G)
    d += (hg := elm.Dot())
    d += elm.Ground()
    d += elm.Line().left(1.2).at(hv.center)
    d += elm.Capacitor().down().toy(hg.center[1])
    d += elm.Line().tox(hg.center[0])
    d += T('100 nF soldado\nen el sensor', hv.center[0] - 4.2, hv.center[1] - 0.2, fs=8)
    d += elm.Line().right(1.5).at(h.O)
    d += T('→ al filtro RC de su GPIO', h.O[0] + 1.6, h.O[1])

    d += T('NOTAS\n'
           '· Hall recomendado: DRV5055A1QLPG (lineal, 3,3 V; pines 1 VCC · 2 GND · 3 OUT con la cara plana de frente). Otro modelo: confirmar su orden de pines.\n'
           '· Si el Hall comprado SOLO funciona a 5 V (p. ej. algunos 49E): alimentarlo desde VIN/5V del ESP32 y poner un divisor 20 kΩ / 30 kΩ entre OUT y el RC.\n'
           '  Ninguna entrada del ESP32 admite 5 V.  · Un A3144 u otro Hall DIGITAL no sirve (solo da sí/no, no el ángulo).\n'
           '· Pulsos del servo a 3,3 V: el MG90S suele aceptarlos (VERIFICAR); si no responde, intercalar un 74AHCT125 alimentado con 5 V.\n'
           '· Firmware: el de la v3 (mismos pines). El micrófono I2S queda sin conectar. Sentido del servo: ver la guía (comando 50 o 130 = cerrado).',
           -1.0, HY - 4.0, fs=9)
    d.save(os.path.join(OUT, 'Esquema_v4.svg'))
    d.save(os.path.join(OUT, 'Esquema_v4.png'), dpi=150)
    print('Esquema en', OUT)


if __name__ == '__main__':
    main()
