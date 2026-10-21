"""Genera las guías, la lista de materiales y el informe de validación a partir de verify.json."""
from __future__ import annotations
import csv
import json
import math
import os
import time

import config as C
import kinematics as K
import registry as R
import assembly as A
import parts as P

OUT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'out'))
DOCS = os.path.join(OUT, 'Documentacion')
os.makedirs(DOCS, exist_ok=True)
V = json.load(open(os.path.join(OUT, '_canon', 'verify.json'), encoding='utf-8'))
PM = {r['part']: r for r in V['print_meshes']}
F = lambda v, n=1: f'{(round(v, n) + 0.0):.{n}f}'.replace('.', ',')
NAME = C.PROJECT

def write(name, text):
    with open(os.path.join(DOCS, name), 'w', encoding='utf-8') as f:
        f.write(text.strip() + '\n')

ORIENT = {
    'Valve_Ring': 'Cara inferior en la cama (comisuras hacia arriba).',
    'Leaflet_1': 'Cara inferior plana de la valva en la cama.', 'Leaflet_2': 'Cara inferior plana de la valva en la cama.', 'Leaflet_3': 'Cara inferior plana de la valva en la cama.',
    'Link_Normal': 'Plana (3 mm de alto).', 'Link_LostMotion': 'Plana.', 'Link_LostMotion_IC': 'Plana.',
    'Opening_Stop_84': 'Brida en la cama.', 'Opening_Stop_60': 'Brida en la cama.', 'Opening_Stop_45': 'Brida en la cama.',
    'Actuator_Plate': 'Cara inferior en la cama (bujes, orejetas y horquilla hacia arriba).', 'Pushrod': 'Plano.',
    'Column': 'Vertical.', 'Piezo_Mount': 'Cara de contacto con el anillo en la cama.', 'Piezo_Cover': 'Cara exterior en la cama.',
    'Piezo_Adapter_12mm': 'Plano.', 'MEMS_Mount': 'Cara exterior de la escuadra en la cama.', 'Servo_Mount': 'Pie en la cama.',
    'ESP32_Mount': 'Piso en la cama.', 'Angle_Scale': 'Plano, marcas hacia arriba.', 'Base': 'Plana; usar borde (brim) 5 mm.',
    'Tolerance_Coupon': 'Plana.',
}

# ───────────────────────────── guía de impresión ─────────────────────────────

def print_guide():
    rows = []
    for it in R.ITEMS:
        if not it.printable:
            continue
        m = PM[it.name]
        sup = 'Sí (árbol, solo bajo la cola)' if it.name.startswith('Leaflet') else ('Sí' if m['needs_support'] else 'No')
        rows.append(f"| `{C.PREFIX}_{it.name}.stl` | {it.qty} | PETG | {ORIENT.get(it.name, '')} | {F(it.layer, 2)} mm | {it.infill} | {it.walls} | {sup} | "
                    f"{' × '.join(F(v) for v in m['size_mm'])} | {F(m['mass_g_petg'])} g | {it.notes} |")
    total = sum(PM[it.name]['mass_g_petg'] * it.qty for it in R.ITEMS if it.printable and it.name != 'Piezo_Adapter_12mm')
    write('Guia_de_Impresion.md', f"""
# {NAME} — Guía de impresión 3D (FDM, PETG)

**Impresora de referencia:** cama ≥ {int(C.BED[0])} × {int(C.BED[1])} mm · boquilla 0,4 mm · PETG 230–245 °C · cama 70–80 °C · ventilador 30–50 %.
Todas las piezas caben en el volumen de impresión de referencia (verificado automáticamente). Masa total estimada (densidad 1,27 g/cm³, 100 % macizo): **≈ {F(total, 0)} g** (con el relleno indicado será menor).

**Primero imprime `{C.PREFIX}_Tolerance_Coupon.stl`**: fila superior = agujeros para el eje Ø2 (2,0–2,5 mm); fila inferior = pilotos para tornillos (1,6–1,9 = M2, 2,4/2,6 = M3).
Elige el diámetro que gira libre con el eje (valvas y bielas) y el que queda firme (anillo). Si difieren de los valores por defecto, cámbialos en `config.py`
(`PIN_HOLE_LEAF`, `PIN_HOLE_RING`, `M2_PILOT`, `M3_PILOT`) y vuelve a generar todo con `python build_all.py`.

| Archivo STL | Cant. | Material | Orientación | Capa | Relleno | Perímetros | Soportes | Tamaño (mm) | Masa c/u | Observaciones |
|---|---|---|---|---|---|---|---|---|---|---|
{chr(10).join(rows)}

**Notas generales**
- Los STL ya vienen orientados y apoyados en z = 0. No escalar: unidades en milímetros.
- Agujeros horizontales pequeños (ejes Ø2,1 del anillo y pilotos M2 de las almohadillas) se imprimen como puentes; si quedan ovalados, repasarlos con broca manual.
- Las valvas se imprimen al 100 % y con capa 0,12 mm para que la superficie y el barril de la bisagra salgan precisos.
- Piezas móviles y fijas se imprimen por separado (ninguna pieza móvil está fusionada).
- «Soportes = Sí» proviene del análisis automático de voladizos (> 45° y techos anchos); los agujeros pequeños (≤ 3 mm) y los techos planos de hasta 12 mm se consideran puentes imprimibles.
""")

