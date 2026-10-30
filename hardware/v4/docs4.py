"""
Documentos de CardioValveAI v4 (Markdown) a partir del registro de piezas, de verify.json y de placas.json:
  out_v4/LEEME_PRIMERO.md
  out_v4/Documentacion/1_Preguntas_antes_de_imprimir.md
  out_v4/Documentacion/2_Impresion.md
  out_v4/Documentacion/3_Materiales_no_impresos.md
  out_v4/Documentacion/4_Guia_de_Armado.md
  out_v4/Documentacion/5_Sensores_Hall_y_Calibracion.md
  out_v4/Documentacion/6_Verificacion_CAD.md
Uso: python docs4.py   (después de build4.py, verify4.py y plates4.py)
"""
from __future__ import annotations
import json
import math
import os

import config4 as C
import registry4 as R
import parts4 as P

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.abspath(os.path.join(HERE, '..', C.OUT_DIR))
DOC = os.path.join(OUT, 'Documentacion')
V = json.load(open(os.path.join(OUT, '_canon', 'verify.json')))
PL = json.load(open(os.path.join(OUT, '3MF', 'placas.json')))

f1 = lambda x: f'{x:.1f}'.replace('.', ',')
f2 = lambda x: f'{x:.2f}'.replace('.', ',')
ok = lambda b: 'sí' if b else '**NO**'

CUTS = [('R1 pasador de bisagra', 3, R.HINGE_L), ('R2 pasador de horquilla', 3, R.LUG_L), ('R3 pasador de manivela', 1, R.CRANK_L),
        ('R4 pasador de traba', 1, R.LOCK_L)]
ROD_TOTAL = sum(n * l for _, n, l in CUTS)
CLOSED_CMD, OPEN_CMD = 90 + C.BETA_WORK, 90 - C.BETA_WORK


def w(name, text):
    p = os.path.join(DOC if name != 'LEEME_PRIMERO.md' else OUT, name)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, 'w', encoding='utf-8').write(text.strip() + '\n')


def table(head, rows):
    out = ['| ' + ' | '.join(head) + ' |', '|' + '---|' * len(head)]
    out += ['| ' + ' | '.join(str(c) for c in r) + ' |' for r in rows]
    return '\n'.join(out)


