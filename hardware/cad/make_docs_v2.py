"""
Documentación de CardioVal AI v2 (generada a partir de los resultados reales de verify.py y sensing.py).
Uso: python make_docs_v2.py   →   out_v2/Documentacion/*.md, *.csv
Clasificación usada en todos los documentos:
  [CÁLCULO] verificado por cálculo · [SIM] verificado por inspección o simulación geométrica ·
  [SW] compilado o probado en software · [FÍSICO] pendiente de medición o ensayo físico
"""
from __future__ import annotations
import csv
import json
import math
import os
import numpy as np

import config as C
import kinematics as K
import assembly as A
import parts as P
import registry as R
import sensing as S

OUT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', C.OUT_DIR))
DOC = os.path.join(OUT, 'Documentacion')
CANON = os.path.join(OUT, '_canon')
TAGS = '**[CÁLCULO]** verificado por cálculo · **[SIM]** inspección o simulación geométrica · **[SW]** compilado o probado en software · **[FÍSICO]** pendiente de ensayo físico'
HEAD = f'> {C.PROJECT} · revisión **{C.REVISION}** · prototipo académico de banco **sin fluido**. No es un dispositivo médico ni de diagnóstico.\n> {TAGS}\n'


def F(x, d=1):
    return f'{x:.{d}f}'.replace('.', ',')


def P3(p):
    return '(' + '; '.join(F(v, 1) for v in p) + ')'


def w(name, text):
    os.makedirs(DOC, exist_ok=True)
    with open(os.path.join(DOC, name), 'w', encoding='utf-8') as f:
        f.write(text)


def load():
    V = json.load(open(os.path.join(CANON, 'verify.json')))
    SD = S.final_design()
    return V, SD


# ───────────────────────────── coordenadas de sensores ─────────────────────────────

def sensor_coords():
    tf = A.pose_transforms(K.SWEEP, 'NORMAL')
    hx, hy, hz = C.HALL_XYZ
    out = {}
    for i in range(3):
        out[f'H{i+1}'] = {'global': A.ring_local(i, hx, hy, hz), 'eje': 'radial hacia afuera (x local)', 'pieza': 'Valve_Ring (bolsillo TO-92)',
                          'ajuste': 'fijo (piso del bolsillo); la variación se absorbe con la calibración'}
    M = tf['H0_Holder']
    ze = P.hall0_element_z()
    out['H0'] = {'global': tuple((M @ np.array([C.MAG_PLATE_R, 0, ze, 1]))[:3]), 'eje': 'vertical (cara plana hacia abajo)', 'pieza': 'H0_Holder (arandela de la columna 1)',
                 'ajuste': 'fijo; separación 4 mm con el plato arriba (verificar con galga)'}
    x0 = C.PAD_FACE_R + 4.0 - 0.8 + C.PIEZO_T / 2
    Mp1 = tf['Piezo_Mount']; Mp2 = tf['Piezo_Mount_P2']
    out['P1'] = {'global': tuple((Mp1 @ np.array([x0, 0, C.PAD_H / 2, 1]))[:3]), 'eje': 'normal del disco: radial', 'pieza': 'Piezo_Mount en la almohadilla de la valva 2',
                 'ajuste': '3 almohadillas iguales (valvas 1, 2 y 3) para comparar posiciones'}
    out['P2'] = {'global': tuple((Mp2 @ np.array([x0, 0, C.PAD_H / 2, 1]))[:3]), 'eje': 'normal del disco: +y global', 'pieza': 'Piezo_Mount en la almohadilla P2 del Servo_Mount',
                 'ajuste': 'fijo'}
    Mh = tf['MEMS_Stand_Holder']
    out['M1'] = {'global': tuple(Mh[:3, 3]), 'eje': 'normal de la placa hacia el eje de la válvula, inclinada hacia abajo', 'pieza': 'MEMS_Stand + MEMS_Stand_Holder',
                 'ajuste': f'radial ±8 mm (ranuras), inclinación libre en el pivote (nominal {F(P.stand_heights()[1])}°)'}
    Ma = tf['MEMS_Board_Reference_Alt']
    out['M1_alt'] = {'global': tuple(Ma[:3, 3]), 'eje': f'inclinado {P.MEMS_TILT:.0f}° hacia el centro', 'pieza': 'MEMS_Mount (escuadra sobre la almohadilla de la valva 1)',
                     'ajuste': 'altura ±3 mm (ranuras)'}
    return out


# ───────────────────────────── 01 Auditoría ─────────────────────────────

def doc_auditoria(V, SD):
    sw = V['sweep']
    nfail = [c for c in V['assembly'] if not c['ok']]
    t = f"""# 01 · Auditoría de la entrega v1 y correcciones de la v2

{HEAD}
**Qué se auditó:** `entrega/CardioValAI_Modelo_Final_STL.zip` (v1, commit 519c9ac): CAD paramétrico (Python/build123d), 23 STL, STEP de piezas y
ensamblaje, archivo Blender, animación, guías, lista de materiales, informe de validación y el firmware `CardioValAI_ServoTest.ino`.
**La v1 se conserva sin cambios.** Todo lo nuevo lleva el prefijo `CardioValAI_v2` y sale en `hardware/out_v2/`.

## 1. Problemas que impedían MEDIR apertura y cierre (prioridad máxima)

| # | Problema en v1 | Evidencia | Corrección en v2 | Estado |
|---|---|---|---|---|
| 1 | **No había medición de la posición real de las valvas.** Solo se conocía el ángulo ORDENADO al servo. | El firmware solo mueve el servo; no hay sensor de posición. | Imán N42 Ø4×2 en la cola de cada valva + sensor Hall lineal DRV5055A1 (TO-92) en la pared del anillo (H1–H3) y un Hall DRV5055A2 sobre el plato (H0). Posición elegida con un modelo de dipolos (`sensing.py`). | Diseño [CÁLCULO] [SIM]; respuesta real [FÍSICO] |
| 2 | **Los eventos de apertura y cierre no producen contacto mecánico** en modo normal: al cerrar quedan {F(2 * C.EDGE_GAP)} mm entre bordes y el tope de 84° no se toca a 80°. | Geometría del CAD (holgura de coaptación) y tabla cinemática. | Se declara explícitamente: piezo y micrófono probablemente **no** marcan inicio/fin de apertura ni de cierre; registran sobre todo el ruido del servo. Los eventos se miden con los Hall; piezo y audio quedan como señales complementarias a evaluar (ensayos 5, 6 y 11). | [CÁLCULO]; confirmación [FÍSICO] |
| 3 | Alojamiento de imán de v1 con **0,8 mm de profundidad para un imán de 1 mm** y bolsillo Hall sin posición calculada. | `parts.py` v1. | Alojamiento Ø{F(C.MAG_LEAF[0] + C.MAG_POCKET_CLR)} × {F(C.MAG_LEAF[1] + 0.2)} mm; bolsillo TO-92 en {P3(C.HALL_XYZ)} (marco de la valva) con piso que fija la altura, canal de patas y bajada exterior de cables. | [SIM] |
| 4 | **Ejes de acero y tornillo de acero en la cola** a pocos mm del imán: deforman el campo. | BOM v1: eje de acero Ø2; cola–biela M2 autorroscante. | Ejes de **latón** Ø2 (o inox 316); pasador de latón Ø2 × {F(C.TAIL_PIN_LEN, 0)} a presión en la cola; tornillo de los topes de latón. | [CÁLCULO] |
| 5 | Firmware sin adquisición, con `delay()` bloqueante; la guía decía «registra piezo y MEMS». | `CardioValAI_ServoTest.ino`. | Firmware ESP-IDF nuevo: ADC continuo (DMA), I2S, servo no bloqueante, protocolo binario con CRC, contadores de pérdidas, paradas controladas. **Compila (ESP-IDF v5.4.1); no se probó en hardware.** | [SW]; funcionamiento [FÍSICO] |
| 6 | Protección del piezo descripta como «1 MΩ + zener» (insuficiente) y conexión casi directa al ADC. | Guía v1. | Acondicionamiento completo por canal: descarga, limitación de corriente, recorte con Schottky a ambos rieles, polarización, amplificación seleccionable y antialias de 2.º orden (Hoja 2). | [CÁLCULO]; [FÍSICO] |

## 2. Inconsistencias de montaje y tornillería

| # | Problema en v1 | Corrección v2 | Estado |
|---|---|---|---|
| 7 | Tope: piloto de 1,8 mm (autorroscante) pero la guía pedía «M2×20 + tuerca». | Agujero de paso Ø{F(C.M2_CLEAR)} + **tuerca M2 atrapada** en la brida; tornillo de latón desde arriba (se cambia sin desarmar). | [SIM] |
| 8 | BOM: «M2×8 DIN 912 autorroscante» (un DIN 912 es métrico, no autorroscante). | Tabla de uniones con el tipo correcto por unión (métrico + tuerca, inserto termofijado o autorroscante solo donde corresponde). | [CÁLCULO] |
| 9 | Columnas y almohadillas con rosca directa en PETG para piezas que se desmontan a menudo. | **Insertos de latón** M3 en columnas y base, M2 en almohadillas. | [SIM]; ajuste de los agujeros [FÍSICO] (probeta) |
| 10 | Radio del horn fijado en 8 mm sin poder cambiarlo. | El dato de entrada es el radio medido; el barrido se calcula (tabla en 04). | [CÁLCULO] |
| 11 | Cuna del ESP32 para 55×28 mm sin confirmar; perforaba/apoyaba la placa sin retención clara ni zona de antena. | Bandeja para placa perforada 70×90 con el ESP32 en zócalos hembra (no se perfora ni flexiona), barras de sujeción, antena fuera del borde, USB/EN/BOOT accesibles. **No definitiva** hasta recibir medidas. | [SIM]; medidas [FÍSICO] |
| 12 | Cables sin recorrido definido; riesgo de roce con el plato. | Recorridos modelados (haces Ø2–3) incluidos en el barrido de interferencias; pinzas en columnas, canales en el anillo, ranuras para bridas. | [SIM] |
| 13 | Tornillería no incluida en el control de interferencias. | Tornillos y tuercas del plato, topes y comisuras modelados y verificados en todo el recorrido. | [SIM] |
| 14 | Archivo `.blend` guardado con Blender 5.0 (no abre en 4.5 LTS). | `.blend` v2 guardado con **Blender 4.5.15 LTS** (bpy 4.5). | [SW] |
| 15 | Micrófono solo en una escuadra sobre el anillo (transmisión estructural, sin ajuste de distancia). | Soporte independiente `MEMS_Stand` (ranura radial ±8 mm, pivote) + se conserva la escuadra como alternativa para comparar. | [SIM]; elección [FÍSICO] |
| 16 | P2 sin alojamiento definido. | Almohadilla P2 en el soporte del servo (misma interfaz de 22 mm que P1). | [SIM] |

## 3. Riesgos mecánicos identificados (no resueltos del todo sin ensayo)

- **Efecto cajón del plato:** si una sola valva se traba, la resultante se va a {F(C.LINK_PIN_X)} mm del eje y supera el límite en seco
  ({F(V['plate_binding']['limite_mm_mu_0.35'])} mm con μ = 0,35). Con grasa PTFE el límite sube a {F(V['plate_binding']['limite_mm_mu_0.15'])} mm. Mitigación: lubricar; detección de atasco por H0 en el firmware. [CÁLCULO] / [FÍSICO]
- **Gomas antivibración del servo:** aíslan solo por encima de ≈ 1,4·fn; estimación fn ≈ 250 Hz (no medida). Por debajo pueden amplificar. [CÁLCULO aproximado] / [FÍSICO]
- **Holgura de bujes ({F(C.BUSH_CLEAR)} mm radial) y agujeros de PETG:** dependen de la impresora → probeta. [FÍSICO]
- **Servo MG90S:** par de bloqueo 1,8 kg·cm es dato de distribuidores, no verificado; margen calculado ×{F(V['servo']['margin_x'])} sobre una carga estimada. [CÁLCULO] / [FÍSICO]

## 4. Resultado de las verificaciones digitales v2 (ejecutadas sobre los archivos entregados)

- Barrido de interferencias: **{sw['poses_checked']} poses** (25 posiciones × 5 modos), intersección booleana exacta: **{len(sw['interferences'])} interferencias**. [SIM]
- Contactos de diseño (volumen < 0,05 mm³): {', '.join(sorted(sw['contacts'])) or 'ninguno'}.
- Holgura mínima medida entre pares móviles: ver `Informe_de_Validacion_v2.md` (el 0,0 corresponde al apoyo previsto de la valva sobre su tope en los modos con tope).
- Comprobaciones de montaje: {len(V['assembly']) - len(nfail)} de {len(V['assembly'])} correctas.{(' Fallan: ' + '; '.join(c['check'] for c in nfail)) if nfail else ''} [SIM]
- Mallas STL: cerradas, orientación coherente, un cuerpo, apoyadas en z = 0, dentro de una cama 220 × 220. [SW]
- Firmware: compila sin advertencias en el código propio con ESP-IDF v5.4.1. [SW]
- Herramientas de computadora: prueba de extremo a extremo con datos **sintéticos** del emulador (protocolo, CRC, detección de fallas inyectadas). [SW]

**Nada de lo anterior demuestra que el prototipo físico funcione.** Ver `10_Pendientes_Fisicos.md`.
"""
    w('01_Auditoria_v1_y_Correcciones.md', t)


