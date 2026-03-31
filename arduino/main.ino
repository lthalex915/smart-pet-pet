/*************************************************************
 * COMBINED: RFID-RC522 + HC-SR04 + DHT11 + HX711 + SSD1306 OLED + ESP8266 + FAN
 * TARGET: Arduino Mega 2560
 * THEME: Cyberpunk HUD  v1.4
 *
 * --- RFID RC522 WIRING ---
 *  RC522 SDA  → Mega Pin 53
 *  RC522 SCK  → Mega Pin 52
 *  RC522 MOSI → Mega Pin 51
 *  RC522 MISO → Mega Pin 50
 *  RC522 RST  → Mega Pin 49
 *  RC522 3.3V → Mega 3.3V   ← MUST be 3.3V, NOT 5V
 *  RC522 GND  → Mega GND
 *
 * --- HC-SR04 WIRING ---
 *  HC-SR04 TRIG → Mega Pin 22
 *  HC-SR04 ECHO → Mega Pin 23
 *  HC-SR04 VCC  → Mega 5V
 *  HC-SR04 GND  → Mega GND
 *
 * --- SSD1306 OLED WIRING ---
 *  OLED SDA → Mega Pin 20  (Hardware I2C — do not change)
 *  OLED SCL → Mega Pin 21  (Hardware I2C — do not change)
 *  OLED VCC → Mega 3.3V
 *  OLED GND → Mega GND
 *  Default address: 0x3C — change OLED_ADDR to 0x3D if blank
 *
 * --- DHT11 WIRING ---
 *  DHT11 DATA → Mega Pin 24
 *  DHT11 VCC  → Mega 5V
 *  DHT11 GND  → Mega GND
 *  Note: Add 10kΩ pull-up resistor between DATA pin and VCC
 *
 * --- HX711 WIRING ---
 *  HX711 DT   → Mega Pin 2
 *  HX711 SCK  → Mega Pin 3
 *  HX711 VCC  → Mega 5V
 *  HX711 GND  → Mega GND
 *
 * --- ESP8266 WIRING ---
 *  ESP8266 TX    → Mega Pin 19  (RX1 — Hardware Serial1)
 *  ESP8266 RX    → Mega Pin 18  (TX1) via voltage divider:
 *                  Mega TX1 → 1kΩ → ESP8266 RX → 2kΩ → GND
 *  ESP8266 VCC   → External 3.3V regulator (AMS1117-3.3 etc.)
 *  ESP8266 GND   → Mega GND
 *  ESP8266 CH_PD → 3.3V
 *  ESP8266 RST   → 3.3V
 *
 * --- N-MOSFET FAN WIRING (ZP5S4010H 5V 40×40mm) ---
 *  MOSFET Module Signal → Mega Pin 6  (PWM)
 *  MOSFET Module VCC    → Mega 5V     (module logic power)
 *  MOSFET Module GND    → Mega GND
 *  MOSFET Module V+ IN  → Mega 5V     (fan power rail)
 *  MOSFET Module OUT+   → Fan red wire  (+)
 *  MOSFET Module OUT-   → Fan black wire (-)
 *  Serial control: type 0–100 and press Enter to set fan speed %
 *
 * LIBRARIES REQUIRED:
 *  - MFRC522 by GithubCommunity
 *  - Adafruit SSD1306
 *  - Adafruit GFX Library
 *  - DHT sensor library by Adafruit
 *  - HX711 Arduino Library
 *
 * COMBINED HUD LAYOUT (128×64):
 *  ┌─ >> SENSOR HUD ──────────── WiF─┐
 *  ├┐ DIST     │ TEMP    │ HUM      ┌┤
 *  │  124.7CM  │ 25.5°C  │ 65%      │
 *  │  ─────────────────────────────  │
 *  │  |   [████████████░░░░░]  |  |  │
 *  │         >> ZONE: NEAR           │
 *  │  FAN:50%                     ■  │
 *  └┘                               └┘
 *************************************************************/

#include <SPI.h>
#include <Wire.h>
#include <MFRC522.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <DHT.h>
#include <HX711.h>

// ── Wi-Fi Credentials ──────────────────────────────────────
#define WIFI_SSID  "EE3070_P1615_1"
#define WIFI_PASS  "EE3070P1615"

// ── Firebase Realtime Database (REST API) ─────────────────
// Host only (no https:// prefix)
#define FIREBASE_HOST     "smart-pet-pet-8f928-default-rtdb.asia-southeast1.firebasedatabase.app"
// Optional fallback for very old ESP8266 AT firmware (e.g. AT 1.1.0) that returns "IP ERROR"
// Update this IP if backend DNS changes.
#define FIREBASE_HOST_IP  "35.186.236.207"
#define FIREBASE_AUTH     ""  // Keep empty if DB rules already allow write
#define DEVICE_ID         "arduino-mega-01"