# ─────────────────────────────────────────────────────────────────────────────
def leeme():
    printed = [i for i in R.ITEMS if i.kind in ('probeta', 'obligatoria')]
    rows = [(f'`{i.file}.stl`', i.qty, i.role) for i in printed]
    opt = [i for i in R.ITEMS if i.kind == 'opcional']
    w('LEEME_PRIMERO.md', f"""
# {C.PROJECT} {C.REVISION} · banco académico de una válvula trivalva (SIN fluido, NO es un dispositivo médico)

Diámetro exterior {f1(C.OD)} mm · alto {f1(C.TOP_Z)} mm · 3 valvas movidas por UN servo MG90S (180°) · 3 sensores Hall + 3 imanes · ESP32.
Apertura de trabajo 0–{C.THETA_OPEN:.0f}° (comando del servo {CLOSED_CMD:.0f}° → {OPEN_CMD:.0f}°). El mecanismo no tiene topes: el servo no se fuerza en ningún punto de su recorrido.

## 1 · Antes de imprimir
Lee **Documentacion/1_Preguntas_antes_de_imprimir.md**. Las medidas del Hall, los imanes, el servo y su horn se tomaron de valores típicos:
si lo que compraste es distinto, hay que ajustar 4 piezas antes de imprimirlas.

## 2 · Qué imprimir (PETG) — carpeta `STL/01_Imprimir_Obligatorio`
El número del final del nombre es la **cantidad de copias**. Las STL ya están orientadas como van en la cama.

{table(['Archivo', 'Copias', 'Para qué'], rows)}

Total obligatorio: **{sum(i.qty for i in printed if i.kind == 'obligatoria')} piezas** (+ 1 probeta). Ninguna lleva soportes.
Opcional (`STL/02_Opcional`): {len(opt)} galgas de calibración (`07_Galga_00 … 80`), 1 copia de cada una.
`STL/03_Referencia_NO_IMPRIMIR`: servo, horn, pasadores de latón, imanes y Hall, solo para ver y medir.

Atajo: la carpeta `3MF` trae una placa lista por cada grupo de parámetros (todas las copias ya distribuidas). Orden: Placa_0 (probeta) → Placa_1 … Placa_4 → Placa_5 (opcional).

## 3 · Qué comprar (lista completa en Documentacion/3_Materiales_no_impresos.md)
- 1 varilla de **latón Ø3 mm** (≥ 300 mm). Es la ÚNICA fijación: se corta en 8 pasadores.
- 3 imanes de neodimio **Ø4 × 2 mm**, magnetización axial (+2 de repuesto).
- 3 sensores Hall **lineales** TO-92 (recomendado DRV5055A1QLPG). Un A3144 (digital) NO sirve.
- Servo MG90S (trae el horn y los 2 tornillos que se usan), ESP32 DevKit V1, fuente de 5 V ≥ 2 A, cables, 4 resistencias, 7 condensadores.
**No hay tornillos, tuercas ni insertos que comprar.**

## 4 · Armado
**Documentacion/4_Guia_de_Armado.md** (12 pasos, con el despiece numerado `Vistas/Despiece_numerado.png`).
Herramientas: sierra chica o alicate de corte, lima o lija, alicate, destornillador Phillips chico, cautín, cianoacrilato.

## 5 · Otros archivos
- `CAD/` sólidos STEP editables (cada pieza y el conjunto) + `CAD/fuente/`, el código Python paramétrico que los genera: `config4.py` tiene TODAS las medidas;
  `python build4.py && python verify4.py && python plates4.py` regenera STL, comprobación y placas (requiere build123d, trimesh, manifold3d, shapely).
- `CardioValveAI_v4_Animacion.mp4` (26 s): armado desde el despiece, apertura y cierre por fuera, el mecanismo por dentro y la vista superior.
- `Blender/CardioValveAI_v4.blend` conjunto con animación de apertura y cierre.
- `Electronica/Esquema_v4.png` alimentación y conexiones.
- `Firmware/` el firmware del ESP32 (el de la v3: mismos pines) y `Herramientas_Mac/` los programas de registro, calibración y `cvai_montaje.py` (posición de montaje del servo).
- `Documentacion/6_Verificacion_CAD.md` qué se comprobó en el CAD y qué falta probar con las piezas reales.

**Estado:** diseño verificado SOLO en CAD (interferencias, holguras, accesos, montaje y campo magnético calculado). No se ha impreso ni probado físicamente.
""")