# ───────────────────────────── 02 Medidas pedidas ─────────────────────────────

def doc_medidas():
    t = f"""# 02 · Medidas y fotos que bloquean decisiones (lista única)

{HEAD}
Mientras falten, las piezas afectadas quedan **paramétricas y NO definitivas** (marcadas en la lista de materiales).

| # | Qué enviar | Para qué se usa | Pieza / archivo afectado |
|---|---|---|---|
| 1 | **ESP32 DevKit V1:** foto superior e inferior junto a una regla; largo y ancho de la placa; cantidad total de pines (30 o 38); separación entre las dos hileras (centro a centro); posición del USB y de los botones EN/BOOT; texto del chip USB (CP2102 o CH340) | Zócalos y bandeja; acceso USB/EN/BOOT; zona de antena; velocidad del puerto serie (921 600 vs. ≥ 1,5 M baudios) | `Electronics_Tray`, `Perfboard_ESP32_Reference`, `config.ESP32_*`, firmware `CVAI_BAUD` |
| 2 | **Servo:** marca/modelo exacto; largo, ancho y alto del cuerpo; distancia entre agujeros de las orejas; altura de la cara inferior de las orejas; posición del eje respecto del extremo | Soporte del servo y altura de todo el conjunto | `ServoDims` en `config.py` |
| 3 | **Horn que se usará:** distancia del centro del eje al agujero elegido (mm) y diámetro de ese agujero | Barrido y comandos (tabla en 04) | `SERVO.horn_r` |
| 4 | **Placa INMP441:** foto de ambas caras; diámetro o lados; espesor; dónde está el agujero del puerto acústico (cara con el micrófono o cara opuesta); orden de los pines | Portaplaca y orientación del puerto | `MEMS_BOARD`, `MEMS_Stand_Holder` |
| 5 | **Discos piezoeléctricos:** diámetro del disco metálico, diámetro de la cerámica, espesor total; si es posible, capacidad medida con multímetro (nF) | Asiento del disco y frecuencia del paso alto (Rb·Cp) | `PIEZO_D`, `PIEZO_T`, Hoja 2 |
| 6 | **Placa perforada** (si ya la tienen): medidas | Bandeja | `PERFBOARD` |

Con 1–3 se cierran las piezas que bloquean el armado; 4–6 afinan soportes y filtros.
"""
    w('02_Medidas_y_Fotos_Pendientes.md', t)


# ───────────────────────────── 03 Sensores ─────────────────────────────

