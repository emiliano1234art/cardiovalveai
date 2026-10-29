"""
CardioValveAI v3 / v3.1 — esquemas eléctricos (schemdraw). Genera SVG y PNG en hardware/<OUT_DIR de cad/config.py>/Electronica/.
La electrónica es la misma en v3 y v3.1.

Hojas:
  1. Alimentación, masa en estrella, servo (5 V externos), parada de emergencia y LED de sincronización.
  2. Sensores Hall H1–H3 (dos opciones según el modelo real) y micrófono INMP441.
Valores calculados en Electronica_y_Calculos.md. Componentes marcados VERIFICAR dependen de lo comprado.
"""
import os
import schemdraw
import schemdraw.elements as elm

import sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'cad'))
import config as CFG   # noqa: E402
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', CFG.OUT_DIR, 'Electronica')
os.makedirs(OUT, exist_ok=True)


def save(d, name):
    d.save(os.path.join(OUT, name + '.svg'))
    d.save(os.path.join(OUT, name + '.png'), dpi=150)


def sheet_power():
    d = schemdraw.Drawing(show=False)
    d.config(fontsize=10, unit=2.4)
    T = lambda txt, x, y, **k: elm.Label().label(txt, fontsize=k.pop('fs', 9), halign=k.pop('ha', 'left'), **k).at((x, y))
    box = lambda name, pins, size: elm.Ic(pins=[elm.IcPin(p, side=sd, slot=sl, anchorname=an) for p, sd, sl, an in pins], size=size, label=name)
    d += T('HOJA 1 · CardioValveAI v3 · Alimentación del servo (5 V externos) separada del USB · masa en estrella', 0, 10.0, fs=13)
    Y = 6.0
    # fuente
    d += (src := elm.SourceV().up().at((0, Y - 3.0)))
    d += T('Fuente\n5 V ≥ 2 A\n(3 A recom.)', -2.6, Y - 2.0)
    d += elm.Line().up(0.6).at(src.end)
    d += elm.Line().right(0.6)
    d += (f := elm.Fuse().right())
    d += T('F1 PTC\n2,5 A', f.center[0] - 0.5, f.center[1] + 0.9)
    d += elm.Line().right(0.6)
    d += (q := box('Q1', [('D', 'left', '1/1', 'D'), ('S', 'right', '1/1', 'S'), ('G', 'bottom', '1/1', 'G')], (2.0, 1.6)).anchor('D'))
    d += T('AO3401A (P-MOS)\nprotección contra\npolaridad invertida', q.D[0] - 0.2, q.D[1] + 1.6)
    d += elm.Resistor().down().at(q.G)
    d += elm.Ground()
    d += T('10 kΩ', q.G[0] + 0.3, q.G[1] - 1.3)
    d += elm.Line().right(0.6).at(q.S)
    d += (n1 := elm.Dot())
    d += elm.DiodeTVS().down().at(n1.center)
    d += elm.Ground()
    d += T('D1\nSMBJ5.0A', n1.center[0] + 0.3, n1.center[1] - 1.5)
    d += elm.Line().right(0.8).at(n1.center)
    d += (sw := elm.Switch(nc=True).right())
    d += T('S1 PARADA DE\nEMERGENCIA (NC)', sw.center[0] - 1.2, sw.center[1] - 1.3)
    d += elm.Line().right(0.6)
    d += elm.Line().right(2.2)
    d += (jw := elm.Dot())
    d += T('J1: desconexión del servo (bornera o conector\ncon traba, polaridad marcada)', jw.center[0] - 3.2, jw.center[1] + 1.6)
    d += T('J1', jw.center[0] - 0.25, jw.center[1] + 0.45)
    d += elm.Line().right(1.0)
    d += (n2 := elm.Dot())
    d += T('+5V_SERVO', n2.center[0] - 0.2, n2.center[1] + 0.45)
    d += elm.Capacitor(polar=True).down().at(n2.center)
    d += elm.Ground()
    d += T('C1 1000 µF\n10 V bajo ESR', n2.center[0] + 0.3, n2.center[1] - 1.5)
    d += elm.Line().right(2.6).at(n2.center)
    d += (n3 := elm.Dot())
    d += elm.Capacitor().down().at(n3.center)
    d += elm.Ground()
    d += T('C2 100 nF\nen el conector', n3.center[0] - 2.4, n3.center[1] - 2.2)
    d += elm.Line().right(1.2).at(n3.center)
    d += (sv := box('', [('GND', 'left', '1/3', 'G'), ('+5V', 'left', '2/3', 'V'), ('PWM', 'left', '3/3', 'P')], (2.2, 2.8)).anchor('V'))
    d += T('servo (modelo por\nconfirmar; 3 hilos)', sv.V[0] + 0.1, sv.V[1] - 2.0)
    # retorno del servo y estrella
    d += elm.Line().left(0.5).at(sv.G)
    d += elm.Line().down(5.2)
    d += elm.Line().tox(src.start[0])
    d += elm.Line().toy(src.start[1])
    d += (gs := elm.Dot().at((src.start[0], sv.G[1] - 5.2)))
    d += T('★ GND estrella (un solo punto, en la placa perforada). El retorno del servo va con su propio cable hasta ★', 0.3, gs.center[1] - 0.5)
    d += elm.Line().down(0.8).at(gs.center)
    d += elm.Ground()
    # PWM
    d += elm.Line().left(0.5).at(sv.P)
    d += elm.Line().up(1.6)
    d += (np_ := elm.Dot())
    d += (r1 := elm.Resistor().left(3.0))
    d += T('R1 220 Ω', r1.center[0] - 0.6, r1.center[1] + 0.5)
    d += elm.Line().left(0.4)
    d += T('← GPIO18 (PWM 3,3 V, 50 Hz)', r1.end[0] - 4.9, r1.end[1])
    d += elm.Resistor().right(2.2).at(np_.center)
    d += elm.Ground().right()
    d += T('R2 10 kΩ a GND: PWM en bajo\nmientras el ESP32 arranca', np_.center[0] + 0.1, np_.center[1] + 1.0)
    d += T('NOTAS\n'
           '· El ESP32 se alimenta SOLO por USB. +5V_SERVO NUNCA se une a VIN/5V del ESP32: solo se comparte GND en ★ → no hay realimentación USB ↔ fuente.\n'
           '· Pulsos de 3,3 V: muchos micro servos los aceptan (VERIFICAR con el servo real); si no, intercalar un 74AHCT125 alimentado con 5 V.\n'
           '· Regulador MCP1700-3302: 5 V del USB → 3V3_A solo para los 3 Hall (salida ratiométrica: necesitan una alimentación limpia).\n'
           '· Fuente del servo: dimensionar con la corriente de bloqueo del servo REAL (dato por confirmar); 5 V ≥ 2 A para un micro servo.\n'
           '· LED de sincronización: GPIO19 → 330 Ω → LED → GND, ubicado dentro del cuadro de la cámara.\n'
           '· Parada por software: GPIO23 ← contacto NA a GND (pull-up interno). S1 corta la potencia del servo físicamente.',
           0, -2.6)
    save(d, 'Hoja1_Alimentacion_Servo')