// ── RFID Pins ─────────────────────────────────────────────
#define PIN_RFID_SS   53
#define PIN_RFID_RST  49

// ── HC-SR04 Pins & Constants ───────────────────────────────
const int   TRIG_PIN    = 22;
const int   ECHO_PIN    = 23;
const float SOUND_SPEED = 0.0343;

// ── DHT11 ──────────────────────────────────────────────────
#define DHT_PIN   24
#define DHT_TYPE  DHT11

// ── HX711 Load Cell ────────────────────────────────────────
const int   LOADCELL_DOUT_PIN           = 2;
const int   LOADCELL_SCK_PIN            = 3;
const float LOADCELL_CALIBRATION_FACTOR = 1000.0;  // Adjust after calibration
const float FOOD_PRESENT_THRESHOLD_G    = 10.0;    // >= 10g considered "food exists"

// ── Fan (N-MOSFET module, ZP5S4010H) ──────────────────────
const int FAN_PIN  = 6;   // PWM-capable pin → MOSFET Signal input
int       fanSpeed = 0;   // Current speed 0–100 %

// ── OLED Config ────────────────────────────────────────────
#define OLED_W      128
#define OLED_H       64
#define OLED_RESET   -1
#define OLED_ADDR    0x3C  // Try 0x3D if display stays blank

// ── Display Modes ──────────────────────────────────────────
#define MODE_HUD   0
#define MODE_RFID  1

// ── ESP8266 (Hardware Serial1 on Mega: RX1=pin19, TX1=pin18) ─
#define ESP_SERIAL  Serial1
#define ESP_BAUD    115200

// ── Global Objects ─────────────────────────────────────────
MFRC522            rfid(PIN_RFID_SS, PIN_RFID_RST);
MFRC522::MIFARE_Key key;
Adafruit_SSD1306   oled(OLED_W, OLED_H, &Wire, OLED_RESET);
DHT                dht(DHT_PIN, DHT_TYPE);
HX711              scale;

// ── Sensor State ───────────────────────────────────────────
float lastDistance        = -1.0;
bool  noEcho              = true;
float foodWeightGram      = NAN;
bool  loadCellOK          = false;
bool  hasFoodInContainer  = false;

// ── RFID State ─────────────────────────────────────────────
char               rfidUID[30]  = "";
MFRC522::PICC_Type rfidPiccType = MFRC522::PICC_TYPE_UNKNOWN;

// ── DHT State ──────────────────────────────────────────────
float dhtTemp     = NAN;
float dhtHumidity = NAN;
bool  dhtOK       = false;

// ── Wi-Fi State ────────────────────────────────────────────
bool wifiConnected       = false;
bool firebaseUseIPFallback = false;

// ── OLED State ─────────────────────────────────────────────
bool          oledOK         = false;
byte          displayMode    = MODE_HUD;
unsigned long rfidDisplayEnd = 0;
const unsigned long RFID_DISPLAY_DURATION = 4000;

// ── Timing ─────────────────────────────────────────────────
unsigned long lastDistanceTime = 0;
unsigned long lastOledTime     = 0;
unsigned long lastBlinkTime    = 0;
unsigned long lastDHTTime      = 0;
unsigned long lastWeightTime   = 0;
unsigned long lastFirebasePush = 0;
bool          blinkState       = true;

const unsigned long DISTANCE_INTERVAL        = 300;
const unsigned long OLED_INTERVAL            = 150;
const unsigned long BLINK_INTERVAL           = 500;
const unsigned long DHT_INTERVAL             = 3000;
const unsigned long WEIGHT_INTERVAL          = 1500;
const unsigned long FIREBASE_SENSOR_INTERVAL = 3000;


// ═══════════════════════════════════════════════════════════
//  FAN CONTROL
// ═══════════════════════════════════════════════════════════

void setFanSpeed(int percent) {
  fanSpeed = constrain(percent, 0, 100);
  int pwmValue = map(fanSpeed, 0, 100, 0, 255);
  analogWrite(FAN_PIN, pwmValue);
  Serial.print(F("[FAN] Speed set to "));
  Serial.print(fanSpeed);
  Serial.println(F("%"));
}

// Called every loop() — non-blocking serial read
void checkSerialFanInput() {
  if (Serial.available() > 0) {
    String input = Serial.readStringUntil('\n');
    input.trim();
    int value = input.toInt();
    if (value >= 0 && value <= 100) {
      setFanSpeed(value);
    } else {
      Serial.println(F("[FAN] Please enter a value between 0 and 100."));
    }
  }
}


// ═══════════════════════════════════════════════════════════
//  ESP8266: AT Command Helpers
// ═══════════════════════════════════════════════════════════

