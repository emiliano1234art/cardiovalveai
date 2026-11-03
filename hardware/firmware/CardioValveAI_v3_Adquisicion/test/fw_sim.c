/*
 * Simulador del firmware en modo dashboard para el computador (NO es el firmware: es un modelo para probar el dashboard).
 *   - Usa el dash_logic.c REAL (lectura de comandos, formato de la telemetría, cinemática, fases, nombres de eventos).
 *   - El servo sigue el perfil de main/servo.c: DWELL_CLOSED → OPENING → DWELL_OPEN → CLOSING, parada controlada en 800 ms y
 *     parada por falta de latido a los 2 s, con los tiempos por omisión del firmware (400/300/400/900 ms).
 *   - La lógica de dash.c (apply_mode, SET_MODE inicia el movimiento, HB, STOP) está replicada aquí.
 * Lee comandos por stdin (líneas) y escribe la telemetría por stdout a 50 Hz.   Uso: fw_sim [--hall]   (--hall: src "HALL")
 */
#define _POSIX_C_SOURCE 200809L
#include <math.h>
#include <poll.h>
#include <stdio.h>
#include <string.h>
#include <time.h>
#include <unistd.h>
#include "dash_logic.h"
#include "servo.h"

static double now_ms(void) { struct timespec t; clock_gettime(CLOCK_MONOTONIC, &t); return t.tv_sec * 1000.0 + t.tv_nsec / 1e6; }
static float smooth(float u) { return 0.5f - 0.5f * cosf(3.14159265f * u); }

static servo_cfg_t cfg = { .cmd_closed = 130.0f, .cmd_open = 50.0f, .cmd_min = 45.0f, .cmd_max = 135.0f,
                           .t_open_ms = 400, .t_dwell_open_ms = 300, .t_close_ms = 400, .t_dwell_closed_ms = 900, .hb_timeout_ms = 2000 };
static sv_phase_t ph = SV_DETACHED;
static float s_cmd = 130.0f, from_c, to_c, open_sano;
static double t0, dur = 1, last_hb;
static bool start_req, stop_req, attached, use_hall;
static int stop_reason;
static dash_mode_t mode = DASH_MODE_SANO;

static void evt(int code, long arg)
{
    const char *n = dash_event_name(code);
    if (n) { printf("{\"evt\":\"%s\",\"arg\":%ld}\n", n, arg); fflush(stdout); }
}

static void apply_mode(dash_mode_t m)
{
    float o = (m == DASH_MODE_ESTENOSIS) ? dash_cmd_from_theta(DASH_STEN_THETA_MAX) : open_sano;
    if (o < cfg.cmd_min) o = cfg.cmd_min;
    if (o > cfg.cmd_max) o = cfg.cmd_max;
    cfg.cmd_open = o;
    mode = m;
}

static void handle_line(const char *line)
{
    const dash_cmd_t c = dash_parse_command(line);
    switch (c.kind) {
    case DASH_CMD_SET_MODE: {
        apply_mode(c.mode);
        last_hb = now_ms();
        const bool running = ph >= SV_OPENING && ph <= SV_MOVING;
        if (!running) start_req = true;
        break;
    }
    case DASH_CMD_HB:   last_hb = now_ms(); break;
    case DASH_CMD_STOP: stop_req = true; stop_reason = 10; break;
    case DASH_CMD_PING: puts("{\"ack\":\"PING\"}"); break;
    case DASH_CMD_INFO: printf("{\"info\":{\"fw\":\"fw_sim\",\"mode\":\"%s\"}}\n", dash_mode_name(mode)); break;
    case DASH_CMD_BAD_MODE: puts("{\"err\":\"modo desconocido: use SANO o ESTENOSIS\"}"); break;
    case DASH_CMD_UNKNOWN:  puts("{\"err\":\"comando desconocido\"}"); break;
    default: break;
    }
    fflush(stdout);
}

static void servo_tick(double now)
{
    const bool running = ph >= SV_OPENING && ph <= SV_MOVING;
    if (running && now - last_hb > cfg.hb_timeout_ms) { stop_req = true; stop_reason = 12; }
    if (stop_req) {
        stop_req = false; start_req = false; evt(stop_reason, 0);
        if (attached) { from_c = s_cmd; to_c = cfg.cmd_closed; t0 = now; dur = 800; ph = SV_STOPPING; }
        else ph = SV_DETACHED;
    }
    if (start_req && (ph == SV_IDLE || ph == SV_DETACHED)) {
        start_req = false; evt(8, 0);
        attached = true; s_cmd = cfg.cmd_closed; ph = SV_DWELL_CLOSED; t0 = now; dur = cfg.t_dwell_closed_ms;
    }
    float u = dur > 0 ? (float)((now - t0) / dur) : 1.0f;
    if (u > 1.0f) u = 1.0f;
    if (ph == SV_OPENING || ph == SV_CLOSING || ph == SV_STOPPING) s_cmd = from_c + (to_c - from_c) * smooth(u);
    if (u >= 1.0f) {
        switch (ph) {
        case SV_DWELL_CLOSED: ph = SV_OPENING; from_c = s_cmd; to_c = cfg.cmd_open; t0 = now; dur = cfg.t_open_ms; break;
        case SV_OPENING:      ph = SV_DWELL_OPEN; t0 = now; dur = cfg.t_dwell_open_ms; break;
        case SV_DWELL_OPEN:   ph = SV_CLOSING; from_c = s_cmd; to_c = cfg.cmd_closed; t0 = now; dur = cfg.t_close_ms; break;
        case SV_CLOSING:      ph = SV_DWELL_CLOSED; t0 = now; dur = cfg.t_dwell_closed_ms; break;
        case SV_STOPPING:     ph = SV_DETACHED; attached = false; evt(15, stop_reason); break;
        default: break;
        }
    }
}

int main(int argc, char **argv)
{
    use_hall = argc > 1 && !strcmp(argv[1], "--hall");
    open_sano = cfg.cmd_open;
    apply_mode(DASH_MODE_SANO);
    last_hb = now_ms();
    setvbuf(stdout, NULL, _IOLBF, 0);
    printf("{\"info\":{\"fw\":\"fw_sim\",\"baud\":115200,\"hz\":50,\"mode\":\"SANO\",\"cal\":[%d,%d,%d],\"open_sano\":%.1f,\"open_estenosis\":%.1f}}\n",
           use_hall, use_hall, use_hall, (double)open_sano, (double)dash_cmd_from_theta(DASH_STEN_THETA_MAX));
    char buf[256]; size_t n = 0;
    double next_tel = now_ms();
    for (;;) {
        struct pollfd p = { 0, POLLIN, 0 };
        if (poll(&p, 1, 5) > 0) {
            char ch;
            ssize_t r = read(0, &ch, 1);
            if (r == 0) return 0;                       /* el dashboard cerró el puerto */
            if (r == 1) {
                if (ch == '\n') { buf[n] = 0; handle_line(buf); n = 0; }
                else if (n < sizeof buf - 1) buf[n++] = ch;
                else n = 0;
            }
        }
        const double now = now_ms();
        servo_tick(now);
        if (now >= next_tel) {
            next_tel += 20;
            if (next_tel < now) next_tel = now + 20;
            char line[160];
            const int k = dash_format_telemetry(line, sizeof line, (uint32_t)now, dash_theta_from_cmd(s_cmd), mode, ph, use_hall);
            if (k > 0) { fwrite(line, 1, (size_t)k, stdout); fflush(stdout); }
        }
    }
}
