/*
 * Control NO bloqueante del servo MG90S (LEDC 50 Hz, 16 bits → 0,305 µs por paso).
 * Una tarea periódica (5 ms, vTaskDelayUntil) calcula el comando según un perfil coseno
 * cerrado → abierto → espera → cerrado → espera. Ninguna parte usa delay() bloqueante en el lazo de adquisición.
 *
 * Notas de sincronización (documentadas para el análisis):
 *  - El nuevo ancho de pulso se aplica en el PRÓXIMO período PWM: retardo 0–20 ms entre el sello del comando
 *    y el pulso real. Más el retardo interno del servo. Por eso la posición REAL se mide con los sensores Hall.
 *  - Seguridad: límites duros de comando; parada de emergencia (GPIO23) corta los pulsos de inmediato;
 *    sin latido de la computadora → parada controlada; falta de movimiento de las valvas (Hall) → parada;
 *    con calibración válida, ángulo medido fuera de [lim_min, lim_max] → parada.
 *  - El mecanismo NO tiene topes que el servo empuje en modo normal: el rango de comando está limitado a la
 *    carrera calculada (±β alrededor de 90°).
 */
#include <math.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "driver/ledc.h"
#include "driver/gpio.h"
#include "esp_timer.h"
#include "servo.h"
#include "proto.h"
#include "acq.h"
#include "board_pins.h"
#include "cal.h"

#define PERIOD_MS   5
#define LEDC_RES    LEDC_TIMER_16_BIT
#define LEDC_MAXD   ((1u << 16) - 1)

servo_cfg_t g_servo_cfg = {
    .cmd_closed = 130.0f, .cmd_open = 50.0f, .cmd_min = 45.0f, .cmd_max = 135.0f,
    .us_at_0 = 500, .us_at_180 = 2500,
    .t_open_ms = 400, .t_dwell_open_ms = 300, .t_close_ms = 400, .t_dwell_closed_ms = 900,
    .cycles = 20, .hb_timeout_ms = 2000, .stall_min_delta = 200,
    .lim_min_deg = -8.0f, .lim_max_deg = 86.0f, .sync_pulse_ms = 30,
};

static volatile sv_phase_t s_phase = SV_DETACHED;
static volatile float s_cmd = 130.0f;
static volatile bool s_attached;
static volatile bool s_stop_req, s_start_req, s_move_req;
static volatile int s_stop_reason;
static volatile uint32_t s_req_cycles, s_cycle;
static volatile float s_move_to;
static volatile uint32_t s_move_ms;
static volatile int64_t s_last_hb;
static volatile bool s_estop;
static bool s_start_after_move;

static uint32_t deg_to_duty(float deg, uint16_t *us_out)
{
    const servo_cfg_t *c = &g_servo_cfg;
    if (deg < c->cmd_min) deg = c->cmd_min;
    if (deg > c->cmd_max) deg = c->cmd_max;
    float us = c->us_at_0 + (c->us_at_180 - c->us_at_0) * deg / 180.0f;
    if (us_out) *us_out = (uint16_t)lroundf(us);
    return (uint32_t)lroundf(us / 20000.0f * LEDC_MAXD);
}

static void apply(float deg)
{
    uint16_t us;
    uint32_t d = deg_to_duty(deg, &us);
    ledc_set_duty(LEDC_LOW_SPEED_MODE, LEDC_CHANNEL_0, d);
    ledc_update_duty(LEDC_LOW_SPEED_MODE, LEDC_CHANNEL_0);
    if (!s_attached) {
        s_attached = true;
        proto_event(EV_SERVO_ATTACHED, (int32_t)lroundf(deg * 100));
    }
}

void servo_detach(int reason_event)
{
    ledc_stop(LEDC_LOW_SPEED_MODE, LEDC_CHANNEL_0, 0);   /* sin pulsos: el MG90S deja de hacer fuerza */
    if (s_attached) {
        s_attached = false;
        proto_event(EV_SERVO_DETACHED, reason_event);
    }
    s_phase = SV_DETACHED;
}

