/*
 * Comandos de texto (una línea por comando, terminada en '\n'). Respuesta: trama TEXT "OK ..." o "ERR ...".
 *   PING                         → OK PONG
 *   HB                           → latido (sin respuesta). La computadora lo envía cada 0,5 s.
 *   INFO                         → reenvía la trama INFO (JSON)
 *   STREAM ON|OFF                → habilita/inhabilita el envío de datos
 *   START <ciclos>               → ciclos de apertura/cierre con el perfil configurado (0 = hasta STOP)
 *   STOP                         → parada controlada (vuelve a cerrado y corta pulsos)
 *   DETACH                       → corte inmediato de pulsos
 *   MOVE <grados> <ms>           → movimiento manual (calibración); limitado a [cmd_min, cmd_max]
 *   SET <clave> <valor>          → claves: closed open min max us0 us180 t_open t_dwell_open t_close t_dwell_closed
 *                                  hb_ms stall oc_ma oc_ms audio(dec8k|full16k) audio_shift
 *   GET                          → configuración actual (en la trama INFO)
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <strings.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "driver/uart.h"
#include "esp_idf_version.h"
#include "cmd.h"
#include "proto.h"
#include "servo.h"
#include "acq.h"
#include "ina219.h"

#define FW_VERSION "CardioValAI_v2_Adquisicion 2.0.0"
extern int g_baud;

void send_info(void)
{
    static char js[1400];
    int mv[17] = { 0 };
    int nc = acq_adc_cali_table(mv);
    const servo_cfg_t *c = &g_servo_cfg;
    int n = snprintf(js, sizeof js,
        "{\"fw\":\"%s\",\"proto\":%d,\"idf\":\"%s\",\"build\":\"%s %s\",\"baud\":%d,"
        "\"adc\":{\"total_rate\":%d,\"pattern\":[\"P1\",\"H1\",\"P2\",\"H2\",\"P1\",\"H3\",\"P2\",\"H0\"],\"atten_db\":12,\"bits\":12,"
        "\"fast_rate\":%d,\"fast_fir_delay_us\":%d,\"hall_rate\":%d,\"hall_sum_of\":%d,\"skew_p1_p2_us\":31.25,"
        "\"cali_scheme\":\"%s\",\"cali_raw_step\":256,\"cali_mv\":[",
        FW_VERSION, PROTO_VERSION, esp_get_idf_version(), __DATE__, __TIME__, g_baud,
        ADC_TOTAL_RATE, FAST_OUT_RATE, (15 * 1000000) / FAST_IN_RATE, HALL_OUT_RATE, HALL_DECIM, acq_adc_cali_scheme());
    for (int k = 0; k < nc && n < (int)sizeof js - 32; k++) {
        n += snprintf(js + n, sizeof js - n, "%s%d", k ? "," : "", mv[k]);
    }
    n += snprintf(js + n, sizeof js - n,
        "]},\"audio\":{\"in_rate\":%d,\"out_rate\":%d,\"shift\":%d,\"slot\":%d},"
        "\"servo\":{\"closed\":%.2f,\"open\":%.2f,\"min\":%.2f,\"max\":%.2f,\"us0\":%u,\"us180\":%u,\"t_open\":%lu,\"t_dwell_open\":%lu,"
        "\"t_close\":%lu,\"t_dwell_closed\":%lu,\"hb_ms\":%lu,\"stall\":%u,\"oc_ma\":%u,\"oc_ms\":%u,\"pwm_hz\":50,\"update_ms\":5},"
        "\"ina219\":%s}",
        AUDIO_IN_RATE, g_acq.audio_full ? AUDIO_IN_RATE : AUDIO_IN_RATE / 2, g_acq.audio_shift, g_acq.audio_slot,
        c->cmd_closed, c->cmd_open, c->cmd_min, c->cmd_max, c->us_at_0, c->us_at_180,
        (unsigned long)c->t_open_ms, (unsigned long)c->t_dwell_open_ms, (unsigned long)c->t_close_ms, (unsigned long)c->t_dwell_closed_ms,
        (unsigned long)c->hb_timeout_ms, c->stall_min_delta, c->overcurrent_ma, c->overcurrent_ms, ina219_present() ? "true" : "false");
    if (n > 0 && n < (int)sizeof js) {
        proto_send(FR_INFO, js, (uint16_t)n);
    }
}

static bool set_key(const char *k, const char *v)
{
    servo_cfg_t *c = &g_servo_cfg;
    float f = strtof(v, NULL);
    unsigned long u = strtoul(v, NULL, 10);
    const bool idle = servo_phase() == SV_IDLE || servo_phase() == SV_DETACHED;
    if (!strcasecmp(k, "audio")) {
        bool full = !strcasecmp(v, "full16k");
        if (full && g_baud < 1500000) { proto_text("ERR audio full16k requiere >= 1500000 baudios"); return false; }
        g_acq.audio_full = full; return true;
    }
    if (!strcasecmp(k, "audio_shift")) { if (u > 12) return false; g_acq.audio_shift = (uint8_t)u; return true; }
    if (!idle) { proto_text("ERR cambiar parametros del servo solo detenido"); return false; }
    if (!strcasecmp(k, "closed")) { if (f < c->cmd_min || f > c->cmd_max) return false; c->cmd_closed = f; }
    else if (!strcasecmp(k, "open")) { if (f < c->cmd_min || f > c->cmd_max) return false; c->cmd_open = f; }
    else if (!strcasecmp(k, "min")) { if (f < 0 || f > 180) return false; c->cmd_min = f; }
    else if (!strcasecmp(k, "max")) { if (f < 0 || f > 180) return false; c->cmd_max = f; }
    else if (!strcasecmp(k, "us0")) { if (u < 400 || u > 1000) return false; c->us_at_0 = u; }
    else if (!strcasecmp(k, "us180")) { if (u < 2000 || u > 2700) return false; c->us_at_180 = u; }
    else if (!strcasecmp(k, "t_open")) { if (u < 50 || u > 10000) return false; c->t_open_ms = u; }
    else if (!strcasecmp(k, "t_dwell_open")) { if (u > 10000) return false; c->t_dwell_open_ms = u; }
    else if (!strcasecmp(k, "t_close")) { if (u < 50 || u > 10000) return false; c->t_close_ms = u; }
    else if (!strcasecmp(k, "t_dwell_closed")) { if (u < 100 || u > 10000) return false; c->t_dwell_closed_ms = u; }
    else if (!strcasecmp(k, "hb_ms")) { if (u < 500 || u > 10000) return false; c->hb_timeout_ms = u; }
    else if (!strcasecmp(k, "stall")) { if (u > 30000) return false; c->stall_min_delta = u; }
    else if (!strcasecmp(k, "oc_ma")) { if (u < 100 || u > 3000) return false; c->overcurrent_ma = u; }
    else if (!strcasecmp(k, "oc_ms")) { if (u < 20 || u > 5000) return false; c->overcurrent_ms = u; }
    else return false;
    return true;
}

static void handle(char *line)
{
    char *save = NULL;
    char *w = strtok_r(line, " \t\r", &save);
    if (!w) return;
    char *a1 = strtok_r(NULL, " \t\r", &save);
    char *a2 = strtok_r(NULL, " \t\r", &save);
    if (!strcasecmp(w, "HB")) { servo_heartbeat(); return; }
    if (!strcasecmp(w, "PING")) { proto_text("OK PONG"); return; }
    if (!strcasecmp(w, "INFO") || !strcasecmp(w, "GET")) { send_info(); return; }
    if (!strcasecmp(w, "STREAM")) { g_acq.streaming = a1 && !strcasecmp(a1, "ON"); proto_text("OK STREAM %s", g_acq.streaming ? "ON" : "OFF"); return; }
    if (!strcasecmp(w, "START")) {
        uint32_t n = a1 ? strtoul(a1, NULL, 10) : g_servo_cfg.cycles;
        proto_text(servo_start(n) ? "OK START %lu" : "ERR parada de emergencia activa (%lu)", (unsigned long)n);
        return;
    }
    if (!strcasecmp(w, "STOP")) { servo_stop(EV_STOP_USER); proto_text("OK STOP"); return; }
    if (!strcasecmp(w, "DETACH")) { servo_detach(EV_STOP_USER); proto_text("OK DETACH"); return; }
    if (!strcasecmp(w, "MOVE") && a1) {
        float d = strtof(a1, NULL);
        uint32_t ms = a2 ? strtoul(a2, NULL, 10) : 500;
        proto_text(servo_move(d, ms) ? "OK MOVE %.2f %lu" : "ERR MOVE %.2f %lu (fuera de rango, en marcha o parada activa)", d, (unsigned long)ms);
        return;
    }
    if (!strcasecmp(w, "SET") && a1 && a2) {
        if (set_key(a1, a2)) { proto_text("OK SET %s %s", a1, a2); send_info(); }
        else { proto_text("ERR SET %s %s", a1, a2); }
        return;
    }
    proto_text("ERR comando desconocido: %s", w);
}

static void cmd_task(void *arg)
{
    char line[96];
    int n = 0;
    for (;;) {
        uint8_t ch;
        if (uart_read_bytes(UART_NUM_0, &ch, 1, pdMS_TO_TICKS(100)) != 1) continue;
        if (ch == '\n') {
            line[n] = 0;
            handle(line);
            n = 0;
        } else if (n < (int)sizeof line - 1) {
            line[n++] = (char)ch;
        } else {
            n = 0;   /* línea demasiado larga: se descarta */
        }
    }
}

void cmd_start(void)
{
    xTaskCreatePinnedToCore(cmd_task, "cmd", 4096, NULL, 4, NULL, 0);
}