# ───────────────────────────── lista de materiales ─────────────────────────────

def bom():
    printable = [(f'{C.PREFIX}_{it.name}.stl', it.qty, it.role, 'Imprimible (PETG)', ' × '.join(F(v) for v in PM[it.name]['size_mm']) + ' mm') for it in R.ITEMS if it.printable]
    pin_len = 56
    commercial = [
        ('Servomotor MG90S (con horn de un brazo)', 1, 'Mueve el plato actuador', 'Comercial', 'Cuerpo ≈ 22,8 × 12,2 × 22,7 mm; orejas a 27,8 mm (VERIFICAR); agujero del horn a 8 mm del eje (VERIFICAR)'),
        ('ESP32 DevKit (30 o 38 pines)', 1, 'Adquisición y control', 'Comercial', 'Referencia 55 × 28 mm (VERIFICAR; cuna para 55,8 × 28,8)'),
        ('Módulo micrófono MEMS INMP441 (I²S)', 1, 'Sonido de apertura y cierre', 'Comercial', 'Placa ≈ 14 mm (VERIFICAR; ranura para 14,5 × 14,5 × 1,6)'),
        ('Disco piezoeléctrico Ø15 mm (o Ø12 con adaptador)', 2, 'Vibración transmitida al anillo (1 de repuesto)', 'Comercial', 'Espesor ≈ 0,45 mm, con cables'),
        (f'Varilla de acero rectificada Ø2 mm, cortada a {pin_len} mm', 3, 'Ejes de bisagra de las valvas', 'Comercial', 'Ø2,00 h8; extremos sin rebabas'),
        ('Tornillo M2×8 cabeza cilíndrica (DIN 912)', 3 + 2, 'Cola–biela (autorroscante en la cola) ×3 · orejas del servo ×2', 'Comercial', 'Acero o inox'),
        ('Tornillo M2×10 + tuerca M2', 3, 'Biela–orejeta del plato', 'Comercial', ''),
        ('Tornillo M2×14 + tuerca M2', 1, 'Horquilla del plato–empujador', 'Comercial', ''),
        ('Tornillo M2×6 (o el del horn)', 1, 'Empujador–horn', 'Comercial', 'Autorroscante en el agujero del horn'),
        ('Tornillo M2×20 + tuerca M2', 3, 'Topes de apertura (desde la cara superior)', 'Comercial', '+2 de repuesto para módulos'),
        ('Tornillo M2×16', 2, 'Tapa + soporte del piezo a la almohadilla', 'Comercial', ''),
        ('Tornillo M2×8', 2, 'Escuadra del MEMS a la almohadilla', 'Comercial', ''),
        ('Tornillo M3×10', 3, 'Columnas a la base (desde abajo)', 'Comercial', ''),
        ('Tornillo M3×30', 3, 'Anillo a las columnas (desde las comisuras)', 'Comercial', ''),
        ('Tornillo M3×10 + arandela de goma M3', 4, 'Soporte del servo a la base (antivibración)', 'Comercial', '8 arandelas (una arriba y otra abajo del pie)'),
        ('Tornillo M3×8', 2, 'Cuna del ESP32 a la base (desde abajo)', 'Comercial', ''),
        ('Arandelas M2', 10, 'Bajo cabezas y tuercas', 'Comercial', ''),
        ('Resorte de extensión pequeño (Ø3 × 15–20 mm, k ≈ 0,05 N/mm) o elástico de silicona Ø1 mm', 2, 'Abre la valva en los módulos de recorrido perdido', 'Comercial', 'Fuerza ≈ 0,3–0,6 N'),
        ('Patas de goma adhesivas Ø10 mm', 4, 'Aislamiento de vibraciones externas', 'Comercial', ''),
        ('Fuente 5 V ≥ 2 A + condensador 470–1000 µF', 1, 'Alimentación del servo (tierra común con el ESP32)', 'Comercial', ''),
        ('Protoboard + cables Dupont', 1, 'Conexiones', 'Comercial', ''),
        ('Resistencia 1 MΩ + diodo zener 3,3 V (o divisor + protección)', 1, 'Acondicionamiento del piezo hacia el ADC', 'Comercial', 'Ver guía de ensamblaje'),
        ('Bridas plásticas 2,5 mm', 10, 'Alivio de tensión y canales de cable', 'Comercial', ''),
        ('Grasa de PTFE', 1, 'Bujes del plato y bisagras', 'Comercial', ''),
        ('Cianoacrilato', 1, 'Fijar los ejes en el anillo (solo en los extremos)', 'Comercial', ''),
        ('(Opcional) Imán de neodimio Ø3 × 1 mm + sensor Hall lineal (p. ej. DRV5055 / SS49E)', 3, 'Medición del ángulo real (alternativa B)', 'Comercial', 'Alojamientos ya previstos en la cola y en el anillo'),
    ]
    with open(os.path.join(DOCS, 'Lista_de_Materiales.csv'), 'w', newline='', encoding='utf-8') as f:
        w = csv.writer(f)
        w.writerow(['Componente', 'Cantidad', 'Función', 'Tipo', 'Especificación / dimensiones críticas'])
        for r in printable + commercial:
            w.writerow(r)
    md = '\n'.join(f'| {a} | {b} | {c} | {d} | {e} |' for a, b, c, d, e in printable + commercial)
    write('Lista_de_Materiales.md', f"""
# {NAME} — Lista de materiales

«VERIFICAR» = medida tomada de fichas o de modelos de referencia, no de un plano oficial: mídela en la pieza comprada y, si cambia, ajusta `config.py` y regenera.

| Componente | Cant. | Función | Tipo | Especificación / dimensiones críticas |
|---|---|---|---|---|
{md}

También en formato CSV: `Lista_de_Materiales.csv`.
""")