bool espSendCmd(const char* cmd, const char* expected,
                unsigned long timeoutMs = 3000) {
  while (ESP_SERIAL.available()) ESP_SERIAL.read();
  ESP_SERIAL.println(cmd);
  Serial.print(F("[ESP] >> ")); Serial.println(cmd);

  String resp = "";
  unsigned long start = millis();
  while (millis() - start < timeoutMs) {
    while (ESP_SERIAL.available()) resp += (char)ESP_SERIAL.read();
    if (resp.indexOf(expected) != -1) {
      Serial.print(F("[ESP] << ")); Serial.println(resp);
      return true;
    }
  }
  Serial.print(F("[ESP] TIMEOUT. Got: ")); Serial.println(resp);
  return false;
}

void initESP8266() {
  Serial.println(F("[ESP] Initialising ESP8266..."));
  ESP_SERIAL.begin(ESP_BAUD);
  delay(1500);
  while (ESP_SERIAL.available()) ESP_SERIAL.read();

  if (!espSendCmd("AT", "OK", 3000)) {
    Serial.println(F("[ESP FAIL] No response — check wiring / baud rate."));
    return;
  }
  Serial.println(F("[ESP] Module alive."));

  if (!espSendCmd("AT+CWMODE=1", "OK", 3000))
    Serial.println(F("[ESP WARN] Could not set STA mode."));

  char joinCmd[100];
  snprintf(joinCmd, sizeof(joinCmd),
           "AT+CWJAP=\"%s\",\"%s\"", WIFI_SSID, WIFI_PASS);
  Serial.println(F("[ESP] Connecting to WiFi..."));
  if (!espSendCmd(joinCmd, "WIFI CONNECTED", 15000)) {
    Serial.println(F("[ESP WARN] WiFi connection failed or timed out."));
    return;
  }

  espSendCmd("AT+CIFSR", "OK", 5000);
  espSendCmd("AT+GMR", "OK", 5000);  // Firmware version (for SSL capability check)
  wifiConnected = true;
  Serial.println(F("[ESP PASS] WiFi connected — IP obtained."));
}

void configureESP8266SSL() {
  // Not all AT firmware versions support these commands; warnings are expected on old firmware.
  Serial.println(F("[ESP] Configuring SSL options..."));

  if (!espSendCmd("AT+CIPSSLCCONF=0", "OK", 3000))
    Serial.println(F("[ESP WARN] CIPSSLCCONF unsupported (continuing)."));

  char sniCmd[180];
  snprintf(sniCmd, sizeof(sniCmd), "AT+CIPSSLCSNI=\"%s\"", FIREBASE_HOST);
  if (!espSendCmd(sniCmd, "OK", 3000))
    Serial.println(F("[ESP WARN] CIPSSLCSNI unsupported (continuing)."));

  if (!espSendCmd("AT+CIPSSLSIZE=4096", "OK", 3000))
    Serial.println(F("[ESP WARN] CIPSSLSIZE unsupported (continuing)."));
}


// ═══════════════════════════════════════════════════════════
//  Firebase REST Push Helpers (via ESP8266 AT)
// ═══════════════════════════════════════════════════════════

bool espWaitForToken(const char* expected, unsigned long timeoutMs, String* responseOut) {
  String resp = "";
  unsigned long start = millis();

  while (millis() - start < timeoutMs) {
    while (ESP_SERIAL.available()) {
      resp += (char)ESP_SERIAL.read();
      if (resp.indexOf(expected) != -1) {
        if (responseOut) *responseOut = resp;
        return true;
      }
    }
  }

  if (responseOut) *responseOut = resp;
  return false;
}

String firebaseAuthQuery() {
  if (strlen(FIREBASE_AUTH) == 0) return "";
  return String("?auth=") + FIREBASE_AUTH;
}

bool espTryOpenSSLSocket(const char* target, String* responseOut) {
  char startCmd[200];
  snprintf(startCmd, sizeof(startCmd), "AT+CIPSTART=\"SSL\",\"%s\",443", target);

  while (ESP_SERIAL.available()) ESP_SERIAL.read();
  ESP_SERIAL.println(startCmd);
  Serial.print(F("[ESP] >> ")); Serial.println(startCmd);

  String resp = "";
  unsigned long start = millis();
  bool connected = false;

  while (millis() - start < 15000) {
    while (ESP_SERIAL.available()) {
      resp += (char)ESP_SERIAL.read();
    }

    bool hasFail = (resp.indexOf("CONNECT FAIL") != -1) ||
                   (resp.indexOf("ERROR") != -1) ||
                   (resp.indexOf("FAIL") != -1 && resp.indexOf("ALREADY CONNECTED") == -1) ||
                   (resp.indexOf("CLOSED") != -1);
    if (hasFail) break;

    bool hasConnect = (resp.indexOf("ALREADY CONNECTED") != -1) ||
                      (resp.indexOf("Linked") != -1) ||
                      (resp.indexOf("CONNECT") != -1 && resp.indexOf("CONNECT FAIL") == -1);
    if (hasConnect) {
      connected = true;
      break;
    }
  }

  Serial.print(F("[ESP] << ")); Serial.println(resp);
  if (responseOut) *responseOut = resp;
  return connected;
}

