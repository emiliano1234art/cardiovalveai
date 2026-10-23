#pragma once
#include <stdbool.h>
#define INA219_ABSENT (-32768)
void ina219_start(float shunt_ohm);
int ina219_last_ma(void);     /* INA219_ABSENT si no se detectó el sensor */
bool ina219_present(void);
