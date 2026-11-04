# ValveSense

## Monitor en vivo: servo + sensores Hall (ESP32 por USB)

El dashboard actual muestra una válvula animada que se abre y se cierra, el ángulo medido por 3 sensores Hall, el historial de ciclos, un análisis de patrones y un plan de rehabilitación kinésica. **No usa WiFi**: el ESP32 se conecta por cable USB y el navegador lee el puerto con Web Serial (Chrome o Edge).

### Conexiones

| Componente | Conexión |
|---|---|
| Jack (+) / (−) | Riel positivo (+5 V) / riel negativo (GND) |
| Servo MG90S | Rojo a +5 V · café a GND · señal a **GPIO 18** |
| ESP32 GND | Mismo GND que el jack y el servo |
| Hall 1 / 2 / 3 (señal) | GPIO **34** / **35** / **32** |
| Hall VCC / GND | 3V3 del ESP32 / GND |

### Puesta en marcha

1. Instala la librería **ESP32Servo** en el Arduino IDE y sube `firmware/cardiovalve_esp32/cardiovalve_esp32.ino`. Cierra el Monitor Serie después (el puerto no puede estar ocupado).
2. Con los imanes **lejos** de los sensores, enciende el ESP32: mide el valor neutro de cada Hall al arrancar.
3. `npm install` y `npm run dev`, abre `http://localhost:5173` en Chrome o Edge (o el sitio publicado) y pulsa **Conectar ESP32 (USB)**.
4. **Modo demo** simula el ESP32 para probar el dashboard sin hardware.

### Qué hace

- **Dos modos** desde el dashboard: *Válvula normal* (el servo abre 80°) y *Válvula incompleta* (abre 35°). Con cualquier señal de imán, el dashboard informa la apertura del modo elegido; el ángulo que de verdad miden los Hall se muestra aparte.
- **Servo** calibrado: 500 µs = 0° (vertical), 2500 µs = 180°, movimiento lento y suave. Los ángulos y tiempos están al inicio del `.ino`.
- **Hall a grados**: promedio ponderado de la posición de cada sensor (`HALL_POS_DEG`, ajústalo a donde estén tus sensores). Usa *Calibrar neutro* y *Calibrar rango* si la lectura no coincide.
- **Registros**: cada ciclo se guarda en el navegador (hasta 3000) y se puede exportar o importar en CSV/JSON.
- **Análisis de patrones («IA local»)**: calcula la apertura media respecto de lo esperado, variabilidad, tendencia y ritmo, y muestra una alerta cuando la válvula abre incompletamente. Son reglas estadísticas que corren en el navegador; no es un modelo de lenguaje y no necesita internet.
- **Plan de rehabilitación kinésica**: se genera según el nivel de apertura (normal, limitada o incompleta), con respiración, ejercicio gradual, conservación de energía, monitoreo y señales de alerta. Se puede descargar o imprimir.

> Es un prototipo académico con un modelo a escala. El plan debe ser revisado por un/a kinesiólogo/a y el médico tratante; no es un diagnóstico.

### Código

`src/live/` (motor, fuentes USB y demo, análisis, plan y componentes) y `firmware/`. El resto de `src/` (motor piezo/audio, simulación) es la versión anterior y ya no se usa en la interfaz.

---

## ValveSense (versión anterior: análisis de piezo y audio)

**Análisis inteligente de la firma mecánica y acústica valvular**

Dashboard web para un prototipo experimental a escala (Ingeniería Biomédica + Kinesiología) inspirado en una prótesis aórtica mecánica. Una válvula de ~60–80 mm, accionada por servomotor, se monitoriza con un **sensor piezoeléctrico** (vibración), un **micrófono MEMS** (sonido) y un **ESP32** (adquisición).

> ⚠️ **No es un dispositivo médico.** El objetivo es construir una *línea basal* del comportamiento mecánico/acústico del prototipo y detectar **desviaciones** respecto de ella. Ningún resultado es un diagnóstico. Todos los datos actuales son **sintéticos**, incluido el "paciente simulado".

---

## 1. Instalación

Requisitos: **Node.js ≥ 20** y npm.

```bash
git clone <repo> && cd cardiovalveai
npm install
```

## 2. Ejecución

```bash
npm run dev        # servidor de desarrollo → http://localhost:5173
npm run build      # typecheck + build de producción en dist/
npm run preview    # sirve el build de producción
npm run dataset    # regenera el dataset sintético de ejemplo (public/data/)
```

En la barra superior puedes:

- Cambiar el **estado experimental**: Normal · Apertura limitada · Cierre alterado · Ritmo irregular.
- Ajustar la **frecuencia programada** (lpm) con `−` / `+`.
- Alternar **SIMULACIÓN / DATOS REALES** (ESP32 por WebSocket).
- **Recapturar la línea basal** con los próximos 30 ciclos de la fuente activa.

