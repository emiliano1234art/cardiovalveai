"""
CardioVal AI v2 — esquemas eléctricos (schemdraw). Genera SVG y PNG en hardware/out_v2/Electronica/.

Hojas:
  1. Alimentación, masa en estrella, servo (5 V externos), INA219, parada de emergencia y LED de sincronización.
  2. Acondicionamiento de UN canal piezoeléctrico (P1; P2 es idéntico con U1C/U1D).
  3. Sensores Hall (H0–H3), micrófono INMP441 y conexiones al ESP32 DevKit V1.
Valores calculados en Electronica_y_Calculos.md. Componentes marcados VERIFICAR dependen de lo comprado.
"""
import os
import schemdraw
import schemdraw.elements as elm

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'out_v2', 'Electronica')
os.makedirs(OUT, exist_ok=True)


def save(d, name):
    d.save(os.path.join(OUT, name + '.svg'))
    d.save(os.path.join(OUT, name + '.png'), dpi=150)


def sheet_power():
    d = schemdraw.Drawing(show=False)
    d.config(fontsize=10, unit=2.4)
    T = lambda txt, x, y, **k: elm.Label().label(txt, fontsize=k.pop('fs', 9), halign=k.pop('ha', 'left'), **k).at((x, y))
    box = lambda name, pins, size: elm.Ic(pins=[elm.IcPin(p, side=sd, slot=sl, anchorname=an) for p, sd, sl, an in pins], size=size, label=name)
    d += T('HOJA 1 · Alimentación del servo (5 V externos) separada del USB · masa en estrella', 0, 10.0, fs=13)
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
    d += (ina := box('INA219', [('+', 'left', '1/1', 'VP'), ('−', 'right', '1/1', 'VM')], (2.2, 1.6)).anchor('VP'))
    d += T('shunt 0,1 Ω\nI2C → GPIO21/22', ina.VP[0], ina.VP[1] - 1.5)
    d += elm.Line().right(1.0).at(ina.VM)
    d += (n2 := elm.Dot())
    d += T('+5V_SERVO', n2.center[0] - 0.6, n2.center[1] + 0.45)
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
    d += T('servo MG90S\n(cable de 3 hilos)', sv.V[0] + 2.6, sv.V[1] - 0.2)
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
           '· Pulsos de 3,3 V: el MG90S suele aceptarlos (VERIFICAR); si no, intercalar un 74AHCT125 alimentado con 5 V.\n'
           '· Regulador analógico MCP1700-3302: 5 V del USB → 3V3_A (sensores Hall y MCP6004), separado del 3V3 digital de la placa.\n'
           '· LED de sincronización: GPIO19 → 330 Ω → LED → GND, ubicado dentro del cuadro de la cámara.\n'
           '· Parada por software: GPIO23 ← contacto NA a GND (pull-up interno). S1 corta la potencia del servo físicamente.',
           0, -2.6)
    save(d, 'Hoja1_Alimentacion_Servo')