def doc_sensores(V, SD):
    co = sensor_coords()
    rows = '\n'.join(f"| {k} | {v['pieza']} | {P3(v['global'])} | {v['eje']} | {v['ajuste']} |" for k, v in co.items())
    tab = '\n'.join(f"| {F(r['theta_deg'], 0)} | {F(r['B_mT'], 2)} | {F(r['V_out_A1_V'], 3)} | {F(r['slope_mV_per_deg'], 1)} |" for r in SD['table'])
    tol = '\n'.join(f"| {k} | {'sí' if v['monotonic'] else 'NO'} | {F(v['min_slope_mV_per_deg'], 2)} | {F(v['max_abs_mT'], 1)} |" for k, v in SD['mount_tolerance'].items())
    pl = SD['plate']
    plt = ' · '.join(f"{F(a, 1)} mm → {F(b, 2)} mT" for a, b in zip(pl['travel_mm'], pl['Bz_mT']))
    st_zpiv, st_tilt = P.stand_heights()
    t = f"""# 03 · Sensores: evaluación, ubicación, señales esperadas y pruebas de selección

{HEAD}
## 1. Evaluación de la configuración propuesta (P1, P2, M1)

**Conclusión:** P1, P2 y M1 **no alcanzan** para determinar de forma confiable cuándo empieza y termina la apertura y el cierre. Motivos [CÁLCULO]:
- En modo normal no hay contacto mecánico al abrir ni al cerrar (holgura de coaptación {F(2 * C.EDGE_GAP)} mm; tope a 84° no alcanzado). Sin choque no hay un
  transitorio característico; lo que vibra y suena durante el movimiento es sobre todo el **servo** (engranajes y motor), que se mueve durante todo el recorrido.
- P2 no mide «solo el motor»: recibe vibración de toda la estructura (base, columnas, plato). Restar P1 − P2 directamente no es válido: los caminos de transmisión
  tienen distinta ganancia y fase según la frecuencia (gomas, PETG, uniones atornilladas). Solo se justificaría restar con una función de transferencia medida
  (ensayo 6) y en las bandas donde la coherencia P1–P2 sea alta (> 0,8).
- Un micrófono omnidireccional orientado hacia la válvula **no** rechaza el sonido del motor.
- Un piezo por sector **no** identifica la valva de ese sector: la estructura transmite a todo el anillo.

**Cambio adoptado:** se agrega **medición directa de posición** con sensores Hall (H1–H3 por valva + H0 en el plato). Piezo y micrófono se conservan como señales
**complementarias** y se evalúa experimentalmente si aportan (ensayos 5, 6, 10 y 11). Las 3 almohadillas del anillo permiten comparar posiciones de P1.

## 2. Origen común y coordenadas

Origen: esquina inferior de la base (x a lo largo de 200 mm, y a lo largo de 180 mm, z hacia arriba). Centro de la válvula: ({F(A.VX)}; {F(A.VY)}) mm; cara inferior
del anillo a z = {F(A.Z_RING, 2)} mm. Valvas en 90°, 210° y 330° (valva 1, 2, 3). Coordenadas con la válvula **cerrada** (servo 130°).

| Sensor | Pieza | Centro (x; y; z) mm | Orientación | Ajuste |
|---|---|---|---|---|
{rows}

## 3. Sensores Hall de posición (medición principal)

**Principio:** el imán (N42, Ø{F(C.MAG_LEAF[0], 0)}×{F(C.MAG_LEAF[1], 0)} mm, magnetizado axialmente) gira con la cola de la valva; el DRV5055 mide la componente radial del
campo. La salida es una tensión proporcional al campo (60 mV/mT en A1 con VCC = 3,3 V, dato de la hoja de datos TI). La curva tensión–ángulo **no es lineal**: se calibra
punto por punto (`cvai_calibrate.py`).

**Respuesta calculada** con un modelo de dipolos (aproximado; sirve para elegir geometría y comprobar monotonía, no para predecir mV exactos) [CÁLCULO]:

| θ (°) | B (mT) | Vout A1 (V) | pendiente (mV/°) |
|---|---|---|---|
{tab}

Monótona en 0–84°: **{'sí' if SD['summary']['monotonic'] else 'NO'}** · pendiente mínima {F(SD['summary']['min_slope_mV_per_deg'], 2)} mV/° · campo máximo {F(SD['summary']['max_abs_mT'], 1)} mT
(DRV5055A1 satura a ≈ ±21 mT con 3,3 V → margen).

**Tolerancia de montaje ±0,5 mm** (¿sigue siendo monótona?) [CÁLCULO]:

| desplazamiento | monótona | pendiente mín. (mV/°) | campo máx. (mT) |
|---|---|---|---|
{tol}

**Resolución estimada:** con ruido efectivo de ≈ 1 mV tras promediar 8 muestras (estimación; se mide en el ensayo 4), ≈ 0,3–0,5° cerca de 0° y de 84°, y < 0,1° a mitad de
recorrido. **Rango:** −2° a 84°. **Frecuencia:** 1 kS/s por canal (el movimiento dura cientos de ms).

**H0 (plato):** imán Ø{F(C.MAG_PLATE[0], 0)}×{F(C.MAG_PLATE[1], 0)} en el lóbulo de la columna 1; DRV5055A2 (30 mV/mT) a {F(C.HALL0_GAP)} mm con el plato arriba.
Campo vs. carrera: {plt}. Monótona: **{'sí' if pl['monotonic'] else 'NO'}**; muy **no lineal** (∝ 1/d³): se linealiza con la calibración. Diafonía del imán del plato
sobre H1–H3: ≤ {F(SD['plate_to_leaf_crosstalk_mV_max'], 1)} mV (despreciable y constante en la calibración) [CÁLCULO].

**Fijación:** imán con una gota de cianoacrilato, **polaridad marcada** (orientar para que la salida baje desde 1,65 V al acercarse; si sube, dar vuelta el imán).
Sensor TO-92 empujado hasta el piso del bolsillo, cara plana hacia el centro de la válvula, fijado con una gota de silicona neutra (removible). Patas hacia arriba,
soldadas a 3 hilos que bajan por el canal exterior del anillo.

**Interferencias:** tornillos/ejes de acero cerca (por eso latón), imán del motor del servo (≈ 65 mm; se mide en el ensayo 5/6), campo terrestre (constante: lo absorbe la
calibración), temperatura (≈ −0,12 %/°C del imán: calibrar a la temperatura de trabajo), ruido de la alimentación (sensor ratiométrico → regulador analógico propio 3V3_A).

**Señal esperada:** H1–H3 bajan de ≈ {F(SD['table'][1]['V_out_A1_V'], 2)} V (cerrada) a ≈ {F(SD['table'][-2]['V_out_A1_V'], 2)} V (80°) durante la apertura y vuelven
al cerrar; H0 sigue la carrera del plato. **Apertura incompleta:** meseta más baja; **cierre incompleto:** el residual no vuelve a la base; **asimetría:** mesetas distintas
entre valvas; **atasco:** H0 se detiene mientras el comando sigue.

**Prueba de selección:** no hay posiciones alternativas que elegir (el bolsillo es fijo); se verifica que la calibración sea monótona con error de validación cruzada ≤ 1° y que
el ruido estático sea ≤ 0,5° (ensayo 4). Si no se cumple: revisar polaridad/pegado del imán y la posición del sensor.

## 4. Piezoeléctricos P1 y P2 (complementarios)

- **P1:** en `Piezo_Mount` atornillado a la almohadilla de la **valva 2** (las 3 almohadillas son iguales: se puede mover a la valva 1 o 3 para comparar).
  **P2:** el mismo soporte en la almohadilla `P2` del `Servo_Mount` (lado aislado por las gomas: ve fuerte al servo, pero también a la estructura).
- **Fijación repetible:** disco apoyado en un asiento de 0,8 mm de profundidad y adherido con **cinta doble faz fina (≈ 0,1 mm) recortada a la medida** o un punto de
  cianoacrilato en el borde metálico (más rígido, más difícil de sacar). La tapa **no toca** el disco. Dos tornillos M2 con insertos y el mismo torque «firme con la mano».
- **Efecto de la fijación:** el adhesivo y la masa del soporte forman un sistema masa–resorte; una capa blanda (cinta gruesa) atenúa las frecuencias altas y desplaza la
  resonancia; un adhesivo rígido transmite mejor pero cambia con cada pegado. Por eso: misma cinta, mismo recorte, mismo torque, y el ensayo 9 (desmontar/montar) mide la
  repetibilidad del montaje.
- **Cable:** sale por el canal inferior del soporte, brida en las ranuras (alivio de tensión), baja por fuera del recorrido del plato (ver vistas de cables).
- **Señal esperada:** ruido del servo mientras se mueve (P2 ≫ P1 esperable), casi nada en reposo. Un rebote o contacto (tope, atasco, roce) puede producir un transitorio
  breve; solo cuenta si su tiempo coincide con el evento medido por los Hall en ciclos repetidos.
- **Interferencias:** servo, mesa, ambiente (golpes, voces), cable movido (triboeléctrico), red eléctrica.
- **Prueba de selección:** con el ensayo 10, comparar las 3 almohadillas: contraste (dB) en ±30 ms del fin de apertura/cierre MEDIDO respecto de la mitad del recorrido y
  respecto de la espera quieta (`cvai_analyze.py` lo calcula). Se elige la que tenga mayor contraste **y** menor dispersión del tiempo del pico (IQR).
- **Distinguir ciclos normales de inconsistentes:** comparar energía por banda y tiempo del pico por ciclo con la mediana de la sesión (z robusto); solo es útil si en los
  ciclos con fallas conocidas (ensayo 8) aparece un cambio reproducible que los Hall confirmen.

## 5. Micrófono M1 (complementario)

- **Placa:** confirmar con fotos (ítem 4 de 02). El INMP441 es de **puerto inferior**: el agujero está en la cápsula y, en muchas placas de módulo, atraviesa el circuito
  impreso. El portaplaca tiene ventanas en ambas caras para que el puerto quede libre cualquiera sea la placa.
- **Configuración inicial recomendada: soporte independiente `MEMS_Stand`** a {F(C.MEMS_STAND_R, 0)} mm del eje, {F(15, 0)} mm sobre la cara superior del anillo, apuntando
  al plano de las bisagras (inclinación nominal {F(st_tilt)}°). Razón: separa el micrófono de la vibración estructural del anillo y permite variar la distancia
  (±8 mm) y el ángulo. No es «la óptima»: es el punto de partida.
- **Alternativa a comparar:** `MEMS_Mount` (escuadra en la almohadilla de la valva 1): posición fija y repetible, pero acoplada a la estructura.
- **Resonancia del soporte:** poste de PETG 12×12 de ≈ {F(st_zpiv, 0)} mm: primer modo estimado ≈ 150–250 Hz con el portaplaca (cálculo de viga empotrada,
  orden de magnitud). Se verifica en el ensayo 5 (espectro en reposo y con golpecito identificado SOLO para caracterizar).
- **Pantalla acústica:** no se usa al comienzo. Si se prueba, una placa entre servo y micrófono crea reflexiones y su propia resonancia; se compararía con y sin pantalla
  en el ensayo 10, sin cambiar nada más.
- **Señal esperada:** ruido del servo durante el movimiento; los eventos de la válvula, si existen, quedarían enmascarados. Se evalúa igual que los piezo.

## 6. Procedimiento experimental para ajustar la ubicación (resumen)

1. Calibrar los Hall (ensayo 4) → los tiempos de evento se toman de los Hall.
2. Registrar 30 ciclos normales por cada configuración: P1 en almohadilla 1, 2 y 3; M1 a 44, 52 y 60 mm (ranura) y en la escuadra.
3. Para cada configuración: contraste evento/mitad del recorrido, IQR del tiempo del pico, coherencia con P2.
4. Elegir la configuración con mejor contraste y menor dispersión; repetir en otra sesión (ensayo 12) antes de fijarla.
"""
    w('03_Sensores_Ubicacion_y_Evaluacion.md', t)


# ───────────────────────────── 04 Mecanismo ─────────────────────────────

FASTENERS = [
    ('Eje de bisagra (×3)', 'Varilla de LATÓN Ø2 × 56', 'Ajuste en el anillo (Ø2,1) + gota de cianoacrilato SOLO en los extremos; libre en la valva (Ø2,4)', 'No magnético'),
    ('Cola–biela (×3)', 'Pasador de LATÓN Ø2 × 9', 'A presión en la cola (Ø1,95), libre en la biela (Ø2,2); las paredes de la ranura impiden que salga', 'Reemplaza el autorroscante de acero de v1'),
    ('Biela–orejeta del plato (×3)', 'M2×10 inox A2 o latón + tuerca M2', 'Métrico con tuerca (no rosca en plástico)', 'Llave de tubo 4 mm por el lado de la tuerca'),
    ('Horquilla–empujador', 'M2×14 + tuerca M2', 'Métrico con tuerca', ''),
    ('Empujador–horn', 'Tornillo del horn (o M2×6)', 'Rosca en el horn', 'Agujero del empujador Ø2,4 libre'),
    ('Topes (×3)', 'M2×20 de LATÓN + tuerca M2 atrapada', 'Métrico; tuerca en la trampa hexagonal de la brida', 'Cerca del Hall: no usar acero'),
    ('Almohadillas (P1, M1 alt.)', 'M2×10 inox', 'Insertos termofijados M2 (Ø3,2 × 4)', 'Desmontaje frecuente'),
    ('Almohadilla P2', 'M2×10 inox', 'Insertos M2 en el soporte del servo', ''),
    ('Columnas → base (×3)', 'M3×10', 'Inserto M3 en la base de la columna', 'Cabeza en el rebaje inferior de la base'),
    ('Anillo → columnas (×3)', 'M3×30', 'Inserto M3 en la columna; atraviesa la arandela o el soporte H0', ''),
    ('Orejas del servo (×2)', 'Tornillos que trae el servo', 'Autorroscante en piloto Ø1,8 (pocas vueltas de montaje)', ''),
    ('Soporte del servo → base (×4)', 'M3×12 + 2 arandelas de goma + casquillo Ø4×Ø3,2×5,5', 'Inserto M3 en la base; el casquillo limita la compresión de la goma', 'No apretar la goma a fondo'),
    ('Bandeja → base (×4)', 'M3×6', 'Insertos en la base', 'Antes de colocar la placa'),
    ('Barras de sujeción (×4)', 'M3×8', 'Insertos en los postes de la bandeja', ''),
    ('Soporte M1 → base (×2)', 'M3×10 + arandela', 'Insertos en la base, por las ranuras', 'Ajuste radial ±8 mm'),
    ('Pivote de M1', 'M3×16 + tuerca autoblocante', 'Fricción regulable', ''),
    ('Pinzas de cable (×3)', '—', 'A presión sobre la columna', 'Bajo el recorrido del plato'),
]