# ─────────────────────────────────────────────────────────────────────────────
def preguntas():
    w('1_Preguntas_antes_de_imprimir.md', f"""
# Preguntas antes de imprimir (lista única)

Las piezas se dibujaron con medidas típicas. Responde esta lista (o mide con un pie de metro) **antes de imprimir las piezas afectadas**.
Si todo coincide, imprime tal cual. Si algo difiere, se cambia un número en `CAD/fuente/config4.py` y se regeneran las STL (`python build4.py`).

{table(['#', 'Dato que falta', 'Valor usado en el diseño', 'Piezas afectadas', 'Por qué importa'], [
        (1, 'Modelo EXACTO del sensor Hall (texto impreso en la cara plana, o enlace de compra) y si es un componente suelto TO-92 o viene en una placa (módulo)',
         f'TO-92 suelto, cuerpo {f1(C.TO92[0])} × {f2(C.TO92[1])} × {f1(C.TO92[2])} mm, lineal (analógico), p. ej. DRV5055A1QLPG',
         '06 Portasensor_Hall · esquema',
         'Un módulo con placa NO entra en el portasensor. Un Hall digital (A3144, KY-003…) solo da sí/no: no sirve para medir el ángulo.'),
        (2, 'Imanes: diámetro × espesor y dirección de magnetización', f'Ø{f1(C.MAGNET[0])} × {f1(C.MAGNET[1])} mm, axial (polos en las caras planas)',
         '02 Valva (ranura del imán)', 'La ranura tiene 0,2 mm de holgura. Un imán de otro tamaño no entra o queda suelto.'),
        (3, 'Servo: medidas reales del MG90S comprado (largo y ancho del cuerpo, separación de los agujeros de las orejas, distancia del eje al borde)',
         f'cuerpo {f1(C.SERVO.L)} × {f1(C.SERVO.W)} mm, orejas a {f1(C.SERVO.tab_hole_spacing)} mm, eje a {f1(C.SERVO.shaft_offset)} mm del borde',
         '01 Cuerpo (tabique y ventana del servo)', 'Hay clones con medidas distintas.'),
        (4, 'Horn de UN brazo que trae el servo: diámetro del cubo, largo (centro → punta), ancho de la punta, espesor del brazo',
         f'cubo Ø{f1(C.HORN.hub_d)}, largo {f1(C.HORN.arm_len)}, punta {f1(C.HORN.tip_w)}, espesor {f1(C.HORN.t)} mm',
         '05 Manivela', 'La manivela encastra sobre el horn.'),
        (5, 'Tamaño de la cama de la impresora', f'{C.BED[0]:.0f} × {C.BED[1]:.0f} mm', 'placas 3MF', 'Si es más chica, se redistribuyen las placas (la pieza mayor mide 90 × 90 mm).'),
        (6, '¿Consigues varilla de latón (o acero) de Ø3,0 mm?', 'Latón Ø3,0 mm', 'todas (agujeros a presión y libres)',
         'Es la única fijación. Acero Ø3 también sirve (cuesta más cortarlo). Otro diámetro obliga a regenerar los agujeros.'),
    ])}

Lo que NO depende de estas respuestas y se puede imprimir ya: **00 Probeta**, **03 Pistón** y **04 Yugo** (salvo la respuesta 6).

La probeta (00) resuelve además el ajuste de TU impresora: ver «Paso 1» en la guía de armado.
""")


# ─────────────────────────────────────────────────────────────────────────────
def impresion():
    rows = []
    for i in R.ITEMS:
        if i.kind == 'referencia' or (i.kind == 'opcional' and i.name != 'Galga_00'):
            continue
        name = '07_Galga_XX (5 archivos)' if i.kind == 'opcional' else f'{i.file}'
        m = next((x for x in V['mallas'] if x['pieza'].startswith(i.num + '_' + (i.name if i.kind != 'opcional' else 'Galga'))), None)
        mass = f"{f1(m['masa_g_petg'] * (5 if i.kind == 'opcional' else i.qty))} g" if m else ''
        rows.append((name, i.qty if i.kind != 'opcional' else '1 c/u', i.orient, i.supports, i.params, mass))
    plates = [(p['placa'], ', '.join(p['piezas']), p['parametros'], ok(p['dentro_de_la_cama'])) for p in PL]
    total_g = sum(x['masa_g_petg'] * int(x['pieza'].rsplit('_x', 1)[1]) for x in V['mallas'] if not x['pieza'].startswith('07'))
    w('2_Impresion.md', f"""
# Impresión (PETG, boquilla 0,4 mm)

**Ninguna pieza necesita soportes.** Los agujeros horizontales son chicos (Ø3) y el techo de la ventana del servo es a dos aguas (45°), así que se imprimen sin soporte.
No hay piezas de soporte que retirar: todo lo que sale de la impresora es funcional. Lo único a limpiar es el borde (brim) del cuerpo.

## Parámetros comunes
- PETG · cama 75–85 °C · boquilla 230–245 °C · ventilador 30–50 %.
- Velocidad moderada (≤ 60 mm/s en perímetros externos) para que los agujeros salgan redondos.
- Sin «compensación de agujeros» del laminador: los ajustes ya están en el diseño y se comprueban con la probeta.
- Costura (seam) alineada atrás, lejos de los agujeros de los pasadores.

## Por pieza
{table(['Archivo', 'Copias', 'Orientación en la cama', 'Soportes', 'Parámetros', 'PETG aprox.'], rows)}

Total (obligatorias + probeta) ≈ {f1(total_g)} g de PETG (masas calculadas con relleno 100 %; las reales son menores).

## Placas 3MF (carpeta `3MF`)
Cada placa agrupa piezas con la misma altura de capa. Ábrelas en PrusaSlicer, OrcaSlicer, Bambu Studio o Cura y aplica los parámetros de la tabla.

{table(['Placa', 'Contenido', 'Parámetros', 'Cabe en la cama'], plates)}

## Después de imprimir
- Quitar el brim del cuerpo y repasar la primera capa con una lima si quedó «pata de elefante» (sobre todo en las ranuras guía del pistón).
- **No** agrandar los agujeros de los pasadores a ciegas: comparar primero con la probeta (Paso 1 de la guía).
- Las zapatas de los brazos del pistón (los 3 extremos) y sus ranuras llevan una capa fina de grasa PTFE o vaselina.
""")


