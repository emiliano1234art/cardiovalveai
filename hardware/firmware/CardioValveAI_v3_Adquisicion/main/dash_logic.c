#include "dash_logic.h"
#include <ctype.h>
#include <math.h>
#include <stdio.h>
#include <string.h>
#include <strings.h>
#include "servo.h"     /* solo los tipos: sv_phase_t */

#define D2R 0.017453292519943295f
#define R2D 57.29577951308232f

float dash_theta_from_cmd(float cmd_deg)
{
    const float beta = (90.0f - cmd_deg) * D2R;
    return DASH_PSI0 + atanf(DASH_CRANK_R * sinf(beta) / DASH_TAIL_A) * R2D;
}

float dash_cmd_from_theta(float theta_deg)
{
    float s = DASH_TAIL_A * tanf((theta_deg - DASH_PSI0) * D2R) / DASH_CRANK_R;
    if (s > 1.0f) s = 1.0f;
    if (s < -1.0f) s = -1.0f;
    return 90.0f - asinf(s) * R2D;
}

const char *dash_mode_name(dash_mode_t m) { return m == DASH_MODE_ESTENOSIS ? "ESTENOSIS" : "SANO"; }

const char *dash_phase_name(int p)
{
    switch ((sv_phase_t)p) {
    case SV_OPENING:      return "APERTURA";
    case SV_DWELL_OPEN:   return "MESETA SISTOLICA";
    case SV_CLOSING:
    case SV_STOPPING:     return "CIERRE";
    case SV_DWELL_CLOSED: return "DIASTOLE";
    case SV_MOVING:       return "AJUSTE";
    case SV_IDLE:
    case SV_DETACHED:
    default:              return "REPOSO";
    }
}

const char *dash_event_name(int c)
{
    switch (c) {   /* códigos de proto.h; los eventos de cada ciclo (2–7) no se informan: el dashboard ya ve la fase */
    case 8:  return "RUN_START";
    case 9:  return "RUN_END";
    case 10: return "STOP_USER";
    case 11: return "STOP_ESTOP";
    case 12: return "STOP_HEARTBEAT";
    case 13: return "STOP_STALL";
    case 14: return "STOP_ACQ_FAULT";
    case 15: return "SERVO_DETACHED";
    case 16: return "SERVO_ATTACHED";
    case 17: return "STOP_LIMIT";
    case 18: return "ESTOP_RELEASED";
    case 20: return "ADC_POOL_OVF";
    case 22: return "ADC_PATTERN_ERR";
    default: return NULL;
    }
}

int dash_format_telemetry(char *buf, size_t n, uint32_t t_ms, float deg, dash_mode_t mode, int servo_phase, bool from_hall)
{
    if (!(deg > -90.0f && deg < 270.0f)) deg = 0.0f;           /* NaN o valor absurdo: no se publica */
    if (deg > -0.05f && deg < 0.05f) deg = 0.0f;               /* evita «-0.0» */
    int k = snprintf(buf, n, "{\"t\":%lu,\"deg\":%.1f,\"mode\":\"%s\",\"phase\":\"%s\",\"src\":\"%s\"}\n",
                     (unsigned long)t_ms, (double)deg, dash_mode_name(mode), dash_phase_name(servo_phase), from_hall ? "HALL" : "CMD");
    return (k > 0 && (size_t)k < n) ? k : -1;
}

int dash_json_escape(char *dst, size_t n, const char *src)
{
    size_t o = 0;
    for (; *src; src++) {
        const unsigned char ch = (unsigned char)*src;
        char tmp[8];
        int l;
        if (ch == '"' || ch == '\\') { tmp[0] = '\\'; tmp[1] = (char)ch; l = 2; }
        else if (ch == '\n') { memcpy(tmp, "\\n", 2); l = 2; }
        else if (ch == '\r') { memcpy(tmp, "\\r", 2); l = 2; }
        else if (ch == '\t') { memcpy(tmp, "\\t", 2); l = 2; }
        else if (ch < 0x20) { l = snprintf(tmp, sizeof tmp, "\\u%04x", ch); }
        else { tmp[0] = (char)ch; l = 1; }
        if (o + (size_t)l + 1 > n) return -1;
        memcpy(dst + o, tmp, (size_t)l);
        o += (size_t)l;
    }
    if (o + 1 > n) return -1;
    dst[o] = 0;
    return (int)o;
}