# ───────────────────────────── guía de ensamblaje ─────────────────────────────

def assembly_guide():
    g = V['geometry']
    rtab = '\n'.join(f'| {r} mm | ±{F(math.degrees(math.asin(min(1, K.STROKE / (2 * r)))), 1)}° | {F(90 + math.degrees(math.asin(min(1, K.STROKE / (2 * r)))), 0)}° → {F(90 - math.degrees(math.asin(min(1, K.STROKE / (2 * r)))), 0)}° |' for r in (7, 8, 9, 10))
    write('Guia_de_Ensamblaje.md', f"""
# {NAME} — Guía de ensamblaje

Prototipo **académico y experimental**: no es un dispositivo médico, no es implantable y no se conecta a pacientes. El movimiento lo produce un servomotor; **no** hay presión ni circulación de líquido.

## Cómo funciona el mecanismo (un solo servo)
`MG90S → palanca de {F(K.CRANK_R)} mm (horn) → empujador → plato actuador (corredera vertical guiada por 3 columnas) → 3 bielas → cola de cada valva → 3 valvas`.
- Cada valva gira sobre un **eje de acero Ø2** que atraviesa el anillo en una cuerda a {F(C.HINGE_D, 0)} mm del centro. Su «cola» sale por una ranura de la pared y recibe la biela.
- Al **bajar** el plato {F(g['stroke_mm'], 2)} mm, las tres valvas abren de 0° a 80°; al **subir**, cierran. El servo recorre ±{F(C.SERVO_SWEEP, 0)}° respecto de la horizontal (comando ≈ 130° = cerrada, 50° = abierta).
- Las alteraciones se hacen con **módulos intercambiables** en una valva (biela + tope), sin cambiar el comando del servo y **sin que el servo empuje contra un tope** (ver «Módulos»).

## Herramientas
Destornillador allen 1,5 y 2,5 mm (o Phillips según tornillos), alicate de punta, broca manual 2,0 / 2,1 / 2,4 mm, lija 400, cortaalambre para la varilla Ø2, cianoacrilato, grasa PTFE.

## Orden de montaje
1. **Calibración de holguras.** Imprime la probeta y define los diámetros reales (ver Guía de impresión). Repasa con broca: agujeros del eje en el anillo (Ø2,1) y en valvas/bielas (Ø2,4).
2. **Columnas.** Atornilla las 3 columnas a la base con M3×10 desde abajo (cabezas en los rebajes).
3. **Plato actuador.** Lija y engrasa las columnas; desliza el plato por las 3 columnas (bujes hacia arriba). Debe bajar por su propio peso sin trabarse.
4. **Servo.** Antes de montar el horn, centra el servo (comando 90°). Monta el horn con el brazo **horizontal apuntando hacia el centro de la válvula** (+x). Fija el servo al `Servo_Mount` con 2× M2×8 en las orejas y el soporte a la base con 4× M3×10 **sobre arandelas de goma**.
5. **Empujador.** Extremo inferior al agujero del horn a {F(K.CRANK_R, 0)} mm del eje (M2×6); extremo superior a la horquilla del plato (M2×14 + tuerca), pasando por el agujero central del plato.
6. **Valvas + bielas (en el banco).** Une cada biela normal a la cola de su valva con M2×8 (cabeza del lado de la biela; el tornillo rosca en la cola). Comprueba que la biela gira libre.
7. **Valvas en el anillo.** Coloca cada valva en el sector con su número grabado (1–3 en el anillo; 1–3 puntos en la valva), con la biela pasando hacia abajo por la ranura. Introduce el eje Ø2×56 **desde el exterior** por el agujero de la pared, atravesando el barril, hasta la pared opuesta. Fija el eje con una gota de cianoacrilato **solo en los extremos** (nunca en el barril). Gira cada valva a mano: 0°–90° sin roce.
8. **Topes.** Inserta un `Opening_Stop_84` desde abajo en cada ranura (cara inclinada hacia la cola) y fíjalo con M2×20 desde la cara superior del anillo (+ tuerca bajo la brida).
9. **Anillo sobre las columnas.** Retira el transportador `Angle_Scale` (solo va encajado). Con el servo en 50° (plato abajo), apoya el anillo en las columnas haciendo coincidir las comisuras con las columnas. Une cada biela a su orejeta del plato con M2×10 + tuerca (acceso lateral bajo el anillo). Fija el anillo con 3× M3×30 desde las comisuras.
10. **Piezoeléctrico.** Limpia el asiento del `Piezo_Mount`; pega el disco con cinta doble faz fina o un punto de cianoacrilato (reemplazable). Pasa los cables por el canal y fija con brida en las ranuras inferiores (alivio de tensión). Atornilla soporte + `Piezo_Cover` a la almohadilla de la valva 2 con 2× M2×16. La tapa **no toca** el disco. Hay otras dos almohadillas para comparar posiciones.
11. **Micrófono MEMS.** Desliza la placa INMP441 en la ranura del portaplaca (ventanas en ambas caras: el puerto queda libre esté arriba o abajo). Atornilla la escuadra a la almohadilla de la valva 1 con 2× M2×8; las ranuras permiten ±3 mm de altura. El micrófono **no toca piezas móviles** y está unido al anillo, lejos del servo.
12. **ESP32.** Atornilla la cuna a la base (2× M3×8 desde abajo). Apoya la placa en las repisas de los extremos (pines hacia abajo, libres) y sujétala con una brida por la ranura inferior.
13. **Cableado** (asignación propuesta; confirmar en el firmware):
    - Servo: señal → GPIO 18 (PWM 50 Hz); rojo → **+5 V de la fuente externa**; café → GND. **Unir la GND de la fuente con la GND del ESP32.** Condensador 470–1000 µF en la alimentación del servo.
    - INMP441: VDD → 3,3 V; GND; SCK → GPIO 26; WS → GPIO 25; SD → GPIO 33; L/R → GND.
    - Piezo: en paralelo con 1 MΩ; protección (zener 3,3 V o divisor) → GPIO 34 (ADC1). Cables trenzados y cortos.
    - ECG futuro: **solo** mediante un módulo aislado y alimentado por batería, preferentemente inalámbrico. **Nunca** conectar electrodos corporales a este circuito alimentado por USB.
    - Lleva los cables por las ranuras de bridas de la base, lejos del recorrido de las bielas y del plato.

## Ajustes mecánicos
- **Extremos del servo.** Ajusta en el firmware los ángulos de comando para que: plato arriba → valvas cerradas con ≈ 1 mm de separación visible entre bordes; plato abajo → 80° (mide con el transportador `Angle_Scale` o con las marcas ópticas).
- **Radio real del horn.** Si el agujero del horn no está a 8 mm, el recorrido necesario cambia:

| Radio del agujero del horn | Barrido de la palanca | Comando (cerrada → abierta) |
|---|---|---|
{rtab}

## Módulos (modos de ensayo)
| Modo | Valva 1 | Valva 2 | Valva 3 | Cómo funciona |
|---|---|---|---|---|
| Normal | Biela normal + tope 84 | Normal + tope 84 | Normal + tope 84 | Unión rígida: las tres valvas 0° → 80°. El tope 84 es de seguridad (no se toca). |
| Apertura restringida 60° | `Link_LostMotion` + `Opening_Stop_60` + resorte | Normal | Normal | El resorte abre la valva hasta el tope; el pasador del plato sigue bajando dentro de la ranura de la biela (recorrido perdido): **el servo nunca empuja contra el tope**. Al cerrar, el pasador vuelve a empujar la biela. |
| Apertura restringida 45° | `Link_LostMotion` + `Opening_Stop_45` + resorte | Normal | Normal | Igual, con tope de 45°. |
| Cierre incompleto | `Link_LostMotion_IC` + `Opening_Stop_84` + resorte | Normal | Normal | La biela es {F(C.LINK_L - K.MODULES['IC'].L, 2)} mm más corta: con el plato arriba la valva queda en {F(C.IC_RESIDUAL, 0)}°. Al abrir llega al tope de 84° y la ranura absorbe el resto. |
| Asimétrico | `Link_LostMotion` + tope 60 + resorte | `Link_LostMotion` + tope 45 + resorte | Normal | Tres recorridos diferentes (60°, 45°, 80°). |
| Ritmo irregular | Normal | Normal | Normal | Se programa en el firmware (cambio de frecuencia/retardo del ciclo). |

**Resorte de los módulos:** se ata en el agujero Ø1,5 de la cola y baja por el canal del tope; se anuda (o engancha) bajo la brida. Tensión suave (≈ 0,3–0,6 N).

**Cambiar un módulo:** servo en 50° → retirar el tornillo biela–plato → empujar el eje Ø2 hacia afuera → levantar la valva con su biela → cambiar biela y/o tope → volver a montar.

## Pruebas iniciales (en este orden)
1. **Sin servo:** retira el tornillo del empujador y mueve el plato a mano: las tres valvas deben abrir y cerrar juntas, sin trabas.
2. **Prueba de control del servo (sin transmitir movimiento):** con el empujador desconectado, haz funcionar el servo con el ciclo normal y registra piezo y MEMS. Esto mide la vibración/sonido propios del servo para restarlos o compararlos.
3. **Ciclo lento:** 10 ciclos/min, luego 60–75 ciclos/min. Revisar ruidos de roce y temperatura del servo.
4. **Medición del ángulo real:** cámara superior (marcas ópticas) y cámara lateral alineada con el eje de la valva 1 frente al `Angle_Scale`.
5. **Modos alterados**, uno a la vez, comparando con el registro normal.
""")