def doc_mecanismo(V):
    kin = V['kinematics']
    modes = []
    for mode, rows in kin.items():
        th = np.array([r['theta'] for r in rows])
        modes.append(f"| {mode} | {', '.join(K.MODES[mode])} | " + ' · '.join(f'v{i+1}: {F(th[:, i].min(), 0)}→{F(th[:, i].max(), 0)}°' for i in range(3)) +
                     f" | {F(min(min(r['transmission']) for r in rows), 0)}° |")
    horn = '\n'.join(f"| {F(h['horn_r_mm'], 0)} | " + (f"±{F(h['barrido_deg'])}° | {F(h['comando_deg'][0])}–{F(h['comando_deg'][1])}° | {F(h['columna_mm'], 2)} | {F(h['inclinacion_max_empujador_deg'])}° | {F(h['par_kgcm'], 3)} |"
                     if h['valido'] else f"— | — | — | — | {h['motivo']} |") for h in V['horn_table'])
    fast = '\n'.join(f'| {a} | {b} | {c} | {d} |' for a, b, c, d in FASTENERS)
    sv = V['servo']
    clr = sorted(V['clearance'].items(), key=lambda kv: kv[1]['min_mm'])
    clr_t = '\n'.join(f"| {k} | {F(v['min_mm'], 2)} | {v['mode']} | {F(v['beta'])}° |" for k, v in clr)
    t = f"""# 04 · Revisión del mecanismo y del montaje

{HEAD}
## 1. Geometría principal [SIM]
- Valvas planas de {F(C.LEAF_T)} mm sobre ejes de cuerda a {F(C.HINGE_D, 0)} mm del centro; holgura con la pared ≥ {F(C.WALL_CLEAR)} mm en todo el recorrido hasta
  {F(C.THETA_DESIGN, 0)}° (incluye el espesor); separación entre bordes al cerrar {F(2 * C.EDGE_GAP)} mm (no hay contacto valva–valva).
- Carrera del plato {F(K.STROKE, 3)} mm; radio del horn {F(K.CRANK_R)} mm → barrido ±{F(K.SWEEP)}° (comando {F(90 - K.SWEEP)}° = abierta, {F(90 + K.SWEEP)}° = cerrada).
- Holguras móviles por defecto {F(C.CLR_MOVE, 2)} mm; bujes del plato {F(C.BUSH_CLEAR)} mm radial, largo {F(C.BUSH_H, 0)} mm.

## 2. Modos: piezas alternativas y simultáneas [CÁLCULO]

| Modo | Módulos (valva 1, 2, 3) | Recorrido de cada valva | ángulo de transmisión mín. |
|---|---|---|---|
{chr(10).join(modes)}

- **Se montan siempre:** anillo, 3 valvas, plato, empujador, columnas, servo, sensores.
- **Alternativas por valva:** biela normal `Link_Normal` + tope 84° (modo normal) **o** biela con recorrido perdido `Link_LostMotion` + tope 60° o 45° + resorte/elástico
  **o** `Link_LostMotion_IC` + tope 84° + elástico (cierre incompleto). Asimétrico = valva 1 con 60° y valva 2 con 45°.
- **El servo nunca empuja contra un tope:** en modo normal la valva llega a 80° y el tope está en 84°; en los modos alterados la ranura de la biela absorbe el resto
  de la carrera (ranura usada ≤ 4,44 de {F(C.LM_SLOT)} mm). El rango de comando del firmware está limitado por software.
- **Elástico (v2):** se engancha en la oreja del barril de la valva (lado −y) y pasa por el agujero de la brida del tope (se anuda debajo). Solo en los modos con
  recorrido perdido. Fuerza sugerida 0,3–0,6 N (banda elástica fina o resorte de tracción pequeño): VERIFICAR que la valva llegue al tope.

## 3. Holguras mínimas medidas en el barrido [SIM]

| Par | mínimo (mm) | modo | servo β |
|---|---|---|---|
{clr_t}

## 4. Radio del horn: consecuencias [CÁLCULO]
Medir el agujero elegido y escribirlo en `config.SERVO.horn_r`; luego regenerar todo (`build_all.py`, `verify.py`).

| r horn (mm) | barrido | comando | columna (mm) | inclinación máx. del empujador | par necesario (kg·cm) |
|---|---|---|---|---|---|
{horn}

## 5. Par del servo [CÁLCULO, con supuestos]
Fuerza en el empujador {F(sv['force_N'], 2)} N (peso del plato y bielas {F(sv['plate_and_links_g'])} g, momento de gravedad de las valvas, fricción supuesta μ = 0,35 con
carga lateral de 0,3 N por buje, 2 elásticos de 0,6 N). Par = {F(sv['torque_kgcm'], 3)} kg·cm frente a 1,8 kg·cm de bloqueo (dato de distribuidores, NO verificado)
→ margen ×{F(sv['margin_x'])}. El margen real se mide con el INA219 (corriente) en los ensayos 6 y 7.

## 6. Efecto cajón del plato [CÁLCULO]
{V['plate_binding']['lectura']}

## 7. Uniones y tornillería

| Unión | Elemento | Tipo de rosca / retención | Nota |
|---|---|---|---|
{fast}

**Métrico + tuerca:** rosca de acero en acero, se puede desarmar muchas veces. **Inserto termofijado:** rosca métrica de latón dentro del plástico, para uniones que se
desarman a menudo. **Autorroscante:** corta su rosca en el plástico; pocas vueltas de montaje (solo orejas del servo, con los tornillos originales).

## 8. Orden de montaje y acceso a herramientas [SIM]
Ver `Guia_de_Ensamblaje_v2.md`. Comprobaciones automáticas de acceso: {sum(c['ok'] for c in V['assembly'])} de {len(V['assembly'])} correctas
(trayectorias de ejes, destornilladores, llave de tubo, inserción de los Hall, USB).

## 9. Gomas antivibración [CÁLCULO aproximado / FÍSICO]
Arandelas de goma Shore ≈ 60A bajo el soporte del servo: rigidez estimada de 4 apoyos ≈ 1–3·10⁵ N/m con ≈ 40 g → fn ≈ 250 Hz (orden de magnitud). Aíslan solo por encima de
≈ 1,4·fn; cerca de fn **amplifican**. El casquillo limita la compresión para que la rigidez sea repetible. Ensayo 6: comparar P1/P2 con y sin gomas.

## 10. Cables durante el ciclo [SIM]
Todos los recorridos (H0–H3, P1, P2, M1, servo) están modelados como haces Ø2–3 mm y se verificaron contra las piezas móviles en las {V['sweep']['poses_checked']} poses:
sin interferencias; holgura mínima cable–plato {F(V['clearance'].get('Cable_Routes_Reference ↔ Actuator_Plate', {}).get('min_mm', float('nan')), 1)} mm.
Señales por el sur de la base hacia el extremo −y de la bandeja; servo y 5 V por el norte hacia el extremo +y (separación ≥ 20 mm).

## 11. Observación directa de la posición
- Hall H1–H3 (medición principal, calibrada).
- Cámara superior: dos hoyuelos Ø1,5 en la línea central de cada valva (a 6 y 16 mm del eje) y marca fiduciaria en el anillo.
- Cámara lateral alineada con el eje de la valva 1 frente al `Angle_Scale` (transportador 0–90°).
- LED de sincronización (GPIO19) dentro del cuadro: une el video con los datos.

## 12. Animación
La animación se calcula cuadro a cuadro con la misma cinemática del CAD. **No es una prueba de funcionamiento ni una medición**.
"""
    w('04_Mecanismo_Revision.md', t)


# ───────────────────────────── 05 Electrónica ─────────────────────────────

PINS = [
    ('GPIO36 (VP)', 'H1 Hall valva 1', 'entrada analógica', 'ADC1_CH0', 'Solo entrada; sin pull'),
    ('GPIO39 (VN)', 'H2 Hall valva 2', 'entrada analógica', 'ADC1_CH3', 'Solo entrada'),
    ('GPIO32', 'H3 Hall valva 3', 'entrada analógica', 'ADC1_CH4', ''),
    ('GPIO33', 'H0 Hall del plato', 'entrada analógica', 'ADC1_CH5', ''),
    ('GPIO34', 'P1 piezo anillo (acondicionado)', 'entrada analógica', 'ADC1_CH6', 'Solo entrada'),
    ('GPIO35', 'P2 piezo soporte servo (acondicionado)', 'entrada analógica', 'ADC1_CH7', 'Solo entrada'),
    ('GPIO26', 'INMP441 SCK', 'salida', 'I2S1 BCLK', '33 Ω en serie'),
    ('GPIO25', 'INMP441 WS', 'salida', 'I2S1 WS', ''),
    ('GPIO27', 'INMP441 SD', 'entrada', 'I2S1 DIN', ''),
    ('GPIO18', 'PWM servo', 'salida', 'LEDC canal 0, 50 Hz, 16 bits', '220 Ω serie + 10 kΩ a GND'),
    ('GPIO19', 'LED de sincronización', 'salida', '', '330 Ω + LED a GND'),
    ('GPIO23', 'Parada por software', 'entrada', 'pull-up interno', 'contacto NA a GND'),
    ('GPIO21 / GPIO22', 'INA219 SDA / SCL', 'I2C', 'I2C0 400 kHz', 'pull-up del módulo'),
    ('GPIO2', 'LED azul de la placa', 'salida', '', 'pin de arranque: sin carga externa'),
    ('GPIO1 / GPIO3', 'UART0 (USB)', '—', 'protocolo binario', 'reservado'),
    ('3V3', 'INMP441, pull-ups', 'alimentación', '', 'regulador de la placa'),
    ('VIN / 5V', 'MCP1700 → 3V3_A (Hall + MCP6004)', 'alimentación', '', 'NUNCA conectar +5V_SERVO'),
    ('GND', 'masa', '—', '', 'unión a la estrella ★'),
    ('No usar', 'GPIO6–11 (flash), GPIO12 (arranque), GPIO0/5/15 (arranque), ADC2 (no admite DMA)', '', '', ''),
]


def bandwidth(audio_full=False):
    hdr = 9 + 16
    items = [('P1+P2 (8 kS/s, 16 bits)', 2 * 8000 * 2 + 8000 / 128 * hdr),
             ('H0–H3 (1 kS/s, 16 bits)', 4 * 1000 * 2 + 1000 / 32 * hdr),
             ('Audio ' + ('16 kHz' if audio_full else '8 kHz') + ' 16 bits', (16000 if audio_full else 8000) * 2 + (16000 if audio_full else 8000) / 256 * hdr),
             ('Comando del servo (200 Hz)', 200 * (17 + 9)), ('INA219 (500 Hz)', 500 * 2 + 10 * hdr), ('Estado (2 Hz) + eventos (≈ 20/s)', 2 * 99 + 20 * 22)]
    return items, sum(v for _, v in items)