bool espOpenFirebaseSocket(String* responseOut) {
  if (!espSendCmd("AT+CIPMUX=0", "OK", 3000))
    Serial.println(F("[ESP WARN] Failed to set single-connection mode."));

  const char* primaryTarget = firebaseUseIPFallback ? FIREBASE_HOST_IP : FIREBASE_HOST;

  String primaryResp;
  if (espTryOpenSSLSocket(primaryTarget, &primaryResp)) {
    if (responseOut) *responseOut = primaryResp;
    return true;
  }

  // First hostname attempt failed; try fixed IP fallback once on old firmware.
  if (!firebaseUseIPFallback && strlen(FIREBASE_HOST_IP) > 0) {
    Serial.println(F("[ESP WARN] Hostname SSL connect failed, trying FIREBASE_HOST_IP fallback..."));
    String fallbackResp;
    if (espTryOpenSSLSocket(FIREBASE_HOST_IP, &fallbackResp)) {
      firebaseUseIPFallback = true;
      Serial.println(F("[ESP PASS] FIREBASE_HOST_IP fallback enabled."));
      if (responseOut) {
        *responseOut = primaryResp;
        *responseOut += "\n[FALLBACK]\n";
        *responseOut += fallbackResp;
      }
      return true;
    }

    if (responseOut) {
      *responseOut = primaryResp;
      *responseOut += "\n[FALLBACK]\n";
      *responseOut += fallbackResp;
    }
    return false;
  }

  if (responseOut) *responseOut = primaryResp;
  return false;
}

bool espHttpJsonRequest(const char* method, const String& path, const String& payload) {
  if (!wifiConnected) {
    Serial.println(F("[FB WARN] Skip push — WiFi is not connected."));
    return false;
  }

  String openResp;
  if (!espOpenFirebaseSocket(&openResp)) {
    Serial.println(F("[FB FAIL] SSL socket open failed (CIPSTART)."));
    Serial.print(F("[FB FAIL] CIPSTART response: "));
    Serial.println(openResp);
    return false;
  }

  String request = String(method) + " " + path + " HTTP/1.1\r\n";
  request += String("Host: ") + FIREBASE_HOST + "\r\n";  // Keep canonical host for Firebase routing
  request += "Connection: close\r\n";
  request += "Content-Type: application/json\r\n";
  request += "Accept: application/json\r\n";
  request += "Content-Length: " + String(payload.length()) + "\r\n\r\n";
  request += payload;

  Serial.print(F("[FB] Sending "));
  Serial.print(method);
  Serial.print(F(" "));
  Serial.print(path);
  Serial.print(F(" ("));
  Serial.print(request.length());
  Serial.println(F(" bytes)"));

  char sendCmd[28];
  snprintf(sendCmd, sizeof(sendCmd), "AT+CIPSEND=%d", (int)request.length());
  if (!espSendCmd(sendCmd, ">", 5000)) {
    Serial.println(F("[FB FAIL] CIPSEND prompt timeout."));
    ESP_SERIAL.println(F("AT+CIPCLOSE"));
    return false;
  }

  while (ESP_SERIAL.available()) ESP_SERIAL.read();
  ESP_SERIAL.print(request);

  String resp;
  if (!espWaitForToken("SEND OK", 12000, &resp)) {
    Serial.print(F("[FB FAIL] SEND failed. Resp: "));
    Serial.println(resp);
    ESP_SERIAL.println(F("AT+CIPCLOSE"));
    return false;
  }

  // Read remaining HTTP response. Extend timeout while bytes continue to arrive.
  unsigned long readStart = millis();
  while (millis() - readStart < 7000) {
    while (ESP_SERIAL.available()) {
      resp += (char)ESP_SERIAL.read();
      readStart = millis();
    }
    if (resp.indexOf("CLOSED") != -1) break;
  }
  ESP_SERIAL.println(F("AT+CIPCLOSE"));

  bool ok = (resp.indexOf("HTTP/1.1 200") != -1) ||
            (resp.indexOf("HTTP/1.1 204") != -1);

  if (ok) {
    Serial.println(F("[FB PASS] HTTP write success."));
  } else {
    Serial.print(F("[FB WARN] HTTP response: "));
    Serial.println(resp);
  }
  return ok;
}