/* ───── lectura mínima de un objeto JSON plano: solo los pares "clave":"texto" del nivel superior ───── */
static const char *skip_ws(const char *s) { while (*s && isspace((unsigned char)*s)) s++; return s; }

/* Lee una cadena JSON desde la comilla de apertura. Copia hasta n-1 caracteres a out (puede ser NULL). Devuelve el puntero
 * tras la comilla de cierre, o NULL si la cadena no termina. */
static const char *read_string(const char *s, char *out, size_t n)
{
    size_t o = 0;
    s++;   /* comilla de apertura */
    while (*s && *s != '"') {
        char ch = *s++;
        if (ch == '\\' && *s) ch = *s++;      /* escape: basta con tomar el carácter siguiente */
        if (out && o + 1 < n) out[o++] = ch;
    }
    if (*s != '"') return NULL;
    if (out && n) out[o] = 0;
    return s + 1;
}

/* Busca el valor de texto de `key` en el objeto de nivel superior. Falso si falta, no es texto o el JSON está mal formado. */
static bool get_string(const char *line, const char *key, char *out, size_t n)
{
    const char *s = skip_ws(line);
    if (*s != '{') return false;
    s = skip_ws(s + 1);
    bool found = false;
    while (*s && *s != '}') {
        if (*s != '"') return false;
        char k[24];
        s = read_string(s, k, sizeof k);
        if (!s) return false;
        s = skip_ws(s);
        if (*s != ':') return false;
        s = skip_ws(s + 1);
        if (*s == '"') {
            const bool match = strcmp(k, key) == 0;
            s = read_string(s, match ? out : NULL, n);
            if (!s) return false;
            if (match) found = true;
        } else {   /* número, true/false/null, objeto o arreglo: se salta respetando anidación y cadenas */
            int depth = 0;
            while (*s && !(depth == 0 && (*s == ',' || *s == '}'))) {
                if (*s == '"') { s = read_string(s, NULL, 0); if (!s) return false; continue; }
                if (*s == '{' || *s == '[') depth++;
                if (*s == '}' || *s == ']') depth--;
                s++;
            }
        }
        s = skip_ws(s);
        if (*s == ',') s = skip_ws(s + 1);
    }
    return *s == '}' && found;
}

dash_cmd_t dash_parse_command(const char *line)
{
    dash_cmd_t r = { DASH_CMD_NONE, DASH_MODE_SANO };
    if (!line || *skip_ws(line) != '{') return r;
    char cmd[24] = "", mode[24] = "";
    if (!get_string(line, "cmd", cmd, sizeof cmd)) { r.kind = DASH_CMD_UNKNOWN; return r; }
    if (!strcasecmp(cmd, "SET_MODE")) {
        if (get_string(line, "mode", mode, sizeof mode) && !strcasecmp(mode, "SANO")) { r.kind = DASH_CMD_SET_MODE; r.mode = DASH_MODE_SANO; }
        else if (mode[0] && !strcasecmp(mode, "ESTENOSIS")) { r.kind = DASH_CMD_SET_MODE; r.mode = DASH_MODE_ESTENOSIS; }
        else r.kind = DASH_CMD_BAD_MODE;
    }
    else if (!strcasecmp(cmd, "HB")) r.kind = DASH_CMD_HB;
    else if (!strcasecmp(cmd, "STOP")) r.kind = DASH_CMD_STOP;
    else if (!strcasecmp(cmd, "INFO")) r.kind = DASH_CMD_INFO;
    else if (!strcasecmp(cmd, "PING")) r.kind = DASH_CMD_PING;
    else r.kind = DASH_CMD_UNKNOWN;
    return r;
}
