/*
  CardioValve AI — firmware ESP32
  ---------------------------------------------------------------
  Servo MG90S  -> GPIO 18   (rojo = +5V externo, café = GND común)
  Hall 1       -> GPIO 34   (VCC = 3V3)
  Hall 2       -> GPIO 35   (VCC = 3V3)
  Hall 3       -> GPIO 32   (VCC = 3V3)

  La comunicación con el dashboard es SOLO por el cable USB (Web Serial).
  No usa WiFi ni Bluetooth.

  Librería necesaria: ESP32Servo  (Administrar bibliotecas -> "ESP32Servo")
  Velocidad del Monitor Serie / dashboard: 115200 baudios.

  Comandos que entiende (una línea de texto cada uno):
    MODE:SANO          válvula normal      (servo abre ANGULO_NORMAL)
    MODE:INCOMPLETA    válvula incompleta  (servo abre ANGULO_INCOMPLETA)
    START / STOP       el servo NO se mueve al encender: parte con START y se detiene con STOP
    HB                 latido del dashboard (si deja de llegar, el servo se detiene)
    CAL_ZERO           re-mide el valor neutro de los Hall (válvula cerrada y quieta)
    CAL_CURVE          calibración automática (~30 s): el servo recorre todo su rango y el
                       ESP32 aprende qué leen los Hall en cada ángulo. Se guarda en la memoria
                       y desde entonces los Hall miden el ángulo real de la válvula.
*/

#include <ESP32Servo.h>
#include <Preferences.h>
#include <math.h>
#include <string.h>

// ───────────────────────── Pines ─────────────────────────
const int PIN_SERVO = 18;
const int PIN_HALL[3] = {34, 35, 32};

// ───────── Servo: calibración que ya comprobaste ─────────
// 500 µs  = 0°   (posición vertical de partida)
// 2500 µs = 180° (media vuelta completa)
const int US_0   = 500;
const int US_180 = 2500;

// ───────── Ángulos de apertura de cada modo (en grados del servo) ─────────
// Normal = media vuelta completa. Si el servo choca con la estructura, baja a 170.
// Si cambias ANGULO_NORMAL hay que volver a hacer CAL_CURVE.
const float ANGULO_NORMAL     = 180.0;
const float ANGULO_INCOMPLETA = 80.0;

// ───────── Tiempos de cada fase del ciclo (ms) ─────────
// Lentos a propósito: el MG90S se mueve fluido y sin perder fuerza.
// Para acelerar, baja los valores.
struct Perfil {
  float angulo;
  unsigned long tSubida, tMeseta, tBajada, tDiastole;
};
Perfil PERFIL_NORMAL     = {ANGULO_NORMAL,     1800, 400, 1500, 1200};
Perfil PERFIL_INCOMPLETA = {ANGULO_INCOMPLETA, 1300, 300, 1200, 1200};

// ───────── Sensores Hall ─────────
// Posición angular aproximada (°) de cada sensor. Solo se usa mientras NO hay curva
// calibrada (después de CAL_CURVE el ángulo se mide con la curva aprendida).
float HALL_POS_DEG[3] = {45.0, 90.0, 135.0};
const int   HALL_ZONA_MUERTA = 40;    // cuentas ADC que se ignoran (ruido)
float       hallEscala[3]    = {600, 600, 600}; // cuentas con el imán pegado (CAL_CURVE las ajusta)

// ───────── Curva de calibración: lectura de cada Hall en cada ángulo ─────────
const int N_BINS = 19;                // puntos entre 0° y ANGULO_NORMAL
float curva[N_BINS][3];               // desviación (con signo) de cada Hall en cada punto
bool curvaLista = false;
Preferences prefs;
struct CurvaGuardada { uint32_t magia; float angulo; float curva[N_BINS][3]; float escala[3]; };
const uint32_t MAGIA = 0xCA2D10A1;

// ───────── Estado ─────────
enum Fase { APERTURA, MESETA, CIERRE, DIASTOLE };
Fase fase = DIASTOLE;
bool modoNormal = true;
bool sistemaActivo = false;   // el servo espera en 0° hasta recibir START desde el dashboard
unsigned long tInicioFase = 0;
unsigned long ciclo = 0;
float anguloServo = 0.0;

Servo servo;

float hallNeutro[3] = {2048, 2048, 2048};
float hallFiltrado[3] = {2048, 2048, 2048};
float hallW[3] = {0, 0, 0};
float hallGrados = 0.0;

// Estado de la calibración automática
bool calActiva = false;
enum CalFase { CAL_MOVER, CAL_ESPERAR, CAL_PROMEDIAR, CAL_VOLVER };
CalFase calFase = CAL_MOVER;
int calBin = 0;
unsigned long calT = 0;
float calDesde = 0;
float calAcc[3] = {0, 0, 0};
int calN = 0;
float spanMax[3] = {0, 0, 0};
const unsigned long CAL_MOVER_MS = 700, CAL_ESPERAR_MS = 500, CAL_PROMEDIAR_MS = 400, CAL_VOLVER_MS = 1800;

