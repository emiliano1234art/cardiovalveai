/*
 * Lógica pura del modo «dashboard web» (protocolo JSON por línea, 115200 baudios). Sin dependencias de ESP-IDF:
 * se prueba en el computador con test/test_dash_logic.c.
 *
 *   ESP32 → navegador (50 Hz):  {"t":124500,"deg":45.2,"mode":"SANO","phase":"APERTURA","src":"HALL"}\n
 *   navegador → ESP32:          {"cmd":"SET_MODE","mode":"SANO"}\n | {"cmd":"SET_MODE","mode":"ESTENOSIS"}\n
 *                               {"cmd":"HB"}\n (latido, cada 0,5 s) | {"cmd":"STOP"}\n | {"cmd":"INFO"}\n | {"cmd":"PING"}\n
 *   ESP32 → navegador (eventos): {"evt":"STOP_ESTOP","arg":0}\n   {"txt":"..."}\n   {"info":{...}}\n   {"ack":"..."}\n   {"err":"..."}\n
 */
#pragma once
#include <stddef.h>
#include <stdint.h>
#include <stdbool.h>

/* Cinemática del mecanismo v4 (hardware/v4/kin4.py): θ(β) = PSI0 + atan(R·sen β / A), con β = 90° − comando del servo.
 * Es un MODELO del diseño (CAD): estima el ángulo de las valvas a partir de lo que se le ordena al servo; no es una medición. */
#define DASH_CRANK_R 8.5f      /* radio del pasador de la manivela (mm) */
#define DASH_TAIL_A  6.5f      /* distancia eje de bisagra → pasador de la horquilla (mm) */
#define DASH_PSI0    40.0f     /* inclinación de la cola con las valvas cerradas (°) */

/* Modo estenosis: apertura máxima de las valvas (°). El límite de diseño del modo patológico es 35°. */
#define DASH_STEN_THETA_MAX 32.0f

typedef enum { DASH_MODE_SANO = 0, DASH_MODE_ESTENOSIS = 1 } dash_mode_t;

typedef enum {
    DASH_CMD_NONE = 0,    /* línea vacía o que no es un objeto JSON */
    DASH_CMD_SET_MODE,
    DASH_CMD_HB,
    DASH_CMD_STOP,
    DASH_CMD_INFO,
    DASH_CMD_PING,
    DASH_CMD_BAD_MODE,    /* SET_MODE con un modo que no existe o sin modo */
    DASH_CMD_UNKNOWN      /* JSON válido con un comando desconocido o sin "cmd" */
} dash_cmd_kind_t;

typedef struct {
    dash_cmd_kind_t kind;
    dash_mode_t mode;     /* válido si kind == DASH_CMD_SET_MODE */
} dash_cmd_t;

float dash_theta_from_cmd(float cmd_deg);      /* comando del servo (°) → ángulo estimado de las valvas (°) */
float dash_cmd_from_theta(float theta_deg);    /* inversa: comando del servo que da ese ángulo de valvas */
const char *dash_mode_name(dash_mode_t m);     /* "SANO" | "ESTENOSIS" */
const char *dash_phase_name(int servo_phase);  /* sv_phase_t → "APERTURA", "MESETA SISTOLICA", "CIERRE", "DIASTOLE", "REPOSO", "AJUSTE" */
const char *dash_event_name(int ev_code);      /* código de evento → nombre; NULL si no se informa al dashboard */

dash_cmd_t dash_parse_command(const char *line);

/* Escribe la línea de telemetría (con '\n'). Devuelve el largo, o -1 si no cabe. */
int dash_format_telemetry(char *buf, size_t n, uint32_t t_ms, float deg, dash_mode_t mode, int servo_phase, bool from_hall);
/* Escapa una cadena para ponerla dentro de comillas JSON. Devuelve el largo, o -1 si no cabe. */
int dash_json_escape(char *dst, size_t n, const char *src);