static void estop_isr(void *arg)
{
    ledc_stop(LEDC_LOW_SPEED_MODE, LEDC_CHANNEL_0, 0);   /* corte inmediato de pulsos (función apta para ISR) */
    s_estop = true;          /* la tarea del servo registra el evento y bloquea nuevos movimientos */
}

bool servo_estop_active(void) { return s_estop || gpio_get_level(PIN_ESTOP) == 0; }

static float smooth(float u) { return 0.5f - 0.5f * cosf((float)M_PI * u); }

static void send_cmd(int64_t t, float deg)
{
    uint16_t us;
    deg_to_duty(deg, &us);
    struct __attribute__((packed)) { int64_t t; int16_t deg_x100; uint16_t us; uint8_t phase; uint32_t cycle; } m =
        { t, (int16_t)lroundf(deg * 100), us, (uint8_t)s_phase, s_cycle };
    _Static_assert(sizeof m == 17, "CMD = 17 bytes (cvai_proto.CMD)");
    if (g_acq.streaming) proto_send(FR_CMD, &m, sizeof m);
}

static void sync_led(bool on)
{
    gpio_set_level(PIN_SYNC_LED, on);
    proto_event(on ? EV_SYNC_LED_ON : EV_SYNC_LED_OFF, (int32_t)s_cycle);
}

static void reset_track(uint16_t *mn, uint16_t *mx)
{
    for (int k = 0; k < N_HALL; k++) { mn[k] = mx[k] = g_acq.hall_last[k]; }
}

/* Falta de movimiento: NINGUNA de las tres valvas varió al menos min_delta cuentas durante el movimiento comandado.
 * (Una sola valva trabada con las otras moviéndose se detecta en el análisis por ciclo, no aquí.) */
static bool no_motion(const uint16_t *mn, const uint16_t *mx, uint16_t min_delta)
{
    if (min_delta == 0) return false;
    for (int k = 0; k < N_HALL; k++) { if ((uint16_t)(mx[k] - mn[k]) >= min_delta) return false; }
    return true;
}