def doc_electronica():
    pins = '\n'.join(f'| {a} | {b} | {c} | {d} | {e} |' for a, b, c, d, e in PINS)
    bw, tot = bandwidth(False)
    bwf, totf = bandwidth(True)
    bwt = '\n'.join(f'| {a} | {F(b / 1000, 2)} |' for a, b in bw)
    link = 921600 / 10
    t = f"""# 05 · Electrónica, tabla de conexiones y cálculos

{HEAD}
Esquemas: `Electronica/Hoja1_Alimentacion_Servo`, `Hoja2_Canal_Piezo`, `Hoja3_Hall_MEMS` (SVG y PNG), generados con `hardware/electronica/esquema.py`.
Fuentes de datos: hojas de datos de Espressif (ESP32 Datasheet / Technical Reference Manual / ESP-IDF v5.4 Programming Guide: ADC continuo, I2S, LEDC),
TI DRV5055 (SBAS640), TDK InvenSense INMP441 (DS-INMP441), Microchip MCP6004 (DS20001733) y MCP1700 (DS20001826), TI INA219 (SBOS448), Nexperia BAT54S.
**Los valores marcados VERIFICAR dependen de lo comprado.** Ningún circuito fue armado ni medido todavía [FÍSICO].

## 1. Tabla pin a pin (ESP32 DevKit V1, 30 pines — VERIFICAR con la serigrafía de su placa)

| Pin | Señal | Dirección | Periférico | Nota |
|---|---|---|---|---|
{pins}

## 2. Alimentación y masas
- **Servo:** fuente externa de 5 V **≥ 2 A (3 A recomendado)**. El MG90S puede pedir picos de varios cientos de mA al arrancar y más al bloquearse (dato no verificado:
  se mide con el INA219). PTC de 2,5 A, P-MOS AO3401A contra polaridad invertida (caída ≈ 0,1 V a 2 A), TVS SMBJ5.0A, 1000 µF de bajo ESR + 100 nF en el conector.
- **ESP32:** solo por USB de la computadora. **+5V_SERVO nunca se conecta a VIN/5V**: así no hay realimentación entre la fuente y el USB; solo se comparte GND en un punto.
- **Regulador analógico** MCP1700-3302 (desde el 5 V del USB): 3V3_A para los 4 Hall (≈ 6 mA c/u) y el MCP6004 — separa el ruido digital del ESP32 de los sensores
  ratiométricos.
- **Masa en estrella** ★ en la placa perforada: retorno del servo con su propio cable; masas analógicas (Hall, piezo) juntas cerca del MCP6004 y unidas a ★ por un solo punto.
- **Parada de emergencia:** contacto NC en la línea del servo (corte físico) + contacto NA a GPIO23 (aviso al firmware).
- **Señal PWM:** 3,3 V; el MG90S suele aceptarla (VERIFICAR). Si no responde bien, 74AHCT125 alimentado a 5 V. 10 kΩ a GND para que no haya pulsos al arrancar.

## 3. Canal piezoeléctrico (×2) [CÁLCULO]
- **Impedancia de entrada:** Rb = 1 MΩ a VBIAS en paralelo con la entrada CMOS del MCP6004 (pA). Con Cp ≈ 10 nF (VERIFICAR) → paso alto 1/(2π·1 MΩ·10 nF) ≈ 16 Hz.
- **Descarga:** la misma Rb descarga el disco (τ = Rb·Cp ≈ 10 ms); no quedan cargas tras desconectar.
- **Limitación de corriente + protección ±:** Rs = 10 kΩ en serie y BAT54S (dos Schottky) recortando el nodo B a −0,3 V … 3,6 V. Un disco golpeado puede dar decenas de voltios:
  con 50 V la corriente queda en (50 − 3,6)/10 k ≈ 4,6 mA (BAT54S: 200 mA máx.), y la entrada del amplificador nunca sale de los rieles. Un zener solo no limita la corriente
  ni protege el lado negativo.
- **Polarización:** VBIAS = 3,3·100k/250k = 1,32 V (10 µF de desacoplo), centrado en el rango lineal del ADC con 12 dB (≈ 0,15–2,45 V).
- **Ganancia seleccionable** (puente J1): 1, 2,2 o 4,6 alrededor de VBIAS. Se elige la mayor que no sature en el ensayo 6.
- **Antialias:** Sallen-Key Butterworth de 2.º orden, R = 10 kΩ, C1 = 15 nF, C2 = 7,5 nF → fc = 1/(2π·10k·√(15n·7,5n)) ≈ 1,5 kHz, Q = 0,707. El ADC muestrea cada
  canal piezo a 16 kS/s; lo que cae arriba de 13 kHz (y se replegaría en la banda útil 0–3 kHz) queda atenuado ≥ 37 dB; después un FIR digital (31 coef.) lleva a 8 kS/s.
- **Salida al ADC:** 100 Ω + 2,2 nF (reserva de carga para el muestreo del SAR).
- **Prueba previa SIN ESP32:** (1) con multímetro, VBIAS = 1,32 ± 0,05 V y salida de U1B igual a VBIAS; (2) con osciloscopio o el ADC de otro equipo, golpecito con el dedo en
  el soporte: la salida debe quedar dentro de 0,15–2,45 V; (3) aplicar ±10 V a la entrada a través del disco desconectado y una fuente limitada a 10 mA: la salida no debe
  pasar de 0–3,3 V. Recién entonces se conecta a GPIO34/35.

## 4. Sensores Hall [CÁLCULO]
DRV5055A1 (H1–H3, 60 mV/mT) y A2 (H0, 30 mV/mT) a 3,3 V; 100 nF junto a cada sensor; salida con RC 1 kΩ/100 nF (fc ≈ 1,6 kHz) antes del ADC. La salida es ratiométrica
(VCC/2 sin campo): por eso 3V3_A propio. Los imanes se orientan para que la salida **baje** (≈ 0,8–1,65 V), dentro del rango lineal del ADC.

## 5. Micrófono INMP441
3,3 V con 100 nF; L/R a GND; I2S1 maestro a 16 kHz, palabra de 32 bits (dato de 24 bits), BCLK = 64·fs = 1,024 MHz. Cable ≤ 20 cm con GND entre SCK y SD, lejos del servo.

## 6. Recursos del ESP32 clásico y conflictos [CÁLCULO + SW]
- El **ADC continuo (DMA) usa el periférico I2S0** en el ESP32 clásico → el micrófono va en **I2S1**. Verificado en el código de ESP-IDF v5.4.1 (`adc_dma.c` reserva I2S0).
- **ADC2 no admite DMA** (y choca con Wi-Fi) → los 6 canales analógicos están en ADC1.
- **Muestreo secuencial, no simultáneo:** un solo ADC recorre el patrón P1 H1 P2 H2 P1 H3 P2 H0 a 64 kS/s → 15,625 µs entre conversiones; P1 y P2 quedan desfasados
  31,25 µs (constante, informado en la trama INFO). Hall: 8 kS/s por canal → suma de 8 → 1 kS/s.
- **LEDC** (PWM del servo) y **esp_timer** (marcas de tiempo en µs) son independientes del ADC/I2S. Las marcas se toman en la interrupción de fin de cada búfer DMA.
- **¿Alcanza el ADC interno?** Sí para el objetivo principal: los Hall son lentos y se calibran (la no linealidad del ADC queda dentro de la calibración); para piezo
  alcanza como señal complementaria (≈ 9–10 bits efectivos, dato de la documentación de Espressif; se mide el ruido en el ensayo 4). Para audio se usa el micrófono digital.
  Si más adelante se necesitara mejor calidad de vibración: ADC externo SPI (p. ej. MCP3208, 12 bits, 100 kS/s) o un códec de audio estéreo — no se incluye por ahora.

## 7. Ancho de banda del enlace USB-serie [CÁLCULO]

| Flujo | kB/s |
|---|---|
{bwt}
| **Total (audio 8 kHz)** | **{F(tot / 1000, 1)}** |

A 921 600 baudios (8N1) caben {F(link / 1000, 1)} kB/s → uso {F(100 * tot / link, 0)} %. Con audio a 16 kHz serían {F(totf / 1000, 1)} kB/s ({F(100 * totf / link, 0)} %): el firmware
solo lo permite con ≥ 1,5 Mbaudios (posible con CH340/CP2102N; VERIFICAR el chip de su placa). Datos en binario con CRC, no en texto.
"""
    w('05_Electronica_y_Calculos.md', t)


# ───────────────────────────── 06 Firmware ─────────────────────────────

def doc_firmware():
    t = f"""# 06 · Firmware de adquisición y control (ESP-IDF)

{HEAD}
**Estado:** compila con **ESP-IDF v5.4.1** (GCC xtensa esp-14.2.0_20241119; Python 3.11; esp-idf-kconfig 2.5.4; esptool 4.12.0) para `esp32`. Imagen ≈ 279 kB.
**No se probó en hardware** (no hay placa en este entorno). El archivo de restricciones de Python de Espressif (dl.espressif.com) estaba bloqueado por la red; se instalaron
versiones compatibles desde PyPI con la opción oficial `--no-constraints`.
El firmware v1 (`CardioValAI_ServoTest.ino`) se conserva sin cambios.

## Compilar y grabar (Mac)
```
. $HOME/esp/esp-idf/export.sh          # ESP-IDF v5.4.x instalado según la guía oficial de Espressif
cd hardware/firmware/CardioValAI_v2_Adquisicion
idf.py set-target esp32 && idf.py build
idf.py -p /dev/cu.usbserial-XXXX flash   # NO usar 'monitor': el puerto transporta datos binarios
```

## Tareas y prioridades (FreeRTOS)
| Núcleo | Tarea | Prio | Período / disparo | Función |
|---|---|---|---|---|
| 1 | adc | 10 | fin de búfer DMA (4 ms) | demultiplexa, FIR P1/P2, suma Hall, saturación, marcas de tiempo |
| 1 | i2s | 9 | fin de búfer DMA (16 ms) | elige ranura, FIR y diezmado del audio, saturación |
| 0 | servo | 8 | 5 ms (vTaskDelayUntil) | perfil coseno, eventos, seguridad, atasco |
| 0 | ina | 6 | 2 ms | corriente del servo (opcional) |
| 0 | tx | 5 | cola | envía tramas por UART0 |
| 0 | cmd | 4 | líneas de texto | comandos |
| 0 | main | 1 | 500 ms | trama de estado |

## Frecuencias, filtros, búferes y sincronización
- ADC1 continuo a 64 kS/s, 12 bits, atenuación 12 dB; patrón de 8 → P1 y P2 a 16 kS/s (FIR 31 coef. y diezmado → **8 kS/s**), H0–H3 a 8 kS/s (suma de 8 → **1 kS/s**).
- Búfer DMA del ADC 512 B (32 juegos = 4 ms); reserva interna del driver 16 kB (128 ms).
- I2S1: 16 kHz, 8 descriptores × 256 tramas (128 ms); audio enviado a **8 kHz** (FIR 47 coef.) o 16 kHz si el enlace lo permite.
- Búfer de transmisión de 48 kB (≈ 0,5 s). Si se llena, la trama se descarta, se cuenta y la secuencia salta (la computadora lo detecta).
- **Marcas de tiempo:** reloj único `esp_timer` (µs) para ADC, I2S, comandos y eventos → una sola base de tiempo. Retardos de grupo de los FIR descontados.
  Desfase fijo P1–P2 31,25 µs. Comando PWM: se aplica en el próximo período de 20 ms (retardo 0–20 ms) → la posición REAL se toma de los Hall.
- **Video:** LED de sincronización encendido 30 ms al comienzo de cada ciclo (evento con marca de tiempo).

## Seguridad
- Arranca **sin pulsos** al servo. Límites de comando por software ({F(90 - K.SWEEP)}–{F(90 + K.SWEEP)}° más 5° de margen).
- Parada de emergencia (GPIO23): corta los pulsos en la interrupción; bloquea nuevos movimientos hasta soltarla.
- Sin latido `HB` de la computadora durante 2 s → parada controlada (vuelve a cerrado en 800 ms y corta pulsos).
- Atasco: si H0 no varía lo esperado durante un movimiento completo → parada (`SET stall 0` lo desactiva, p. ej. en el ensayo 6 con el empujador desconectado).
- Sobrecorriente sostenida (INA219) → corte inmediato. Falla de adquisición (200 ms sin datos del ADC) → parada controlada.

## Protocolo
Trama `A5 5A | tipo | largo u16 | secuencia u16 | carga | CRC16-CCITT`. Tipos: INFO (JSON con configuración y tabla de calibración del ADC), FAST, HALL, AUDIO, CMD, EVENT,
STATUS, TEXT, INA. Detalle de cada carga en `main/proto.h` y su espejo `host/cvai_proto.py` (los tamaños se comprueban al compilar con `_Static_assert`).
Comandos de texto: `PING, HB, INFO, STREAM ON|OFF, START n, STOP, DETACH, MOVE grados ms, SET clave valor`.
"""
    w('06_Firmware.md', t)


