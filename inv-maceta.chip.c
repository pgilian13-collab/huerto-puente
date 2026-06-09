// Wokwi Custom Chip - Maceta Independiente
// I2C slave + GPIO outputs (3 relays + buzzer) + Framebuffer display
// SPDX-License-Identifier: MIT

#include "wokwi-api.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef struct {
  uint32_t temp_attr;
  uint32_t hum_amb_attr;
  uint32_t hum_suelo_attr;
  uint32_t ph_attr;
  uint32_t addr_attr;
  pin_t pin_bomba;
  pin_t pin_vent;
  pin_t pin_pulv;
  pin_t pin_buzzer;
  buffer_t fb;
  uint32_t fb_width;
  uint32_t fb_height;
  uint8_t reg_ptr;
  uint8_t sensor_buf[8];
  uint8_t relay_state;
} chip_state_t;

static void update_sensor_buf(chip_state_t *chip) {
  float temp = attr_read_float(chip->temp_attr);
  float hum_amb = attr_read_float(chip->hum_amb_attr);
  float hum_suelo = attr_read_float(chip->hum_suelo_attr);
  float ph = attr_read_float(chip->ph_attr);

  uint16_t t = (uint16_t)(temp * 10);
  uint16_t ha = (uint16_t)(hum_amb * 10);
  uint16_t hs = (uint16_t)(hum_suelo * 10);
  uint16_t p = (uint16_t)(ph * 10);

  chip->sensor_buf[0] = (t >> 8) & 0xFF;
  chip->sensor_buf[1] = t & 0xFF;
  chip->sensor_buf[2] = (ha >> 8) & 0xFF;
  chip->sensor_buf[3] = ha & 0xFF;
  chip->sensor_buf[4] = (hs >> 8) & 0xFF;
  chip->sensor_buf[5] = hs & 0xFF;
  chip->sensor_buf[6] = (p >> 8) & 0xFF;
  chip->sensor_buf[7] = p & 0xFF;
}

static void draw_rect(buffer_t fb, uint32_t x, uint32_t y, uint32_t w, uint32_t h, uint32_t color) {
  for (uint32_t row = y; row < y + h; row++) {
    for (uint32_t col = x; col < x + w; col++) {
      buffer_write(fb, (row * 128 + col) * 4, &color, 4);
    }
  }
}

static uint32_t make_color(uint8_t r, uint8_t g, uint8_t b) {
  return (uint32_t)r | ((uint32_t)g << 8) | ((uint32_t)b << 16) | (0xFFu << 24);
}

static void draw_bar(buffer_t fb, uint32_t x, uint32_t y, uint32_t w, uint32_t h, float value, float max_val, uint32_t color) {
  uint32_t filled = (uint32_t)((value / max_val) * w);
  if (filled > w) filled = w;

  uint32_t bg = make_color(40, 40, 40);
  draw_rect(fb, x, y, w, h, bg);
  draw_rect(fb, x, y, filled, h, color);
}

static void draw_indicator(buffer_t fb, uint32_t x, uint32_t y, uint32_t on) {
  uint32_t color = on ? make_color(0, 255, 0) : make_color(60, 60, 60);
  draw_rect(fb, x, y, 10, 10, color);
}

static void update_display(chip_state_t *chip) {
  float temp = attr_read_float(chip->temp_attr);
  float hum_amb = attr_read_float(chip->hum_amb_attr);
  float hum_suelo = attr_read_float(chip->hum_suelo_attr);
  float ph = attr_read_float(chip->ph_attr);

  uint32_t black = make_color(0, 0, 0);
  draw_rect(chip->fb, 0, 0, 128, 64, black);

  uint32_t cyan = make_color(0, 200, 200);
  uint32_t blue = make_color(50, 100, 255);
  uint32_t brown = make_color(180, 120, 50);
  uint32_t orange = make_color(255, 160, 0);

  draw_bar(chip->fb, 2, 4, 100, 8, temp, 60.0, cyan);
  draw_bar(chip->fb, 2, 16, 100, 8, hum_amb, 100.0, blue);
  draw_bar(chip->fb, 2, 28, 100, 8, hum_suelo, 100.0, brown);
  draw_bar(chip->fb, 2, 40, 100, 8, ph, 14.0, orange);

  uint32_t light_gray = make_color(150, 150, 150);
  uint32_t white = make_color(255, 255, 255);
  buffer_write(chip->fb, (4 * 128 + 108) * 4, &white, 4);
  buffer_write(chip->fb, (5 * 128 + 108) * 4, &white, 4);
  buffer_write(chip->fb, (16 * 128 + 108) * 4, &white, 4);
  buffer_write(chip->fb, (17 * 128 + 108) * 4, &white, 4);
  buffer_write(chip->fb, (28 * 128 + 108) * 4, &white, 4);
  buffer_write(chip->fb, (29 * 128 + 108) * 4, &white, 4);
  buffer_write(chip->fb, (40 * 128 + 108) * 4, &white, 4);
  buffer_write(chip->fb, (41 * 128 + 108) * 4, &white, 4);

  draw_indicator(chip->fb, 114, 2, (chip->relay_state & 0x01));
  draw_indicator(chip->fb, 114, 14, (chip->relay_state & 0x02));
  draw_indicator(chip->fb, 114, 26, (chip->relay_state & 0x04));
  draw_indicator(chip->fb, 114, 38, (chip->relay_state & 0x08));
}