void firebasePushSensorLatest() {
  String payload = "{";
  payload += "\"deviceId\":\"" DEVICE_ID "\",";
  payload += "\"distance\":";
  if (noEcho || lastDistance < 0) payload += "null";
  else                            payload += String(lastDistance, 1);
  payload += ",";
  payload += "\"noEcho\":";
  payload += (noEcho ? "true" : "false");
  payload += ",";
  payload += "\"temperature\":";
  if (!dhtOK || isnan(dhtTemp))   payload += "null";
  else                            payload += String(dhtTemp, 1);
  payload += ",";
  payload += "\"humidity\":";
  if (!dhtOK || isnan(dhtHumidity)) payload += "null";
  else                              payload += String(dhtHumidity, 0);
  payload += ",";
  payload += "\"weight\":";
  if (!loadCellOK || isnan(foodWeightGram)) payload += "null";
  else                                       payload += String(foodWeightGram, 1);
  payload += ",";
  payload += "\"hasFood\":";
  payload += (hasFoodInContainer ? "true" : "false");
  payload += ",";
  payload += "\"timestamp\":{\".sv\":\"timestamp\"}";
  payload += "}";

  String path = "/sensors/latest.json";
  path += firebaseAuthQuery();

  Serial.println(F("[FB] Updating sensors/latest ..."));
  if (!espHttpJsonRequest("PUT", path, payload))
    Serial.println(F("[FB WARN] sensors/latest update failed."));
}

void firebasePushRFIDScan() {
  String payload = "{";
  payload += "\"deviceId\":\"" DEVICE_ID "\",";
  payload += "\"uid\":\"";
  payload += rfidUID;
  payload += "\",";
  payload += "\"type\":\"";
  payload += rfid.PICC_GetTypeName(rfidPiccType);
  payload += "\",";
  payload += "\"timestamp\":{\".sv\":\"timestamp\"}";
  payload += "}";

  String path = "/rfidScans.json";
  path += firebaseAuthQuery();

  Serial.println(F("[FB] Appending rfidScans entry ..."));
  if (!espHttpJsonRequest("POST", path, payload))
    Serial.println(F("[FB WARN] rfidScans append failed."));
}


// ═══════════════════════════════════════════════════════════
//  OLED PRIMITIVES
// ═══════════════════════════════════════════════════════════

void drawHeader(const char* label) {
  oled.fillRect(0, 0, 128, 11, SSD1306_WHITE);
  oled.setTextColor(SSD1306_BLACK);
  oled.setTextSize(1);
  oled.setCursor(3, 2);
  oled.print(label);
  if (wifiConnected) {
    oled.setCursor(110, 2);
    oled.print(F("WiF"));
  }
  oled.setTextColor(SSD1306_WHITE);
}

void drawCorners() {
  oled.drawFastHLine(0,   12, 7, SSD1306_WHITE);
  oled.drawFastVLine(0,   12, 7, SSD1306_WHITE);
  oled.drawFastHLine(121, 12, 7, SSD1306_WHITE);
  oled.drawFastVLine(127, 12, 7, SSD1306_WHITE);
  oled.drawFastHLine(0,   63, 7, SSD1306_WHITE);
  oled.drawFastVLine(0,   57, 7, SSD1306_WHITE);
  oled.drawFastHLine(121, 63, 7, SSD1306_WHITE);
  oled.drawFastVLine(127, 57, 7, SSD1306_WHITE);
}

void drawSignalBar(float dist) {
  const int bx = 4, by = 38, bw = 120, bh = 8;
  oled.drawRect(bx, by, bw, bh, SSD1306_WHITE);

  int filled = 0;
  if (!noEcho && dist > 0 && dist <= 300.0)
    filled = (int)map((long)constrain((int)dist, 1, 300), 1, 300, bw - 4, 0);
  if (filled > 0) oled.fillRect(bx + 2, by + 2, filled, bh - 4, SSD1306_WHITE);

  for (int t = bx + 24; t < bx + bw - 2; t += 24)
    oled.drawFastVLine(t, by - 3, 3, SSD1306_WHITE);
}

const char* getZoneLabel(float dist) {
  if (noEcho || dist < 0)  return "!! NO SIGNAL !!";
  if (dist < 15)           return "!! CRITICAL <15CM !!";
  if (dist < 50)           return ">> ZONE: NEAR";
  if (dist < 120)          return ">> ZONE: MID-RANGE";
  return                          ">> ZONE: FAR";
}

void glitchEffect() {
  oled.invertDisplay(true);  delay(70);
  oled.invertDisplay(false); delay(60);
  oled.invertDisplay(true);  delay(50);
  oled.invertDisplay(false);
}


// ═══════════════════════════════════════════════════════════
//  OLED SCREEN: Combined Sensor HUD (default)
//
//  Pixel map:
//   y= 0–10  Header ">> SENSOR HUD"        [WiF if connected]
//   y=12     Corner top brackets
//   y=12–32  Column dividers at x=44, x=87
//   y=13     Labels:  DIST   │ TEMP   │ HUM
//   y=23     Values:  124.7CM│ 25.5°C │ 65%
//   y=33     Horizontal separator
//   y=35–37  Tick marks
//   y=38–45  Proximity signal bar
//   y=48     Zone label (centred)
//   y=57     FAN:XX% (left) + blinking status dot (right)
//   y=57–63  Corner bottom brackets
// ═══════════════════════════════════════════════════════════

