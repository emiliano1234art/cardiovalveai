/*
 * Modo «dashboard web» (CONFIG_CVAI_DASHBOARD_JSON): telemetría y comandos en JSON por línea a 115200 baudios.
 * Ver dash_logic.h para el formato. Con la opción desactivada este módulo no se compila y el firmware habla el protocolo binario.
 */
#pragma once
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

void dash_start(void);                         /* tarea de telemetría a 50 Hz + saludo inicial */
void dash_handle_line(const char *line);       /* línea que empieza con '{' (la entrega cmd.c) */
void dash_event(uint8_t ev_code, int32_t arg); /* evento del servo/adquisición → {"evt":...} (solo los relevantes) */
void dash_text(const char *msg);               /* mensaje de texto → {"txt":...} */