def sheet_sensors():
    d = schemdraw.Drawing(show=False)
    d.config(fontsize=10, unit=2.4)
    T = lambda txt, x, y, **k: elm.Label().label(txt, fontsize=k.pop('fs', 9), halign=k.pop('ha', 'left'), **k).at((x, y))
    d += T('HOJA 2 · CardioValveAI v3 · Sensores Hall H1–H3 (uno por valva) y micrófono INMP441', 0, 9.6, fs=13)

    def hall(x0, y0, title, vcc, divider):
        e = elm.Ic(pins=[elm.IcPin('GND', side='left', slot='1/2', anchorname='G'), elm.IcPin('VCC', side='left', slot='2/2', anchorname='V'),
                         elm.IcPin('OUT', side='right', slot='1/1', anchorname='O')], size=(2.0, 2.0)).right().at((x0, y0)).anchor('center')
        nonlocal d
        d += e
        d += T(title, e.V[0] - 0.2, e.V[1] + 1.5)
        d += elm.Line().left(1.2).at(e.V)
        d += (v := elm.Dot())
        d += elm.Vdd().label(vcc)
        d += elm.Line().left(1.2).at(e.G)
        d += (g := elm.Dot())
        d += elm.Ground()
        d += elm.Line().left(1.0).at(v.center)
        d += elm.Capacitor().down().toy(g.center[1])
        d += elm.Line().tox(g.center[0])
        d += T('100 nF junto\nal sensor', v.center[0] - 3.3, v.center[1] - 1.0)
        d += elm.Line().right(1.0).at(e.O)
        if divider:
            d += (r1 := elm.Resistor().right())
            d += T('20 kΩ', r1.center[0] - 0.3, r1.center[1] + 0.5)
            d += (nd := elm.Dot())
            d += elm.Resistor().down().at(nd.center)
            d += elm.Ground()
            d += T('30 kΩ\n(×0,6: 5 V → 3,0 V)', nd.center[0] + 0.3, nd.center[1] - 1.3)
            d += elm.Line().right(0.8).at(nd.center)
        d += (rh := elm.Resistor().right())
        d += T('1 kΩ', rh.center[0] - 0.3, rh.center[1] + 0.5)
        d += (o := elm.Dot())
        d += elm.Capacitor().down().at(o.center)
        d += elm.Ground()
        d += T('100 nF\n(fc 1,6 kHz)', o.center[0] + 0.3, o.center[1] - 1.3)
        d += T('→ ADC1', o.center[0] + 0.3, o.center[1] + 0.4)

    hall(3, 5.5, 'OPCIÓN A (recomendada): Hall ratiométrico de 3,3 V\n(p. ej. DRV5055A1QLPG) — VERIFICAR pines de SU modelo', '3V3_A', False)
    hall(3, 0.0, 'OPCIÓN B: Hall que exige 5 V (p. ej. algunos «49E»):\nla salida NUNCA va directo al ESP32 → divisor', '5V USB', True)
    d += T('H1 → GPIO36 (VP) · H2 → GPIO39 (VN) · H3 → GPIO32. Los tres canales son iguales.\n'
           'Distribución de pines: DRV5055 (TO-92): 1 VCC, 2 GND, 3 OUT. Otros modelos usan otro orden: confirmar con la hoja de datos real.\n'
           'Un A3144 (interruptor digital) NO sirve: solo da encendido/apagado, no el ángulo continuo.',
           0, -3.8)
    X0 = 19.0
    d += (m := elm.Ic(pins=[elm.IcPin('L/R', side='left', anchorname='LR'), elm.IcPin('GND', side='left', anchorname='G'),
                            elm.IcPin('VDD', side='left', anchorname='V'), elm.IcPin('SD', side='right', anchorname='SD'),
                            elm.IcPin('WS', side='right', anchorname='WS'), elm.IcPin('SCK', side='right', anchorname='SCK')]).right().at((X0, 5.0)).anchor('center'))
    d += T('INMP441 (placa)', m.V[0] - 0.1, m.V[1] + 1.4)
    d += elm.Line().left(1.0).at(m.V)
    d += (mv := elm.Dot())
    d += elm.Vdd().label('3V3')
    d += elm.Line().left(1.0).at(m.G)
    d += (mg := elm.Dot())
    d += elm.Line().left(1.0).at(m.LR)
    d += elm.Line().toy(mg.center[1] - 1.6)
    d += elm.Ground()
    d += elm.Line().toy(m.LR[1]).at(mg.center)
    d += elm.Line().left(1.0).at(mv.center)
    d += elm.Capacitor().down().toy(mg.center[1])
    d += elm.Line().tox(mg.center[0])
    d += T('100 nF', mv.center[0] - 2.4, mv.center[1] - 0.6)
    d += elm.Line().right(0.6).at(m.SCK)
    d += (rk := elm.Resistor().right(1.6))
    d += T('33 Ω', rk.center[0] - 0.3, rk.center[1] + 0.45, fs=8)
    d += T('→ GPIO26', rk.end[0] + 0.1, rk.end[1])
    d += elm.Line().right(2.2).at(m.WS)
    d += T('→ GPIO25', m.WS[0] + 2.3, m.WS[1])
    d += elm.Line().right(2.2).at(m.SD)
    d += T('→ GPIO27', m.SD[0] + 2.3, m.SD[1])
    d += T('I2S1 maestro · 16 kHz · BCLK = 1,024 MHz (64·fs)\nL/R a GND → canal izquierdo (el firmware verifica la ranura)\n'
           'Cable ≤ 20 cm, GND entre SCK y SD, lejos del cable del servo', X0 - 2.0, 1.2)
    save(d, 'Hoja2_Hall_MEMS')


if __name__ == '__main__':
    sheet_power(); sheet_sensors()
    print('Esquemas en', os.path.abspath(OUT))
