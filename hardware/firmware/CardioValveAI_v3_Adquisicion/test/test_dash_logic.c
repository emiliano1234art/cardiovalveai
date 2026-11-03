/*
 * Prueba en el computador de main/dash_logic.c (sin ESP-IDF).   Uso:  ./run_tests.sh
 * Verifica: cinemática (contra los valores del CAD v4), nombres de fase y evento, formato de la telemetría,
 * lectura de comandos (incluidos casos mal formados) y escape JSON.
 */
#include <math.h>
#include <stdio.h>
#include <string.h>
#include "dash_logic.h"
#include "servo.h"

static int fails, total;
#define CHECK(cond, ...) do { total++; if (!(cond)) { fails++; printf("FALLA línea %d: ", __LINE__); printf(__VA_ARGS__); printf("\n"); } } while (0)
#define NEAR(a, b, tol) (fabsf((a) - (b)) <= (tol))

static dash_cmd_t P(const char *s) { return dash_parse_command(s); }

int main(void)
{
    /* ── cinemática: valores de hardware/v4 (kin4.py / verify.json: θ = −0,0° … 80,0° para comando 130° … 50°) ── */
    CHECK(NEAR(dash_theta_from_cmd(130.0f), 0.0f, 0.2f), "θ(130°)=%.3f", dash_theta_from_cmd(130.0f));
    CHECK(NEAR(dash_theta_from_cmd(50.0f), 80.0f, 0.2f), "θ(50°)=%.3f", dash_theta_from_cmd(50.0f));
    CHECK(NEAR(dash_theta_from_cmd(90.0f), 40.0f, 0.01f), "θ(90°)=%.3f (centro del recorrido)", dash_theta_from_cmd(90.0f));
    CHECK(NEAR(dash_theta_from_cmd(0.0f), 92.6f, 0.1f), "θ(0°)=%.3f (extremo del servo: valvas abiertas del todo, 92,6°)", dash_theta_from_cmd(0.0f));
    CHECK(NEAR(dash_theta_from_cmd(180.0f), -12.6f, 0.1f), "θ(180°)=%.3f (extremo del servo: posición de montaje, −12,6°)", dash_theta_from_cmd(180.0f));
    for (float th = -10.0f; th <= 90.0f; th += 2.5f) {
        const float back = dash_theta_from_cmd(dash_cmd_from_theta(th));
        CHECK(NEAR(back, th, 0.02f), "ida y vuelta θ=%.1f → %.3f", th, back);
    }
    const float open_sten = dash_cmd_from_theta(DASH_STEN_THETA_MAX);
    CHECK(NEAR(dash_theta_from_cmd(open_sten), 32.0f, 0.02f), "θ del modo estenosis");
    CHECK(open_sten > 90.0f && open_sten < 100.0f, "comando de apertura en estenosis = %.2f° (debe estar dentro de 45…135°)", open_sten);
    CHECK(NEAR(open_sten, 96.17f, 0.05f), "comando de apertura en estenosis = %.3f (esperado 96,17)", open_sten);
    CHECK(open_sten >= 45.0f && open_sten <= 135.0f, "dentro de los límites duros del firmware cmd_min/cmd_max");
    CHECK(dash_theta_from_cmd(dash_cmd_from_theta(500.0f)) < 200.0f, "entrada absurda no produce NaN");
    CHECK(!isnan(dash_cmd_from_theta(-500.0f)), "entrada absurda (tan) no produce NaN");

    /* ── fases y eventos ── */
    CHECK(!strcmp(dash_phase_name(SV_OPENING), "APERTURA"), "APERTURA");
    CHECK(!strcmp(dash_phase_name(SV_DWELL_OPEN), "MESETA SISTOLICA"), "MESETA");
    CHECK(!strcmp(dash_phase_name(SV_CLOSING), "CIERRE"), "CIERRE");
    CHECK(!strcmp(dash_phase_name(SV_STOPPING), "CIERRE"), "parada controlada = cierre");
    CHECK(!strcmp(dash_phase_name(SV_DWELL_CLOSED), "DIASTOLE"), "DIASTOLE");
    CHECK(!strcmp(dash_phase_name(SV_IDLE), "REPOSO") && !strcmp(dash_phase_name(SV_DETACHED), "REPOSO"), "REPOSO");
    CHECK(!strcmp(dash_phase_name(SV_MOVING), "AJUSTE"), "AJUSTE");
    CHECK(!strcmp(dash_phase_name(99), "REPOSO"), "fase desconocida → REPOSO");
    CHECK(dash_event_name(2) == NULL && dash_event_name(6) == NULL, "eventos de cada ciclo no se informan");
    CHECK(!strcmp(dash_event_name(11), "STOP_ESTOP") && !strcmp(dash_event_name(12), "STOP_HEARTBEAT"), "paradas sí");
    CHECK(dash_event_name(0) == NULL && dash_event_name(255) == NULL, "códigos fuera de tabla");

    /* ── telemetría ── */
    char b[160];
    int n = dash_format_telemetry(b, sizeof b, 124500, 45.2f, DASH_MODE_SANO, SV_OPENING, true);
    CHECK(n > 0 && !strcmp(b, "{\"t\":124500,\"deg\":45.2,\"mode\":\"SANO\",\"phase\":\"APERTURA\",\"src\":\"HALL\"}\n"), "formato: %s", b);
    CHECK(n == (int)strlen(b), "largo devuelto");
    n = dash_format_telemetry(b, sizeof b, 7, -0.03f, DASH_MODE_ESTENOSIS, SV_DWELL_CLOSED, false);
    CHECK(!strcmp(b, "{\"t\":7,\"deg\":0.0,\"mode\":\"ESTENOSIS\",\"phase\":\"DIASTOLE\",\"src\":\"CMD\"}\n"), "sin «-0.0»: %s", b);
    n = dash_format_telemetry(b, sizeof b, 4294967295u, 80.04f, DASH_MODE_SANO, SV_DWELL_OPEN, false);
    CHECK(n > 0 && strstr(b, "\"t\":4294967295") && strstr(b, "\"deg\":80.0"), "t máximo y redondeo: %s", b);
    n = dash_format_telemetry(b, sizeof b, 1, NAN, DASH_MODE_SANO, SV_IDLE, false);
    CHECK(n > 0 && strstr(b, "\"deg\":0.0"), "NaN → 0.0: %s", b);
    n = dash_format_telemetry(b, 20, 1, 1.0f, DASH_MODE_SANO, SV_IDLE, false);
    CHECK(n == -1, "buffer chico → -1");
    n = dash_format_telemetry(b, sizeof b, 124500, 45.2f, DASH_MODE_SANO, SV_OPENING, true);
    CHECK(n < 100, "línea de %d bytes × 50 Hz = %d B/s, cabe en 115200 baudios (11520 B/s)", n, n * 50);

    /* ── comandos válidos (los textos exactos que envía el dashboard) ── */
    dash_cmd_t c = P("{\"cmd\":\"SET_MODE\",\"mode\":\"SANO\"}");
    CHECK(c.kind == DASH_CMD_SET_MODE && c.mode == DASH_MODE_SANO, "SANO");
    c = P("{\"cmd\":\"SET_MODE\",\"mode\":\"ESTENOSIS\"}");
    CHECK(c.kind == DASH_CMD_SET_MODE && c.mode == DASH_MODE_ESTENOSIS, "ESTENOSIS");
    CHECK(P("{\"cmd\":\"HB\"}").kind == DASH_CMD_HB, "HB");
    CHECK(P("{\"cmd\":\"STOP\"}").kind == DASH_CMD_STOP, "STOP");
    CHECK(P("{\"cmd\":\"INFO\"}").kind == DASH_CMD_INFO, "INFO");
    CHECK(P("{\"cmd\":\"PING\"}").kind == DASH_CMD_PING, "PING");
    /* variantes tolerables */
    c = P("  { \"mode\" : \"estenosis\" , \"cmd\" : \"set_mode\" }  ");
    CHECK(c.kind == DASH_CMD_SET_MODE && c.mode == DASH_MODE_ESTENOSIS, "espacios, orden y mayúsculas");
    c = P("{\"cmd\":\"SET_MODE\",\"mode\":\"SANO\",\"extra\":{\"a\":[1,2,{\"cmd\":\"STOP\"}],\"b\":\"x,y}\"},\"n\":-3.5e2}");
    CHECK(c.kind == DASH_CMD_SET_MODE && c.mode == DASH_MODE_SANO, "campos extra anidados no confunden (el STOP anidado se ignora)");
    CHECK(P("{\"x\":\"{\\\"cmd\\\":\\\"STOP\\\"}\",\"cmd\":\"HB\"}").kind == DASH_CMD_HB, "un cmd dentro de un texto no cuenta");
    CHECK(P("{\"cmd\":\"HB\"}\r").kind == DASH_CMD_HB, "con \\r final");

    /* ── comandos inválidos: no deben mover nada ── */
    CHECK(P("").kind == DASH_CMD_NONE && P("   ").kind == DASH_CMD_NONE && P("HB").kind == DASH_CMD_NONE, "no JSON → NONE");
    CHECK(P(NULL).kind == DASH_CMD_NONE, "NULL");
    CHECK(P("{\"cmd\":\"SET_MODE\"}").kind == DASH_CMD_BAD_MODE, "SET_MODE sin modo");
    CHECK(P("{\"cmd\":\"SET_MODE\",\"mode\":\"OTRO\"}").kind == DASH_CMD_BAD_MODE, "modo desconocido");
    CHECK(P("{\"cmd\":\"SET_MODE\",\"mode\":5}").kind == DASH_CMD_BAD_MODE, "modo numérico");
    CHECK(P("{\"cmd\":\"SET_MODE\",\"mode\":\"SANOX\"}").kind == DASH_CMD_BAD_MODE, "SANOX no es SANO");
    CHECK(P("{\"cmd\":\"SET_MODE\",\"mode\":\"\"}").kind == DASH_CMD_BAD_MODE, "modo vacío");
    CHECK(P("{\"cmd\":\"EXPLOTAR\"}").kind == DASH_CMD_UNKNOWN, "comando desconocido");
    CHECK(P("{\"mode\":\"SANO\"}").kind == DASH_CMD_UNKNOWN, "sin cmd");
    CHECK(P("{\"cmd\":5}").kind == DASH_CMD_UNKNOWN, "cmd numérico");
    CHECK(P("{\"cmd\":\"HB\"").kind == DASH_CMD_UNKNOWN, "sin llave de cierre");
    CHECK(P("{\"cmd\":\"HB").kind == DASH_CMD_UNKNOWN, "cadena sin cerrar");
    CHECK(P("{cmd:HB}").kind == DASH_CMD_UNKNOWN, "sin comillas");
    CHECK(P("{\"cmd\":\"SET_MODE\",\"mode\":\"SANO\"").kind == DASH_CMD_UNKNOWN, "SET_MODE truncado no se ejecuta");
    CHECK(P("{\"cmd\":\"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\"}").kind == DASH_CMD_UNKNOWN, "valor largo se trunca sin desbordar");
    CHECK(P("{\"cmd\":\"HB\",,}").kind != DASH_CMD_SET_MODE, "comas sobrantes no producen SET_MODE");
    {   /* línea gigante / basura binaria: no debe fallar la memoria (se corre también con ASan/UBSan) */
        char big[4096]; memset(big, '{', sizeof big - 1); big[sizeof big - 1] = 0;
        CHECK(P(big).kind == DASH_CMD_UNKNOWN, "4 KB de llaves");
        char bin[64]; for (int i = 0; i < 63; i++) bin[i] = (char)(0x80 + i); bin[63] = 0;
        CHECK(P(bin).kind == DASH_CMD_NONE, "bytes altos");
        unsigned x = 12345;
        for (int t = 0; t < 20000; t++) {   /* fuzz determinista: nunca debe producir SET_MODE por azar */
            char s[48]; int L = 1 + (int)(x % 46);
            for (int i = 0; i < L; i++) { x = x * 1103515245u + 12345u; s[i] = "{}\":,\\ abcmodeSANOHB[]"[(x >> 16) % 22]; }
            s[L] = 0;
            dash_cmd_t r = P(s);
            if (r.kind == DASH_CMD_SET_MODE) { CHECK(0, "fuzz produjo SET_MODE: %s", s); break; }
        }
    }

    /* ── escape JSON ── */
    char e[64];
    CHECK(dash_json_escape(e, sizeof e, "hola") == 4 && !strcmp(e, "hola"), "sin cambios");
    CHECK(dash_json_escape(e, sizeof e, "a\"b\\c\n\t") > 0 && !strcmp(e, "a\\\"b\\\\c\\n\\t"), "escapes: %s", e);
    CHECK(dash_json_escape(e, sizeof e, "\x01") > 0 && !strcmp(e, "\\u0001"), "control: %s", e);
    CHECK(dash_json_escape(e, sizeof e, "ñ válvula") > 0 && !strcmp(e, "ñ válvula"), "UTF-8 intacto");
    CHECK(dash_json_escape(e, 5, "abcdef") == -1, "no cabe → -1");
    CHECK(dash_json_escape(e, 4, "abcd") == -1, "no cabe el terminador → -1");
    CHECK(dash_json_escape(e, 5, "abcd") == 4, "cabe justo con el terminador");
    CHECK(dash_json_escape(e, 5, "abc") == 3, "justo");

    printf("%d/%d comprobaciones correctas\n", total - fails, total);
    return fails ? 1 : 0;
}