unsigned long tUltimoEnvio = 0;
const unsigned long INTERVALO_TELEMETRIA = 40;   // 25 Hz
unsigned long tUltimoLatido = 0;
const unsigned long TIMEOUT_LATIDO = 5000;

// ───────── Utilidades ─────────
int anguloAMicros(float angulo) {
  return US_0 + (int)((US_180 - US_0) * (angulo / 180.0) + 0.5);
}

void moverServo(float angulo) {
  if (angulo < 0) angulo = 0;
  if (angulo > 180) angulo = 180;
  anguloServo = angulo;
  servo.writeMicroseconds(anguloAMicros(angulo));
}

// Curva suave de 5º orden: arranca y frena sin tirones
float suavizar(float t) {
  if (t < 0) t = 0;
  if (t > 1) t = 1;
  return t * t * t * (t * (t * 6 - 15) + 10);
}

float interpolar(float desde, float hasta, unsigned long t, unsigned long dur) {
  if (dur == 0) return hasta;
  return desde + (hasta - desde) * suavizar((float)t / (float)dur);
}

const char* nombreFase() {
  if (calActiva) return "CALIBRANDO";
  if (!sistemaActivo) return "PAUSA";
  switch (fase) {
    case APERTURA: return "APERTURA";
    case MESETA:   return "MESETA";
    case CIERRE:   return "CIERRE";
    default:       return "DIASTOLE";
  }
}

// ───────── Hall ─────────
int leerAdc(int pin) {
  long s = 0;
  for (int i = 0; i < 4; i++) s += analogRead(pin);
  return (int)(s / 4);
}

void calibrarNeutro() {
  // Mantén los imanes LEJOS de los sensores mientras se mide
  double acc[3] = {0, 0, 0};
  const int N = 64;
  for (int i = 0; i < N; i++) {
    for (int k = 0; k < 3; k++) acc[k] += leerAdc(PIN_HALL[k]);
    delay(5);
  }
  for (int k = 0; k < 3; k++) {
    hallNeutro[k] = acc[k] / N;
    hallFiltrado[k] = hallNeutro[k];
  }
}

float suavizado01(float a, float b, float x) {
  float t = (x - a) / (b - a);
  if (t < 0) t = 0;
  if (t > 1) t = 1;
  return t * t * (3 - 2 * t);
}

float anguloBin(int k) { return ANGULO_NORMAL * k / (N_BINS - 1); }

// Estima el ángulo buscando el punto de la curva aprendida más parecido a lo que leen los Hall.
float estimarAngulo(const float d[3]) {
  float mejor = 1e30f, ang = 0;
  for (int k = 0; k < N_BINS - 1; k++) {
    float ab[3], ad[3], den = 0, num = 0;
    for (int j = 0; j < 3; j++) {
      ab[j] = curva[k + 1][j] - curva[k][j];
      ad[j] = d[j] - curva[k][j];
      den += ab[j] * ab[j];
      num += ad[j] * ab[j];
    }
    float t = den > 1e-6f ? num / den : 0;
    if (t < 0) t = 0;
    if (t > 1) t = 1;
    float dist2 = 0;
    for (int j = 0; j < 3; j++) {
      float e = ad[j] - t * ab[j];
      dist2 += e * e;
    }
    if (dist2 < mejor) {
      mejor = dist2;
      ang = anguloBin(k) + t * (anguloBin(k + 1) - anguloBin(k));
    }
  }
  return ang;
}

void guardarCurva() {
  CurvaGuardada g;
  g.magia = MAGIA;
  g.angulo = ANGULO_NORMAL;
  memcpy(g.curva, curva, sizeof(curva));
  memcpy(g.escala, hallEscala, sizeof(g.escala));
  prefs.begin("cardio", false);
  prefs.putBytes("curva", &g, sizeof(g));
  prefs.end();
}

void cargarCurva() {
  CurvaGuardada g;
  prefs.begin("cardio", false);
  size_t n = prefs.getBytes("curva", &g, sizeof(g));
  prefs.end();
  if (n == sizeof(g) && g.magia == MAGIA && fabsf(g.angulo - ANGULO_NORMAL) < 0.5f) {
    memcpy(curva, g.curva, sizeof(curva));
    memcpy(hallEscala, g.escala, sizeof(hallEscala));
    curvaLista = true;
  }
}