# ─────────────────────────────────────────────────────────────────────────────
def materiales():
    cuts = table(['Pasador', 'Cantidad', 'Largo (mm)'], [(n, q, f1(l)) for n, q, l in CUTS])
    w('3_Materiales_no_impresos.md', f"""
# Materiales no impresos (lista mínima)

## Mecánica
{table(['Cant.', 'Material', 'Medida', 'Uso', 'Nota'], [
        (1, 'Varilla de latón (o acero)', f'Ø3,0 mm, ≥ 300 mm', 'los 8 pasadores (ÚNICA fijación comprada)', f'se usan {f1(ROD_TOTAL)} mm; sobra para equivocarse'),
        ('3 (+2)', 'Imán de neodimio N35–N52', f'Ø{f1(C.MAGNET[0])} × {f1(C.MAGNET[1])} mm, magnetización AXIAL', 'uno por valva', 'VERIFICAR medidas reales (pregunta 2)'),
        (1, 'Cianoacrilato (gotita)', '—', 'imanes y manivela sobre el horn', ''),
        (1, 'Grasa PTFE o vaselina', '—', 'zapatas del pistón, pasadores', ''),
        (1, 'Cinta adhesiva o pegamento caliente', '—', 'fijar las pestañas de los 3 portasensores', ''),
    ])}

Corte de la varilla:
{cuts}

**Total: {f1(ROD_TOTAL)} mm.** Limar las puntas (sin rebabas, con un chaflán leve) para que entren rectos.

## Electrónica
{table(['Cant.', 'Componente', 'Nota'], [
        (1, 'Servo MG90S 180° (con sus horns y tornillos)', 'se usan el horn de UN brazo, su tornillo central y los 2 tornillos de las orejas'),
        (3, 'Sensor Hall LINEAL TO-92: DRV5055A1QLPG (recomendado) o SS49E/49E', 'NO un A3144 ni otro digital. VERIFICAR modelo (pregunta 1)'),
        (1, 'ESP32 DevKit V1 (ESP32-WROOM-32) + cable USB de datos', 'se alimenta por USB'),
        (1, 'Fuente 5 V ≥ 2 A (cargador USB de 5 V 2 A + cable cortado, o fuente de banco)', 'SOLO para el servo'),
        (1, 'Interruptor de palanca', 'corta los 5 V del servo'),
        (1, 'Condensador electrolítico 470–1000 µF 10 V', 'en los bornes del servo'),
        (6, 'Condensador cerámico 100 nF', '3 en los Hall + 3 en los filtros RC'),
        (1, 'Resistencia 220 Ω', 'señal PWM del servo'),
        (3, 'Resistencia 1 kΩ', 'filtros RC de los Hall'),
        ('3 × 40 cm', 'Cable de 3 hilos delgado (o cable plano)', 'uno por Hall'),
        (1, 'Placa perforada chica o protoboard + cables dupont', ''),
        ('—', 'Termorretráctil o cinta aislante', 'patas de los Hall'),
    ])}

Si el Hall comprado solo funciona a 5 V (algunos 49E): agregar 3 × 20 kΩ y 3 × 30 kΩ (divisor de la salida). Ver el esquema.

## Herramientas
Sierra chica o alicate de corte para el latón · lima o lija · alicate · destornillador Phillips chico · cautín y estaño · pie de metro (recomendado).
""")