# ───────────────────────────── informe de validación ─────────────────────────────

def validation_report():
    pm = V['print_meshes']
    mesh_ok = all(r['watertight'] and r['winding'] and r['manifold_ok'] and r['bodies'] == 1 and r['fits_bed'] and abs(r['zmin']) < 1e-3 for r in pm)
    inter = V['sweep']['interferences']
    asm = V['assembly']
    clr = sorted(V['clearance'].items(), key=lambda kv: kv[1]['min_mm'])
    kin_rows = []
    for mode, rows in V['kinematics'].items():
        th = [[r['theta'][i] for r in rows] for i in range(3)]
        kin_rows.append(f"| {mode.replace('_', ' ').title()} | " + ' | '.join(f"{F(min(t))}° → {F(max(t))}°" for t in th) +
                        f" | {F(max(max(r['slot_mm']) for r in rows), 2)} mm | {F(min(min(r['transmission']) for r in rows))}° |")
    mesh_rows = '\n'.join(f"| {r['part']} | {'✔' if r['watertight'] and r['winding'] and r['manifold_ok'] else '✘'} | {r['bodies']} | {F(r['volume_mm3'])} | {' × '.join(F(v) for v in r['size_mm'])} | {'✔' if r['fits_bed'] else '✘'} | {F(r['overhang_mm2'])} | {F(r.get('bridge_mm2', 0))} |" for r in pm)
    clr_rows = '\n'.join(f"| {k} | {F(v['min_mm'], 2)} | {v['mode'].replace('_', ' ').lower()} · servo {F(K.servo_command(v['beta']), 0)}° |" for k, v in clr)
    asm_rows = '\n'.join(f"| {c['check']} | {'✔' if c['ok'] else '✘ ' + ', '.join(c['hits'])} |" for c in asm)
    s = V['servo']
    write('Informe_de_Validacion.md', f"""
# {NAME} — Informe de validación (v1, {V['generated']})

Este informe separa lo **verificado digitalmente** (ejecutado de verdad sobre los archivos entregados) de lo **pendiente de prueba física**.
Una verificación digital **no** aprueba un ensayo físico.

## 1. Verificaciones ejecutadas
### 1.1 Mallas STL de impresión  — {'✔ todas correctas' if mesh_ok else '✘ revisar'}
Cerradas (watertight), orientación de caras coherente, malla «manifold» válida (manifold3d), **un solo cuerpo por archivo**, apoyadas en z = 0, en milímetros y dentro del volumen {int(C.BED[0])} × {int(C.BED[1])} × {int(C.BED[2])} mm.

| Pieza | Malla cerrada y válida | Cuerpos | Volumen (mm³) | Tamaño (mm) | Cabe | Voladizo (mm²) | Puentes (mm²) |
|---|---|---|---|---|---|---|---|
{mesh_rows}

### 1.2 Cinemática (un solo servo, plato compartido)
Carrera del plato {F(V['geometry']['stroke_mm'], 2)} mm · palanca {F(V['geometry']['crank_r_mm'], 2)} mm · biela normal {F(C.LINK_L)} mm · biela IC {F(V['geometry']['ic_link_mm'], 2)} mm.
El ángulo de transmisión (biela–cola) se mantiene lejos de los puntos muertos (0°/180°): mínimo ≥ 40° en todos los modos.

| Modo | Valva 1 | Valva 2 | Valva 3 | Recorrido perdido usado (máx. {F(C.LM_SLOT)} mm) | Transmisión mín. |
|---|---|---|---|---|---|
{chr(10).join(kin_rows)}

La tabla completa (comando del servo → posición del plato → ángulo de cada valva) está en `Tabla_Cinematica.csv`.

### 1.3 Interferencias en todo el recorrido — {'✔ 0 interferencias' if not inter else '✘ ' + str(len(inter))}
Intersección booleana exacta (manifold3d) entre **todas** las piezas del ensamblaje (anillo, valvas, ejes, bielas, topes, plato, columnas, empujador, horn, servo, soportes, sensores, ESP32, base, transportador) en **{V['sweep']['poses_checked']} poses** (25 posiciones del servo × 5 modos). Umbral: volumen > {F(0.05, 2)} mm³.
{'' if not inter else chr(10).join(f'- {k}: {v}' for k, v in inter.items())}

### 1.4 Holguras mínimas medidas (distancia punto–superficie, 9 posiciones × 5 modos)
| Par | Holgura mínima (mm) | Dónde |
|---|---|---|
{clr_rows}

«Valva ↔ tope = 0» es el **contacto previsto** del tope en los modos restringidos.

### 1.5 Montaje (trayectorias de ejes, tornillos y herramientas)
| Verificación | Resultado |
|---|---|
{asm_rows}

### 1.6 Carga estimada del servo (cálculo, no medición)
Plato + bielas + empujador ≈ {F(s['plate_and_links_g'])} g; fuerza estimada {F(s['force_N'], 2)} N (peso, par de las valvas, roce supuesto μ = 0,35 y dos resortes de módulo) → par ≈ {F(s['torque_kgcm'], 3)} kg·cm.
Par de bloqueo del MG90S según distribuidores: {F(s['mg90s_stall_kgcm_unverified'])} kg·cm (**no verificado**). Margen ≈ ×{F(s['margin_x'])}. El valor real depende del roce de los bujes impresos: medir la corriente del servo en la prueba inicial.

## 2. Cambios respecto de los parámetros iniciales (justificación)
- **Valvas planas «semilunares simplificadas»:** cada valva gira sobre un eje recto (cuerda a {F(C.HINGE_D, 0)} mm del centro); su contorno se calculó para que, **con el espesor incluido**, no toque la pared en todo el recorrido hasta {F(C.THETA_DESIGN, 0)}° (holgura de diseño {F(C.WALL_CLEAR)} mm) y deje {F(2 * C.EDGE_GAP)} mm entre bordes al cerrar. Una valva curva real necesitaría flexión del material.
- **Mando por «cola»:** la cola de cada valva atraviesa una ranura de la pared y forma un mecanismo biela–manivela con el plato. Ángulo inicial de la cola {F(C.TAIL_PHI0, 0)}° sobre la horizontal: el recorrido de ±40° alrededor de la horizontal evita puntos muertos.
- **Comisuras de {F(C.POST_H, 0)} mm sobre el anillo** (altura total {F(C.RING_H + C.POST_H, 0)} mm) para el aspecto de raíz aórtica y para alojar los tornillos M3 de las columnas.
- **Alteraciones con recorrido perdido + resorte** en lugar de topes simples: con topes solos el servo empujaría contra ellos (bloqueo).
- **Tope de seguridad a 84°** (no 80°) en modo normal: la unión rígida ya limita a 80°; un tope exacto en 80° forzaría el servo por tolerancias.
- **Base 200 × 180 mm en una pieza**: cabe en camas de 220 × 220 mm; no fue necesario dividirla.

## 3. Pendiente de prueba física (NO verificado)
- Tolerancias reales de impresión (agujeros, ejes, bujes): usar la probeta.
- Dimensiones reales del MG90S, del horn (radio del agujero), del INMP441 y del ESP32 comprados.
- Roce y posible atascamiento del plato en las columnas impresas; repetibilidad del ciclo.
- Par real del servo, temperatura y consumo en ciclos largos; durabilidad y desgaste de bisagras, bielas y bujes.
- Fuerza real de los resortes y comportamiento de los módulos de recorrido perdido.
- Calidad del acoplamiento del piezo al anillo y separación acústica del MEMS respecto del servo.
- Exactitud de la medición del ángulo (óptica y Hall): requiere calibración experimental.
- Resistencia mecánica: **no** se realizó análisis de esfuerzos ni de fatiga (la simulación es cinemática).
""")