static void servo_task(void *arg)
{
    TickType_t wake = xTaskGetTickCount();
    float from = s_cmd, to = s_cmd;
    int64_t t0 = 0;
    uint32_t dur = 1;
    int64_t sync_off_t = 0;
    uint16_t hmin[N_HALL], hmax[N_HALL];
    for (int k = 0; k < N_HALL; k++) { hmin[k] = 0xFFFF; hmax[k] = 0; }
    bool estop_reported = false;

    for (;;) {
        vTaskDelayUntil(&wake, pdMS_TO_TICKS(PERIOD_MS));
        const int64_t now = esp_timer_get_time();
        const servo_cfg_t *c = &g_servo_cfg;

        /* 1) seguridad: parada de emergencia física */
        if (servo_estop_active()) {
            if (s_phase != SV_DETACHED || s_attached) { servo_detach(EV_STOP_ESTOP); proto_event(EV_STOP_ESTOP, 0); }
            estop_reported = true;
            s_start_req = s_move_req = false;
            if (gpio_get_level(PIN_ESTOP) == 1) { s_estop = false; }
            continue;
        } else if (estop_reported) {
            estop_reported = false;
            proto_event(EV_ESTOP_RELEASED, 0);
        }
        /* 2) límites de ángulo MEDIDO (solo si la calibración del sensor es válida) */
        if (s_attached) {
            for (int k = 0; k < N_HALL; k++) {
                float a;
                if (cal_angle(k, g_acq.hall_last[k], &a) && (a < c->lim_min_deg || a > c->lim_max_deg)) {
                    servo_detach(EV_STOP_LIMIT); proto_event(EV_STOP_LIMIT, (k + 1) * 1000 + (int32_t)lroundf(a));
                    break;
                }
            }
            if (!s_attached) continue;
        }
        /* 3) latido de la computadora */
        const bool running = s_phase >= SV_OPENING && s_phase <= SV_MOVING;
        if (running && now - s_last_hb > (int64_t)c->hb_timeout_ms * 1000) {
            s_stop_req = true; s_stop_reason = EV_STOP_HEARTBEAT;
        }
        /* 4) pedidos */
        if (s_stop_req) {
            s_stop_req = false;
            proto_event(s_stop_reason, 0);
            if (s_attached) {   /* parada controlada: vuelve a cerrado en 800 ms y luego corta pulsos */
                from = s_cmd; to = c->cmd_closed; t0 = now; dur = 800; s_phase = SV_STOPPING;
            } else {
                servo_detach(s_stop_reason);
            }
            s_start_req = s_move_req = false;
        }
        if (s_move_req && (s_phase == SV_IDLE || s_phase == SV_DETACHED)) {
            s_move_req = false;
            from = s_attached ? s_cmd : c->cmd_closed; to = s_move_to; t0 = now; dur = s_move_ms ? s_move_ms : 1;
            s_phase = SV_MOVING;
        }
        if (s_start_req && (s_phase == SV_IDLE || s_phase == SV_DETACHED)) {
            /* Si el servo estaba sin pulsos, su posición es desconocida: el primer pulso lo lleva a cerrado
             * desde donde esté. Procedimiento: dejar el mecanismo cerrado a mano antes de START. */
            s_start_req = false;
            s_cycle = 0;
            proto_event(EV_RUN_START, (int32_t)s_req_cycles);
            if (s_attached) { from = s_cmd; to = c->cmd_closed; t0 = now; dur = 600; s_phase = SV_MOVING; s_start_after_move = true; }
            else { s_cmd = c->cmd_closed; s_phase = SV_DWELL_CLOSED; t0 = now; dur = c->t_dwell_closed_ms; }
        }
        /* 5) perfil */
        float u = dur ? (float)(now - t0) / (dur * 1000.0f) : 1.0f;
        if (u > 1.0f) u = 1.0f;
        switch (s_phase) {
        case SV_OPENING: case SV_CLOSING: case SV_MOVING: case SV_STOPPING:
            s_cmd = from + (to - from) * smooth(u);
            break;
        default:
            break;
        }
        if (s_phase != SV_DETACHED && s_phase != SV_IDLE) apply(s_cmd);
        /* seguimiento de las 3 valvas durante los movimientos (falta de movimiento = mecanismo detenido) */
        for (int k = 0; k < N_HALL; k++) {
            uint16_t v = g_acq.hall_last[k];
            if (v < hmin[k]) hmin[k] = v;
            if (v > hmax[k]) hmax[k] = v;
        }
        if (u >= 1.0f) {
            switch (s_phase) {
            case SV_OPENING:
                proto_event(EV_OPEN_CMD_END, (int32_t)s_cycle);
                if (no_motion(hmin, hmax, c->stall_min_delta)) { s_stop_req = true; s_stop_reason = EV_STOP_STALL; }
                s_phase = SV_DWELL_OPEN; t0 = now; dur = c->t_dwell_open_ms;
                break;
            case SV_DWELL_OPEN:
                s_phase = SV_CLOSING; from = s_cmd; to = c->cmd_closed; t0 = now; dur = c->t_close_ms;
                reset_track(hmin, hmax);
                proto_event(EV_CLOSE_CMD_START, (int32_t)s_cycle);
                break;
            case SV_CLOSING:
                proto_event(EV_CLOSE_CMD_END, (int32_t)s_cycle);
                if (no_motion(hmin, hmax, c->stall_min_delta)) { s_stop_req = true; s_stop_reason = EV_STOP_STALL; }
                s_cycle++;
                s_phase = SV_DWELL_CLOSED; t0 = now; dur = c->t_dwell_closed_ms;
                break;
            case SV_DWELL_CLOSED:
                if (s_req_cycles && s_cycle >= s_req_cycles) {
                    proto_event(EV_RUN_END, (int32_t)s_cycle);
                    s_phase = SV_IDLE;
                    break;
                }
                proto_event(EV_CYCLE_START, (int32_t)s_cycle);
                sync_led(true); sync_off_t = now + (int64_t)c->sync_pulse_ms * 1000;
                s_phase = SV_OPENING; from = s_cmd; to = c->cmd_open; t0 = now; dur = c->t_open_ms;
                reset_track(hmin, hmax);
                proto_event(EV_OPEN_CMD_START, (int32_t)s_cycle);
                break;
            case SV_MOVING:
                if (s_start_after_move) { s_start_after_move = false; s_phase = SV_DWELL_CLOSED; t0 = now; dur = c->t_dwell_closed_ms; }
                else { s_phase = SV_IDLE; }
                break;
            case SV_STOPPING:
                servo_detach(s_stop_reason);
                break;
            default:
                break;
            }
        }
        if (sync_off_t && now >= sync_off_t) { sync_led(false); sync_off_t = 0; }
        if (s_phase != SV_DETACHED) send_cmd(now, s_cmd);
    }
}