def sheet_piezo():
    d = schemdraw.Drawing(show=False)
    d.config(fontsize=10, unit=2.4)
    T = lambda txt, x, y, **k: elm.Label().label(txt, fontsize=k.pop('fs', 9), halign=k.pop('ha', 'left'), **k).at((x, y))
    d += T('HOJA 2 · Acondicionamiento de un canal piezoeléctrico (P1; P2 idéntico con U1C/U1D del mismo MCP6004)', 0, 11.6, fs=13)
    # piezo y nodo A
    d += (pz := elm.Capacitor().up().at((0, 2)))
    d += elm.Ground().at(pz.start)
    d += T('Disco piezo\nCp ≈ 10 nF\n(VERIFICAR)\nmalla del cable\na GND', -2.9, 3.6)
    d += elm.Line().right(1.4).at(pz.end)
    d += (a := elm.Dot())
    d += T('A', a.center[0] - 0.15, a.center[1] + 0.45)
    d += (rb := elm.Resistor().down().at(a.center))
    d += T('Rb 1 MΩ', a.center[0] + 0.35, a.center[1] - 1.0)
    d += T('→ VBIAS', rb.end[0] - 0.4, rb.end[1] - 0.45)
    d += (rs := elm.Resistor().right().at(a.center))
    d += T('Rs 10 kΩ', rs.start[0] + 0.45, rs.start[1] + 0.55)
    d += (b := elm.Dot())
    d += T('B', b.center[0] - 0.45, b.center[1] + 0.35)
    d += (d1 := elm.Schottky().up().at(b.center))
    d += elm.Vdd().label('3V3_A')
    d += (gb := elm.Ground().at((b.center[0], b.center[1] - 2.4)))
    d += elm.Schottky().up().at((b.center[0], b.center[1] - 2.4)).to(b.center)
    d += T('D2 BAT54S\n(par Schottky)\nrecorta a\n−0,3…3,6 V', b.center[0] + 0.3, b.center[1] - 3.3)
    # U1A amplificador no inversor alrededor de VBIAS
    d += elm.Line().right(1.4).at(b.center)
    d += (u1 := elm.Opamp(leads=True).right().anchor('in2'))
    d += T('U1A ¼ MCP6004', u1.center[0] - 0.9, u1.center[1] - 1.5)
    d += elm.Line().left(0.5).at(u1.in1)
    d += (nm := elm.Dot())
    d += elm.Line().up(3.2)
    d += (nt := elm.Dot())
    d += (rf := elm.Resistor().right().tox(u1.out[0]))
    d += elm.Line().toy(u1.out[1])
    d += T('Rf (puente J1): 0 Ω → G = 1 · 12 kΩ → G = 2,2 · 36 kΩ → G = 4,6', nt.center[0] - 0.3, nt.center[1] + 0.75)
    d += (rg := elm.Resistor().left().at(nt.center))
    d += T('Rg 10 kΩ', rg.center[0] - 0.6, rg.center[1] + 0.55)
    d += T('→ VBIAS', rg.end[0] - 1.5, rg.end[1])
    # Sallen-Key
    d += (r1 := elm.Resistor().right().at(u1.out))
    d += T('R1 10 kΩ', r1.center[0] - 0.6, r1.center[1] - 0.8)
    d += (c := elm.Dot())
    d += (r2 := elm.Resistor().right())
    d += T('R2 10 kΩ', r2.center[0] - 0.6, r2.center[1] - 0.8)
    d += (dd := elm.Dot())
    d += (c2 := elm.Capacitor().down().at(dd.center))
    d += elm.Ground()
    d += T('C2 7,5 nF', dd.center[0] + 0.3, dd.center[1] - 1.2)
    d += elm.Line().right(1.2).at(dd.center)
    d += (u2 := elm.Opamp(leads=True).right().anchor('in2'))
    d += T('U1B seguidor', u2.center[0] - 0.8, u2.center[1] - 1.5)
    d += elm.Line().left(0.4).at(u2.in1)
    d += elm.Line().up(1.0)
    d += elm.Line().tox(u2.out[0] + 0.3)
    d += elm.Line().toy(u2.out[1])
    d += elm.Line().up(4.2).at(c.center)
    d += (c1 := elm.Capacitor().right().tox(u2.out[0] + 0.9))
    d += T('C1 15 nF', c1.center[0] - 0.5, c1.center[1] + 0.5)
    d += elm.Line().toy(u2.out[1])
    d += elm.Line().right(1.0).at(u2.out)
    d += (ro := elm.Resistor().right())
    d += T('100 Ω', ro.center[0] - 0.4, ro.center[1] + 0.5)
    d += (adc := elm.Dot())
    d += elm.Capacitor().down().at(adc.center)
    d += elm.Ground()
    d += T('2,2 nF', adc.center[0] + 0.3, adc.center[1] - 1.2)
    d += T('→ GPIO34 (ADC1_CH6)\n   P2 → GPIO35 (CH7)', adc.center[0] + 0.3, adc.center[1] + 0.5)
    d += T('VBIAS = 3V3_A · 100k/(150k+100k) = 1,32 V, desacoplado con 10 µF (común a P1 y P2)\n'
           'Sallen-Key Butterworth: fc = 1/(2π·10k·√(15n·7,5n)) ≈ 1,5 kHz, Q = 0,707 (atenúa 37 dB a 13 kHz)\n'
           'Paso alto natural: fc = 1/(2π·Rb·Cp) ≈ 16 Hz con Cp = 10 nF (depende del disco: medir Cp)\n'
           'Rango útil del ADC (12 dB): 0,15–2,45 V → excursión ±1,15 V alrededor de VBIAS. Elegir G para no saturar\n'
           'Prueba previa SIN ESP32: medir VBIAS a la salida; golpecito con el dedo en el soporte: la señal debe quedar en 0,15–2,45 V',
           0, -3.6)
    save(d, 'Hoja2_Canal_Piezo')


