# ValveSense · CardioValveAI

**Del movimiento valvular al seguimiento funcional: una base para la rehabilitación cardiorrespiratoria personalizada.**

Proyecto Interdisciplinario (Ingeniería Civil en Biomedicina + Kinesiología). Este repositorio contiene:

1. **Presentación interactiva de avance** (por defecto): portada + 10 diapositivas de contenido + bibliografía, con un modelo trivalvo animado y manipulable.
2. **Dashboard v1** (conservado) en `#/dashboard`: análisis de señales sintéticas y conexión al ESP32.

> ⚠️ Prototipo académico. No es un dispositivo médico ni entrega diagnósticos. Todo dato generado se marca como **SIMULACIÓN**; el panel funcional usa **datos sintéticos, no clínicos**.

---

## Presentación interactiva (entrega 20–21 de octubre)

### Abrir

| Opción | Cómo |
|---|---|
| **Sin internet** | Abrir `entrega/ValveSense_presentacion.html` con doble clic (archivo autocontenido, ~2 MB). |
| **PDF para Canvas** | `entrega/ValveSense_presentacion.pdf` (12 páginas, una diapositiva por página). Regenerarlo tras completar los campos pendientes. |
| **En línea** | https://emiliano1234art.github.io/cardiovalveai/ (GitHub Pages, se actualiza al hacer merge en `main`). |
| **Desarrollo** | `npm install && npm run dev` → http://localhost:5173/cardiovalveai/ |

`npm run build:offline` regenera `entrega/ValveSense_presentacion.html`.

### Controles

| Acción | Botón / tecla |
|---|---|
| Anterior / siguiente | `‹ ›`, flechas ← →, PageUp/PageDown, deslizar en tablet |
| Índice lateral | `☰` o **I** |
| Modo Presentación / Exploración | barra inferior o **E** (Presentación oculta controles secundarios) |
| Notas del expositor | **N** (no se imprimen) |
| Animación completa → reducida → pausa | **A** |
| Pantalla completa | `⛶` o **F** |
| Imprimir / Guardar como PDF | botón `Imprimir / PDF` (diseño de impresión claro, 1 diapositiva por página, estados estáticos representativos y pestañas desplegadas) |
| Enlace directo | `#/s7`, `#/s8`, `#/biblio`… |

### Dónde editar el contenido

**Todo el contenido editable está en `src/presentation/content.ts`**: integrantes, entrevista, dibujo inicial, hallazgos del Toolkit, Carta Gantt, hitos, URL del QR, referencias y notas del expositor. Un texto entre `[corchetes]` es un **campo pendiente** y se muestra resaltado en rosa.

Pendiente de completar con información real del equipo (no se inventó):

- Nombres de integrantes (`META.members`).
- Entrevista al docente (`INTERVIEW`): nombre, cargo, fecha, foto, extracto, observación → implicación → ajuste. Mientras esté pendiente, la diapositiva 6 muestra el guion de preguntas preparado.
- Dibujo inicial a mano (`DRAWING_BEFORE`): copiar la imagen a `public/` y poner su ruta.
- Hallazgos del Toolkit — Encargo 1 (`TOOLKIT_FINDINGS`).
- Carta Gantt — Encargo 2 (`GANTT`): fechas, responsables y estados. Hoy es una **propuesta editable**; solo "Dashboard y presentación" figura *en curso* porque tiene respaldo en el repositorio.
- Referencias marcadas *pendiente de verificación* (DOI de Fritzsche 2007, hoja oficial del MG90S, enlace ESP-IDF).

### Modelo de simulación (fuente única de verdad)

`src/presentation/sim/model.ts` define la cinemática trivalva y las señales; `sim/store.ts` tiene **un solo reloj**. El modelo 3D, el indicador de fase, las ondas de vibración y sonido y los gráficos de límites, derivadas e integrales leen el mismo estado, así que **pausar detiene todo** y cambiar la frecuencia modifica el período en todas partes.

Supuestos documentados:

- Ciclo en fracciones fijas de T: apertura 0–0,15T · abierta hasta 0,40T · cierre hasta 0,52T · cerrada.
- Perfil suave θ = θmín + Δθ·(1 − cos πu)/2 ⇒ ω = Δθ·π/(2D)·sin πu.
- Cada evento (tope de apertura, asiento de cierre) excita una oscilación amortiguada con amplitud ∝ ω máx del tramo (supuesto a validar).
- Condiciones: normal (80°, editable) · limitada a 60° · limitada a 45° · cierre incompleto (12° residuales, separación visible) · asimétrica (valva 3 al 55 % y con retardo 0,05T).
- Ruido de fondo con semilla fija (reproducible). Sin circuito de presión ni flujo.
- Eₓ = ∫x²dt en V²·s (no es energía mecánica en joules); RMS = √(Eₓ/Δt).
- "Diferencia vs. normal" (diapositiva 9) = promedio de diferencias relativas de 4 descriptores: **heurística demostrativa**, no IA entrenada ni diagnóstico.

El ángulo del servo **no** es el ángulo de las valvas: su relación depende del mecanismo de transmisión y requiere calibración.

### Estructura

```
src/presentation/
├── content.ts              ← contenido editable centralizado
├── Presentation.tsx        shell: escenario 16:9, navegación, modos, notas, impresión
├── sim/model.ts            cinemática trivalva + señales sintéticas
├── sim/store.ts            reloj y parámetros únicos
├── geometry/trivalve.ts    geometría compartida 3D / SVG
├── three/                  escena Three.js (rotación, vistas, despiece, etiquetas)
├── components/             gráficos, controles, conexión ESP32, valva SVG
├── slides/                 Portada, S01…S10, Bibliografía
└── styles/presentation.css tema azul noche + tema de impresión
```

La conexión real del dashboard v1 (`src/sources/Esp32WebSocketSource.ts`) se conserva y se usa en la diapositiva 7 (modo Exploración → URL → Conectar). Sin conexión, la diapositiva muestra «Sin conexión al prototipo» y las señales son simulación.

---

# Dashboard v1 (`#/dashboard`)

## 1. Instalación

Requisitos: **Node.js ≥ 20** y npm.

```bash
git clone <repo> && cd cardiovalveai
npm install
```

## 2. Ejecución

```bash
npm run dev        # servidor de desarrollo → http://localhost:5173/cardiovalveai/#/dashboard
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