void servo_init(void)
{
    ledc_timer_config_t tc = { .speed_mode = LEDC_LOW_SPEED_MODE, .duty_resolution = LEDC_RES, .timer_num = LEDC_TIMER_0,
                               .freq_hz = 50, .clk_cfg = LEDC_AUTO_CLK };
    ESP_ERROR_CHECK(ledc_timer_config(&tc));
    ledc_channel_config_t cc = { .gpio_num = PIN_SERVO, .speed_mode = LEDC_LOW_SPEED_MODE, .channel = LEDC_CHANNEL_0,
                                 .timer_sel = LEDC_TIMER_0, .duty = 0, .hpoint = 0 };
    ESP_ERROR_CHECK(ledc_channel_config(&cc));
    ledc_stop(LEDC_LOW_SPEED_MODE, LEDC_CHANNEL_0, 0);     /* arranca SIN pulsos: el servo no se mueve al encender */

    gpio_config_t out = { .pin_bit_mask = (1ULL << PIN_SYNC_LED) | (1ULL << PIN_STATUS), .mode = GPIO_MODE_OUTPUT };
    ESP_ERROR_CHECK(gpio_config(&out));
    gpio_set_level(PIN_SYNC_LED, 0);
    gpio_config_t in = { .pin_bit_mask = 1ULL << PIN_ESTOP, .mode = GPIO_MODE_INPUT, .pull_up_en = GPIO_PULLUP_ENABLE,
                         .intr_type = GPIO_INTR_NEGEDGE };
    ESP_ERROR_CHECK(gpio_config(&in));
    ESP_ERROR_CHECK(gpio_install_isr_service(0));
    ESP_ERROR_CHECK(gpio_isr_handler_add(PIN_ESTOP, estop_isr, NULL));
    s_last_hb = esp_timer_get_time();
    xTaskCreatePinnedToCore(servo_task, "servo", 4096, NULL, 8, NULL, 0);
}

bool servo_start(uint32_t cycles)
{
    if (servo_estop_active()) return false;
    s_req_cycles = cycles;
    s_last_hb = esp_timer_get_time();
    s_start_req = true;
    return true;
}

bool servo_move(float deg, uint32_t ms)
{
    if (servo_estop_active()) return false;
    if (deg < g_servo_cfg.cmd_min || deg > g_servo_cfg.cmd_max) return false;
    s_move_to = deg; s_move_ms = ms;
    s_last_hb = esp_timer_get_time();
    s_move_req = true;
    return true;
}

void servo_stop(int reason_event) { s_stop_reason = reason_event; s_stop_req = true; }
void servo_heartbeat(void) { s_last_hb = esp_timer_get_time(); }
sv_phase_t servo_phase(void) { return s_phase; }
float servo_cmd_now(void) { return s_cmd; }
uint32_t servo_cycle(void) { return s_cycle; }