def kin_table():
    with open(os.path.join(DOCS, 'Tabla_Cinematica.csv'), 'w', newline='', encoding='utf-8') as f:
        w = csv.writer(f)
        w.writerow(['modo', 'comando_servo_deg', 'palanca_beta_deg', 'plato_desde_arriba_mm', 'valva1_deg', 'valva2_deg', 'valva3_deg', 'valva1_en_tope', 'ranura1_mm'])
        for mode in K.MODES:
            for k in range(41):
                beta = C.SERVO_SWEEP - 2 * C.SERVO_SWEEP * k / 40
                p = K.pose(beta, mode)
                w.writerow([mode, round(K.servo_command(beta), 2), round(beta, 2), round(K.Z_TOP - p['zp'], 3), *[round(s['theta'], 2) for s in p['leaves']],
                            p['leaves'][0]['on_stop'], round(p['leaves'][0]['slot_used'], 3)])

def angle_doc():
    write('Medicion_del_Angulo.md', f"""
# {NAME} — Medición del ángulo real de las valvas

El ángulo **ordenado** al servo no es necesariamente el ángulo **real** de la valva (holguras, flexión, roce). El diseño deja dos caminos:

## Alternativa A — Óptica (incluida)
- **Marcas en cada valva:** dos hoyuelos Ø1,5 en la línea central, a 6 y 16 mm del eje. **Marca fiduciaria** grabada en el anillo junto a cada valva y números 1–3.
- **Cámara superior:** la distancia proyectada entre las marcas es d·cos θ → θ = arccos(d_medida / d_real). Sensibilidad baja cerca de 0° (usar la cámara lateral en ese rango); a 60–80° una incertidumbre de 0,2 mm equivale a ≈ 1°.
- **Cámara lateral + `Angle_Scale`:** el transportador (marcas cada 5°, largas cada 30°) se encaja en la ranura de la base, en el plano perpendicular al eje de la valva 1 y centrado a la altura del eje. Filmar con la cámara alineada con el eje (teleobjetivo para reducir paralaje).
- **Mide directamente:** el ángulo geométrico de la valva. **Precisión a evaluar:** ±1–3° (depende de la resolución, el paralaje y la calibración).

## Alternativa B — Sensor Hall (espacio reservado)
- Alojamiento Ø3,2 × 0,8 mm en la cara −y de cada cola para un imán Ø3 × 1 mm, y bolsillo vertical abierto arriba en la pared del anillo (junto a cada ranura) para un sensor Hall lineal (p. ej. DRV5055/SS49E en una placa pequeña).
- **Mide directamente:** la intensidad del campo del imán, que cambia con la posición de la cola; el ángulo se obtiene con una **curva de calibración** (Hall vs. ángulo medido ópticamente).
- **Precisión a evaluar:** depende de la calibración y de la temperatura; típicamente mejor resolución que la óptica pero menos exactitud absoluta sin calibrar.
""")