# ─────────────────────────────────────────────────────────────────────────────
def guia():
    hp = P.HINGE_PIN
    protr = -C.SPOT_V - hp[0]
    w('4_Guia_de_Armado.md', f"""
# Guía de armado

Mira `Vistas/Despiece_numerado.png`: los números (01–06) son los de las piezas impresas y R1–R9 los de las compradas.
Cada valva se identifica en la cara superior del cuerpo con 1, 2 o 3 puntos, junto a una muesca índice: valva 1 ↔ Hall 1 ↔ GPIO36, etc.

Convención: el **lado del pasador** de cada bisagra es por donde entra el latón; el **lado del sensor** es el extremo opuesto del mismo eje, donde entra el portasensor.

### Paso 1 · Probeta (antes que nada)
Imprime `00_Probeta_x1` con los mismos parámetros del cuerpo. Las muescas de arriba numeran las columnas 1, 2 y 3. La columna **2** es el valor del diseño.
- **Ø3 a presión** (2,85 / 2,95 / 3,05): el latón debe entrar con alicate o golpecitos y NO salir con la mano.
- **Ø3 libre** (3,20 / 3,30 / 3,40): el latón debe girar sin juego visible.
- **Ranura del imán** ({f1(P.COUPON_MAG[0][0])} / {f1(P.COUPON_MAG[1][0])} / {f1(P.COUPON_MAG[2][0])} mm): el imán entra con el dedo.
- **Pilotos** de los tornillos del servo (1,6 / 1,8 / 2,0): el tornillo entra firme sin partir el plástico.
- **Túnel**: el portasensor (06) entra y desliza sin juego lateral.

Si la columna 2 funciona en todo, imprime el resto tal cual. Si otra columna es mejor, cambia `PIN_PRESS`, `PIN_FREE` o `SERVO_PILOT` en `config4.py` y regenera, o repasa a mano con una broca del diámetro de la columna buena.

### Paso 2 · Cortar el latón
Corta 3 × {f1(R.HINGE_L)} mm (R1), 3 × {f1(R.LUG_L)} mm (R2), 1 × {f1(R.CRANK_L)} mm (R3) y 1 × {f1(R.LOCK_L)} mm (R4). Lima las puntas.

### Paso 3 · Imanes en las valvas (02)
En el extremo del barril del lado del sensor hay una ranura vertical. Pon una gota chica de cianoacrilato y empuja el imán **hasta el fondo**, de canto.
Que no entre pegamento en el agujero del barril. La polaridad no importa (la calibración la absorbe), pero pon los 3 iguales para que las curvas se parezcan.

### Paso 4 · Valvas en el pistón (03)
Mete la cola de cada valva entre las dos mejillas de una horquilla del pistón y empuja un pasador **R2 ({f1(R.LUG_L)} mm)** a presión por las dos mejillas, atravesando la ranura de la cola.
Debe quedar al ras de ambas mejillas. Mueve la valva: debe girar y la cola deslizar sin trabarse.

### Paso 5 · Yugo (04) en el pistón
Pasa la espiga del yugo de abajo hacia arriba por la ranura central del pistón. Encima del disco, empuja el pasador **R4 ({f1(R.LOCK_L)} mm)** a presión por el agujero de la espiga.
El yugo queda colgando bajo el pistón con su ranura horizontal.

### Paso 6 · Subconjunto en el cuerpo (01)
Abre las tres valvas al máximo y baja el subconjunto desde arriba: las zapatas de los 3 brazos entran en las 3 ranuras guía del cuerpo (en las comisuras) y el yugo baja hacia el faldón.
Gíralo hasta que cada valva quede frente a su marca de puntos (1, 2 o 3). Baja hasta que el agujero de cada barril quede alineado con el agujero de la pared.

### Paso 7 · Pasadores de bisagra (R1)
Desde AFUERA, por el rebaje plano del lado del pasador, mete cada R1 ({f1(R.HINGE_L)} mm): atraviesa la pared, el resalte de empuje y el barril,
hasta el fondo ciego del barril. Los últimos ~{f1(V['retencion'][0]['largo_a_presion_mm'])} mm van a presión en la pared: termina con alicate o golpecitos. Queda asomando ≈ {f1(protr)} mm para sacarlo con alicate si hace falta.

### Paso 8 · Prueba a mano (sin servo)
Empuja el yugo hacia arriba y abajo por la ventana del servo. Las tres valvas deben abrir y cerrar **juntas y suaves**, de cerradas a abiertas, sin roces.
Si algo roza: localiza el punto, lima y repite. Engrasa las zapatas. **No sigas hasta que esto funcione.**

### Paso 9 · Hall en los portasensores (06)
Suelda un cable de 3 hilos a cada Hall (aísla cada pata). Coloca el Hall en el canal del portasensor, **cara plana mirando hacia el centro de la válvula**,
apoyado contra el labio de la punta; las patas salen hacia afuera. Una gota de pegamento caliente lo sujeta.

### Paso 10 · Portasensores en el cuerpo
Por el rebaje plano del lado del sensor, mete el portasensor en su túnel (el nervio del lomo entra en la ranura del túnel: solo entra en una posición)
y empújalo **hasta que la punta toque el extremo del barril** (se siente el tope). No fuerces. Fija la pestaña a la pared con cinta o una gota de pegamento caliente.
Repite la prueba del Paso 8: las valvas deben seguir moviéndose libres. Si un portasensor se mueve después, hay que recalibrar esa valva.
Para cambiar un Hall: despega la pestaña y tira del portasensor; no hace falta desarmar nada más.

### Paso 11 · Electrónica y calibración
Arma el circuito de `Electronica/Esquema_v4.png` **sin el servo**. Carga el firmware (el mismo de la v3: mismos pines; el micrófono queda sin conectar).
Calibra cada valva empujando el yugo a mano (ver `5_Sensores_Hall_y_Calibracion.md`).

### Paso 12 · Servo (R7)
1. Prensa el pasador **R3 ({f1(R.CRANK_L)} mm)** en la manivela (05): entra por el lado del encastre y queda al ras del fondo del encastre.
2. Conecta solo el servo (sin montar) y su fuente, y ejecuta `python cvai_montaje.py --port …`: el servo va a **180°** y queda sin pulsos.
3. Calza el horn de un brazo en el eje con el brazo **hacia abajo** (colgando) y aprieta su tornillo central. Pega la manivela sobre el horn (encastre del lado del horn) con 2 gotas de cianoacrilato: el pasador queda hacia afuera.
4. Lleva el servo por la ventana, acostado, con la manivela colgando, hasta que el pasador entre en la ranura del yugo y las orejas apoyen en el tabique.
5. Atornilla las 2 orejas con los tornillos del servo, desde afuera por la ventana. El cable sale por la ventana.
6. Con el firmware: `MOVE {CLOSED_CMD:.0f} 1000` → valvas cerradas; `MOVE {OPEN_CMD:.0f} 1000` → abiertas. Son los valores por omisión del firmware (cerrado {CLOSED_CMD:.0f}°, abierto {OPEN_CMD:.0f}°).
   Si al revés: el horn quedó mal calzado; repite 2–3.

Listo: `python cvai_record.py --port … --ciclos 10 --live`.
""")