// Convierte las lecturas de los Hall en un ángulo.
void actualizarHall() {
  float totalW = 0, sumaPos = 0, d[3];
  for (int k = 0; k < 3; k++) {
    hallFiltrado[k] += 0.35f * (leerAdc(PIN_HALL[k]) - hallFiltrado[k]);
    d[k] = hallFiltrado[k] - hallNeutro[k];
    float dev = fabsf(d[k]);

    if (calActiva && dev > spanMax[k]) spanMax[k] = dev;

    float w = (dev - HALL_ZONA_MUERTA) / (hallEscala[k] - HALL_ZONA_MUERTA);
    if (w < 0) w = 0;
    if (w > 1) w = 1;
    hallW[k] = w;
    totalW += w;
    sumaPos += w * HALL_POS_DEG[k];
  }

  if (curvaLista) {
    // Medición real: ángulo de la curva aprendida que mejor coincide con los Hall
    hallGrados += 0.3f * (estimarAngulo(d) - hallGrados);
  } else if (totalW < 0.05f) {
    hallGrados = 0.0;
  } else {
    // Aproximación mientras no hay curva: promedio ponderado de la posición de los sensores
    hallGrados = (sumaPos / totalW) * suavizado01(0.05f, 0.4f, totalW);
  }
}

// ───────── Calibración automática de la curva (CAL_CURVE) ─────────
void iniciarCalibracion() {
  sistemaActivo = false;
  calActiva = true;
  curvaLista = false;
  calBin = 0;
  calFase = CAL_MOVER;
  calT = millis();
  calDesde = anguloServo;
  for (int k = 0; k < 3; k++) spanMax[k] = 0;
  Serial.println("{\"info\":\"CAL_CURVE: el servo se moverá solo unos 30 s\"}");
}

void terminarCalibracion() {
  calActiva = false;
  // ¿Los sensores cambiaron lo suficiente al mover la válvula?
  float spread = 0;
  for (int k = 0; k < N_BINS; k++) {
    float dist2 = 0;
    for (int j = 0; j < 3; j++) {
      float e = curva[k][j] - curva[0][j];
      dist2 += e * e;
    }
    if (dist2 > spread) spread = dist2;
  }
  if (sqrtf(spread) < 120.0f) {
    cargarCurva();   // vuelve a la curva guardada antes, si había una
    Serial.println("{\"info\":\"CAL_CURVE falló: los Hall casi no cambian al mover la válvula\"}");
    return;
  }
  for (int k = 0; k < 3; k++)
    if (spanMax[k] > 150) hallEscala[k] = spanMax[k] * 0.9f;
  curvaLista = true;
  guardarCurva();
  Serial.println("{\"info\":\"CAL_CURVE listo\"}");
}

void actualizarCalibracion() {
  unsigned long t = millis() - calT;
  float destino = anguloBin(calBin);
  switch (calFase) {
    case CAL_MOVER:
      if (t < CAL_MOVER_MS) moverServo(interpolar(calDesde, destino, t, CAL_MOVER_MS));
      else { moverServo(destino); calFase = CAL_ESPERAR; calT = millis(); }
      break;
    case CAL_ESPERAR:
      if (t >= CAL_ESPERAR_MS) {
        calFase = CAL_PROMEDIAR;
        calT = millis();
        calN = 0;
        for (int k = 0; k < 3; k++) calAcc[k] = 0;
      }
      break;
    case CAL_PROMEDIAR:
      for (int k = 0; k < 3; k++) calAcc[k] += hallFiltrado[k] - hallNeutro[k];
      calN++;
      if (t >= CAL_PROMEDIAR_MS) {
        for (int k = 0; k < 3; k++) curva[calBin][k] = calAcc[k] / calN;
        calBin++;
        calDesde = anguloServo;
        calT = millis();
        calFase = (calBin >= N_BINS) ? CAL_VOLVER : CAL_MOVER;
      }
      break;
    case CAL_VOLVER:
      if (t < CAL_VOLVER_MS) moverServo(interpolar(calDesde, 0, t, CAL_VOLVER_MS));
      else { moverServo(0); terminarCalibracion(); }
      break;
  }
}

// ───────── Servo: máquina de fases ─────────
void actualizarServo() {
  if (tUltimoLatido != 0 && millis() - tUltimoLatido > TIMEOUT_LATIDO) sistemaActivo = false;

  if (!sistemaActivo) {
    // Vuelve despacio a 0° (vertical) y se queda ahí
    if (anguloServo > 0.2f) moverServo(anguloServo - 0.6f);
    else moverServo(0);
    return;
  }

  const Perfil &p = modoNormal ? PERFIL_NORMAL : PERFIL_INCOMPLETA;
  unsigned long t = millis() - tInicioFase;

  switch (fase) {
    case APERTURA:
      if (t < p.tSubida) moverServo(interpolar(0, p.angulo, t, p.tSubida));
      else { moverServo(p.angulo); fase = MESETA; tInicioFase = millis(); }
      break;
    case MESETA:
      if (t >= p.tMeseta) { fase = CIERRE; tInicioFase = millis(); }
      break;
    case CIERRE:
      if (t < p.tBajada) moverServo(interpolar(p.angulo, 0, t, p.tBajada));
      else { moverServo(0); fase = DIASTOLE; tInicioFase = millis(); }
      break;
    case DIASTOLE:
      if (t >= p.tDiastole) { fase = APERTURA; tInicioFase = millis(); ciclo++; }
      break;
  }
}

