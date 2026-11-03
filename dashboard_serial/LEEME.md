# Dashboard serial de CardioValveAI

Un solo archivo (`index.html`, copia en `entrega/CardioValveAI_Dashboard_Serial.html`) que se comunica con el ESP32 por USB desde Chrome o Edge de escritorio.
Prototipo académico de banco: no es un dispositivo médico ni entrega diagnósticos.

## 1. Abrir el archivo como pestaña de Google Chrome

Cualquiera de estas formas sirve (no necesita servidor):

1. **Abrir archivo:** en Chrome pulsa `Ctrl + O` (Windows/Linux) o `Cmd + O` (Mac) y elige `CardioValveAI_Dashboard_Serial.html`.
2. **Arrastrar:** arrastra el archivo desde el explorador de archivos hasta la ventana de Chrome.
3. **Doble clic:** si Chrome es tu navegador predeterminado, basta con hacer doble clic en el archivo.
4. **Escribir la ruta:** pega en la barra de direcciones `file:///` seguido de la ruta del archivo, por ejemplo `file:///C:/Users/tu_usuario/Descargas/CardioValveAI_Dashboard_Serial.html` (Windows) o `file:///Users/tu_usuario/Descargas/CardioValveAI_Dashboard_Serial.html` (Mac).

Consejos:
- Debe ser **Chrome o Edge de escritorio**. No funciona en Safari, Firefox ni en el celular.
- Necesita internet solo para cargar el diseño (Tailwind, Chart.js y la tipografía); la comunicación con el ESP32 es local.
- Para dejarlo siempre a mano: con la pestaña abierta, menú ⋮ → *Guardar y compartir* → *Crear acceso directo…* (marca «Abrir como ventana»), o ancla la pestaña con clic derecho → *Fijar*.

## 2. Conectar

1. Conecta el ESP32 por USB. **Cierra antes cualquier otro programa que use el puerto** (monitor serial de Arduino/PlatformIO, `cvai_record.py`, etc.): solo uno puede usarlo a la vez.
2. Pulsa **Conectar Hardware**, elige el puerto (Mac: `cu.usbserial-…`; Windows: `COMx`) y acepta.
3. Al abrirse el puerto, muchas placas ESP32 se reinician: es normal. Aparece «Conectado» y empieza la telemetría.
4. Pulsa **Modo Fisiológico (Sano)** o **Modo Patológico (Estenosis)**: el servo empieza a ciclar. El «Modo activo» que se muestra es el que **informa el ESP32**.
5. **Detener movimiento** detiene el servo. Si cierras la pestaña o se cuelga el navegador, el firmware lo detiene solo a los ~2 s (el panel envía un «latido» cada 0,5 s).
6. Sin hardware: **Modo demostración** genera datos simulados (con un aviso permanente de que no son del prototipo).

Antes de mover el servo por primera vez: deja el mecanismo cerrado a mano (el primer pulso lo lleva a la posición cerrada desde donde esté) y ten a mano la parada de emergencia física (GPIO23).

## 3. Firmware: dos modos

El firmware (`hardware/firmware/CardioValveAI_v3_Adquisicion`) tiene ahora dos modos que **no pueden usarse a la vez**:

| | Modo binario (por omisión) | Modo dashboard (nuevo) |
|---|---|---|
| Uso | herramientas de Mac: registro, **calibración con galgas**, análisis | este dashboard |
| Puerto | 921600 baudios, tramas binarias | 115200 baudios, JSON por línea |
| Micrófono | se inicia | no se inicia (el prototipo v4 no lo lleva) |

Compilar y cargar (con ESP-IDF v5.4.x instalado, según la guía de Espressif):

