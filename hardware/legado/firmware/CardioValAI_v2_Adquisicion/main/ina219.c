/*
 * INA219 (opcional): corriente del servo en la línea de 5 V externa. Lectura de la tensión de shunt
 * (registro 0x01, 10 µV/LSB) a 500 Hz. Con el módulo típico (R = 0,1 Ω) → 0,1 mA/LSB, rango ±3,2 A (PGA /8).
 * Se usa para: (1) dimensionar la fuente con picos medidos, (2) detectar atascos (sobrecorriente sostenida).
 */
#include <string.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "driver/i2c_master.h"
#include "esp_timer.h"
#include "ina219.h"
#include "proto.h"
#include "acq.h"
#include "board_pins.h"

#define INA_RATE_HZ 500
#define INA_BLOCK   50

static i2c_master_dev_handle_t s_dev;
static volatile int s_last_ma = INA219_ABSENT;
static float s_shunt = 0.1f;
static bool s_present;

static esp_err_t wr16(uint8_t reg, uint16_t v)
{
    uint8_t b[3] = { reg, (uint8_t)(v >> 8), (uint8_t)v };
    return i2c_master_transmit(s_dev, b, 3, 10);
}

static esp_err_t rd16(uint8_t reg, int16_t *v)
{
    uint8_t b[2];
    esp_err_t e = i2c_master_transmit_receive(s_dev, &reg, 1, b, 2, 10);
    *v = (int16_t)((b[0] << 8) | b[1]);
    return e;
}

static void ina_task(void *arg)
{
    struct __attribute__((packed)) hdr { int64_t t_last; uint32_t idx0; uint16_t n; uint16_t ua_per_lsb; };
    _Static_assert(sizeof(struct hdr) == 16, "cabecera INA = 16 bytes (cvai_proto.INA_HDR)");
    static uint8_t out[sizeof(struct hdr) + INA_BLOCK * 2];
    int16_t blk[INA_BLOCK];
    int n = 0;
    uint32_t idx = 0;
    const uint16_t ua_per_lsb = (uint16_t)(10.0f / s_shunt + 0.5f);   /* 10 µV / R → µA */
    TickType_t wake = xTaskGetTickCount();
    for (;;) {
        vTaskDelayUntil(&wake, pdMS_TO_TICKS(1000 / INA_RATE_HZ));
        int16_t v;
        if (rd16(0x01, &v) != ESP_OK) { continue; }
        s_last_ma = (int)(v * ua_per_lsb / 1000);
        blk[n++] = v;
        if (n == INA_BLOCK) {
            struct hdr h = { esp_timer_get_time(), idx, INA_BLOCK, ua_per_lsb };
            memcpy(out, &h, sizeof h);
            memcpy(out + sizeof h, blk, sizeof blk);
            if (g_acq.streaming) { proto_send(FR_INA, out, sizeof out); }
            idx += INA_BLOCK; n = 0;
        }
    }
}

void ina219_start(float shunt_ohm)
{
    s_shunt = shunt_ohm;
    i2c_master_bus_config_t bc = { .i2c_port = I2C_NUM_0, .sda_io_num = PIN_SDA, .scl_io_num = PIN_SCL,
                                   .clk_source = I2C_CLK_SRC_DEFAULT, .glitch_ignore_cnt = 7, .flags.enable_internal_pullup = true };
    i2c_master_bus_handle_t bus;
    if (i2c_new_master_bus(&bc, &bus) != ESP_OK) { return; }
    if (i2c_master_probe(bus, INA219_ADDR, 20) != ESP_OK) { proto_text("INA219 no detectado (opcional)"); return; }
    i2c_device_config_t dc = { .dev_addr_length = I2C_ADDR_BIT_LEN_7, .device_address = INA219_ADDR, .scl_speed_hz = 400000 };
    if (i2c_master_bus_add_device(bus, &dc, &s_dev) != ESP_OK) { return; }
    /* BRNG = 16 V, PGA /8 (±320 mV), ADC bus y shunt 12 bits (532 µs), modo continuo shunt + bus */
    if (wr16(0x00, 0x199F) != ESP_OK) { return; }
    s_present = true;
    xTaskCreatePinnedToCore(ina_task, "ina", 3072, NULL, 6, NULL, 0);
}

int ina219_last_ma(void) { return s_last_ma; }
bool ina219_present(void) { return s_present; }