static void apply_relay_state(chip_state_t *chip) {
  pin_write(chip->pin_bomba, (chip->relay_state & 0x01) ? HIGH : LOW);
  pin_write(chip->pin_vent, (chip->relay_state & 0x02) ? HIGH : LOW);
  pin_write(chip->pin_pulv, (chip->relay_state & 0x04) ? HIGH : LOW);
  pin_write(chip->pin_buzzer, (chip->relay_state & 0x08) ? HIGH : LOW);
}

static void chip_timer_callback(void *data) {
  chip_state_t *chip = (chip_state_t *)data;
  update_sensor_buf(chip);
  update_display(chip);
}

bool on_i2c_connect(void *user_data, uint32_t address, bool read) {
  return true;
}

uint8_t on_i2c_read(void *user_data) {
  chip_state_t *chip = (chip_state_t *)user_data;
  uint8_t val = chip->sensor_buf[chip->reg_ptr];
  chip->reg_ptr = (chip->reg_ptr + 1) & 0x07;
  return val;
}

bool on_i2c_write(void *user_data, uint8_t data) {
  chip_state_t *chip = (chip_state_t *)user_data;
  if (chip->reg_ptr == 0xFF) {
    chip->relay_state = data;
    apply_relay_state(chip);
    chip->reg_ptr = 0;
  } else {
    chip->reg_ptr = data & 0xFF;
  }
  return true;
}

void chip_init() {
  chip_state_t *chip = (chip_state_t *)malloc(sizeof(chip_state_t));

  chip->addr_attr = attr_init("i2cAddr", 0);
  chip->temp_attr = attr_init("temperature", 25.0);
  chip->hum_amb_attr = attr_init("humAmb", 60.0);
  chip->hum_suelo_attr = attr_init("humSuelo", 50.0);
  chip->ph_attr = attr_init("ph", 7.0);
  chip->reg_ptr = 0;
  chip->relay_state = 0;

  chip->pin_bomba = pin_init("R_BOMBA", OUTPUT);
  chip->pin_vent = pin_init("R_VENT", OUTPUT);
  chip->pin_pulv = pin_init("R_PULV", OUTPUT);
  chip->pin_buzzer = pin_init("BUZZER", OUTPUT);
  pin_write(chip->pin_bomba, LOW);
  pin_write(chip->pin_vent, LOW);
  pin_write(chip->pin_pulv, LOW);
  pin_write(chip->pin_buzzer, LOW);

  chip->fb = framebuffer_init(&chip->fb_width, &chip->fb_height);

  uint32_t addr_offset = (uint32_t)attr_read(chip->addr_attr);
  uint32_t i2c_address = 0x10 + addr_offset;

  update_sensor_buf(chip);
  update_display(chip);

  const i2c_config_t i2c_config = {
    .user_data = chip,
    .address = i2c_address,
    .scl = pin_init("SCL", INPUT_PULLUP),
    .sda = pin_init("SDA", INPUT_PULLUP),
    .connect = on_i2c_connect,
    .read = on_i2c_read,
    .write = on_i2c_write,
  };
  i2c_init(&i2c_config);

  const timer_config_t timer_config = {
    .callback = chip_timer_callback,
    .user_data = chip,
  };
  timer_t timer = timer_init(&timer_config);
  timer_start(timer, 500, true);
}