# ─────────────────────────────────────────────────────────────────────────────
def sensores():
    h = V['hall']
    srows = [(s['sensor'], f2(s['v_0']), f2(s['v_80']), ok(not s['satura_0_80']), f1(s['pendiente_min_mV_por_grado'])) for s in h['sensores']]
    trows = [(k, f2(v['error_max_con_calibracion_nominal_deg'])) for k, v in h['tolerancia'].items()]
    bu = h['B_u_mT']
    w('5_Sensores_Hall_y_Calibracion.md', f"""
# Sensores Hall y calibración

## Cómo funciona
El imán va pegado en el extremo del barril y **gira con la valva**. El Hall está fijo en el portasensor, sobre la prolongación del eje de la bisagra,
a {f1(h['distancia_iman_elemento_mm'])} mm del imán. Cuando la valva gira, cambia la dirección del campo que ve el Hall: la salida varía de forma continua y **monótona**
(siempre en el mismo sentido) en todo el recorrido. Cada Hall ve solo su imán (efecto de los otros dos ≈ {f2(h['diafonia_otras_valvas_mT'])} mT, despreciable).

## Digital vs. analógico
- **Analógico / lineal** (DRV5055, SS49E, 49E): entrega un voltaje proporcional al campo. **Es el que se necesita.**
- **Digital / interruptor** (A3144, US1881, módulos KY-003): solo cambia entre dos estados al pasar un umbral. **No sirve** para medir el ángulo.

## Señal esperada (CÁLCULO con un modelo de imán ideal, NO medición)
Campo radial en el Hall: {bu['0']} mT con la valva cerrada, {bu['40']} mT a 40°, {bu['80']} mT abierta a 80°.

{table(['Sensor', 'V cerrada', 'V abierta 80°', 'Sin saturar 0–80°', 'Pendiente mín. (mV/°)'], srows)}

Los voltajes reales dependerán del imán real (grado N35–N52), de la tolerancia del sensor y de la impresión: **por eso se calibra**.

## Qué tan sensible es al montaje (cálculo)
{table(['Desviación', 'Error si se usa la calibración original (°)'], trows)}

Lectura: el juego del barril casi no afecta, pero el **portasensor debe quedar tocando el barril**. Si se mueve, se recalibra esa valva.

## Calibración (por valva, con el servo SIN montar)
Una lectura Hall NO es un ángulo: hasta calibrar, solo indica que la valva se mueve.
1. Imprime las galgas opcionales `07_Galga_00 … 80`. Cada una apoya en la cara superior del cuerpo con su chaveta en la muesca índice de la valva, y su cara inclinada marca el ángulo.
2. `python cvai_calibrate.py galgas --port … --valva 1 --galgas 0,20,40,60,80 --repeticiones 3 --salida cal_valva1.csv`
   Para cada galga: empuja el yugo a mano hasta que la valva **toque** la galga, sostén y pulsa Enter. Repite con las valvas 2 y 3.
3. `python cvai_calibrate.py ajustar cal_valva1.csv cal_valva2.csv cal_valva3.csv --salida calib_hall.json` → curva por sensor, ruido y repetibilidad.
4. `python cvai_calibrate.py subir calib_hall.json --port …` → guarda la calibración en el ESP32.
5. Con el servo montado: `python cvai_calibrate.py video --port … --salida cal_video.csv` y un video lateral para comprobar ángulos intermedios e **histéresis** (abriendo vs. cerrando).

Sin galgas: se puede calibrar con fotos o video lateral y un transportador, con menor exactitud.
La curva se interpola entre puntos medidos; fuera de 0–80° no se extrapola.
""")


