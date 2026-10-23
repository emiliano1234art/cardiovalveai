#pragma once
#include <stdint.h>
#include <stdbool.h>

#define CAL_MAX_PTS 32

typedef struct {
    bool valid;
    uint8_t n;
    uint32_t crc;
    float th_min, th_max;
    char reason[48];     /* motivo si no es válida ("ausente", "no monótona", …) */
} cal_status_t;

void cal_init(void);
/* Carga por pasos (comandos CAL BEGIN / CAL PT / CAL END): evita líneas largas por el puerto serie */
bool cal_begin(int i);
bool cal_point(uint16_t raw_sum8, float deg);
bool cal_end(char *msg, int len);          /* valida y guarda en NVS; devuelve falso con el motivo */
bool cal_clear(int i);
cal_status_t cal_status(int i);
/* Lectura cruda (suma de 8) → ángulo por interpolación lineal entre puntos. Falso si no hay calibración válida o la lectura
 * cae fuera del rango calibrado (no se extrapola). */
bool cal_angle(int i, uint16_t raw_sum8, float *deg);
uint8_t cal_valid_mask(void);