void displayHUD() {
  oled.clearDisplay();
  drawHeader(">> SENSOR HUD");
  drawCorners();

  // ── Column dividers ───────────────────────────────────
  oled.drawFastVLine(44, 12, 21, SSD1306_WHITE);
  oled.drawFastVLine(87, 12, 21, SSD1306_WHITE);

  oled.setTextSize(1);

  // ── Row 1: Labels ─────────────────────────────────────
  oled.setCursor(2,  13); oled.print(F("DIST"));
  oled.setCursor(46, 13); oled.print(F("TEMP"));
  oled.setCursor(89, 13); oled.print(F("HUM"));

  // ── Row 2: Live values ────────────────────────────────

  // Distance
  oled.setCursor(2, 23);
  if (noEcho || lastDistance < 0) {
    oled.print(F("--.-CM"));
  } else {
    char distStr[8];
    dtostrf(lastDistance, 0, 1, distStr);
    oled.print(distStr);
    oled.print(F("CM"));
  }

  // Temperature
  oled.setCursor(46, 23);
  if (!dhtOK || isnan(dhtTemp)) {
    oled.print(F("--.-"));
    oled.write(0xF8);
    oled.print('C');
  } else {
    char tempStr[7];
    dtostrf(dhtTemp, 0, 1, tempStr);
    oled.print(tempStr);
    oled.write(0xF8);
    oled.print('C');
  }

  // Humidity
  oled.setCursor(89, 23);
  if (!dhtOK || isnan(dhtHumidity)) {
    oled.print(F("--%"));
  } else {
    oled.print((int)dhtHumidity);
    oled.print('%');
  }

  // ── Horizontal separator ──────────────────────────────
  oled.drawFastHLine(2, 33, 124, SSD1306_WHITE);

  // ── Proximity bar ─────────────────────────────────────
  drawSignalBar(lastDistance);

  // ── Zone label (centred) ──────────────────────────────
  const char* zone = getZoneLabel(lastDistance);
  int16_t  bx1, by1;
  uint16_t tw, th;
  oled.getTextBounds(zone, 0, 0, &bx1, &by1, &tw, &th);
  oled.setCursor((128 - (int)tw) / 2, 48);
  oled.print(zone);

  // ── Fan speed indicator (bottom-left) ─────────────────
  oled.setCursor(4, 57);
  oled.print(F("FAN:"));
  oled.print(fanSpeed);
  oled.print('%');

  // ── Blinking status dot (bottom-right) ────────────────
  if (blinkState) oled.fillRect(117, 57, 5, 5, SSD1306_WHITE);

  oled.display();
}


// ═══════════════════════════════════════════════════════════
//  OLED SCREEN: RFID Scan Result
// ═══════════════════════════════════════════════════════════

void displayRFID() {
  oled.clearDisplay();
  drawHeader(">> RFID DETECTED");
  drawCorners();

  oled.setTextSize(1);
  oled.setCursor(4, 14); oled.print(F("UID :"));
  oled.setCursor(4, 23);
  oled.print(rfidUID[0] ? rfidUID : "--");

  oled.setCursor(4, 33);
  oled.print(F("TYPE:"));
  oled.print(rfid.PICC_GetTypeName(rfidPiccType));

  oled.drawFastHLine(4, 43, 120, SSD1306_WHITE);

  oled.fillRect(4, 45, 120, 10, SSD1306_WHITE);
  oled.setTextColor(SSD1306_BLACK);
  oled.setCursor(14, 47); oled.print(F(">> ACCESS LOGGED <<"));
  oled.setTextColor(SSD1306_WHITE);

  long remaining = ((long)rfidDisplayEnd - (long)millis()) / 1000L + 1L;
  remaining = constrain(remaining, 0L, 9L);
  oled.setCursor(4, 56);
  oled.print(F("RETURN IN ")); oled.print(remaining); oled.print(F("s"));

  if (blinkState) oled.fillRect(117, 56, 5, 5, SSD1306_WHITE);
  oled.display();
}


// ═══════════════════════════════════════════════════════════
//  HC-SR04: Distance Reading
// ═══════════════════════════════════════════════════════════

void readDistance() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  long duration = pulseIn(ECHO_PIN, HIGH, 30000);
  if (duration == 0) {
    noEcho = true; lastDistance = -1.0;
    Serial.println(F("[DIST] No echo — check wiring"));
    return;
  }
  noEcho       = false;
  lastDistance = duration * SOUND_SPEED / 2.0;
  Serial.print(F("[DIST] ")); Serial.print(lastDistance, 1); Serial.println(F(" cm"));
}


// ═══════════════════════════════════════════════════════════
//  DHT11: Temperature & Humidity Reading
// ═══════════════════════════════════════════════════════════