# ───────────────────────────── 07 Herramientas · 08 Método · 09 Ensayos · 10 Pendientes ─────────────────────────────

def doc_herramientas():
    t = f"""# 07 · Herramientas de computadora (Mac): registro, vista en vivo, análisis y calibración

{HEAD}
Carpeta `host/`. Python ≥ 3.10: `python3 -m pip install -r requirements.txt` (numpy, scipy, matplotlib, pyserial). Puerto en Mac: `/dev/cu.usbserial-*`, `/dev/cu.SLAB_USBtoUART`
(CP2102) o `/dev/cu.wchusbserial*` (CH340): `ls /dev/cu.*`.

| Programa | Uso |
|---|---|
| `cvai_record.py` | Registra una sesión (`raw.bin` sin modificar + `session.json` + `session.npz` + `audio.wav`). `--live` abre la vista en vivo: ángulo medido (o cuentas si no hay calibración) **y aparte** el comando del servo, H0, P1/P2, envolvente del audio y alertas de saturación, pérdidas, CRC y parada. `--modo` declara las piezas instaladas. |
| `cvai_analyze.py` | Por ciclo: inicio y fin MEDIDOS de apertura y cierre, retardos respecto del comando, duraciones, meseta, residual, período, carrera del plato, asimetría, z robusto ciclo a ciclo, clasificación «equivalente / inconsistente» con motivos. Señales complementarias: contraste en ventanas de evento, tiempo del pico y energía por bandas. Gráficos y `ciclos.csv`. |
| `cvai_calibrate.py` | `guiado`: lleva el servo a posiciones fijas y pide los ángulos medidos (transportador/video). `ajustar`: curva monótona por valva con validación cruzada. |
| `cvai_emulator.py` | **Emulador con datos SINTÉTICOS** (puerto virtual, mismo protocolo). Solo para probar el software. Todo lo que produce lleva la marca «SINTÉTICO» en `session.json` y en los gráficos. Puede inyectar fallas inventadas (`--falla atasco:N`, `asimetria:N`, `cierre:N`). |
| `tests/test_e2e.py` | Prueba automática emulador → registro → calibración sintética → análisis. Resultado en este entorno: **aprobada** [SW]. |

**Separación de datos reales y de demostración:** el campo `fuente` de `session.json` viene de la trama INFO del firmware; el emulador declara «EMULADOR — DATOS SINTÉTICOS».
Nunca se mezclan sesiones sintéticas con reales en el análisis de variabilidad.

**Sin IA por ahora.** Si más adelante se entrena un clasificador, separar entrenamiento y evaluación **por sesión** (nunca ciclos de la misma sesión en ambos conjuntos)
para evitar fuga de información.
"""
    w('07_Herramientas_Mac.md', t)


def doc_metodo():
    t = f"""# 08 · Método de medición, calibración de la posición y criterios de inconsistencia

{HEAD}
## 1. Qué se mide y qué se estima
- **Medido:** ángulo de cada valva (Hall H1–H3 calibrados contra transportador/video) y carrera del plato (H0). Tiempos en µs del reloj del ESP32.
- **Ordenado (no es posición):** ángulo de comando del servo; se grafica aparte con línea discontinua.
- **Estimado / complementario:** vibración (P1, P2) y sonido (M1): no se usan para marcar eventos.

## 2. Calibración de la posición de las valvas
1. Montar el `Angle_Scale` y una cámara lateral alineada con el eje de la valva 1 (teleobjetivo o lejos, para reducir el paralaje); cámara superior para las valvas 2 y 3
   (hoyuelos de la línea central y marca fiduciaria).
2. `python cvai_calibrate.py guiado --port …`: el servo va a 17 posiciones fijas (130° → 50°). En cada una se promedian 0,5 s de H0–H3 y se escriben los ángulos medidos.
3. `python cvai_calibrate.py ajustar calib_puntos.csv`: curva PCHIP monótona por valva; informa el error de validación cruzada. **Aceptar si ≤ 1° (propuesto).**
4. Verificación diaria: posición cerrada y abierta; si difiere > 2° de la calibración, recalibrar. Recalibrar siempre tras desmontar imanes o sensores.
5. H0: se relaciona con el comando estático (linealiza la carrera del plato); se usa para detectar atascos, no como ángulo de valva.

## 3. Eventos por ciclo (cvai_analyze.py)
- base (cerrada) = mediana 20–200 ms antes del comando de apertura; meseta = mediana del 60 % final de la espera abierta; residual = mediana del 40 % final de la espera cerrada.
- S_ref = mediana de (meseta − base) en la sesión.
- **Inicio de apertura:** cruce de base + 10 % S_ref; **fin:** cruce de base + 90 % (meseta − base). **Cierre:** simétrico. Duración = fin − inicio; retardo = inicio − comando.
- Interpolación lineal entre muestras (1 ms).

## 4. Criterios propuestos (a ajustar con los datos del ensayo 12)
| Indicador | Criterio |
|---|---|
| Apertura incompleta | meseta − base < 90 % S_ref, o (calibrado) meseta < ángulo esperado del modo − 5° |
| Cierre incompleto | residual − base de la sesión > máx(5 % S_ref, 2°) |
| Asimetría | (calibrado) diferencia de mesetas entre valvas, descontando la del modo declarado, > 5° |
| Atasco | carrera del plato < 90 % de la de referencia, o parada del firmware por atasco/sobrecorriente |
| Variación ciclo a ciclo | z robusto > 3,5 (z = (x − mediana)/(1,4826·MAD)), con pisos de 5 ms y 1° |
| Datos no confiables | saturación, desborde del ADC/I2S, tramas descartadas o saltos de secuencia dentro del ciclo |
| **Ciclos equivalentes** | ninguno de los anteriores |

## 5. Comparación de señales complementarias
Por ciclo: contraste (dB) en ±30 ms del fin de apertura/cierre medido respecto de la espera quieta y de la mitad del recorrido, tiempo del pico respecto del evento (mediana e IQR),
energía en 20–200 / 200–1000 / 1000–3000 Hz. Se considera que una señal **ayuda** a identificar el evento solo si, en varias sesiones, el contraste respecto de la mitad del
recorrido es ≥ 6 dB y el IQR del tiempo del pico ≤ 10 ms (criterios propuestos). Si no, se informa que no se distingue del ruido del servo.

**Importante:** detectar cambios en este banco **no** equivale a diagnosticar una prótesis implantada.
"""
    w('08_Metodo_Medicion_Calibracion_Criterios.md', t)


TESTS = [
    ('1. Probeta de tolerancias', 'Imprimir `Tolerance_Coupon`; probar ejes de latón (libre y a presión), insertos M2/M3, imanes Ø4 y Ø3, pilotos.',
     'Eje libre gira sin juego visible; a presión no sale tirando con la mano; insertos a ras y sin girar; imanes entran con presión leve. Anotar diámetros elegidos y actualizar `config.py`.'),
    ('2. Movimiento manual sin servo', 'Mecanismo armado, empujador desconectado; mover el plato a mano en toda la carrera, en cada modo.',
     'Sin trabas ni roces audibles; las 3 valvas van de 0° a 80° (normal); fuerza para mover el plato medida con dinamómetro/balanza (anotar; objetivo propuesto < 1 N).'),
    ('3. Límites de apertura y cierre', 'Video lateral con `Angle_Scale` + foto superior, plato en los extremos.',
     'Cerrada: 0 ± 2°, separación entre bordes visible ≈ 1 mm; abierta: 80 ± 3°; topes alternativos 60/45 ± 3°; valva sobre su tope en los modos alterados.'),
    ('4. Electrónica y adquisición (sin mecanismo)', 'Prueba previa del acondicionamiento (doc 05); luego ESP32 + sensores en banco; 10 min con `STREAM ON`.',
     'VBIAS 1,32 ± 0,05 V; Hall estáticos dentro de ±15 % de lo calculado; 0 errores CRC, 0 saltos, 0 desbordes; ruido Hall ≤ 0,5° equivalente; calibración Hall con error ≤ 1°.'),
    ('5. Ruido ambiente, mecanismo detenido', 'Servo sin pulsos, 2 min de registro en el laboratorio real.',
     'Niveles de referencia de P1, P2 y M1 (se registran, no hay umbral); sin saturación.'),
    ('6. Servo con el empujador desconectado', '`SET stall 0`; ciclos con el horn libre. Repetir con y sin gomas.',
     'Firma del servo en P1/P2/M1; coherencia y función de transferencia P2→P1; pico de corriente (INA219) < 70 % de la capacidad de la fuente.'),
    ('7. Mecanismo completo, modo normal', '30 ciclos, 3 sesiones, video sincronizado con el LED.',
     'Meseta 80 ± 3° en las 3 valvas, residual ≤ 2°, diferencia entre valvas ≤ 3°, CV de duraciones < 5 %, ≥ 95 % de ciclos «equivalentes».'),
    ('8. Una alteración conocida a la vez', 'R60, R45, cierre incompleto, asimétrico; 30 ciclos cada uno, con 10 ciclos normales antes y después.',
     'El 100 % de los ciclos alterados se marcan con el motivo correcto; ≥ 95 % de los normales quedan «equivalentes».'),
    ('9. Desmontar y volver a montar sensores', 'Retirar y volver a colocar piezo, micrófono y (si corresponde) Hall; repetir 7.',
     'Mesetas dentro de ±2° de antes; diferencias de nivel de P1/P2/M1 documentadas (repetibilidad del montaje).'),
    ('10. Posiciones y velocidades', 't_open/t_close = 200, 400, 800 ms; P1 en las 3 almohadillas; M1 a 44/52/60 mm y en la escuadra.',
     'Métricas coherentes con la velocidad; selección de ubicación según doc 03.'),
    ('11. Video vs. señales', 'Comparar ángulos y tiempos del video (≥ 60 cuadros/s) con Hall, piezo y audio.',
     'Ángulo Hall vs. video: error máx. ≤ 3°, RMS ≤ 1,5°; tiempos de evento: diferencia ≤ 1 cuadro + 10 ms. Evaluar si piezo/audio marcan eventos (doc 08 §5).'),
    ('12. Variabilidad normal', '≥ 3 sesiones × 30 ciclos en días distintos, mismo modo normal.',
     'Mediana y MAD por métrica entre sesiones → fijar los umbrales definitivos. Base para cualquier análisis posterior.'),
]