---

## 3. Arquitectura

```
          ┌────────────────────────── Fuente de datos (ValveDataSource) ──────────────────────────┐
          │  SimulatedValveSource  ──►  ValveSignalSynth (señales físicas sintéticas)            │
          │  Esp32WebSocketSource  ──►  ESP32 real (JSON por WebSocket)                          │
          └──────────────────────────────┬────────────────────────────────────────────────────────┘
                                         │ SignalChunk { piezo, servo, audio, fs, t0 }
                                         ▼
                              ┌────────────────────┐
                              │ ValveSenseEngine   │  buffers circulares (3 s), espectrograma STFT
                              └─────────┬──────────┘
                                        ▼
       ┌───────────────────── ValveAnalysisPipeline ──────────────────────┐
       │ CycleAnalyzer  → segmenta ciclos (cruce de umbral del servo)      │
       │                → descriptores: RMS, pico, energía, f. dominante, │
       │                  centroide, tiempos 10–90 %, envolventes de fase  │
       │ BaselineModel  → z-scores vs basal + correlación de forma         │
       │                → similitud %, anomaly score (0–1), regularidad    │
       └──────────────────────────────┬────────────────────────────────────┘
                                      ▼ CycleRecord (1 por ciclo)
                      useValveSense (React, refresco 10 Hz) → componentes
```

**Principio clave:** el simulador produce *señales crudas*, no métricas. Todas las métricas (incluido el anomaly score) se calculan con el **mismo pipeline** que procesará los datos del ESP32. Al cambiar el modo experimental, el score cambia porque la señal medida cambia, no porque el modo se lo indique.

### Estructura de carpetas

```
src/
├── types/valvesense.ts          Contratos de datos (SignalChunk, CycleRecord, …)
├── config/modes.ts              Perfiles físicos de cada estado + constantes de adquisición
├── simulation/
│   ├── ValveSignalSynth.ts      Sintetizador: servo + resonadores amortiguados (clics) + ruido de flujo
│   ├── PatientSimulator.ts      Paciente SINTÉTICO + historial ficticio de sesiones
│   └── rng.ts                   PRNG determinista
├── sources/
│   ├── DataSource.ts            Interfaz común de fuentes
│   ├── SimulatedValveSource.ts  Fuente simulada (bloques de 50 ms)
│   └── Esp32WebSocketSource.ts  ← punto de conexión del ESP32
├── analysis/
│   ├── dsp.ts                   FFT, Welch, RMS, centroide, envolventes, Pearson
│   ├── CycleAnalyzer.ts         Segmentación y descriptores por ciclo
│   ├── BaselineModel.ts         Línea basal y evaluación de desviaciones
│   ├── ValveAnalysisPipeline.ts Orquestación + regularidad + suavizado
│   └── calibration.ts           Calibración de la basal en simulación
├── engine/                      Motor (sin React): buffers, espectrograma, snapshots
├── hooks/useValveSense.ts       Puente React
├── components/
│   ├── layout/                  Header, barra de control
│   ├── sections/                Las 6 secciones del dashboard
│   ├── charts/                  Gráfico de señal, espectrograma, tooltip, tema
│   └── ui/                      Section, MetricCard, StatusBadge
└── lib/                         RingBuffer, formato, exportación CSV/JSON
scripts/generate-dataset.ts      Generador del dataset de ejemplo
public/data/                     valvesense_sample_dataset.{csv,json}
```

### Cómo se calculan los indicadores

| Indicador | Cálculo |
|---|---|
| Segmentación de ciclo | Cruce ascendente del ángulo del servo por 8° (con histéresis) |
| Tiempo de apertura / cierre | Transición 10 %→90 % (y 90 %→10 %) del ángulo máximo del ciclo |
| RMS / pico / energía | Sobre la señal piezo del ciclo completo; energía = ∑x²·Δt |
| Frecuencia dominante / centroide | PSD de Welch (Hann 512, 50 %) del audio del ciclo, > 150 Hz |
| Regularidad | `100·exp(−(CV/0,12)^1,5)` con CV = coef. de variación del período (12 ciclos) |
| Similitud con basal | Combina la distancia multivariante de z-scores (9 descriptores) y la correlación de las envolventes de fase |
| Anomaly score (0–1) | Distancia multivariante + error de forma + penalización por irregularidad. Suavizado EMA (α = 0,4) |
| Estado | `< 0,3` NORMAL · `0,3–0,6` DESVIACIÓN LEVE · `≥ 0,6` DESVIACIÓN IMPORTANTE |

