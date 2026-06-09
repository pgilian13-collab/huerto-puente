
from machine import Pin, I2C, ADC, PWM
import ssd1306
import time
import dht

#STEP 2: DECLARE CONNECTION
# ESP32 Pin assignment 

buzzer = PWM(Pin(26), Pin.OUT)
soil_sensor = ADC(Pin(34))  # Analog pin for soil moisture sensor
orangeled = Pin(32,Pin.OUT)
yellowled = Pin(33,Pin.OUT)
greenled = Pin(25,Pin.OUT)
sensor_clima = dht.DHT22(Pin(4))

#STEP 2.2 : DECLARE THE CONNECTION OLED
i2c = I2C(0, scl=Pin(22), sda=Pin(21))
oled = ssd1306.SSD1306_I2C(128, 64, i2c)


#STEP 3 : THE PROCESS
while True:
    try:
        # 1. LECTURA DE SENSORES
        # Sensor de Clima (DHT22)
        sensor_clima.measure()
        temp = sensor_clima.temperature()
        hum_amb = sensor_clima.humidity()
        
        # Sensor de Humedad de Suelo
        sensorValue = soil_sensor.read()
        # Mapeo según tu rango específico (2165-3135)
        humidityPercent = int((sensorValue - 2165) / (3135 - 2165) * 100)
        humidityPercent = max(0, min(humidityPercent, 100)) # Clamp 0-100

        # 2. IMPRESIÓN EN CONSOLA (DEBUG)
        print("---------------------------------------------")
        print("LECTURA ACTUAL:")
        print("Temperatura: {}°C | Humedad Amb: {}%".format(temp, hum_amb))
        print("Humedad Suelo: {}%".format(humidityPercent))
        
        # Lógica de mensajes en terminal según condiciones climáticas
        if temp > 35:
            print(">> ALERTA: REQUIERE ACTIVAR VENTILADORES")
            # Si la temperatura es alta Y la humedad también (>60% por ejemplo)
            if hum_amb > 60:
                print(">> CONDICIÓN CRÍTICA: ACTIVAR PULVERIZADORES")
                print(">> Esperando estabilización del sistema...")
        
        elif temp < 15:
            print(">> ALERTA: REQUIERE AUMENTO DE TEMPERATURA")
        
        # Lógica de humedad de suelo (ya existente en tu código)
        if humidityPercent < 40:
            print(">> ESTADO SUELO: HUMEDO, PARAR RIEGO")
        elif humidityPercent > 60:
            print(">> ESTADO SUELO: SECO, REGAR")
        else:
            print(">> ESTADO SUELO: CANTIDAD IDEAL")
        
        print("---------------------------------------------")

        # 3. LÓGICA DE ALERTAS Y BUZZER
        if humidityPercent < 40:
            buzzer.init(freq=400, duty=10)
            time.sleep(1) # El buzzer suena un segundo
            buzzer.init(freq=1, duty=0)

        elif humidityPercent > 60:
            buzzer.init(freq=900, duty=10)
            time.sleep(1) # El buzzer suena un segundo
            buzzer.init(freq=1, duty=0)
            
        else:
            buzzer.init(freq=1, duty=0)

        # 4. ACTUALIZACIÓN DE DASHBOARD OLED
        oled.fill(0) 
        oled.text("MONITOR SISTEMA", 0, 0)
        oled.text("Hum. Suelo: {}%".format(humidityPercent), 0, 15)
        oled.text("Temp: {} C".format(temp), 0, 30)
        oled.text("Hum. Amb: {}%".format(hum_amb), 0, 45)

        # LÓGICA DE INTERACCIÓN CON EL BUZZER POR TEMPERATURA
        if temp > 35:
            oled.text("! VENTILADORES", 0, 55)
            # Tono agudo y rápido (Alarma de calor)
            buzzer.init(freq=1200, duty=20) 
            
            if hum_amb > 60:
                oled.fill(0)
                oled.text("! PULVERIZADORES", 0, 30)
                # Tono de sirena (Sube y baja)
                buzzer.init(freq=1500, duty=50)
                time.sleep(0.2)
                buzzer.init(freq=1000, duty=50)

        elif temp < 15:
            oled.text("! SUBIR TEMP", 0, 55)
            # Tono grave y lento (Alarma de frío)
            buzzer.init(freq=200, duty=20)

        # LÓGICA DE INTERACCIÓN POR HUMEDAD DE SUELO (Prioridad si no hay alarma de temp)
        elif humidityPercent > 60:
            oled.text("! REGANDO...", 0, 55)
            buzzer.init(freq=800, duty=10) # Tono constante suave mientras riega
        
        else:
            # Si todo está en orden, silencio total
            buzzer.init(freq=1, duty=0)

        oled.show()

    except OSError as e:
        print("Error leyendo sensores (Verifica cables)")

    # 5. TIEMPO DE ESPERA
    # Usamos 2 segundos para cumplir con el RNF04 y el tiempo del DHT22
    time.sleep(2)