// ───────── Comandos ─────────
void enviarHello();

void procesarComando(String s) {
  s.trim();
  s.toUpperCase();
  if (s.length() == 0) return;

  if (s == "HB") { tUltimoLatido = millis(); return; }

  if (s == "MODE:SANO" || s == "SANO") {
    modoNormal = true;
  } else if (s == "MODE:INCOMPLETA" || s == "INCOMPLETA" || s == "ESTENOSIS" || s == "MODE:ESTENOSIS") {
    modoNormal = false;
  } else if (s == "STOP") {
    sistemaActivo = false;
    if (calActiva) {          // cancela la calibración y recupera la curva guardada
      calActiva = false;
      cargarCurva();
      Serial.println("{\"info\":\"CAL_CURVE cancelada\"}");
    }
  } else if (s == "START") {
    if (calActiva) return;
    sistemaActivo = true;
    fase = DIASTOLE;
    tInicioFase = millis();
  } else if (s == "CAL_ZERO") {
    if (calActiva) return;
    calibrarNeutro();
    Serial.println("{\"info\":\"CAL_ZERO listo\"}");
  } else if (s == "CAL_CURVE") {
    if (!calActiva) iniciarCalibracion();
  } else if (s == "HELLO") {
    enviarHello();
  }
}

void leerSerial() {
  static String buf;
  while (Serial.available() > 0) {
    char c = (char)Serial.read();
    if (c == '\n' || c == '\r') {
      if (buf.length() > 0) procesarComando(buf);
      buf = "";
    } else if (buf.length() < 64) {
      buf += c;
    }
  }
}

// ───────── Telemetría ─────────
void enviarHello() {
  Serial.print("{\"hello\":1,\"fw\":\"1.1\",\"normal\":");
  Serial.print(ANGULO_NORMAL, 1);
  Serial.print(",\"incompleta\":");
  Serial.print(ANGULO_INCOMPLETA, 1);
  Serial.println("}");
}

void enviarTelemetria() {
  unsigned long ahora = millis();
  if (ahora - tUltimoEnvio < INTERVALO_TELEMETRIA) return;
  tUltimoEnvio = ahora;

  Serial.print("{\"t\":");   Serial.print(ahora);
  Serial.print(",\"sv\":");  Serial.print(anguloServo, 1);
  Serial.print(",\"h\":[");
  for (int k = 0; k < 3; k++) { Serial.print((int)hallFiltrado[k]); if (k < 2) Serial.print(","); }
  Serial.print("],\"w\":[");
  for (int k = 0; k < 3; k++) { Serial.print(hallW[k], 2); if (k < 2) Serial.print(","); }
  Serial.print("],\"hd\":"); Serial.print(hallGrados, 1);
  Serial.print(",\"m\":\""); Serial.print(modoNormal ? "SANO" : "INCOMPLETA");
  Serial.print("\",\"f\":\""); Serial.print(nombreFase());
  Serial.print("\",\"c\":"); Serial.print(ciclo);
  Serial.print(",\"on\":"); Serial.print(sistemaActivo ? 1 : 0);
  Serial.print(",\"cv\":"); Serial.print(curvaLista ? 1 : 0);
  Serial.print(",\"cp\":"); Serial.print(calActiva ? (calBin * 100) / N_BINS : 100);
  Serial.println("}");
}

// ───────── Arduino ─────────
void setup() {
  Serial.begin(115200);

  analogReadResolution(12);          // 0..4095
  analogSetAttenuation(ADC_11db);    // rango ~0..3,3 V
  for (int k = 0; k < 3; k++) pinMode(PIN_HALL[k], INPUT);

  servo.setPeriodHertz(50);
  servo.attach(PIN_SERVO, US_0, US_180);
  moverServo(0);                     // parte en 0° (vertical), sin dar un salto
  delay(1500);

  calibrarNeutro();                  // válvula cerrada y quieta al encender
  cargarCurva();                     // recupera la calibración guardada (si existe)
  tInicioFase = millis();
  enviarHello();
}

void loop() {
  leerSerial();
  actualizarHall();
  if (calActiva) actualizarCalibracion();
  else actualizarServo();
  enviarTelemetria();
  delay(10);                         // ~100 Hz de lazo; el servo se actualiza cada ~10 ms
}