Valores típicos de la simulación: Normal ≈ 98 % / 0,01 · Ritmo irregular ≈ 55 % / 0,45–0,7 · Apertura limitada ≈ 32 % / 0,89 · Cierre alterado ≈ 25 % / 0,85.

---

## 4. Dónde conectar el ESP32

**Archivo:** `src/sources/Esp32WebSocketSource.ts` (ya implementado). En el dashboard: **DATOS REALES** → escribe la URL (`ws://<ip-del-esp32>:81`) → **Conectar**.

El ESP32 debe abrir un servidor WebSocket y enviar un mensaje JSON por bloque (recomendado: cada 50–100 ms):

```json
{
  "type": "chunk",
  "t0_ms": 123456,
  "fs_piezo": 1000,
  "fs_audio": 8000,
  "piezo": [0.012, -0.004, ...],
  "servo": [0.0, 0.1, ...],
  "audio": [0.001, -0.002, ...]
}
```

- `piezo` y `servo` tienen la **misma longitud** (muestreo `fs_piezo`); `servo` es el ángulo en grados (comandado o medido).
- `audio` tiene longitud `len(piezo) × fs_audio / fs_piezo`, normalizado a [−1, 1] (p. ej. muestra I²S de 16 bits / 32768).
- `piezo` centrado en 0 (resta el offset del ADC), en unidades arbitrarias o V.

Mensajes opcionales:

```json
{ "type": "status", "bpm_programmed": 72 }
{ "type": "cycle", "timestamp": 0, "cycle_number": 1, "...": "CycleFeatures calculados en el firmware" }
```

Al conectar datos reales, pulsa **Recapturar basal** con la válvula funcionando en condición normal: los próximos 30 ciclos definen la nueva línea basal del hardware.

Esqueleto de firmware (Arduino, librerías `WebSocketsServer` y `ArduinoJson`):

```cpp
// Pseudocódigo — adaptar a tu hardware
WebSocketsServer ws(81);
void loop() {
  ws.loop();
  // 1) muestrear piezo (ADC) y ángulo a 1 kHz, audio I2S a 8 kHz en buffers
  // 2) cada 50 ms serializar el bloque como {"type":"chunk", ...} y enviarlo:
  //    ws.broadcastTXT(json);
}
```

Para implementar otra vía (Web Serial, MQTT, archivo), crea una clase que implemente `ValveDataSource` (`src/sources/DataSource.ts`) y regístrala en `ValveSenseEngine`.

---

## 5. Estructura de datos esperada

### `CycleRecord` (un registro por ciclo; formato del CSV exportado)

| Campo | Tipo | Unidad | Descripción |
|---|---|---|---|
| `timestamp` | number | ms | Fin del ciclo (reloj de la fuente; en el dataset, epoch) |
| `cycle_number` | int | — | Número de ciclo desde el inicio |
| `bpm` | number | lpm | Frecuencia medida (media de los últimos 5 ciclos) |
| `servo_angle` | number | ° | Ángulo máximo de apertura del ciclo |
| `valve_state` | enum | — | `closed` · `opening` · `open` · `closing` (estado al cierre del registro) |
| `piezo_raw` | number | u.a. | Valor crudo del piezo en el pico del ciclo |
| `piezo_rms` | number | u.a. | RMS de vibración |
| `piezo_peak` | number | u.a. | Amplitud pico absoluta |
| `piezo_energy` | number | u.a.²·s | Energía de la señal |
| `audio_rms` | number | — | RMS acústico (normalizado) |
| `dominant_frequency` | number | Hz | Pico espectral del audio |
| `spectral_centroid` | number | Hz | Centroide espectral del audio |
| `cycle_duration_ms` | number | ms | Duración del ciclo |
| `opening_duration_ms` | number | ms | Tiempo de apertura (10–90 %) |
| `closing_duration_ms` | number | ms | Tiempo de cierre (90–10 %) |
| `baseline_similarity` | number | % | Similitud con la línea basal (EMA) |
| `anomaly_score` | number | 0–1 | Índice de desviación (EMA) |
| `regularity` | number | % | Regularidad del período |
| `mode` | enum \| null | — | Estado experimental (sólo simulación) |
| `source` | enum | — | `simulation` · `esp32` |

### Dataset sintético de ejemplo

`public/data/valvesense_sample_dataset.csv` y `.json` — 280 ciclos con la secuencia *normal → apertura limitada → normal → cierre alterado → normal → ritmo irregular → normal* (40 ciclos cada uno). El JSON incluye además las estadísticas de la línea basal. También descargable desde la sección **Historial**, junto con la exportación CSV/JSON de la sesión en curso.

---

## Aviso

Proyecto académico. Las señales, el paciente y las sesiones de rehabilitación son **sintéticos** y están marcados como tales en la interfaz. ValveSense no utiliza información médica real ni emite diagnósticos clínicos.