def doc_ensayos():
    rows = '\n'.join(f'| {a} | {b} | {c} |' for a, b, c in TESTS)
    t = f"""# 09 · Plan de validación física (progresivo)

{HEAD}
Los criterios son **objetivos propuestos**, no resultados. Cada ensayo se registra con `cvai_record.py` (sesiones reales: `fuente` = ESP32) y video.

| Ensayo | Procedimiento | Criterio de aceptación propuesto |
|---|---|---|
{rows}

**Video:** cámara lateral (valva 1 + `Angle_Scale`) y superior; ≥ 60 cuadros/s; el LED de sincronización debe verse. El tiempo de cada encendido del LED está en los
eventos `SYNC_LED_ON`: el desfase y la deriva cámara–ESP32 se estiman con varios encendidos.

**Golpes artificiales:** no se usan para «mostrar» detección. Solo se admite un impulso identificado y justificado (p. ej. péndulo de altura conocida) para caracterizar la
transmisión P1/P2 en el ensayo 6, rotulado como tal en `session.json` (`--nota`).

**¿Hay eventos acústicos/vibratorios distinguibles?** Se responde con los ensayos 6, 7 y 11 (doc 08 §5). Si no los hay, la medición de apertura/cierre queda a cargo de los Hall
(ya incluidos) y del video; no se necesita otra medición adicional para el objetivo principal.
"""
    w('09_Plan_de_Ensayos.md', t)


def doc_pendientes():
    t = f"""# 10 · Pendientes de medición o ensayo físico

{HEAD}
- Medidas del ESP32, servo, horn, INMP441, piezo y placa perforada (doc 02) → regenerar piezas afectadas.
- Diámetros reales de agujeros, ajustes a presión e insertos (probeta).
- Respuesta real de los Hall (campo de los imanes comprados, posición real) → calibración; monotonía confirmada.
- Ruido real del ADC y de los Hall; ganancia adecuada de los canales piezo; saturación.
- Funcionamiento del firmware en la placa (no probado en hardware): tasas reales, pérdidas, eventos, paradas, PWM aceptado por el servo a 3,3 V.
- Corriente pico y de bloqueo del servo; margen de par real; fricción del plato; efecto cajón.
- Efecto de las gomas antivibración; resonancias de soportes (micrófono, P1, P2).
- Si P1, P2 o M1 permiten identificar eventos (doc 08 §5).
- Repetibilidad del montaje de sensores y de la calibración.
- Todos los criterios de aceptación del doc 09.
"""
    w('10_Pendientes_Fisicos.md', t)


# ───────────────────────────── guías, BOM, informe, LEEME ─────────────────────────────

NOT_FINAL = {'Electronics_Tray', 'Tray_Clamp', 'Servo_Mount', 'MEMS_Stand_Holder', 'MEMS_Mount', 'Piezo_Mount', 'Piezo_Cover', 'Piezo_Adapter_12mm', 'Base'}


def doc_impresion(V):
    pm = {r['part']: r for r in V['print_meshes']}
    rows = []
    for it in R.ITEMS:
        if not it.printable:
            continue
        r = pm[it.name]
        nf = ' **NO DEFINITIVA**' if it.name in NOT_FINAL else ''
        rows.append(f"| `{C.PREFIX}_{it.name}.stl`{nf} | {it.qty} | {' × '.join(F(v, 1) for v in r['size_mm'])} | {F(r['mass_g_petg'], 1)} | {it.layer} mm · {it.infill} · {it.walls} perímetros | {'sí' if r['needs_support'] else 'no'} | {it.notes} |")
    t = f"""# Guía de impresión v2

{HEAD}
Material: **PETG** (piezas móviles y estructurales). Boquilla 0,4 mm. Unidades de los STL: **milímetros**; ya están orientados para la cama.
**Primero imprimir `{C.PREFIX}_Tolerance_Coupon.stl`** (5 filas × 6 agujeros, número de fila grabado):
1 eje Ø2 libre (2,0–2,5) · 2 eje Ø2 a presión (1,80–2,05) · 3 pilotos M2/M3 (1,6–1,9 / 2,4 / 2,6) · 4 insertos M2 (3,1–3,3) y M3 (4,0–4,2) · 5 imanes Ø4 (4,1–4,3) y Ø3 (3,1–3,3).
Elegir los diámetros que funcionan con lo comprado y actualizar en `config.py`: `PIN_HOLE_LEAF`, `TAIL_PIN_HOLE`, `LINK_HOLE`, `M2_INSERT_D`, `M3_INSERT_D`, `MAG_POCKET_CLR`;
luego `python build_all.py && python verify.py && python make_docs_v2.py`.

Las piezas marcadas **NO DEFINITIVA** dependen de medidas pendientes (doc 02): imprimirlas solo después de actualizarlas o como prueba.

| Archivo | Cant. | Tamaño (mm) | Masa PETG (g) | Parámetros | Soporte | Nota |
|---|---|---|---|---|---|---|
{chr(10).join(rows)}

Insertos termofijados: soldador a ≈ 220–230 °C con punta para insertos; presionar recto hasta quedar a ras; dejar enfriar sin mover.
"""
    w('Guia_de_Impresion_v2.md', t)


def doc_ensamblaje():
    t = f"""# Guía de ensamblaje v2 (paso a paso)

{HEAD}
Herramientas: soldador para insertos, destornillador allen 1,5 y 2,5 mm, llave de tubo 4 mm, alicate de punta, calibre, cianoacrilato, silicona neutra, grasa PTFE, bridas finas.

1. **Probeta** y ajuste de diámetros (guía de impresión).
2. **Insertos:** M3 en las columnas (ambos extremos) y en la base (servo, bandeja, soporte M1); M2 en las 3 almohadillas del anillo y en la almohadilla P2; M3 en los 4 postes de la bandeja.
3. **Imanes:** uno por valva, en el alojamiento de la cara −y de la cola, con cianoacrilato y **la misma cara hacia afuera en las tres** (marcar la polaridad con un punto). Imán Ø3 en el
   lóbulo de la columna 1 del plato.
4. **Columnas → base:** M3×10 desde abajo (cabezas en los rebajes).
5. **Servo:** centrarlo (comando 90°) antes de colocar el horn; horn con el brazo horizontal hacia el centro de la válvula. Servo al `Servo_Mount` con sus tornillos; el soporte a la base con
   M3×12, dos arandelas de goma y el casquillo limitador (no aplastar la goma).
6. **Plato:** lubricar los bujes con grasa PTFE; deslizar sobre las columnas (imán hacia arriba, en la columna 1). Empujador al horn y a la horquilla (M2×14 + tuerca).
7. **Valvas + bielas (en el banco):** pasador de latón Ø2×9 a presión en la cola (a ras de la cara −y), biela normal en el pasador (gira libre).
8. **Valvas en el anillo:** número grabado de la valva = número del sector; biela hacia abajo por la ranura; eje de latón Ø2×56 desde afuera; cianoacrilato solo en los extremos.
   Girar a mano: 0–90° sin roce.
9. **Topes:** `Opening_Stop_84` desde abajo en cada ranura; tuerca M2 en la trampa de la brida; tornillo M2×20 de latón desde arriba.
10. **Sensores Hall:** soldar 3 hilos finos (≈ 30 cm) a cada DRV5055A1 (patas dobladas hacia arriba), insertar en su bolsillo hasta el piso con la cara plana hacia el centro, gota de
    silicona; cables por el canal superior y la bajada exterior.
11. **Arandelas y soporte H0:** `Column_Spacer` sobre las columnas 2 y 3; `H0_Holder` sobre la columna 1 con el DRV5055A2 acostado (cara plana hacia abajo) en su bolsillo.
12. **Anillo sobre las columnas:** servo en 50° (plato abajo); unir cada biela a su orejeta del plato (M2×10 + tuerca, llave de tubo por el lado de la tuerca; retirar antes el
    `Angle_Scale`); fijar el anillo con M3×30 desde las comisuras.
13. **Comprobar a mano** (ensayo 2) con el empujador desconectado y luego conectado.
14. **Piezo P1** (almohadilla de la valva 2) y **P2** (almohadilla P2 del soporte del servo): cinta doble faz fina recortada, disco en el asiento, cables por el canal, brida, tapa (no toca
    el disco), 2× M2×10.
15. **Micrófono M1:** placa en `MEMS_Stand_Holder` (puerto libre), pivote M3×16 + autoblocante, soporte a la base por las ranuras (M3×10). Alternativa: `MEMS_Mount` en la almohadilla de la valva 1.
16. **Cables:** pinzas en las columnas (bajo el recorrido del plato), bridas en las ranuras de la base: señales por el sur, servo/5 V por el norte. Mover el servo a mano por todo el
    recorrido y comprobar que nada roce.
17. **Electrónica:** placa perforada en la bandeja (barras de sujeción), ESP32 en zócalos hembra con la antena fuera del borde −y; prueba previa del acondicionamiento (doc 05) ANTES de
    enchufar el ESP32.
18. **Cambio de módulo:** servo en 50° → retirar tornillo biela–plato → sacar el eje → cambiar biela y tope (y elástico) → volver a montar → recalibrar si se tocó el imán/sensor.
"""
    w('Guia_de_Ensamblaje_v2.md', t)


