"""
Driver ADS1115 para MicroPython (ESP32)
ADC externo de 16-bit via I2C - 4 canales analogicos
"""

from machine import I2C
import time

# Registros ADS1115
REG_CONVERSION = 0x00
REG_CONFIG = 0x01

# Configuracion por defecto
# Gain = 1 (4.096V range), Single-shot mode
DEFAULT_CONFIG = 0xC383  # bits: OS=1, MUX=000 (A0-GND), PGA=001 (4.096V), MODE=1 (single), DR=100 (128SPS), COMP=00

# MUX values for single-ended readings
MUX_MAP = {
    0: 0x4000,  # A0
    1: 0x5000,  # A1
    2: 0x6000,  # A2
    3: 0x7000,  # A3
}


class ADS1115:
    def __init__(self, i2c, address=0x48, gain=1):
        self.i2c = i2c
        self.address = address
        self.gain = gain
        self.gain_v = [6.144, 4.096, 2.048, 1.024, 0.512, 0.256][gain]

    def _write_reg(self, reg, value):
        self.i2c.writeto_mem(self.address, reg, value.to_bytes(2, 'big'))

    def _read_reg(self, reg):
        data = self.i2c.readfrom_mem(self.address, reg, 2)
        return int.from_bytes(data, 'big')

    def read_channel(self, channel):
        """Lee un canal analogico (0-3) y retorna el valor en voltios"""
        if channel < 0 or channel > 3:
            raise ValueError("Canal debe ser 0-3")

        # Configurar: single-shot, canal, gain, 128 SPS
        config = 0x8000  # OS=1 (start conversion)
        config |= MUX_MAP[channel]
        config |= (self.gain << 9)
        config |= 0x0083  # MODE=1 (single), DR=100 (128SPS), COMP=00

        self._write_reg(REG_CONFIG, config)

        # Esperar conversion (max 8ms a 128 SPS)
        time.sleep_ms(10)

        # Leer resultado
        raw = self._read_reg(REG_CONVERSION)

        # Sign extension de 16-bit
        if raw > 32767:
            raw -= 65536

        # Convertir a voltios
        voltios = (raw * self.gain_v) / 32767.0
        return voltios

    def read_channel_raw(self, channel):
        """Lee un canal y retorna el valor raw de 16-bit"""
        if channel < 0 or channel > 3:
            raise ValueError("Canal debe ser 0-3")

        config = 0x8000
        config |= MUX_MAP[channel]
        config |= (self.gain << 9)
        config |= 0x0083

        self._write_reg(REG_CONFIG, config)
        time.sleep_ms(10)

        raw = self._read_reg(REG_CONVERSION)
        if raw > 32767:
            raw -= 65536
        return raw
