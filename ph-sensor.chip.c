// Wokwi Custom Chip - Sensor de pH
// Simula un sensor de pH analógico (ej. SEN0161)
// Rango: pH 0-14, voltaje de salida: 0.0V - 3.3V aprox.
//
// SPDX-License-Identifier: MIT
// Copyright 2024
 
#include "wokwi-api.h"
#include <stdio.h>
#include <stdlib.h>
 
typedef struct {
  pin_t pin_out;
  uint32_t ph_attr;
} chip_state_t;
 
void chip_timer_callback(void *data) {
  chip_state_t *state = (chip_state_t *)data;
 
  // Leer el atributo pH (rango 0-14)
  float ph_value = attr_read_float(state->ph_attr);
 
  // Convertir pH a voltaje: pH=7 → ~2.5V, pH=0 → ~4.2V, pH=14 → ~0.0V
  // Fórmula lineal: V = 4.2 - (ph * 0.3)  (aproximación sensor real)
  float voltage = 4.2f - (ph_value * 0.3f);
 
  // Limitar al rango 0.0 - 5.0V
  if (voltage < 0.0f) voltage = 0.0f;
  if (voltage > 5.0f) voltage = 5.0f;
 
  pin_dac_write(state->pin_out, voltage);
}
 
void chip_init() {
  chip_state_t *state = (chip_state_t *)malloc(sizeof(chip_state_t));
 
  // Pin de salida analógica
  state->pin_out = pin_init("OUT", ANALOG);
 
  // Atributo pH con valor por defecto 7.0 (neutro)
  state->ph_attr = attr_init_float("ph", 7.0f);
 
  // Timer cada 500ms
  const timer_config_t timer_config = {
    .callback = chip_timer_callback,
    .user_data = state,
  };
  timer_t timer = timer_init(&timer_config);
  timer_start(timer, 500, true);
}