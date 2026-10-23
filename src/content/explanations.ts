/**
 * Explicaciones del dashboard en dos niveles.
 * Guía interna de cada texto sencillo (no se muestra): ¿qué vemos?, ¿de dónde
 * vienen los datos?, ¿qué significa que suba o baje?, ¿por qué importa?,
 * ¿cómo se relaciona con CardioValveAI?  Sencilla: 30–60 palabras.
 */
export interface Explanation {
  title: string;
  /** explicación sencilla (cualquier visitante) */
  simple: string;
  /** pistas breves: «fíjate en…» */
  look?: string[];
  /** explicación técnica (estudiantes, profesores, evaluadores) */
  tech: string[];
  /** ecuaciones LaTeX de la explicación técnica */
  math?: string[];
}

export const EXPLAIN = {
  valve3d: {
    title: 'Nuestra válvula experimental',
    simple:
      'Es un modelo a escala de una válvula aórtica de tres valvas. Un pequeño motor las abre y las cierra al ritmo de los latidos, y dos sensores «escuchan» cómo se mueven. Toca los puntos para conocer cada pieza.',
    look: ['Gíralo con el dedo o el mouse.', 'Los puntos numerados explican cada componente.'],
    tech: [
      'Prototipo universitario propuesto: anillo de Ø ≈ 70 mm con tres valvas semilunares a 120° (impresión 3D), un solo servo MG90S con leva, anillo actuador y tres bielas, piezoeléctrico de 12–15 mm integrado en la pared del anillo, micrófono MEMS INMP441 con el puerto orientado a la línea de cierre y ESP32 en la base.',
      'Es una representación del diseño, no una fotografía ni una prótesis implantable: la integración física todavía no está construida. El movimiento por servo es una simulación mecánica y no reproduce las fuerzas de la sangre.',
    ],
  },
  bpm: {
    title: 'Latidos por minuto',
    simple:
      'Este número indica cuántas veces late el corazón en un minuto. Nuestro prototipo puede utilizar ese ritmo para controlar la frecuencia de movimiento de la válvula.',
    look: ['En reposo suele estar entre 60 y 100 lpm.', 'Al hacer ejercicio, sube.'],
    tech: [
      'FC = 60 / RR medio, donde RR es el tiempo (s) entre picos R consecutivos detectados en el ECG.',
      'En simulación el ECG es sintético y la FC programada cambia de forma gradual (≤ 12 lpm/s), como lo haría una FC real.',
    ],
    math: ['\\mathrm{FC}=\\dfrac{60}{\\overline{RR}}\\;[\\mathrm{lpm}]'],
  },
  valveState: {
    title: 'Estado de la válvula',
    simple:
      'Indica si la válvula está abierta o cerrada en este momento. Después de cada latido espera un instante, se abre, permanece abierta y se cierra antes del siguiente latido.',
    tech: [
      'En simulación, la fase sale del modelo: apertura (rampa de 120 ms), abierta (hasta completar D), cierre (rampa de 100 ms) y cerrada.',
      'Con el prototipo real, se estima a partir del ángulo del actuador (abierta si supera el mínimo del ciclo en más de 8°).',
    ],
  },
  ecg: {
    title: 'Latidos del corazón',
    simple:
      'El electrocardiograma registra la actividad eléctrica del corazón. Podemos utilizar sus latidos como referencia para sincronizar el movimiento de nuestra válvula experimental.',
    look: ['Cada pico alto, marcado con «R», es un latido.', 'Las franjas turquesa muestran cuándo la válvula está abierta.', 'Toca el gráfico para explorar un punto.'],
    tech: [
      'El ECG no mide directamente la apertura de la válvula: registra la activación eléctrica. Entre el pico R y el movimiento mecánico existe un retraso electromecánico; en el prototipo es el parámetro τ (100 ms por defecto, configurable).',
      'Los picos R se detectan con un algoritmo inspirado en Pan–Tompkins: derivada → cuadrado → integración en 150 ms → umbral adaptativo con período refractario de 250 ms.',
      'Aquí el ECG es sintético. Un ECG real solo se conectaría mediante un módulo aislado, a batería o inalámbrico; nunca electrodos corporales a un circuito alimentado por USB sin aislamiento.',
    ],
  },
  timing: {
    title: 'Qué pasa en cada latido',
    simple:
      'Esta barra muestra el orden de los acontecimientos: llega el latido (R), la válvula espera un instante, se abre, se mantiene abierta y se cierra antes del próximo latido. El cursor oscuro marca el momento actual.',
    tech: [
      't_apertura = t_R + τ; la apertura dura D desde su inicio y se acota a 0,9·RR − τ − 100 ms para terminar antes del siguiente latido.',
      'Las rampas del servo tienen duración fija (120 ms al abrir, 100 ms al cerrar), por eso un cambio de FC no altera la «firma» mecánica de cada evento.',
    ],
    math: ['t_{\\mathrm{ap}}=t_R+\\tau', 'D_{\\mathrm{ef}}=\\min\\!\\big(D,\\;0{,}9\\,RR-\\tau-T_c\\big)'],
  },
  sync: {
    title: '¿La válvula sigue al corazón?',
    simple:
      'Compara cuánto dura cada ciclo de la válvula con el tiempo entre dos latidos. Si casi no hay diferencia, la válvula se mueve sincronizada con el ritmo del corazón.',
    tech: ['Error de sincronía = |duración del ciclo valvular − RR|. Tolerancia demostrativa: 60 ms.'],
  },
  valveMotion: {
    title: 'La válvula en movimiento',
    simple:
      'Las tres valvas vistas desde la aorta y de lado. Si una condición afecta a una valva, se marca en naranja. Los números resumen cada ciclo: cuánto se abre, cuánto tarda en abrir y cerrar, y qué tan regular es.',
    tech: [
      'Tiempos de apertura y cierre: transición 10 %→90 % (y 90 %→10 %) entre el mínimo y el máximo del ángulo en cada ciclo.',
      'Regularidad con ECG: 100·exp(−(MAD(ciclo − RR)/RR/0,06)^1,5). La variación del RR es fisiológica; lo que importa es que el ciclo siga al RR.',
      'Los ciclos se segmentan con un umbral adaptativo sobre el ángulo (mínimo reciente + 8°), que funciona incluso si la válvula no cierra del todo.',
    ],
  },
  vibration: {
    title: 'Vibración de la válvula',
    simple:
      'Cada vez que la válvula se mueve y sus piezas hacen contacto, produce pequeñas vibraciones. Este sensor las transforma en señales eléctricas que podemos analizar.',
    look: [
      'Los picos muestran los momentos de mayor vibración.',
      'La altura de un pico indica la intensidad registrada.',
      'Una vibración diferente puede indicar que el movimiento mecánico cambió; no significa automáticamente que exista una enfermedad.',
    ],
    tech: [
      'Nombre técnico: señal piezoeléctrica. Sensor de 12–15 mm integrado en la pared del anillo; en el dashboard se muestrea a 1 kHz; amplitud en unidades arbitrarias (depende del montaje y del acondicionamiento).',
      'Descriptores por ciclo: RMS, pico absoluto y energía. Se comparan con la línea basal mediante puntajes z.',
    ],
    math: ['x_{\\mathrm{RMS}}=\\sqrt{\\tfrac{1}{N}\\sum_{n} x_n^2}', 'E=\\int x^2(t)\\,dt\\approx\\sum_n x_n^2\\,\\Delta t'],
  },
  sound: {
    title: 'Sonido de la válvula',
    simple:
      'Al abrirse y cerrarse, una válvula mecánica puede producir pequeños sonidos. Nuestro micrófono registra esos sonidos para estudiar cómo cambia su funcionamiento.',
    look: [
      'Cada onda corta es un «clic» de la válvula.',
      'Si la válvula golpea con más o menos fuerza, o en otro lugar, el clic cambia de volumen o de tono.',
    ],
    tech: [
      'Nombre técnico: análisis acústico. Micrófono MEMS INMP441 (salida digital I²S), 8 kHz en el dashboard; amplitud normalizada a [−1, 1].',
      'Por ciclo: RMS, frecuencia dominante y centroide espectral (PSD de Welch, Hann 512, > 150 Hz). El ruido ambiente también aparece en el micrófono.',
    ],
  },
  spectrogram: {
    title: 'Mapa de sonidos',
    simple:
      'Este gráfico muestra cómo cambian los sonidos con el tiempo. Los colores ayudan a identificar qué frecuencias tienen más energía en cada momento.',
    look: [
      'Horizontal: tiempo. Vertical: tono (grave abajo, agudo arriba).',
      'Una franja vertical oscura es un clic: un sonido breve con muchos tonos a la vez.',
      'Toca una zona para saber qué representa.',
    ],
    tech: ['Nombre técnico: espectrograma (STFT). Ventanas de 256 muestras (32 ms) con salto de 128 (16 ms) a 8 kHz. Color = potencia en dB relativa al máximo reciente (rango 50 dB).'],
    math: ['X(f)=\\sum_{n=0}^{N-1} x_n\\,w_n\\,e^{-i2\\pi f n/f_s}'],
  },
  ai: {
    title: 'Análisis inteligente',
    simple:
      'La inteligencia artificial compara las señales actuales con un patrón de referencia. Si encuentra diferencias importantes, las señala para que podamos investigarlas.',
    look: ['Resultados posibles: patrón similar, cambio de ritmo, cambio detectado o desviación experimental.', 'Reconoce cambios mecánicos; no diagnostica enfermedades.'],
    tech: [
      'Descriptores por evento (energía, pico, tiempos de apertura y cierre, ángulo, frecuencia dominante, centroide) → puntajes z respecto de la línea basal; correlación de las envolventes (0–500 ms desde la apertura, tolerancia ±20 ms); sincronía del ciclo con el RR del ECG.',
      'Índice suavizado (EMA, α = 0,4). Umbrales demostrativos: 0,3 (cambio detectado) y 0,6 (desviación experimental). Si no hay desviación y |FC − FC basal| ≥ 10 lpm, se informa «cambio de ritmo».',
      'Es una heurística experimental a calibrar con datos reales del prototipo. No es un dispositivo médico ni entrega diagnósticos.',
    ],
  },
  similarity: {
    title: '¿Qué tan parecido es al patrón de referencia?',
    simple:
      'Comparamos el funcionamiento actual con un registro experimental obtenido cuando la válvula operaba normalmente. Cuanto más se parecen, mayor es la similitud. No es un indicador de riesgo clínico.',
    tech: ['Nombre técnico: baseline similarity. D es la distancia multivariante de los puntajes z y r la correlación de forma de las envolventes.'],
    math: ['z_k=\\dfrac{x_k-\\mu_k}{\\sigma_k}\\qquad D=\\sqrt{\\tfrac{1}{K}\\sum_k z_k^2}', 'S=100\\,\\big(0{,}62\\,e^{-D^2/24}+0{,}38\\,r\\big)'],
  },
  anomaly: {
    title: 'Cambios detectados',
    simple:
      'Resume en un número de 0 a 1 cuánto cambió la señal respecto del patrón de referencia. Cerca de 0: muy similar. Cerca de 1: muy diferente. Es un indicador técnico del prototipo, no un riesgo clínico.',
    tech: ['Nombre técnico: anomaly score. Combina la distancia de los descriptores (72 %), el error de forma (28 %) y penalizaciones por irregularidad y por falta de sincronía con el ECG. Umbrales demostrativos: 0,3 (cambio) y 0,6 (desviación).'],
  },
  comparison: {
    title: 'Normal vs. ahora',
    simple:
      'La línea gris punteada es la vibración típica de la válvula funcionando normalmente. La línea de color es la actual. Si las dos se separan, algo cambió en el movimiento.',
    tech: ['Envolvente RMS de los primeros 500 ms desde el inicio de la apertura, en tiempo absoluto (no depende de la FC). Promedio de los últimos 4 ciclos frente al promedio de la línea basal.'],
  },
  descriptors: {
    title: '¿Qué cambió?',
    simple:
      'Cada barra muestra cuánto se aleja una característica de la señal respecto de lo normal. Las barras más largas señalan lo que más cambió.',
    tech: ['Puntaje z = (valor − media basal) / dispersión basal (con piso mínimo). Marcas en 2,5σ (cambio) y 4σ (desviación).'],
  },
  patient: {
    title: 'Paciente simulado',
    simple:
      'Un paciente ficticio que hace ejercicio. Sirve para imaginar cómo, en el futuro, los datos de la válvula podrían mirarse junto con la respuesta al ejercicio que estudia Kinesiología. No son datos de una persona real.',
    tech: [
      'FC con un modelo de primer orden que sigue la carga de cada etapa (reposo → calentamiento → ejercicio → enfriamiento → recuperación); SpO₂ y Borg sintéticos.',
      'La integración clínica es una visión futura: no está desarrollada ni validada.',
    ],
  },
  history: {
    title: 'Historial',
    simple:
      'Cada punto es un ciclo de la válvula. Estas líneas muestran cómo cambian las mediciones con el tiempo. También puedes descargar los datos para analizarlos.',
    tech: ['Exportación CSV/JSON con un registro por ciclo (descriptores, FC del ECG, RR, error de sincronía, similitud, índice de diferencia, veredicto, condición y origen). Zonas sombreadas: condición distinta de «Normal».'],
  },
  kinds: {
    title: '¿De dónde vienen los datos?',
    simple:
      'Simulación: datos generados para mostrar cómo funcionaría el sistema. Experimento: datos de los sensores conectados al prototipo. Visión futura: posibles aplicaciones clínicas que todavía no están desarrolladas ni validadas.',
    tech: ['Con el ESP32 desconectado no se muestran valores: el dashboard nunca presenta datos simulados como si vinieran de un sensor real.'],
  },

  // ════════════════ presentación ════════════════
  p_problem: {
    title: '¿Por qué importa?',
    simple:
      'Las personas con una prótesis valvular necesitan controles a lo largo de los años. Hoy se combinan la consulta médica, la auscultación y exámenes como la ecocardiografía. Nosotros exploramos señales complementarias: vibración y sonido de la válvula.',
    look: ['No reemplaza ningún examen clínico.', 'Trabajamos con un modelo experimental, no con pacientes.'],
    tech: [
      'Las guías de enfermedad valvular recomiendan seguimiento clínico y ecocardiográfico periódico de las prótesis (ACC/AHA 2020; ESC/EACTS 2021).',
      'CardioValveAI estudia si las señales mecánicas (piezoeléctrico) y acústicas (MEMS) de un modelo cambian de forma reconocible cuando cambia el movimiento de las valvas. Es investigación de base, no un método diagnóstico.',
    ],
  },
  p_aortic_how: {
    title: '¿Cómo funciona?',
    simple:
      'Cuando el ventrículo izquierdo se contrae, su presión sube. Al superar la presión de la aorta, las tres valvas se abren y la sangre sale. Cuando el ventrículo se relaja, la presión cae, las valvas se juntan en el centro y la sangre no regresa.',
    look: ['Tres valvas semilunares, separadas unos 120°.', 'Es la válvula AÓRTICA, no la tricúspide (que está en el lado derecho del corazón).'],
    tech: [
      'La apertura depende del gradiente de presión entre el ventrículo izquierdo y la aorta: se abre si ΔP > 0 y se cierra cuando el flujo se invierte al final de la eyección.',
      'Las curvas de la animación son ILUSTRATIVAS (teoría fisiológica), construidas para explicar el mecanismo; no son mediciones.',
    ],
    math: ['\\Delta P = P_{VI}-P_{Ao}\\;>\\;0 \\;\\Rightarrow\\; \\text{válvula abierta}'],
  },
  p_no_motor: {
    title: '¿Por qué se mueve sin motores?',
    simple:
      'Una válvula real no tiene motores ni sensores de presión. Sus valvas son pasivas: la sangre las empuja para abrirlas y el reflujo las cierra. En nuestro prototipo usamos un servo para reproducir el movimiento de forma repetible y poder comparar señales.',
    tech: [
      'El servo impone una trayectoria de apertura y cierre; no reproduce las fuerzas hemodinámicas ni la deformación del tejido.',
      'Alternativa futura (no reemplaza la actual): una versión pasiva accionada por un sistema de presión o flujo.',
    ],
  },
  p_proto_how: {
    title: '¿Cómo se mueve?',
    simple:
      'Un solo servomotor gira una leva. La leva sube y baja un anillo actuador y tres bielas transmiten ese movimiento a las tres valvas. Así cada ciclo es igual al anterior y podemos comparar las señales.',
    look: ['Activa «Ver mecanismo» para verlo.', 'Un solo motor, no tres.'],
    tech: [
      'Cadena: servo MG90S → leva → corredera/anillo actuador → tres bielas → tres valvas. Las condiciones alteradas se simulan con topes u holguras en una valva, sin cambiar el comando del servo.',
      'Es una simulación mecánica: no reproduce exactamente las fuerzas hemodinámicas naturales. Torque necesario del servo: por evaluar.',
    ],
  },
  p_ecg_obs: {
    title: '¿Qué estamos observando?',
    simple:
      'Arriba, un electrocardiograma simulado. El sistema detecta cada pico R (un latido) y, después de un pequeño retraso, el motor abre y cierra la válvula. Así la válvula se mueve al ritmo del corazón.',
    look: ['La apertura NO es simultánea al pico R.', 'Cambia la FC y mira cómo se adapta.'],
    tech: [
      'El ECG registra actividad eléctrica: existe un retraso electromecánico antes de la apertura aórtica. En la demostración es el parámetro configurable τ.',
      'Detección del pico R inspirada en Pan–Tompkins (derivada, cuadrado, integración de 150 ms y umbral adaptativo).',
    ],
    math: ['\\mathrm{FC}=\\dfrac{60}{RR}', 't_{\\mathrm{ap}}=t_R+\\tau,\\qquad t_{\\mathrm{cierre}}=t_R+\\tau+D'],
  },
  p_ecg_real: {
    title: '¿Y con un ECG real?',
    simple:
      'Por seguridad, un ECG real solo se tomaría con un módulo aislado y a batería, o con transmisión inalámbrica. Nunca conectaríamos electrodos del cuerpo a un circuito alimentado por USB sin aislamiento.',
    tech: ['Arquitectura propuesta: electrodos → módulo ECG aislado (a batería, certificado para contacto corporal) → enlace inalámbrico → ESP32 → servo. Hoy se usa el modo ECG simulado, que funciona sin hardware.'],
  },
  p_changes_obs: {
    title: '¿Qué estamos observando?',
    simple:
      'A la izquierda, la válvula funcionando como referencia. A la derecha, la misma válvula con un cambio en una de sus valvas. Debajo, sus vibraciones y sonidos: cuando cambia el movimiento, cambian las señales.',
    look: ['La valva afectada aparece en naranja.', 'Prueba cada condición con los botones.'],
    tech: [
      'Condiciones simuladas sobre UNA valva: apertura restringida (tope a 40°), cierre incompleto (12° residuales), movimiento irregular (apertura y retardo variables) y apertura asimétrica (valvas desparejas).',
      'Se comparan descriptores por evento: energía, RMS, frecuencia dominante (FFT), apertura y desfase entre valvas.',
    ],
    math: ['E=\\int x^2(t)\\,dt', 'f_{\\mathrm{dom}}=\\arg\\max_f\\,|X(f)|^2'],
  },
  p_ai_diag: {
    title: '¿Cambio mecánico o enfermedad?',
    simple:
      'Nuestra IA reconoce si las señales se parecen o no al patrón de referencia del prototipo. Eso es detectar un cambio mecánico. Diagnosticar una enfermedad requiere médicos, exámenes validados y aprobación clínica: no es lo que hacemos.',
    tech: ['Resultados posibles: patrón similar, cambio de ritmo, cambio detectado o desviación experimental. Los umbrales son una heurística demostrativa a calibrar con datos reales del prototipo.'],
    math: ['z_k=\\dfrac{x_k-\\mu_k}{\\sigma_k}', 'D=\\sqrt{\\tfrac{1}{K}\\textstyle\\sum_k z_k^2}'],
  },
  p_kine: {
    title: '¿Y Kinesiología?',
    simple:
      'En el futuro, estas señales podrían mirarse junto a cómo responde una persona al ejercicio: frecuencia cardíaca, esfuerzo percibido y recuperación. La idea es apoyar el seguimiento y la rehabilitación cardiorrespiratoria tras un reemplazo valvular.',
    look: ['Los datos del paciente son sintéticos.', 'Las señales de la válvula, simuladas.'],
    tech: ['Variables funcionales elegidas por Kinesiología: FC, SpO₂, esfuerzo percibido (Borg) y recuperación de FC al minuto. La integración clínica es una visión futura: no está desarrollada ni validada.'],
  },
  p_future: {
    title: '¿Qué es real hoy?',
    simple:
      'Hoy tenemos un diseño de prototipo trivalva, la simulación completa, el laboratorio interactivo y la IA experimental. Fabricar el prototipo y medir señales reales es el siguiente paso. Los sensores miniaturizados son solo una idea de investigación.',
    tech: ['No presentamos el modelo 3D como prótesis implantable ni afirmamos haber integrado sensores en prótesis. Cualquier aplicación clínica requeriría desarrollo, validación y aprobación regulatoria.'],
  },
} satisfies Record<string, Explanation>;

export type ExplainId = keyof typeof EXPLAIN;
