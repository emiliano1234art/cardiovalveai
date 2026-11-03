/*
 * Modo dashboard web: telemetría JSON a 50 Hz y comandos SET_MODE / HB / STOP.
 *
 * Seguridad (se conserva todo lo del firmware de adquisición):
 *   - El movimiento solo empieza cuando llega un SET_MODE (acción explícita del usuario en el dashboard).
 *   - El dashboard envía {"cmd":"HB"} cada 0,5 s; sin latido durante hb_timeout_ms (2 s) el servo hace una parada controlada.
 *   - La parada de emergencia física (GPIO23), los límites de ángulo medido y la detección de falta de movimiento siguen activos.
 *
 * Ángulo publicado ("deg"): promedio de las 3 valvas medido con los Hall SI las tres tienen calibración válida y su lectura cae
 * dentro del rango calibrado ("src":"HALL"). Si no, es el ángulo que el modelo del CAD asocia al comando del servo ("src":"CMD"):
 * una estimación de lo que se ordenó, NO una medición.
 */
#include "dash.h"
#include <stdio.h>
#include <string.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_timer.h"
#include "proto.h"
#include "acq.h"
#include "cal.h"
#include "servo.h"
#include "dash_logic.h"

#define TELEMETRY_PERIOD_MS 20          /* 50 Hz */

static volatile dash_mode_t s_mode = DASH_MODE_SANO;
static float s_open_sano;               /* comando de apertura del modo sano (el de fábrica del firmware) */

static void put_line(const char *s)
{
    proto_write_line(s, strlen(s));
}

void dash_text(const char *msg)
{
    char esc[256], out[300];
    if (dash_json_escape(esc, sizeof esc, msg) < 0) return;
    int n = snprintf(out, sizeof out, "{\"txt\":\"%s\"}\n", esc);
    if (n > 0 && n < (int)sizeof out) put_line(out);
}

void dash_event(uint8_t ev_code, int32_t arg)
{
    const char *name = dash_event_name(ev_code);
    if (!name) return;
    char out[96];
    int n = snprintf(out, sizeof out, "{\"evt\":\"%s\",\"arg\":%ld}\n", name, (long)arg);
    if (n > 0 && n < (int)sizeof out) put_line(out);
}

static void put_err(const char *msg)
{
    char esc[128], out[160];
    if (dash_json_escape(esc, sizeof esc, msg) < 0) return;
    int n = snprintf(out, sizeof out, "{\"err\":\"%s\"}\n", esc);
    if (n > 0 && n < (int)sizeof out) put_line(out);
}

static void send_hello(void)
{
    char out[200];
    const uint8_t m = cal_valid_mask();
    int n = snprintf(out, sizeof out,
                     "{\"info\":{\"fw\":\"CardioValveAI dashboard JSON\",\"baud\":115200,\"hz\":%d,\"mode\":\"%s\",\"cal\":[%d,%d,%d],\"open_sano\":%.1f,\"open_estenosis\":%.1f}}\n",
                     1000 / TELEMETRY_PERIOD_MS, dash_mode_name(s_mode), m & 1, (m >> 1) & 1, (m >> 2) & 1,
                     (double)s_open_sano, (double)dash_cmd_from_theta(DASH_STEN_THETA_MAX));
    if (n > 0 && n < (int)sizeof out) put_line(out);
}

/* Ángulo medido: promedio de los 3 Hall calibrados. Falso si falta calibración o alguna lectura sale del rango calibrado. */
static bool hall_angle(float *deg)
{
    float sum = 0;
    for (int k = 0; k < N_HALL; k++) {
        float a;
        if (!cal_angle(k, g_acq.hall_last[k], &a)) return false;
        sum += a;
    }
    *deg = sum / N_HALL;
    return true;
}

static void apply_mode(dash_mode_t m)
{
    servo_cfg_t *c = &g_servo_cfg;
    float open = (m == DASH_MODE_ESTENOSIS) ? dash_cmd_from_theta(DASH_STEN_THETA_MAX) : s_open_sano;
    if (open < c->cmd_min) open = c->cmd_min;
    if (open > c->cmd_max) open = c->cmd_max;
    c->cmd_open = open;          /* el servo lo lee al empezar cada apertura: el cambio rige desde el ciclo siguiente */
    s_mode = m;
}

void dash_handle_line(const char *line)
{
    const dash_cmd_t c = dash_parse_command(line);
    switch (c.kind) {
    case DASH_CMD_SET_MODE: {
        apply_mode(c.mode);
        servo_heartbeat();
        const sv_phase_t ph = servo_phase();
        const bool running = ph >= SV_OPENING && ph <= SV_MOVING;
        if (!running && !servo_start(0)) { put_err("parada de emergencia activa: no se inicia el movimiento"); }
        break;
    }
    case DASH_CMD_HB:   servo_heartbeat(); break;
    case DASH_CMD_STOP: servo_stop(EV_STOP_USER); break;
    case DASH_CMD_INFO: send_hello(); break;
    case DASH_CMD_PING: put_line("{\"ack\":\"PING\"}\n"); break;
    case DASH_CMD_BAD_MODE: put_err("modo desconocido: use SANO o ESTENOSIS"); break;
    case DASH_CMD_UNKNOWN:  put_err("comando desconocido"); break;
    case DASH_CMD_NONE:
    default: break;
    }
}

static void dash_task(void *arg)
{
    TickType_t wake = xTaskGetTickCount();
    char line[160];
    for (;;) {
        vTaskDelayUntil(&wake, pdMS_TO_TICKS(TELEMETRY_PERIOD_MS));
        float deg;
        const bool from_hall = hall_angle(&deg);
        if (!from_hall) deg = dash_theta_from_cmd(servo_cmd_now());
        const int n = dash_format_telemetry(line, sizeof line, (uint32_t)(esp_timer_get_time() / 1000), deg, s_mode, servo_phase(), from_hall);
        if (n > 0) proto_write_line(line, (size_t)n);
    }
}

void dash_start(void)
{
    s_open_sano = g_servo_cfg.cmd_open;
    apply_mode(DASH_MODE_SANO);
    vTaskDelay(pdMS_TO_TICKS(300));      /* deja que la tarea del ADC deje listas las primeras lecturas */
    send_hello();
    xTaskCreatePinnedToCore(dash_task, "dash", 4096, NULL, 5, NULL, 0);
}
