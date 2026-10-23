/*
 * Calibración individual de cada sensor Hall, guardada en NVS (memoria no volátil del ESP32).
 * Cada sensor tiene su propia curva lectura → ángulo, obtenida con las galgas angulares y el video (cvai_calibrate.py).
 * La relación NO es lineal: se guardan los puntos medidos y se interpola entre ellos; fuera del rango calibrado no hay ángulo.
 */
#include <string.h>
#include <stdio.h>
#include <math.h>
#include "nvs_flash.h"
#include "nvs.h"
#include "esp_rom_crc.h"
#include "cal.h"
#include "acq.h"

typedef struct __attribute__((packed)) {
    uint8_t version, n;
    uint16_t raw[CAL_MAX_PTS];
    float deg[CAL_MAX_PTS];
    uint32_t crc;
} cal_blob_t;

static cal_blob_t s_cal[N_HALL];
static cal_status_t s_st[N_HALL];
static int s_edit = -1;
static cal_blob_t s_tmp;

static uint32_t blob_crc(const cal_blob_t *b)
{
    return esp_rom_crc32_le(0, (const uint8_t *)b, offsetof(cal_blob_t, crc));
}

static bool validate(const cal_blob_t *b, cal_status_t *st)
{
    memset(st, 0, sizeof *st);
    st->n = b->n;
    if (b->version != 1 || b->n == 0) { snprintf(st->reason, sizeof st->reason, "ausente"); return false; }
    if (b->n < 5) { snprintf(st->reason, sizeof st->reason, "menos de 5 puntos"); return false; }
    if (b->crc != blob_crc(b)) { snprintf(st->reason, sizeof st->reason, "CRC inválido"); return false; }
    int sgn = 0;
    st->th_min = 1e9f; st->th_max = -1e9f;
    for (int k = 0; k < b->n; k++) {
        if (b->deg[k] < -10.0f || b->deg[k] > 95.0f) { snprintf(st->reason, sizeof st->reason, "ángulo fuera de −10…95°"); return false; }
        st->th_min = fminf(st->th_min, b->deg[k]); st->th_max = fmaxf(st->th_max, b->deg[k]);
        if (k == 0) continue;
        if (b->raw[k] <= b->raw[k - 1]) { snprintf(st->reason, sizeof st->reason, "lecturas repetidas o desordenadas"); return false; }
        int s = b->deg[k] > b->deg[k - 1] ? 1 : (b->deg[k] < b->deg[k - 1] ? -1 : 0);
        if (s == 0 || (sgn && s != sgn)) { snprintf(st->reason, sizeof st->reason, "no monótona (ángulo ambiguo)"); return false; }
        sgn = s;
    }
    if (st->th_max - st->th_min < 30.0f) { snprintf(st->reason, sizeof st->reason, "rango calibrado < 30°"); return false; }
    st->crc = b->crc;
    st->valid = true;
    snprintf(st->reason, sizeof st->reason, "válida");
    return true;
}

static const char *key(int i) { static const char *k[] = { "hall1", "hall2", "hall3" }; return k[i]; }

void cal_init(void)
{
    esp_err_t e = nvs_flash_init();
    if (e == ESP_ERR_NVS_NO_FREE_PAGES || e == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        nvs_flash_erase();
        nvs_flash_init();
    }
    nvs_handle_t h;
    bool open = nvs_open("cal", NVS_READONLY, &h) == ESP_OK;
    for (int i = 0; i < N_HALL; i++) {
        size_t len = sizeof s_cal[i];
        memset(&s_cal[i], 0, sizeof s_cal[i]);
        if (open) { nvs_get_blob(h, key(i), &s_cal[i], &len); }
        validate(&s_cal[i], &s_st[i]);
    }
    if (open) nvs_close(h);
}

bool cal_begin(int i)
{
    if (i < 0 || i >= N_HALL) return false;
    s_edit = i;
    memset(&s_tmp, 0, sizeof s_tmp);
    s_tmp.version = 1;
    return true;
}

bool cal_point(uint16_t raw, float deg)
{
    if (s_edit < 0 || s_tmp.n >= CAL_MAX_PTS) return false;
    /* inserción ordenada por lectura */
    int k = s_tmp.n;
    while (k > 0 && s_tmp.raw[k - 1] > raw) { s_tmp.raw[k] = s_tmp.raw[k - 1]; s_tmp.deg[k] = s_tmp.deg[k - 1]; k--; }
    s_tmp.raw[k] = raw; s_tmp.deg[k] = deg;
    s_tmp.n++;
    return true;
}

bool cal_end(char *msg, int len)
{
    if (s_edit < 0) { snprintf(msg, len, "sin CAL BEGIN"); return false; }
    s_tmp.crc = blob_crc(&s_tmp);
    cal_status_t st;
    if (!validate(&s_tmp, &st)) { snprintf(msg, len, "H%d rechazada: %s", s_edit + 1, st.reason); s_edit = -1; return false; }
    nvs_handle_t h;
    if (nvs_open("cal", NVS_READWRITE, &h) != ESP_OK || nvs_set_blob(h, key(s_edit), &s_tmp, sizeof s_tmp) != ESP_OK || nvs_commit(h) != ESP_OK) {
        snprintf(msg, len, "H%d: error al escribir NVS", s_edit + 1); s_edit = -1; return false;
    }
    nvs_close(h);
    s_cal[s_edit] = s_tmp;
    s_st[s_edit] = st;
    snprintf(msg, len, "H%d guardada: %d puntos, %.1f…%.1f°, CRC %08lx", s_edit + 1, st.n, st.th_min, st.th_max, (unsigned long)st.crc);
    s_edit = -1;
    return true;
}

bool cal_clear(int i)
{
    if (i < 0 || i >= N_HALL) return false;
    nvs_handle_t h;
    if (nvs_open("cal", NVS_READWRITE, &h) == ESP_OK) { nvs_erase_key(h, key(i)); nvs_commit(h); nvs_close(h); }
    memset(&s_cal[i], 0, sizeof s_cal[i]);
    validate(&s_cal[i], &s_st[i]);
    return true;
}

cal_status_t cal_status(int i) { return s_st[i]; }

bool cal_angle(int i, uint16_t raw, float *deg)
{
    const cal_blob_t *b = &s_cal[i];
    if (!s_st[i].valid || raw < b->raw[0] || raw > b->raw[b->n - 1]) return false;
    for (int k = 1; k < b->n; k++) {
        if (raw <= b->raw[k]) {
            float u = (float)(raw - b->raw[k - 1]) / (float)(b->raw[k] - b->raw[k - 1]);
            *deg = b->deg[k - 1] + u * (b->deg[k] - b->deg[k - 1]);
            return true;
        }
    }
    return false;
}

uint8_t cal_valid_mask(void)
{
    uint8_t m = 0;
    for (int i = 0; i < N_HALL; i++) if (s_st[i].valid) m |= (uint8_t)(1u << i);
    return m;
}