def readme():
    files = '\n'.join(f'- `{C.PREFIX}_STL/{C.PREFIX}_{it.name}.stl` × {it.qty} — {it.role}' for it in R.ITEMS if it.printable)
    write('LEEME.md', f"""
# {NAME} — Modelo mecánico definitivo v1 (impresión 3D)

Prototipo universitario de **válvula aórtica trivalva** accionada por **un solo servomotor MG90S**, con sensor piezoeléctrico, micrófono MEMS INMP441 y ESP32.
**Uso académico y experimental. No es un dispositivo médico ni implantable. No usa presión ni líquido.**

## Contenido del paquete
- `{C.PREFIX}_STL/` — piezas imprimibles, una por archivo, orientadas para la cama (mm).
{files}
- `{C.PREFIX}_STEP/` — las mismas piezas como sólidos B-rep editables (STEP), en el marco del ensamblaje.
- `{C.PREFIX}_Assembly_Cerrada.step` — ensamblaje completo con todas las piezas y referencias en posición (válvula cerrada).
- `{C.PREFIX}_Final.blend` — escena de Blender con el ensamblaje y la animación completa (10 segmentos marcados en la línea de tiempo).
- `{C.PREFIX}_Animacion.mp4` — animación renderizada.
- `Referencia_NO_IMPRIMIR/` — modelos de referencia (servo, horn, ESP32, INMP441, piezo, ejes). **No imprimir.**
- `Documentacion/` — Guía de ensamblaje, Guía de impresión, Lista de materiales (MD y CSV), Medición del ángulo, Tabla cinemática (CSV) e Informe de validación.
- `CAD_parametrico/` — código fuente: `config.py` (todos los parámetros), piezas, cinemática, ensamblaje, verificación, documentos y animación.

## Regenerar después de cambiar medidas
```
pip install build123d trimesh manifold3d shapely rtree networkx bpy
python build_all.py      # STL + STEP + ensamblaje
python verify.py         # verificaciones (mallas, interferencias, holguras, montaje)
python make_docs.py      # guías e informe
python blender_anim.py --render   # .blend y cuadros de la animación
```
""")

if __name__ == '__main__':
    print_guide(); bom(); assembly_guide(); validation_report(); kin_table(); angle_doc(); readme()
    print('Documentación en', DOCS)