```sh
cd hardware/firmware/CardioValveAI_v3_Adquisicion
# Modo dashboard
idf.py -D SDKCONFIG_DEFAULTS="sdkconfig.defaults;sdkconfig.dashboard" set-target esp32
idf.py build
idf.py -p /dev/cu.usbserial-XXXX flash       # no uses 'monitor': el puerto lleva datos JSON de 50 Hz

# Para volver al modo binario (calibrar, registrar)
idf.py set-target esp32                       # regenera la configuración desde sdkconfig.defaults
idf.py build && idf.py -p /dev/cu.usbserial-XXXX flash
```

(También se puede activar con `idf.py menuconfig` → *CardioValveAI* → *Modo dashboard web*.)

### Qué ángulo muestra el dashboard (importante)

- **Medido** (`"src":"HALL"`): promedio de los 3 sensores Hall, solo si **los tres tienen calibración válida** guardada en el ESP32. El panel lo indica: «● Medido…».
- **Estimado** (`"src":"CMD"`): sin calibración, el ángulo se calcula con el modelo del CAD a partir del comando que se le da al servo. **No es una medición** (no incluye juegos, holguras ni atascos). El panel lo indica: «○ Estimado… (no es una medición)».

Orden recomendado: (1) cargar el firmware **binario**; (2) calibrar cada valva con las galgas (`hardware/host/cvai_calibrate.py`, ver `5_Sensores_Hall_y_Calibracion.md`) y subir la calibración; (3) cargar el firmware **dashboard**. La calibración queda en la memoria NVS del ESP32 y sobrevive a cargar otro programa (no uses `erase-flash`).

### Modos

- **Sano:** apertura de diseño, hasta ~80° (comando del servo 50°).
- **Estenosis:** apertura restringida a **32°** (comando ≈ 96,2°), por debajo del límite de 35°. Se calcula con la misma cinemática del CAD (`hardware/v4/kin4.py`).
- El cambio de modo rige desde el **ciclo siguiente**. Los tiempos del ciclo son los del firmware (0,4 s abre, 0,3 s meseta, 0,4 s cierra, 0,9 s diástole ≈ 2 s por ciclo).

## 4. Protocolo (por si quieres adaptar otro firmware)

ESP32 → navegador, ~50 Hz, un JSON por línea terminada en `\n`, 115200 baudios:

```json
{"t":124500,"deg":45.2,"mode":"SANO","phase":"APERTURA","src":"HALL"}
```
`phase`: `APERTURA`, `MESETA SISTOLICA`, `CIERRE`, `DIASTOLE` (con o sin tilde) o `REPOSO`. `src` es opcional.

Navegador → ESP32: `{"cmd":"SET_MODE","mode":"SANO"}`, `{"cmd":"SET_MODE","mode":"ESTENOSIS"}`, `{"cmd":"HB"}` (latido cada 0,5 s), `{"cmd":"STOP"}`.

Avisos del ESP32 (se muestran en el panel y se anotan en el registro): `{"evt":"STOP_ESTOP","arg":0}`, `{"err":"…"}`, `{"txt":"…"}`, `{"info":{…}}`, `{"ack":"…"}`.

## 5. Qué se probó y qué no

Probado en este entorno (Chromium real con un puerto serial simulado):
- **Lógica del firmware** (`dash_logic.c`: cinemática, fases, formato JSON, lectura de comandos mal formados): 106 comprobaciones en el computador con detectores de errores de memoria (`hardware/firmware/CardioValveAI_v3_Adquisicion/test/run_tests.sh`).
- **Dashboard + esa misma lógica** (`test/fw_sim.c`: simula el servo con el perfil de `servo.c`): modos, ciclo completo, detención, parada por falta de latido, avisos de error, fuente de la señal (68 comprobaciones del navegador).

**No probado:**
- El firmware **no se compiló con ESP-IDF** en este entorno (la instalación del compilador fue bloqueada por una regla de seguridad). Solo se revisó la sintaxis del código nuevo contra cabeceras de reemplazo. **El primer `idf.py build` en tu computador puede mostrar errores de compilación.**
- Nada se probó con un **ESP32 real**, un servo ni los sensores Hall, ni con Chrome de escritorio con un puerto USB real.