BUY = [
    ('ESP32 DevKit V1 (ESP32-WROOM-32)', 1, 'Medidas por confirmar (doc 02)'), ('Servo MG90S + horns', 1, 'Medidas por confirmar'),
    ('Fuente 5 V 3 A con conector de tornillo o jack', 1, ''), ('Imán neodimio N42 Ø4×2 mm axial', 3 + 2, '+2 de repuesto'),
    ('Imán neodimio N42 Ø3×2 mm axial', 1 + 1, '+1 de repuesto'), ('TI DRV5055A1QLPG (TO-92)', 3 + 1, 'H1–H3 (+1)'), ('TI DRV5055A2QLPG (TO-92)', 1 + 1, 'H0 (+1)'),
    ('INMP441 (placa de módulo)', 1, 'Fotos por confirmar'), ('Disco piezoeléctrico Ø15 (o Ø12 con adaptador)', 2 + 1, 'P1, P2 (+1)'),
    ('Microchip MCP6004 (DIP-14 o SOIC + adaptador)', 1, '4 amplificadores'), ('Microchip MCP1700-3302 (TO-92)', 1, '3V3_A'), ('INA219 (módulo, shunt 0,1 Ω)', 1, 'opcional, recomendado'),
    ('BAT54S', 2, 'protección piezo'), ('AO3401A (SOT-23) + 10 kΩ', 1, 'polaridad invertida'), ('PTC 2,5 A retención', 1, ''), ('TVS SMBJ5.0A', 1, ''),
    ('Capacitor 1000 µF 10 V bajo ESR', 1, ''), ('Capacitores 100 nF cerámicos', 12, 'desacoplo y RC Hall'), ('Capacitores 15 nF, 7,5 nF (o 6,8 + 0,68), 2,2 nF C0G', 2, 'por canal piezo'),
    ('Capacitor 10 µF', 2, 'VBIAS, regulador'), ('Resistencias 1 MΩ, 10 kΩ, 12 kΩ, 36 kΩ, 150 kΩ, 100 kΩ, 1 kΩ, 220 Ω, 330 Ω, 100 Ω, 33 Ω (1 %)', 1, 'surtido según esquema'),
    ('Placa perforada 7×9 cm', 1, ''), ('Tiras de zócalo hembra 2,54 mm', 2, 'según cantidad de pines del ESP32'), ('Bornera de tornillo 2 vías', 2, '5 V servo'),
    ('Parada de emergencia de 2 contactos (NC + NA) o pulsador', 1, ''), ('LED + 330 Ω', 1, 'sincronización'), ('Cable blindado 2 hilos (piezo)', 2, '≈ 40 cm c/u'),
    ('Cable de 3 hilos fino (Hall)', 4, '≈ 30 cm'), ('Cable plano 6 hilos (micrófono)', 1, '≤ 20 cm'),
    ('Varilla de LATÓN Ø2 mm', 1, '3 × 56 mm (ejes) + 3 × 9 mm (pasadores)'), ('Tornillo M2×20 de LATÓN + tuerca M2', 3, 'topes'),
    ('Tornillo M2×10 inox A2 + tuerca', 3, 'biela–plato'), ('Tornillo M2×14 + tuerca', 1, 'horquilla'), ('Tornillo M2×10 inox', 6, 'almohadillas'),
    ('Tornillo M3×10', 3 + 2, 'columnas, soporte M1'), ('Tornillo M3×30', 3, 'anillo'), ('Tornillo M3×12 + casquillo Ø4×Ø3,2×5,5 + 2 arandelas de goma', 4, 'soporte del servo'),
    ('Tornillo M3×6', 4, 'bandeja'), ('Tornillo M3×8', 4, 'barras de sujeción'), ('Tornillo M3×16 + tuerca autoblocante', 1, 'pivote M1'),
    ('Inserto termofijado M3 (L 5,7)', 6 + 4 + 4 + 2 + 4, 'columnas, base, bandeja'), ('Inserto termofijado M2 (L 3–4)', 8, 'almohadillas'),
    ('Patas de goma adhesivas Ø10', 4, ''), ('Grasa PTFE, cianoacrilato, silicona neutra, cinta doble faz fina, bridas', 1, ''),
]


def doc_bom(V):
    pm = {r['part']: r for r in V['print_meshes']}
    rows, csvrows = [], []
    for it in R.ITEMS:
        if it.printable:
            r = pm[it.name]
            nf = 'NO DEFINITIVA' if it.name in NOT_FINAL else ''
            rows.append(f"| {it.name} | {it.qty} | impresa (PETG) | {' × '.join(F(v, 1) for v in r['size_mm'])} mm · {F(r['mass_g_petg'], 1)} g | {it.role} {nf} |")
            csvrows.append([it.name, it.qty, 'impresa PETG', ' x '.join(f'{v:.1f}' for v in r['size_mm']), it.role + (' ' + nf if nf else '')])
    for a, q, n in BUY:
        rows.append(f'| {a} | {q} | comprada | | {n} |'); csvrows.append([a, q, 'comprada', '', n])
    t = f"""# Lista de materiales v2

{HEAD}
| Elemento | Cant. | Tipo | Medidas | Función / nota |
|---|---|---|---|---|
{chr(10).join(rows)}
"""
    w('Lista_de_Materiales_v2.md', t)
    with open(os.path.join(DOC, 'Lista_de_Materiales_v2.csv'), 'w', newline='', encoding='utf-8') as f:
        cw = csv.writer(f); cw.writerow(['elemento', 'cantidad', 'tipo', 'medidas_mm', 'nota']); cw.writerows(csvrows)


def doc_informe(V):
    pm = V['print_meshes']
    bad = [r['part'] for r in pm if not (r['watertight'] and r['winding'] and r['manifold_ok'] and r['bodies'] == 1 and r['fits_bed'])]
    clr = '\n'.join(f"| {k} | {F(v['min_mm'], 2)} | {v['mode']} |" for k, v in sorted(V['clearance'].items(), key=lambda kv: kv[1]['min_mm']))
    asm = '\n'.join(f"| {c['check']} | {'✔' if c['ok'] else '✘ ' + ', '.join(c['hits'])} |" for c in V['assembly'])
    t = f"""# Informe de validación digital v2

{HEAD}
Generado: {V['generated']}. Todo lo de este informe es **[SIM] o [SW]**: se ejecutó sobre los archivos entregados. No reemplaza ningún ensayo físico.

## Mallas de impresión [SW]
{len(pm)} piezas imprimibles; con problemas: {', '.join(bad) or 'ninguna'} (cerradas, orientación coherente, un cuerpo, z mín. = 0, caben en 220 × 220 × 250).

## Interferencias [SIM]
{V['sweep']['poses_checked']} poses (25 posiciones del servo × 5 modos), todas las piezas, imanes, pasadores, tornillería y cables: **{len(V['sweep']['interferences'])} interferencias**.
Contactos de diseño: {', '.join(sorted(V['sweep']['contacts'])) or 'ninguno'}.

## Holguras mínimas [SIM]
| Par | mm | modo |
|---|---|---|
{clr}

## Montaje y acceso [SIM]
| Comprobación | Resultado |
|---|---|
{asm}

## Cálculos [CÁLCULO]
Servo: {json.dumps(V['servo'], ensure_ascii=False)}. Efecto cajón: {V['plate_binding']['lectura']}
"""
    w('Informe_de_Validacion_v2.md', t)
    with open(os.path.join(DOC, 'Tabla_Cinematica_v2.csv'), 'w', newline='', encoding='utf-8') as f:
        cw = csv.writer(f)
        cw.writerow(['modo', 'comando_servo_deg', 'plato_mm', 'theta1', 'theta2', 'theta3', 'tope1', 'tope2', 'tope3'])
        for mode, rows in V['kinematics'].items():
            for r in rows:
                cw.writerow([mode, r['servo_cmd_deg'], r['plate_mm'], *r['theta'], *r['on_stop']])


def doc_leeme():
    t = f"""# {C.PROJECT} — paquete {C.REVISION}

{HEAD}
Banco experimental universitario de válvula aórtica trivalva accionada por un servo, **sin circulación de líquido**. Objetivo principal: medir de forma repetible la apertura y
el cierre y detectar inconsistencias entre ciclos. Vibración y sonido son señales complementarias. **Detectar cambios en este banco no equivale a diagnosticar una prótesis.**

La revisión **v1** se conserva sin cambios en `entrega/CardioValAI_Modelo_Final_STL.zip`. Todos los archivos de este paquete se generaron desde el mismo código (ver `REVISION.json`).

| Carpeta / archivo | Contenido |
|---|---|
| `Documentacion/01…10` | Auditoría, medidas pendientes, sensores, mecanismo, electrónica, firmware, herramientas, método, ensayos, pendientes |
| `Documentacion/Guia_de_Impresion_v2.md`, `Guia_de_Ensamblaje_v2.md`, `Lista_de_Materiales_v2.*`, `Informe_de_Validacion_v2.md` | Fabricación y verificación |
| `{C.PREFIX}_STL/` | Piezas imprimibles (mm, orientadas) |
| `{C.PREFIX}_STEP/`, `{C.PREFIX}_Assembly_Cerrada.step` | Sólidos editables y ensamblaje |
| `Referencia_NO_IMPRIMIR/` | Servo, ESP32+placa, sensores, imanes, tornillería, cables |
| `{C.PREFIX}_Final.blend` | Ensamblaje animado (Blender 4.5 LTS) |
| `{C.PREFIX}_Animacion.mp4` | Animación cinemática (no es prueba de funcionamiento) |
| `Vistas/` | Ubicación de sensores y recorrido de cables |
| `Electronica/` | Esquemas (SVG/PNG) |
| `CAD_parametrico/`, `Firmware_v2/`, `Herramientas_Mac/`, `Electronica_fuente/` | Código fuente reproducible |
| `Firmware_v1_original/` | Prueba de servo de v1 (solo mueve el servo) |
"""
    w('LEEME.md', t)


def main():
    V, SD = load()
    doc_auditoria(V, SD); doc_medidas(); doc_sensores(V, SD); doc_mecanismo(V); doc_electronica(); doc_firmware()
    doc_herramientas(); doc_metodo(); doc_ensayos(); doc_pendientes(); doc_impresion(V); doc_ensamblaje(); doc_bom(V); doc_informe(V); doc_leeme()
    print('Documentos en', DOC, sorted(os.listdir(DOC)))


if __name__ == '__main__':
    main()