void readDHT() {
  float t = dht.readTemperature();
  float h = dht.readHumidity();

  if (isnan(t) || isnan(h)) {
    dhtOK = false;
    Serial.println(F("[DHT] Read failed — check wiring!"));
    return;
  }
  dhtOK       = true;
  dhtTemp     = t;
  dhtHumidity = h;

  Serial.print(F("[DHT] Temp: "));     Serial.print(t, 1);
  Serial.print(F(" C  |  Humidity: ")); Serial.print(h, 0);
  Serial.println(F(" %"));
}


// ═══════════════════════════════════════════════════════════
//  HX711: Food Weight Reading
// ═══════════════════════════════════════════════════════════

void readFoodWeight() {
  if (!loadCellOK) {
    return;
  }

  if (!scale.is_ready()) {
    foodWeightGram = NAN;
    hasFoodInContainer = false;
    Serial.println(F("[HX711] Not ready — check wiring."));
    return;
  }

  float rawWeight = scale.get_units(10);

  // Clamp tiny negative noise values to zero.
  if (rawWeight < 0 && rawWeight > -2.0) {
    rawWeight = 0.0;
  }

  foodWeightGram = rawWeight;
  hasFoodInContainer = foodWeightGram >= FOOD_PRESENT_THRESHOLD_G;

  Serial.print(F("[HX711] Weight: "));
  Serial.print(foodWeightGram, 1);
  Serial.print(F(" g  |  Food status: "));
  Serial.println(hasFoodInContainer ? F("HAS FOOD") : F("EMPTY"));
}


// ═══════════════════════════════════════════════════════════
//  RFID: Card Reading
// ═══════════════════════════════════════════════════════════

void readRFID() {
  Serial.println(F("------ RFID TAG DETECTED ------"));

  rfidPiccType = rfid.PICC_GetType(rfid.uid.sak);
  Serial.print(F("[TYPE] ")); Serial.println(rfid.PICC_GetTypeName(rfidPiccType));

  rfidUID[0] = '\0';
  char hexBuf[4];
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (i > 0) strncat(rfidUID, " ", sizeof(rfidUID) - strlen(rfidUID) - 1);
    snprintf(hexBuf, sizeof(hexBuf), "%02X", rfid.uid.uidByte[i]);
    strncat(rfidUID, hexBuf, sizeof(rfidUID) - strlen(rfidUID) - 1);
  }
  Serial.print(F("[UID]  ")); Serial.println(rfidUID);

  Serial.print(F("[C-ARRAY] { "));
  for (byte i = 0; i < rfid.uid.size; i++) {
    Serial.print(F("0x"));
    if (rfid.uid.uidByte[i] < 0x10) Serial.print(F("0"));
    Serial.print(rfid.uid.uidByte[i], HEX);
    if (i < rfid.uid.size - 1) Serial.print(F(", "));
  }
  Serial.println(F(" }  <- paste into AUTH_UIDS[][]"));

  byte gain = rfid.PCD_GetAntennaGain();
  Serial.print(F("[GAIN] 0x")); Serial.println(gain, HEX);
  Serial.println(F("-------------------------------\n"));

  // Push RFID event to Firebase so Web App can show live history
  firebasePushRFIDScan();

  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();

  displayMode    = MODE_RFID;
  rfidDisplayEnd = millis() + RFID_DISPLAY_DURATION;
  if (oledOK) { glitchEffect(); displayRFID(); }
}


// ═══════════════════════════════════════════════════════════
//  SETUP
// ═══════════════════════════════════════════════════════════