def sheet_sensors():
    d = schemdraw.Drawing(show=False)
    d.config(fontsize=10, unit=2.4)
    T = lambda txt, x, y, **k: elm.Label().label(txt, fontsize=k.pop('fs', 9), halign=k.pop('ha', 'left'), **k).at((x, y))
    d += T('HOJA 3 · Sensores Hall H0–H3 y micrófono INMP441', 0, 8.0, fs=13)
    # Hall (uno de cuatro)
    d += (h := elm.Ic(pins=[elm.IcPin('GND', side='left', slot='1/2', anchorname='G'), elm.IcPin('VCC', side='left', slot='2/2', anchorname='V'),
                            elm.IcPin('OUT', side='right', slot='1/1', anchorname='O')], size=(2.0, 2.0)).at((3, 3.5)).anchor('center'))
    d += T('DRV5055 (TO-92)\nA1: H1–H3 · A2: H0', h.V[0] - 0.2, h.V[1] + 1.4)
    d += elm.Line().left(1.2).at(h.V)
    d += (v := elm.Dot())
    d += elm.Vdd().label('3V3_A')
    d += elm.Line().left(1.2).at(h.G)
    d += (gg := elm.Dot())
    d += elm.Ground()
    d += elm.Line().left(1.0).at(v.center)
    d += (cv := elm.Capacitor().down().toy(gg.center[1]))
    d += elm.Line().tox(gg.center[0])
    d += T('100 nF junto\nal sensor', cv.center[0] - 2.4, cv.center[1])
    d += elm.Line().right(1.4).at(h.O)
    d += T('cable 3 hilos ≤ 30 cm', h.O[0] + 0.1, h.O[1] - 0.45, fs=8)
    d += (rh := elm.Resistor().right())
    d += T('1 kΩ', rh.center[0] - 0.3, rh.center[1] + 0.5)
    d += (o := elm.Dot())
    d += elm.Capacitor().down().at(o.center)
    d += elm.Ground()
    d += T('100 nF\n(fc 1,6 kHz)', o.center[0] + 0.3, o.center[1] - 1.3)
    d += T('→ ADC1', o.center[0] + 0.3, o.center[1] + 0.4)
    d += T('H1 → GPIO36 (VP) · H2 → GPIO39 (VN) · H3 → GPIO32 · H0 → GPIO33  (los cuatro canales iguales)\n'
           'Salida = VCC/2 sin campo. Orientar el imán para que la salida BAJE (≈ 0,8–1,65 V): queda en el rango lineal del ADC.',
           0, -0.4)
    # micrófono
    X0 = 15.0
    d += (m := elm.Ic(pins=[elm.IcPin('L/R', side='left', anchorname='LR'), elm.IcPin('GND', side='left', anchorname='G'),
                            elm.IcPin('VDD', side='left', anchorname='V'), elm.IcPin('SD', side='right', anchorname='SD'),
                            elm.IcPin('WS', side='right', anchorname='WS'), elm.IcPin('SCK', side='right', anchorname='SCK')]).right().at((X0, 3.8)).anchor('center'))
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
           'Cable ≤ 20 cm, GND entre SCK y SD, lejos del cable del servo', X0 - 2.0, -1.6)
    save(d, 'Hoja3_Hall_MEMS')


if __name__ == '__main__':
    sheet_power(); sheet_piezo(); sheet_sensors()
    print('Esquemas en', os.path.abspath(OUT))
