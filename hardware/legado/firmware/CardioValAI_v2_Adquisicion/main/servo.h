#pragma once
#include <stdint.h>
#include <stdbool.h>

typedef enum { SV_DETACHED = 0, SV_IDLE, SV_OPENING, SV_DWELL_OPEN, SV_CLOSING, SV_DWELL_CLOSED, SV_MOVING, SV_STOPPING } sv_phase_t;

typedef struct {
    float cmd_closed, cmd_open;      /* ángulo de comando (°) en cerrado / abierto: 130 / 50 con el horn de r = 8 mm */
    float cmd_min, cmd_max;          /* límites duros por software (nunca se comanda fuera) */
    uint16_t us_at_0, us_at_180;     /* pulso (µs) para 0° y 180° — VERIFICAR con el servo real */
    uint32_t t_open_ms, t_dwell_open_ms, t_close_ms, t_dwell_closed_ms;
    uint32_t cycles;                 /* 0 = hasta STOP */
    uint32_t hb_timeout_ms;          /* sin latido de la computadora durante este tiempo → parada controlada */
    uint16_t stall_min_delta;        /* variación mínima de H0 (suma de 8, cuentas) esperada en un movimiento completo */
    uint16_t overcurrent_ma;         /* INA219: umbral sostenido */
    uint16_t overcurrent_ms;
    uint16_t sync_pulse_ms;
} servo_cfg_t;

extern servo_cfg_t g_servo_cfg;

void servo_init(void);
bool servo_start(uint32_t cycles);   /* falso si la parada de emergencia está activa */
void servo_stop(int reason_event);   /* parada controlada: termina en cerrado lento y desactiva el PWM */
void servo_detach(int reason_event); /* corte inmediato de pulsos */
bool servo_move(float deg, uint32_t ms);
void servo_heartbeat(void);
sv_phase_t servo_phase(void);
float servo_cmd_now(void);
uint32_t servo_cycle(void);
bool servo_estop_active(void);