void setup() {
  Serial.begin(115200);
  while (!Serial && millis() < 3000);

  Serial.println(F("============================================"));
  Serial.println(F("RFID + HC-SR04 + DHT11 + HX711 + OLED + ESP + FAN"));
  Serial.println(F("           CYBERPUNK HUD  v1.4              "));
  Serial.println(F("============================================"));
  Serial.println(F("[FAN] Type 0-100 and Enter to set fan speed."));

  // ── Fan ───────────────────────────────────────────────
  pinMode(FAN_PIN, OUTPUT);
  analogWrite(FAN_PIN, 0);  // Start off
  Serial.println(F("[FAN] N-MOSFET fan ready on pin 6."));

  // ── RFID ──────────────────────────────────────────────
  SPI.begin();
  rfid.PCD_Init();
  delay(50);
  Serial.print(F("[RFID] Firmware: "));
  rfid.PCD_DumpVersionToSerial();
  byte v = rfid.PCD_ReadRegister(rfid.VersionReg);
  if (v == 0x00 || v == 0xFF)
    Serial.println(F("[RFID FAIL] RC522 not detected — check wiring!"));
  else
    Serial.println(F("[RFID PASS] RC522 ready."));
  for (byte i = 0; i < 6; i++) key.keyByte[i] = 0xFF;

  // ── HC-SR04 ───────────────────────────────────────────
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  Serial.println(F("[DIST] HC-SR04 ready."));

  // ── DHT11 ─────────────────────────────────────────────
  dht.begin();
  delay(1200);
  readDHT();
  Serial.print(F("[DHT] DHT11 "));
  Serial.println(dhtOK ? F("ready.") : F("FAIL — check wiring!"));

  // ── HX711 ─────────────────────────────────────────────
  scale.begin(LOADCELL_DOUT_PIN, LOADCELL_SCK_PIN);
  scale.set_scale(LOADCELL_CALIBRATION_FACTOR);
  Serial.println(F("[HX711] Taring... keep container empty."));
  delay(1500);

  if (scale.is_ready()) {
    scale.tare();
    loadCellOK = true;
    readFoodWeight();
  } else {
    loadCellOK = false;
    foodWeightGram = NAN;
    hasFoodInContainer = false;
    Serial.println(F("[HX711 FAIL] HX711 not ready — check wiring!"));
  }

  // ── OLED ──────────────────────────────────────────────
  Wire.begin();
  Wire.setClock(400000);

  if (!oled.begin(SSD1306_SWITCHCAPVCC, OLED_ADDR)) {
    Serial.println(F("[OLED FAIL] SSD1306 not found!"));
    Serial.println(F("            Check SDA/SCL (pins 20/21), address, power."));
  } else {
    oledOK = true;
    Serial.print(F("[OLED PASS] SSD1306 at 0x")); Serial.println(OLED_ADDR, HEX);

    oled.clearDisplay();
    drawHeader(">> SYS BOOT v1.4");
    oled.setTextSize(1);
    oled.setTextColor(SSD1306_WHITE);
    oled.setCursor(4, 14); oled.print(F("> MFRC522  "));
    oled.print((v == 0x00 || v == 0xFF) ? F("[FAIL]") : F("[OK]"));
    oled.setCursor(4, 24); oled.print(F("> HC-SR04  [OK]"));
    oled.setCursor(4, 34); oled.print(F("> DHT11    "));
    oled.print(dhtOK ? F("[OK]") : F("[FAIL]"));
    oled.setCursor(4, 44); oled.print(F("> HX711    "));
    oled.print(loadCellOK ? F("[OK]") : F("[FAIL]"));
    oled.setCursor(4, 54); oled.print(F("> ESP8266  INIT..."));
    oled.display();
  }

  // ── ESP8266 ───────────────────────────────────────────
  initESP8266();
  if (wifiConnected) configureESP8266SSL();

  // First sensor sync right after WiFi comes up
  if (wifiConnected) {
    firebasePushSensorLatest();
    lastFirebasePush = millis();
  }

  if (oledOK) {
    oled.fillRect(4, 54, 124, 10, SSD1306_BLACK);
    oled.setCursor(4, 54);
    oled.print(F("> ESP8266  "));
    oled.print(wifiConnected ? F("[OK] WIFI ON") : F("[WARN] NO WIFI"));
    oled.display();
    delay(2000);
    Serial.println(F("[OLED] Boot splash done. HUD active.\n"));
  }

  lastDHTTime = millis();
  lastWeightTime = millis();
}


// ═══════════════════════════════════════════════════════════
//  LOOP
// ═══════════════════════════════════════════════════════════

void loop() {
  unsigned long now = millis();

  // ── Blink ticker ───────────────────────────────────────
  if (now - lastBlinkTime >= BLINK_INTERVAL) {
    lastBlinkTime = now;
    blinkState    = !blinkState;
  }

  // ── Fan speed via Serial input (non-blocking) ──────────
  checkSerialFanInput();

  // ── Distance reading ───────────────────────────────────
  if (now - lastDistanceTime >= DISTANCE_INTERVAL) {
    lastDistanceTime = now;
    readDistance();
  }

  // ── DHT11 reading every 3 s ────────────────────────────
  if (now - lastDHTTime >= DHT_INTERVAL) {
    lastDHTTime = now;
    readDHT();
  }

  // ── HX711 food weight reading ──────────────────────────
  if (now - lastWeightTime >= WEIGHT_INTERVAL) {
    lastWeightTime = now;
    readFoodWeight();
  }

  // ── Firebase push (for Web App realtime display) ───────
  if (wifiConnected && (now - lastFirebasePush >= FIREBASE_SENSOR_INTERVAL)) {
    lastFirebasePush = now;
    firebasePushSensorLatest();
  }

  // ── RFID check ─────────────────────────────────────────
  if (rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial()) {
    readRFID();
    return;
  }

  // ── Auto-revert to HUD after RFID display timer ────────
  if (displayMode == MODE_RFID && now >= rfidDisplayEnd)
    displayMode = MODE_HUD;

  // ── OLED refresh ───────────────────────────────────────
  if (oledOK && (now - lastOledTime >= OLED_INTERVAL)) {
    lastOledTime = now;
    if (displayMode == MODE_RFID) displayRFID();
    else                          displayHUD();
  }
}