# ─────────────────────────────────────────────────────────────────────────────
def verificacion():
    b, bi = V['barrido'], V['barrido_sentido_inverso']
    hold = [(k, f2(v['mm'])) for k, v in V['holguras'].items()]
    mrows = [(m['comprobacion'], ok(m['ok'])) for m in V['montaje']]
    rrows = [(r['union'], r['ajuste'], r.get('nota', '')) for r in V['retencion']]
    meshes = [(m['pieza'], ok(m['cerrada']), m['cuerpos'], ok(m['cabe_en_cama']), f1(m['voladizo_mm2'])) for m in V['mallas']]
    L = V['cargas']
    gal = all(g['ok'] for g in V['galgas'])
    w('6_Verificacion_CAD.md', f"""
# Verificación (SOLO en CAD) · generado {V['generado']}

Todo lo de este documento se calculó sobre los modelos 3D. **Nada se ha probado físicamente.** La última sección lista lo que hay que comprobar con las piezas reales.

## Movimiento completo
- Barrido de todo el recorrido del servo en {b['poses']} posiciones (manivela por un lado) y {bi['poses']} (servo girando al revés): **interferencias {len(b['interferencias']) + len(bi['interferencias'])}**.
- Apertura: 0–{C.THETA_OPEN:.0f}° con comando {CLOSED_CMD:.0f}°→{OPEN_CMD:.0f}°; con el recorrido completo del servo, {f1(C.THETA_MIN)}° a {f1(C.THETA_MAX)}° sin topes (punto muerto del yugo).
- Contactos de diseño: la punta del portasensor apoya en el extremo del barril (tope axial).
- Piezas fijas sin choques entre sí: {ok(not V['fijas'])}.

Holguras mínimas en todo el recorrido (mm):
{table(['Par', 'Mínima'], hold)}

## Montaje y accesos
{table(['Comprobación', 'OK'], mrows)}

## Retención de pasadores y piezas
{table(['Unión', 'Ajuste', 'Nota'], rrows)}

## Impresión
{table(['Pieza', 'Malla cerrada', 'Cuerpos', 'Cabe en la cama', 'Área en voladizo > 45° (mm²)'], meshes)}
Los voladizos corresponden a techos de agujeros chicos y chaflanes: puentes cortos que el PETG imprime sin soporte.

## Galgas
Cada galga toca la valva en su ángulo y no la toca en los demás: {ok(gal)}.

## Esfuerzo del servo (estimación)
Par necesario ≈ {f2(L['par_kgcm'])} kg·cm frente a ≈ {f1(L['par_bloqueo_MG90S_kgcm_no_verificado'])} kg·cm del MG90S (dato de catálogo NO verificado) → margen ≈ ×{f1(L['margen_x'])}.
Peor ángulo de transmisión: coseno {f2(V['accionamiento']['cos_min_trabajo'])} (bueno). {L['cajon']['lectura']}

## Lo que falta probar con las piezas reales
1. Ajustes reales de la impresora (probeta): latón a presión y libre, imán, pilotos, túnel.
2. Que las 3 valvas abran y cierren a mano, suaves y juntas (Paso 8), y que los portasensores no las frenen.
3. Medidas reales del servo y del horn (encastre de la manivela, orejas en el tabique).
4. Sentido y recorrido del servo (comandos {CLOSED_CMD:.0f}° y {OPEN_CMD:.0f}°) y que no zumbe en reposo.
5. Señal real de cada Hall: que sea monótona, sin saturar, y su ruido. Curva de calibración con galgas, repetibilidad e histéresis.
6. Que los portasensores no se muevan con el uso (si se mueven, recalibrar).
7. Desgaste de las ranuras de las colas y del yugo tras muchos ciclos.
""")


def main():
    leeme(); preguntas(); impresion(); materiales(); guia(); sensores(); verificacion()
    print('Documentos en', OUT)


if __name__ == '__main__':
    main()
