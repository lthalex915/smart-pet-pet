/*************************************************************
 * COMBINED: RFID-RC522 + HC-SR04 + DHT11 + HX711 + SSD1306 OLED + ESP8266 + FAN + FEEDER MOTOR/PUMP
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
 * --- FEEDER MOTOR + PUMP (L298N + IRLZ44N) ---
 *  L298N ENA   → Mega Pin 12 (PWM)
 *  L298N IN1   → Mega Pin 7
 *  L298N IN2   → Mega Pin 11
 *  IRLZ44N GATE→ Mega Pin 10 (Pump MOSFET)
 *  Command source: Firebase /sensors/feeding/command and /sensors/weight/command
 *  Supported actions:
 *    - "dispenseOnce" (motorRunMs: 300~5000 ms)
 *    - "tareWeight" / "zero" (set current bowl weight baseline to 0 g)
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
#include <EEPROM.h>
#include <limits.h>
#include <math.h>
#include <avr/wdt.h>

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
const int FAN_PIN  = 6;    // PWM-capable pin → MOSFET Signal input
int       fanSpeed = 0;    // Actual output speed 0–100 %
bool      fanManualOn = false;
int       fanManualPercent = 100;  // Frontend manual ON uses 100%
bool      fanAutoEnabled = true;
float     fanAutoThresholdC = 27.0;
bool      fanAutoTriggered = false;

// ── Feeder Motor/Pump (food dispensing actuator) ───────────
const int FEED_MOTOR_ENA_PIN = 12;      // L298N ENA (PWM speed)
const int FEED_MOTOR_IN1_PIN = 7;       // L298N IN1 (direction)
const int FEED_MOTOR_IN2_PIN = 11;      // L298N IN2 (direction)
const int FEED_PUMP_PIN      = 10;      // IRLZ44N gate (optional pump)
const int FEED_DISPENSE_SPEED_PERCENT = 100;
const bool FEED_PUMP_WITH_MOTOR = false; // Keep false for food-only dispenser
const int FEED_RUN_MS_DEFAULT = 1000;
const int FEED_RUN_MS_MIN     = 300;
const int FEED_RUN_MS_MAX     = 5000;
const int RFID_DISPENSE_RUN_MS = FEED_RUN_MS_DEFAULT;
const unsigned long RFID_DISPENSE_COOLDOWN_MS = 5000UL;
const int WATER_PUMP_RUN_MS_DEFAULT = 1500;
const int WATER_PUMP_INTERVAL_DEFAULT_MIN = 20;

int  feederMotorSpeed = 0;   // -100..100
bool feederPumpOn = false;
char lastFeedingRequestId[48] = "";
char lastWeightTareRequestId[48] = "";
int  waterPumpIntervalMin = WATER_PUMP_INTERVAL_DEFAULT_MIN;
unsigned long waterPumpIntervalMs = (unsigned long)WATER_PUMP_INTERVAL_DEFAULT_MIN * 60UL * 1000UL;
bool waterPumpCycleActive = false;
unsigned long waterPumpCycleStartedAt = 0;
unsigned long lastWaterPumpCycleAt = 0;
unsigned long lastRfidDispenseAt = 0;

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
float foodConsumedLastGram = 0.0;
float foodConsumedTotalGram = 0.0;

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

// ── Offline EEPROM Queue State ────────────────────────────
struct __attribute__((packed)) OfflineQueueMeta {
  uint16_t magic;
  uint8_t  version;
  uint8_t  reserved;
  uint16_t head;
  uint16_t count;
  uint32_t dropped;
};

struct __attribute__((packed)) OfflineSample {
  uint8_t  marker;
  uint32_t capturedAtMs;
  int16_t  distanceDeciCm;
  int16_t  tempDeciC;
  int16_t  humidityDeciPct;
  int32_t  weightDeciG;
  int32_t  foodConsumedLastDeciG;
  int32_t  foodConsumedTotalDeciG;
  int16_t  fanAutoThresholdDeciC;
  uint8_t  flags;
  uint8_t  fanSpeedPct;
  uint8_t  fanManualPct;
  uint8_t  waterPumpIntervalMin;
};

const uint16_t EEPROM_QUEUE_MAGIC   = 0xA55A;
const uint8_t  EEPROM_QUEUE_VERSION = 2;
const uint8_t  OFFLINE_SAMPLE_MARKER = 0xA5;

const uint8_t OFFLINE_FLAG_NO_ECHO           = 0x01;
const uint8_t OFFLINE_FLAG_DHT_VALID         = 0x02;
const uint8_t OFFLINE_FLAG_WEIGHT_VALID      = 0x04;
const uint8_t OFFLINE_FLAG_HAS_FOOD          = 0x08;
const uint8_t OFFLINE_FLAG_FAN_MANUAL_ON     = 0x10;
const uint8_t OFFLINE_FLAG_FAN_AUTO_ENABLED  = 0x20;
const uint8_t OFFLINE_FLAG_FAN_AUTO_TRIGGERED = 0x40;

const int EEPROM_QUEUE_META_ADDR = 0;
const int EEPROM_QUEUE_DATA_ADDR = EEPROM_QUEUE_META_ADDR + (int)sizeof(OfflineQueueMeta);

OfflineQueueMeta offlineMeta = {};
bool             offlineQueueEnabled = false;
uint16_t         offlineQueueCapacity = 0;

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
unsigned long lastFanControlPull = 0;
unsigned long lastFeedingControlPull = 0;
unsigned long lastFeedingSettingsPull = 0;
unsigned long lastWeightControlPull = 0;
unsigned long lastOfflineStoreTime = 0;
unsigned long lastOfflineFlushTime = 0;
unsigned long lastReconnectAttempt = 0;
bool          blinkState       = true;
bool          previousWifiConnected = false;

float         lastPushedDistance = NAN;
float         lastPushedTemp = NAN;
float         lastPushedHumidity = NAN;
float         lastPushedWeight = NAN;
int           lastPushedFanSpeed = -1;
int           lastPushedFanManualPercent = -1;
float         lastPushedFanAutoThresholdC = NAN;
float         lastPushedFoodConsumedLast = NAN;
float         lastPushedFoodConsumedTotal = NAN;
int           lastPushedWaterPumpIntervalMin = -1;
bool          lastPushedNoEcho = true;
bool          lastPushedHasFood = false;
bool          lastPushedFanManualOn = false;
bool          lastPushedFanAutoEnabled = false;
bool          lastPushedFanAutoTriggered = false;
bool          lastPushedSnapshotValid = false;

unsigned long currentDistanceInterval = 300;
float         adaptiveDistancePrev = NAN;
bool          adaptiveDistancePrevNoEcho = true;

unsigned long lastActivityTime = 0;
bool          oledDimmed = false;

bool          espPowerSaveConfigured = false;
bool          espPowerSaveSupported = false;

const unsigned long DISTANCE_INTERVAL             = 300;
const unsigned long DISTANCE_IDLE_INTERVAL        = 1000;
const unsigned long OLED_INTERVAL                 = 150;
const unsigned long BLINK_INTERVAL                = 500;
const unsigned long DHT_INTERVAL                  = 3000;
const unsigned long WEIGHT_INTERVAL               = 1500;
const unsigned long FIREBASE_SENSOR_INTERVAL      = 15000;
const unsigned long FIREBASE_FAN_CONTROL_INTERVAL = 20000;
const unsigned long FIREBASE_FEEDING_CONTROL_INTERVAL = 5000;
const unsigned long FIREBASE_FEEDING_SETTINGS_INTERVAL = 30000;
const unsigned long FIREBASE_WEIGHT_CONTROL_INTERVAL = 5000;
const unsigned long OFFLINE_STORE_INTERVAL         = 600000;
const unsigned long OFFLINE_FLUSH_INTERVAL         = 2000;
const unsigned long WIFI_RECONNECT_INTERVAL        = 15000;
const unsigned long OLED_DIM_TIMEOUT               = 60000;

const float DIST_SIGNIFICANT_CHANGE       = 5.0f;
const float DIST_CHANGE_THRESHOLD          = 2.0f;
const float TEMP_CHANGE_THRESHOLD          = 0.5f;
const float HUMID_CHANGE_THRESHOLD         = 2.0f;
const float WEIGHT_CHANGE_THRESHOLD        = 5.0f;
const float FAN_THRESHOLD_CHANGE_THRESHOLD = 0.2f;
const float FOOD_CONSUMED_CHANGE_THRESHOLD = 0.1f;
const float FOOD_CONSUMED_MIN_DELTA_G      = 0.2f;

// Forward declarations used before concrete definitions.
void configureESP8266SSL();
void configureESP8266PowerSave();
bool firebasePullFanSettings();
bool firebasePullFeedingCommand();
bool firebasePullFeedingSettings();
bool firebasePullWeightCommand();
bool firebasePushSensorLatest(bool forcePush = false);
String firebaseAuthQuery();
bool espHttpJsonRequest(const char* method, const String& path, const String& payload,
                        String* responseOut = NULL);
bool isSignedIntegerString(const String& input);
int sanitizeWaterPumpIntervalMin(int value);
void setFeederMotorSpeed(int speedPercent);
void setFeederPump(bool on);
bool runFeederDispenseOnce(int motorRunMs);
bool runLoadCellTare();
bool triggerRfidDispenseOnce();
bool sensorDataChangedSignificantly();
void updateLastPushedSnapshot();
void firebaseServiceWindow(unsigned long now);
void readDistanceSmart();
void checkOledDimming(unsigned long now);
void serviceWaterPumpAuto(unsigned long now);


// ═══════════════════════════════════════════════════════════
//  EEPROM OFFLINE QUEUE HELPERS
// ═══════════════════════════════════════════════════════════

bool isFiniteFloat(float value) {
  return !isnan(value) && !isinf(value);
}

void writeFloatText(char* out, size_t outSize, float value, uint8_t decimals) {
  if (!out || outSize == 0) {
    return;
  }

  if (!isFiniteFloat(value)) {
    strncpy(out, "null", outSize - 1);
    out[outSize - 1] = '\0';
    return;
  }

  dtostrf(value, 0, decimals, out);
}

bool floatChangedBeyondThreshold(float current, float previous, float threshold) {
  if (!isFiniteFloat(current) && !isFiniteFloat(previous)) {
    return false;
  }

  if (!isFiniteFloat(current) || !isFiniteFloat(previous)) {
    return true;
  }

  return fabsf(current - previous) > threshold;
}

void updateLastPushedSnapshot() {
  lastPushedDistance = lastDistance;
  lastPushedTemp = dhtTemp;
  lastPushedHumidity = dhtHumidity;
  lastPushedWeight = foodWeightGram;
  lastPushedFanSpeed = fanSpeed;
  lastPushedFanManualPercent = fanManualPercent;
  lastPushedFanAutoThresholdC = fanAutoThresholdC;
  lastPushedFoodConsumedLast = foodConsumedLastGram;
  lastPushedFoodConsumedTotal = foodConsumedTotalGram;
  lastPushedWaterPumpIntervalMin = waterPumpIntervalMin;
  lastPushedNoEcho = noEcho;
  lastPushedHasFood = hasFoodInContainer;
  lastPushedFanManualOn = fanManualOn;
  lastPushedFanAutoEnabled = fanAutoEnabled;
  lastPushedFanAutoTriggered = fanAutoTriggered;
  lastPushedSnapshotValid = true;
}

bool sensorDataChangedSignificantly() {
  if (!lastPushedSnapshotValid) {
    return true;
  }

  if (lastPushedNoEcho != noEcho) return true;
  if (lastPushedHasFood != hasFoodInContainer) return true;
  if (lastPushedFanManualOn != fanManualOn) return true;
  if (lastPushedFanAutoEnabled != fanAutoEnabled) return true;
  if (lastPushedFanAutoTriggered != fanAutoTriggered) return true;
  if (lastPushedFanSpeed != fanSpeed) return true;
  if (lastPushedFanManualPercent != fanManualPercent) return true;
  if (lastPushedWaterPumpIntervalMin != waterPumpIntervalMin) return true;

  if (floatChangedBeyondThreshold(lastDistance, lastPushedDistance, DIST_CHANGE_THRESHOLD)) return true;
  if (floatChangedBeyondThreshold(dhtTemp, lastPushedTemp, TEMP_CHANGE_THRESHOLD)) return true;
  if (floatChangedBeyondThreshold(dhtHumidity, lastPushedHumidity, HUMID_CHANGE_THRESHOLD)) return true;
  if (floatChangedBeyondThreshold(foodWeightGram, lastPushedWeight, WEIGHT_CHANGE_THRESHOLD)) return true;
  if (floatChangedBeyondThreshold(fanAutoThresholdC, lastPushedFanAutoThresholdC, FAN_THRESHOLD_CHANGE_THRESHOLD)) return true;
  if (floatChangedBeyondThreshold(foodConsumedLastGram, lastPushedFoodConsumedLast, FOOD_CONSUMED_CHANGE_THRESHOLD)) return true;
  if (floatChangedBeyondThreshold(foodConsumedTotalGram, lastPushedFoodConsumedTotal, FOOD_CONSUMED_CHANGE_THRESHOLD)) return true;

  return false;
}

int16_t floatToDeciInt16(float value) {
  if (!isFiniteFloat(value)) {
    return 0;
  }

  float scaled = value * 10.0f;
  long rounded = (scaled >= 0.0f) ? (long)(scaled + 0.5f) : (long)(scaled - 0.5f);

  if (rounded > 32767L) rounded = 32767L;
  if (rounded < -32768L) rounded = -32768L;
  return (int16_t)rounded;
}

int32_t floatToDeciInt32(float value) {
  if (!isFiniteFloat(value)) {
    return 0;
  }

  float scaled = value * 10.0f;
  float roundedF = (scaled >= 0.0f) ? (scaled + 0.5f) : (scaled - 0.5f);
  if (roundedF > (float)LONG_MAX) roundedF = (float)LONG_MAX;
  if (roundedF < (float)LONG_MIN) roundedF = (float)LONG_MIN;
  return (int32_t)roundedF;
}

float deciInt16ToFloat(int16_t value) {
  return ((float)value) / 10.0f;
}

float deciInt32ToFloat(int32_t value) {
  return ((float)value) / 10.0f;
}

int offlineQueueSlotAddress(uint16_t slot) {
  return EEPROM_QUEUE_DATA_ADDR + ((int)slot * (int)sizeof(OfflineSample));
}

void offlineQueuePersistMeta() {
  EEPROM.put(EEPROM_QUEUE_META_ADDR, offlineMeta);
}

bool offlineQueueMetaValid(const OfflineQueueMeta& meta) {
  if (meta.magic != EEPROM_QUEUE_MAGIC) return false;
  if (meta.version != EEPROM_QUEUE_VERSION) return false;
  if (offlineQueueCapacity == 0) return false;
  if (meta.head >= offlineQueueCapacity) return false;
  if (meta.count > offlineQueueCapacity) return false;
  return true;
}

void offlineQueueReset(bool keepDroppedCounter = true) {
  uint32_t droppedSnapshot = keepDroppedCounter ? offlineMeta.dropped : 0;

  offlineMeta.magic = EEPROM_QUEUE_MAGIC;
  offlineMeta.version = EEPROM_QUEUE_VERSION;
  offlineMeta.reserved = 0;
  offlineMeta.head = 0;
  offlineMeta.count = 0;
  offlineMeta.dropped = droppedSnapshot;
  offlineQueuePersistMeta();
}

void offlineQueueInit() {
  int totalBytes = EEPROM.length();
  int usableBytes = totalBytes - EEPROM_QUEUE_DATA_ADDR;

  if (usableBytes <= 0) {
    offlineQueueEnabled = false;
    offlineQueueCapacity = 0;
    Serial.println(F("[EEPROM WARN] Not enough EEPROM for offline queue."));
    return;
  }

  offlineQueueCapacity = (uint16_t)(usableBytes / (int)sizeof(OfflineSample));
  if (offlineQueueCapacity == 0) {
    offlineQueueEnabled = false;
    Serial.println(F("[EEPROM WARN] Offline queue capacity is zero."));
    return;
  }

  OfflineQueueMeta storedMeta;
  EEPROM.get(EEPROM_QUEUE_META_ADDR, storedMeta);

  offlineQueueEnabled = true;
  if (!offlineQueueMetaValid(storedMeta)) {
    offlineMeta = {};
    offlineQueueReset(false);
    Serial.println(F("[EEPROM] Queue metadata initialized."));
  } else {
    offlineMeta = storedMeta;
    Serial.println(F("[EEPROM] Queue metadata loaded."));
  }

  Serial.print(F("[EEPROM] Offline queue capacity: "));
  Serial.print(offlineQueueCapacity);
  Serial.println(F(" samples."));
  if (offlineMeta.count > 0) {
    Serial.print(F("[EEPROM] Pending buffered samples: "));
    Serial.println(offlineMeta.count);
  }
}

bool offlineQueueReadSlot(uint16_t slot, OfflineSample* outSample) {
  if (!offlineQueueEnabled || !outSample) return false;
  if (slot >= offlineQueueCapacity) return false;

  EEPROM.get(offlineQueueSlotAddress(slot), *outSample);
  return true;
}

void offlineQueueWriteSlot(uint16_t slot, const OfflineSample& sample) {
  if (!offlineQueueEnabled) return;
  if (slot >= offlineQueueCapacity) return;

  EEPROM.put(offlineQueueSlotAddress(slot), sample);
}

bool offlineQueuePush(const OfflineSample& sample) {
  if (!offlineQueueEnabled || offlineQueueCapacity == 0) {
    return false;
  }

  uint16_t writeSlot;
  bool overwritten = false;

  if (offlineMeta.count < offlineQueueCapacity) {
    writeSlot = (offlineMeta.head + offlineMeta.count) % offlineQueueCapacity;
    offlineMeta.count++;
  } else {
    writeSlot = offlineMeta.head;
    offlineMeta.head = (offlineMeta.head + 1) % offlineQueueCapacity;
    offlineMeta.dropped++;
    overwritten = true;
  }

  offlineQueueWriteSlot(writeSlot, sample);
  offlineQueuePersistMeta();

  Serial.print(F("[EEPROM] Buffered sample. pending="));
  Serial.print(offlineMeta.count);
  if (overwritten) {
    Serial.print(F(" (oldest overwritten, dropped="));
    Serial.print(offlineMeta.dropped);
    Serial.print(')');
  }
  Serial.println();
  return true;
}

bool offlineQueuePopOldest() {
  if (!offlineQueueEnabled || offlineMeta.count == 0 || offlineQueueCapacity == 0) {
    return false;
  }

  offlineMeta.head = (offlineMeta.head + 1) % offlineQueueCapacity;
  offlineMeta.count--;
  offlineQueuePersistMeta();
  return true;
}

bool offlineQueuePeekOldest(OfflineSample* outSample) {
  if (!offlineQueueEnabled || offlineMeta.count == 0 || !outSample) {
    return false;
  }

  if (!offlineQueueReadSlot(offlineMeta.head, outSample)) {
    return false;
  }

  if (outSample->marker != OFFLINE_SAMPLE_MARKER) {
    Serial.println(F("[EEPROM WARN] Invalid marker in oldest sample. Dropping it."));
    offlineMeta.dropped++;
    offlineQueuePopOldest();
    return false;
  }

  return true;
}

OfflineSample buildCurrentOfflineSample(unsigned long now) {
  OfflineSample sample = {};
  sample.marker = OFFLINE_SAMPLE_MARKER;
  sample.capturedAtMs = now;

  if (noEcho || lastDistance < 0 || !isFiniteFloat(lastDistance)) {
    sample.flags |= OFFLINE_FLAG_NO_ECHO;
  } else {
    sample.distanceDeciCm = floatToDeciInt16(lastDistance);
  }

  if (dhtOK && isFiniteFloat(dhtTemp) && isFiniteFloat(dhtHumidity)) {
    sample.flags |= OFFLINE_FLAG_DHT_VALID;
    sample.tempDeciC = floatToDeciInt16(dhtTemp);
    sample.humidityDeciPct = floatToDeciInt16(dhtHumidity);
  }

  if (loadCellOK && isFiniteFloat(foodWeightGram)) {
    sample.flags |= OFFLINE_FLAG_WEIGHT_VALID;
    sample.weightDeciG = floatToDeciInt32(foodWeightGram);
  }

  sample.foodConsumedLastDeciG = floatToDeciInt32(foodConsumedLastGram);
  sample.foodConsumedTotalDeciG = floatToDeciInt32(foodConsumedTotalGram);

  if (hasFoodInContainer) sample.flags |= OFFLINE_FLAG_HAS_FOOD;
  if (fanManualOn) sample.flags |= OFFLINE_FLAG_FAN_MANUAL_ON;
  if (fanAutoEnabled) sample.flags |= OFFLINE_FLAG_FAN_AUTO_ENABLED;
  if (fanAutoTriggered) sample.flags |= OFFLINE_FLAG_FAN_AUTO_TRIGGERED;

  sample.fanSpeedPct = (uint8_t)constrain(fanSpeed, 0, 100);
  sample.fanManualPct = (uint8_t)constrain(fanManualPercent, 0, 100);
  sample.fanAutoThresholdDeciC = floatToDeciInt16(fanAutoThresholdC);
  sample.waterPumpIntervalMin = (uint8_t)sanitizeWaterPumpIntervalMin(waterPumpIntervalMin);

  return sample;
}

String buildOfflineSamplePayload(const OfflineSample& sample) {
  String payload = "{";
  payload += "\"deviceId\":\"" DEVICE_ID "\",";

  payload += "\"distance\":";
  if (sample.flags & OFFLINE_FLAG_NO_ECHO) payload += "null";
  else payload += String(deciInt16ToFloat(sample.distanceDeciCm), 1);
  payload += ",";

  payload += "\"noEcho\":";
  payload += ((sample.flags & OFFLINE_FLAG_NO_ECHO) ? "true" : "false");
  payload += ",";

  payload += "\"temperature\":";
  if (sample.flags & OFFLINE_FLAG_DHT_VALID) payload += String(deciInt16ToFloat(sample.tempDeciC), 1);
  else payload += "null";
  payload += ",";

  payload += "\"humidity\":";
  if (sample.flags & OFFLINE_FLAG_DHT_VALID) payload += String(deciInt16ToFloat(sample.humidityDeciPct), 1);
  else payload += "null";
  payload += ",";

  payload += "\"weight\":";
  if (sample.flags & OFFLINE_FLAG_WEIGHT_VALID) payload += String(deciInt32ToFloat(sample.weightDeciG), 1);
  else payload += "null";
  payload += ",";

  payload += "\"foodConsumedLastG\":";
  payload += String(deciInt32ToFloat(sample.foodConsumedLastDeciG), 1);
  payload += ",";

  payload += "\"foodConsumedTotalG\":";
  payload += String(deciInt32ToFloat(sample.foodConsumedTotalDeciG), 1);
  payload += ",";

  payload += "\"waterPumpIntervalMin\":";
  payload += String((int)sample.waterPumpIntervalMin);
  payload += ",";

  payload += "\"hasFood\":";
  payload += ((sample.flags & OFFLINE_FLAG_HAS_FOOD) ? "true" : "false");
  payload += ",";

  payload += "\"fanSpeed\":";
  payload += String((int)sample.fanSpeedPct);
  payload += ",";

  payload += "\"fanManualOn\":";
  payload += ((sample.flags & OFFLINE_FLAG_FAN_MANUAL_ON) ? "true" : "false");
  payload += ",";

  payload += "\"fanManualPercent\":";
  payload += String((int)sample.fanManualPct);
  payload += ",";

  payload += "\"fanAutoEnabled\":";
  payload += ((sample.flags & OFFLINE_FLAG_FAN_AUTO_ENABLED) ? "true" : "false");
  payload += ",";

  payload += "\"fanAutoThresholdC\":";
  payload += String(deciInt16ToFloat(sample.fanAutoThresholdDeciC), 1);
  payload += ",";

  payload += "\"fanAutoTriggered\":";
  payload += ((sample.flags & OFFLINE_FLAG_FAN_AUTO_TRIGGERED) ? "true" : "false");
  payload += ",";

  payload += "\"offlineBuffered\":true,";
  payload += "\"capturedAtMs\":";
  payload += String(sample.capturedAtMs);
  payload += ",";
  payload += "\"timestamp\":{\".sv\":\"timestamp\"}";
  payload += "}";
  return payload;
}

bool firebasePushOfflineSample(const OfflineSample& sample) {
  String payload = buildOfflineSamplePayload(sample);
  String path = "/sensors/history.json";
  path += firebaseAuthQuery();

  Serial.println(F("[FB] Uploading buffered sample -> sensors/history"));
  return espHttpJsonRequest("POST", path, payload);
}

void storeOfflineSampleIfDue(unsigned long now) {
  if (!offlineQueueEnabled || wifiConnected) {
    return;
  }

  if (now - lastOfflineStoreTime < OFFLINE_STORE_INTERVAL) {
    return;
  }

  lastOfflineStoreTime = now;
  OfflineSample sample = buildCurrentOfflineSample(now);
  if (!offlineQueuePush(sample)) {
    Serial.println(F("[EEPROM WARN] Failed to buffer offline sample."));
  }
}

void flushOfflineQueueBatch(uint8_t maxSamples) {
  if (!offlineQueueEnabled || !wifiConnected || offlineMeta.count == 0 || maxSamples == 0) {
    return;
  }

  uint8_t sent = 0;
  uint8_t attempts = 0;
  const uint8_t maxAttempts = maxSamples + 3;

  while (sent < maxSamples && attempts < maxAttempts && offlineMeta.count > 0 && wifiConnected) {
    attempts++;

    OfflineSample sample;
    if (!offlineQueuePeekOldest(&sample)) {
      continue;
    }

    if (firebasePushOfflineSample(sample)) {
      offlineQueuePopOldest();
      sent++;
      Serial.print(F("[EEPROM] Buffered sample sent. pending="));
      Serial.println(offlineMeta.count);
    } else {
      Serial.println(F("[EEPROM WARN] Buffered sample upload failed; retry later."));
      break;
    }
  }
}

void flushOfflineQueueIfDue(unsigned long now) {
  if (!offlineQueueEnabled || !wifiConnected || offlineMeta.count == 0) {
    return;
  }

  if (now - lastOfflineFlushTime < OFFLINE_FLUSH_INTERVAL) {
    return;
  }

  lastOfflineFlushTime = now;
  flushOfflineQueueBatch(2);
}


// ═══════════════════════════════════════════════════════════
//  FAN CONTROL
// ═══════════════════════════════════════════════════════════

void setFanSpeed(int percent) {
  int safePercent = constrain(percent, 0, 100);
  if (fanSpeed == safePercent) {
    return;
  }

  fanSpeed = safePercent;
  int pwmValue = map(fanSpeed, 0, 100, 0, 255);
  analogWrite(FAN_PIN, pwmValue);

  Serial.print(F("[FAN] Speed set to "));
  Serial.print(fanSpeed);
  Serial.println(F("%"));
}

void applyFanControlLogic() {
  fanAutoTriggered = fanAutoEnabled && dhtOK && !isnan(dhtTemp) && dhtTemp >= fanAutoThresholdC;

  int targetSpeed = 0;
  if (fanManualOn) {
    targetSpeed = fanManualPercent;
  }
  if (fanAutoTriggered) {
    // Temperature-triggered mode forces fan ON.
    targetSpeed = max(targetSpeed, 100);
  }

  setFanSpeed(targetSpeed);
}

// Called every loop() — non-blocking serial read
// USB serial helper for fan + feeder diagnostics.
void checkSerialCommandInput() {
  if (Serial.available() <= 0) {
    return;
  }

  String input = Serial.readStringUntil('\n');
  input.trim();
  if (input.length() == 0) {
    return;
  }

  if (input.equalsIgnoreCase("help")) {
    Serial.println(F("--- Serial Commands ---"));
    Serial.println(F("0~100              : fan manual speed (%)"));
    Serial.println(F("motor <speed>      : feeder motor -100..100"));
    Serial.println(F("pump on|off        : feeder pump control"));
    Serial.println(F("dispense [runMs]   : run one feed cycle"));
    Serial.println(F("tare               : set current weight to 0g"));
    Serial.println(F("help               : show this list"));
    Serial.println(F("-----------------------"));
    return;
  }

  if (input.startsWith("motor ")) {
    String param = input.substring(6);
    param.trim();
    if (!isSignedIntegerString(param)) {
      Serial.println(F("[FEED] motor expects an integer (-100..100)."));
      return;
    }

    int speedVal = constrain(param.toInt(), -100, 100);
    setFeederMotorSpeed(speedVal);
    Serial.print(F("[FEED] Motor speed set to "));
    Serial.print(speedVal);
    Serial.println(F("%"));
    return;
  }

  if (input.equalsIgnoreCase("pump on")) {
    setFeederPump(true);
    Serial.println(F("[FEED] Pump turned ON"));
    return;
  }

  if (input.equalsIgnoreCase("pump off")) {
    setFeederPump(false);
    Serial.println(F("[FEED] Pump turned OFF"));
    return;
  }

  if (input.startsWith("dispense")) {
    int runMs = FEED_RUN_MS_DEFAULT;
    if (input.length() > 8) {
      String param = input.substring(8);
      param.trim();
      if (param.length() > 0) {
        if (!isSignedIntegerString(param)) {
          Serial.println(F("[FEED] dispense expects optional integer runMs."));
          return;
        }
        runMs = param.toInt();
      }
    }

    runFeederDispenseOnce(runMs);
    return;
  }

  if (input.equalsIgnoreCase("tare")) {
    runLoadCellTare();
    return;
  }

  if (!isSignedIntegerString(input)) {
    Serial.println(F("[SERIAL] Unknown command. Type 'help' for list."));
    return;
  }

  int value = input.toInt();
  if (value < 0 || value > 100) {
    Serial.println(F("[FAN] Please enter a value between 0 and 100."));
    return;
  }

  fanManualPercent = value;
  fanManualOn = (value > 0);
  Serial.print(F("[FAN] Manual control from Serial: "));
  Serial.print(fanManualOn ? F("ON ") : F("OFF "));
  Serial.print(fanManualPercent);
  Serial.println(F("%"));

  applyFanControlLogic();
}


// ═══════════════════════════════════════════════════════════
//  FEEDER MOTOR/PUMP CONTROL
// ═══════════════════════════════════════════════════════════

void setFeederMotorSpeed(int speedPercent) {
  int safeSpeed = constrain(speedPercent, -100, 100);
  if (feederMotorSpeed == safeSpeed) {
    return;
  }

  feederMotorSpeed = safeSpeed;

  if (safeSpeed > 0) {
    digitalWrite(FEED_MOTOR_IN1_PIN, HIGH);
    digitalWrite(FEED_MOTOR_IN2_PIN, LOW);
  } else if (safeSpeed < 0) {
    digitalWrite(FEED_MOTOR_IN1_PIN, LOW);
    digitalWrite(FEED_MOTOR_IN2_PIN, HIGH);
  } else {
    digitalWrite(FEED_MOTOR_IN1_PIN, LOW);
    digitalWrite(FEED_MOTOR_IN2_PIN, LOW);
  }

  int pwmValue = map(abs(safeSpeed), 0, 100, 0, 255);
  analogWrite(FEED_MOTOR_ENA_PIN, pwmValue);
}

void setFeederPump(bool on) {
  feederPumpOn = on;
  digitalWrite(FEED_PUMP_PIN, on ? HIGH : LOW);
}

bool runFeederDispenseOnce(int motorRunMs) {
  int safeRunMs = constrain(motorRunMs, FEED_RUN_MS_MIN, FEED_RUN_MS_MAX);

  Serial.print(F("[FEED] Dispense start | runMs="));
  Serial.println(safeRunMs);

  setFeederMotorSpeed(FEED_DISPENSE_SPEED_PERCENT);
  if (FEED_PUMP_WITH_MOTOR) {
    setFeederPump(true);
  }

  unsigned long startedAt = millis();
  while (millis() - startedAt < (unsigned long)safeRunMs) {
    wdt_reset();
    delay(50);
  }

  setFeederMotorSpeed(0);
  if (FEED_PUMP_WITH_MOTOR) {
    setFeederPump(false);
  }

  Serial.println(F("[FEED] Dispense done."));
  return true;
}

bool runLoadCellTare() {
  if (!loadCellOK) {
    Serial.println(F("[HX711 WARN] Skip tare: load cell not ready."));
    return false;
  }

  if (!scale.is_ready()) {
    Serial.println(F("[HX711 WARN] Skip tare: HX711 not ready."));
    return false;
  }

  Serial.println(F("[HX711] Tare requested. Keep bowl still..."));
  scale.tare(15);

  foodWeightGram = 0.0f;
  foodConsumedLastGram = 0.0f;
  foodConsumedTotalGram = 0.0f;
  hasFoodInContainer = false;

  Serial.println(F("[HX711 PASS] Weight baseline reset to 0 g."));
  firebasePushSensorLatest(true);
  return true;
}

bool triggerRfidDispenseOnce() {
  unsigned long now = millis();
  if (now - lastRfidDispenseAt < RFID_DISPENSE_COOLDOWN_MS) {
    unsigned long remainingMs = RFID_DISPENSE_COOLDOWN_MS - (now - lastRfidDispenseAt);
    Serial.print(F("[RFID FEED] Cooldown active, skip dispense. Remaining ms="));
    Serial.println(remainingMs);
    return false;
  }

  lastRfidDispenseAt = now;

  Serial.print(F("[RFID FEED] Triggering dispense runMs="));
  Serial.println(RFID_DISPENSE_RUN_MS);

  bool ok = runFeederDispenseOnce(RFID_DISPENSE_RUN_MS);
  if (ok) {
    firebasePushSensorLatest(true);
  }

  return ok;
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
    wdt_reset();
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
  wifiConnected = false;
  espPowerSaveConfigured = false;
  espPowerSaveSupported = false;
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

void attemptWiFiReconnect(unsigned long now) {
  if (wifiConnected) {
    return;
  }

  if (now - lastReconnectAttempt < WIFI_RECONNECT_INTERVAL) {
    return;
  }

  lastReconnectAttempt = now;
  Serial.println(F("[ESP] WiFi offline. Attempting reconnect..."));

  initESP8266();
  if (!wifiConnected) {
    Serial.println(F("[ESP WARN] Reconnect failed."));
    return;
  }

  configureESP8266SSL();
  configureESP8266PowerSave();
  firebasePullFanSettings();
  lastFanControlPull = now;
  firebasePullFeedingSettings();
  lastFeedingSettingsPull = now;
  firebasePullFeedingCommand();
  lastFeedingControlPull = now;
  firebasePullWeightCommand();
  lastWeightControlPull = now;
  firebasePushSensorLatest(true);
  lastFirebasePush = now;
  lastOfflineFlushTime = 0;

  Serial.println(F("[ESP PASS] Reconnect complete."));
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

void configureESP8266PowerSave() {
  if (!wifiConnected) {
    return;
  }

  if (espPowerSaveConfigured) {
    return;
  }

  Serial.println(F("[ESP] Enabling modem sleep (battery save)..."));
  if (espSendCmd("AT+SLEEP=2", "OK", 3000) || espSendCmd("AT+SLEEP=1", "OK", 3000)) {
    espPowerSaveSupported = true;
    Serial.println(F("[ESP PASS] Modem sleep enabled."));
  } else {
    espPowerSaveSupported = false;
    Serial.println(F("[ESP WARN] Modem sleep unsupported on this AT firmware."));
  }

  espPowerSaveConfigured = true;
}


// ═══════════════════════════════════════════════════════════
//  Firebase REST Push Helpers (via ESP8266 AT)
// ═══════════════════════════════════════════════════════════

bool espWaitForToken(const char* expected, unsigned long timeoutMs, String* responseOut) {
  String resp = "";
  unsigned long start = millis();

  while (millis() - start < timeoutMs) {
    wdt_reset();
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
    wdt_reset();
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

bool espHttpJsonRequest(const char* method, const String& path, const String& payload,
                        String* responseOut) {
  if (!wifiConnected) {
    Serial.println(F("[FB WARN] Skip push — WiFi is not connected."));
    return false;
  }

  String openResp;
  if (!espOpenFirebaseSocket(&openResp)) {
    Serial.println(F("[FB FAIL] SSL socket open failed (CIPSTART)."));
    Serial.print(F("[FB FAIL] CIPSTART response: "));
    Serial.println(openResp);
    wifiConnected = false;
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
    wifiConnected = false;
    return false;
  }

  while (ESP_SERIAL.available()) ESP_SERIAL.read();
  ESP_SERIAL.print(request);

  String resp;
  if (!espWaitForToken("SEND OK", 12000, &resp)) {
    Serial.print(F("[FB FAIL] SEND failed. Resp: "));
    Serial.println(resp);
    ESP_SERIAL.println(F("AT+CIPCLOSE"));
    wifiConnected = false;
    return false;
  }

  // Read remaining HTTP response. Extend timeout while bytes continue to arrive.
  unsigned long readStart = millis();
  while (millis() - readStart < 7000) {
    wdt_reset();
    while (ESP_SERIAL.available()) {
      resp += (char)ESP_SERIAL.read();
      readStart = millis();
    }
    if (resp.indexOf("CLOSED") != -1) break;
  }
  ESP_SERIAL.println(F("AT+CIPCLOSE"));

  bool disconnected = (resp.indexOf("WIFI DISCONNECT") != -1) ||
                      (resp.indexOf("CLOSED") != -1 && resp.indexOf("HTTP/1.1") == -1);
  if (disconnected) {
    wifiConnected = false;
    Serial.println(F("[FB WARN] Link dropped during HTTP request."));
  }

  bool ok = (resp.indexOf("HTTP/1.1 200") != -1) ||
            (resp.indexOf("HTTP/1.1 204") != -1);

  if (ok) {
    Serial.println(F("[FB PASS] HTTP write success."));
  } else {
    Serial.print(F("[FB WARN] HTTP response: "));
    Serial.println(resp);
  }
  if (responseOut) {
    *responseOut = resp;
  }

  return ok;
}

int jsonFindKeyColon(const String& json, const char* key) {
  String token = String("\"") + key + "\"";
  int keyPos = json.indexOf(token);
  if (keyPos < 0) {
    return -1;
  }

  return json.indexOf(':', keyPos + token.length());
}

int jsonSkipSpace(const String& text, int idx) {
  while (idx < text.length()) {
    char c = text[idx];
    if (c != ' ' && c != '\n' && c != '\r' && c != '\t') {
      break;
    }
    idx++;
  }
  return idx;
}

bool jsonReadBool(const String& json, const char* key, bool* outValue) {
  int colon = jsonFindKeyColon(json, key);
  if (colon < 0) {
    return false;
  }

  int start = jsonSkipSpace(json, colon + 1);
  if (start >= json.length()) {
    return false;
  }

  if (json.startsWith("true", start)) {
    *outValue = true;
    return true;
  }

  if (json.startsWith("false", start)) {
    *outValue = false;
    return true;
  }

  return false;
}

bool jsonReadFloat(const String& json, const char* key, float* outValue) {
  int colon = jsonFindKeyColon(json, key);
  if (colon < 0) {
    return false;
  }

  int start = jsonSkipSpace(json, colon + 1);
  if (start >= json.length()) {
    return false;
  }

  bool quoted = false;
  if (json[start] == '"') {
    quoted = true;
    start++;
  }

  int end = start;
  bool hasDigit = false;
  while (end < json.length()) {
    char c = json[end];

    bool numeric = (c >= '0' && c <= '9') || c == '.' || c == '-' || c == '+' || c == 'e' || c == 'E';
    if (!numeric) {
      break;
    }

    if (c >= '0' && c <= '9') {
      hasDigit = true;
    }

    end++;
  }

  if (!hasDigit) {
    return false;
  }

  if (quoted) {
    if (end >= json.length() || json[end] != '"') {
      return false;
    }
  }

  String token = json.substring(start, end);
  *outValue = token.toFloat();
  return true;
}

bool jsonReadString(const String& json, const char* key, String* outValue) {
  if (!outValue) {
    return false;
  }

  int colon = jsonFindKeyColon(json, key);
  if (colon < 0) {
    return false;
  }

  int start = jsonSkipSpace(json, colon + 1);
  if (start >= json.length()) {
    return false;
  }

  if (json[start] == '"') {
    start++;
    String value = "";

    for (int i = start; i < json.length(); i++) {
      char c = json[i];
      if (c == '\\') {
        if (i + 1 < json.length()) {
          value += json[i + 1];
          i++;
        }
        continue;
      }

      if (c == '"') {
        *outValue = value;
        return true;
      }

      value += c;
    }

    return false;
  }

  int end = start;
  while (end < json.length()) {
    char c = json[end];
    if (c == ',' || c == '}' || c == '\r' || c == '\n' || c == '\t' || c == ' ') {
      break;
    }
    end++;
  }

  if (end <= start) {
    return false;
  }

  *outValue = json.substring(start, end);
  return true;
}

bool extractHttpBody(const String& response, String* outBody) {
  if (!outBody) {
    return false;
  }

  int bodyPos = response.indexOf("\r\n\r\n");
  if (bodyPos < 0) {
    return false;
  }

  *outBody = response.substring(bodyPos + 4);
  outBody->trim();
  return true;
}

bool isSignedIntegerString(const String& input) {
  if (input.length() == 0) {
    return false;
  }

  int start = 0;
  if (input[0] == '+' || input[0] == '-') {
    start = 1;
  }

  if (start >= input.length()) {
    return false;
  }

  for (int i = start; i < input.length(); i++) {
    if (input[i] < '0' || input[i] > '9') {
      return false;
    }
  }

  return true;
}

int sanitizeWaterPumpIntervalMin(int value) {
  int rounded = (int)(value / 5) * 5;
  if (value % 5 >= 3) {
    rounded += 5;
  }

  if (rounded < 15) return 15;
  if (rounded > 30) return 30;
  return rounded;
}

bool firebasePullFanSettings() {
  const char* settingsPaths[] = {
    "/sensors/fanSettings.json",  // preferred shared path
    "/fan/settings.json",         // deprecated fallback path
  };

  String response;
  String activePath = "";

  for (int i = 0; i < 2; i++) {
    String path = String(settingsPaths[i]);
    path += firebaseAuthQuery();

    if (!espHttpJsonRequest("GET", path, "", &response)) {
      if (i == 0) {
        Serial.println(F("[FAN WARN] sensors/fanSettings fetch failed, trying legacy path."));
      } else {
        Serial.println(F("[FAN WARN] fan/settings fetch failed."));
      }
      continue;
    }

    int bodyPos = response.indexOf("\r\n\r\n");
    if (bodyPos < 0) {
      if (i == 0) {
        Serial.println(F("[FAN WARN] sensors/fanSettings response has no body, trying legacy path."));
      } else {
        Serial.println(F("[FAN WARN] fan/settings response has no body."));
      }
      continue;
    }

    String body = response.substring(bodyPos + 4);
    body.trim();

    if (body.length() == 0 || body == "null") {
      if (i == 0) {
        Serial.println(F("[FAN] sensors/fanSettings not found, trying legacy path."));
      } else {
        Serial.println(F("[FAN] fan/settings not found, keeping previous settings."));
      }
      continue;
    }

    activePath = settingsPaths[i];

    bool parsedAny = false;
    bool nextManualOn = fanManualOn;
    float nextManualPercent = fanManualPercent;
    bool nextAutoEnabled = fanAutoEnabled;
    float nextAutoThresholdC = fanAutoThresholdC;

    bool boolValue;
    float floatValue;

    if (jsonReadBool(body, "manualOn", &boolValue)) {
      nextManualOn = boolValue;
      parsedAny = true;
    }
    if (jsonReadFloat(body, "manualPercent", &floatValue)) {
      nextManualPercent = floatValue;
      parsedAny = true;
    }
    if (jsonReadBool(body, "autoEnabled", &boolValue)) {
      nextAutoEnabled = boolValue;
      parsedAny = true;
    }
    if (jsonReadFloat(body, "autoThresholdC", &floatValue)) {
      nextAutoThresholdC = floatValue;
      parsedAny = true;
    }

    if (!parsedAny) {
      Serial.println(F("[FAN WARN] fan settings JSON has no recognized fields."));
      continue;
    }

    fanManualOn = nextManualOn;
    fanManualPercent = constrain((int)(nextManualPercent + 0.5f), 0, 100);
    fanAutoEnabled = nextAutoEnabled;
    fanAutoThresholdC = constrain(nextAutoThresholdC, 15.0, 45.0);

    Serial.print(F("[FAN] Settings synced from "));
    Serial.print(activePath);
    Serial.print(F(" | manualOn="));
    Serial.print(fanManualOn ? F("true") : F("false"));
    Serial.print(F(", manualPercent="));
    Serial.print(fanManualPercent);
    Serial.print(F(", autoEnabled="));
    Serial.print(fanAutoEnabled ? F("true") : F("false"));
    Serial.print(F(", autoThresholdC="));
    Serial.println(fanAutoThresholdC, 1);

    applyFanControlLogic();
    return true;
  }

  applyFanControlLogic();
  return false;
}

bool firebasePatchFeedingCommandStatus(const char* status,
                                       bool executed,
                                       int appliedMotorRunMs,
                                       const char* note) {
  char payload[320];
  snprintf(payload, sizeof(payload),
           "{"
           "\"status\":\"%s\"," 
           "\"executed\":%s,"
           "\"processedBy\":\"%s\","
           "\"processedAt\":{\".sv\":\"timestamp\"},"
           "\"appliedMotorRunMs\":%d,"
           "\"note\":\"%s\""
           "}",
           status,
           executed ? "true" : "false",
           DEVICE_ID,
           appliedMotorRunMs,
           note);

  String path = "/sensors/feeding/command.json";
  path += firebaseAuthQuery();

  return espHttpJsonRequest("PATCH", path, String(payload));
}

bool firebasePatchWeightCommandStatus(const char* status,
                                      bool executed,
                                      const char* requestId,
                                      const char* note) {
  char payload[360];
  snprintf(payload, sizeof(payload),
           "{"
           "\"status\":\"%s\"," 
           "\"executed\":%s,"
           "\"processedBy\":\"%s\"," 
           "\"processedAt\":{\".sv\":\"timestamp\"},"
           "\"requestId\":\"%s\"," 
           "\"note\":\"%s\""
           "}",
           status,
           executed ? "true" : "false",
           DEVICE_ID,
           requestId,
           note);

  String path = "/sensors/weight/command.json";
  path += firebaseAuthQuery();

  return espHttpJsonRequest("PATCH", path, String(payload));
}

bool firebasePullWeightCommand() {
  String response;
  String path = "/sensors/weight/command.json";
  path += firebaseAuthQuery();

  if (!espHttpJsonRequest("GET", path, "", &response)) {
    Serial.println(F("[WEIGHT WARN] weight/command fetch failed."));
    return false;
  }

  String body;
  if (!extractHttpBody(response, &body)) {
    Serial.println(F("[WEIGHT WARN] weight/command response has no body."));
    return false;
  }

  if (body.length() == 0 || body == "null") {
    return false;
  }

  String action;
  if (!jsonReadString(body, "action", &action)) {
    return false;
  }
  action.trim();

  bool isTareAction =
    action.equalsIgnoreCase("tareWeight") ||
    action.equalsIgnoreCase("tare") ||
    action.equalsIgnoreCase("zero");
  if (!isTareAction) {
    return false;
  }

  String status;
  if (jsonReadString(body, "status", &status)) {
    status.trim();
    if (!status.equalsIgnoreCase("pending")) {
      return true;
    }
  }

  String requestId;
  if (!jsonReadString(body, "requestId", &requestId)) {
    requestId = "";
  }
  requestId.trim();

  if (requestId.length() == 0) {
    requestId = String("tare-") + String(millis());
  }

  if (strlen(lastWeightTareRequestId) > 0 && requestId == String(lastWeightTareRequestId)) {
    firebasePatchWeightCommandStatus("done", true, requestId.c_str(), "deduplicated-no-rerun");
    return true;
  }

  Serial.print(F("[WEIGHT] New tare request id="));
  Serial.println(requestId);

  bool ok = runLoadCellTare();

  strncpy(lastWeightTareRequestId, requestId.c_str(), sizeof(lastWeightTareRequestId) - 1);
  lastWeightTareRequestId[sizeof(lastWeightTareRequestId) - 1] = '\0';

  if (ok) {
    if (!firebasePatchWeightCommandStatus("done", true, requestId.c_str(), "tare-complete")) {
      Serial.println(F("[WEIGHT WARN] Failed to patch weight command status."));
    }
    return true;
  }

  if (!firebasePatchWeightCommandStatus("failed", false, requestId.c_str(), "hx711-not-ready")) {
    Serial.println(F("[WEIGHT WARN] Failed to patch failed weight command status."));
  }

  return false;
}

bool firebasePullFeedingCommand() {
  String response;
  String path = "/sensors/feeding/command.json";
  path += firebaseAuthQuery();

  if (!espHttpJsonRequest("GET", path, "", &response)) {
    Serial.println(F("[FEED WARN] feeding/command fetch failed."));
    return false;
  }

  String body;
  if (!extractHttpBody(response, &body)) {
    Serial.println(F("[FEED WARN] feeding/command response has no body."));
    return false;
  }

  if (body.length() == 0 || body == "null") {
    return false;
  }

  String action;
  if (!jsonReadString(body, "action", &action)) {
    return false;
  }
  action.trim();

  if (!action.equalsIgnoreCase("dispenseOnce")) {
    return false;
  }

  String status;
  if (jsonReadString(body, "status", &status)) {
    status.trim();
    if (!status.equalsIgnoreCase("pending")) {
      return true;
    }
  }

  String requestId;
  if (!jsonReadString(body, "requestId", &requestId)) {
    requestId = "";
  }
  requestId.trim();

  if (requestId.length() == 0) {
    String groupId;
    if (jsonReadString(body, "requestGroupId", &groupId)) {
      groupId.trim();
      requestId = groupId;
    }
  }

  if (requestId.length() == 0) {
    requestId = String("req-") + String(millis());
  }

  int motorRunMs = FEED_RUN_MS_DEFAULT;
  float motorRunMsFloat;
  if (jsonReadFloat(body, "motorRunMs", &motorRunMsFloat)) {
    motorRunMs = (int)(motorRunMsFloat + (motorRunMsFloat >= 0 ? 0.5f : -0.5f));
  } else {
    String motorRunMsText;
    if (jsonReadString(body, "motorRunMs", &motorRunMsText)) {
      motorRunMsText.trim();
      if (isSignedIntegerString(motorRunMsText)) {
        motorRunMs = motorRunMsText.toInt();
      }
    }
  }
  motorRunMs = constrain(motorRunMs, FEED_RUN_MS_MIN, FEED_RUN_MS_MAX);

  if (strlen(lastFeedingRequestId) > 0 && requestId == String(lastFeedingRequestId)) {
    // Already executed this request. Try to heal stale "pending" status without rerunning motor.
    firebasePatchFeedingCommandStatus("done", true, motorRunMs, "deduplicated-no-rerun");
    return true;
  }

  Serial.print(F("[FEED] New pending command id="));
  Serial.print(requestId);
  Serial.print(F(" runMs="));
  Serial.println(motorRunMs);

  runFeederDispenseOnce(motorRunMs);

  strncpy(lastFeedingRequestId, requestId.c_str(), sizeof(lastFeedingRequestId) - 1);
  lastFeedingRequestId[sizeof(lastFeedingRequestId) - 1] = '\0';

  if (!firebasePatchFeedingCommandStatus("done", true, motorRunMs, "dispense-complete")) {
    Serial.println(F("[FEED WARN] Failed to patch feeding command status."));
  }

  firebasePushSensorLatest(true);
  return true;
}

bool firebasePullFeedingSettings() {
  String response;
  String path = "/sensors/feeding/settings.json";
  path += firebaseAuthQuery();

  if (!espHttpJsonRequest("GET", path, "", &response)) {
    Serial.println(F("[WATER WARN] feeding/settings fetch failed."));
    return false;
  }

  String body;
  if (!extractHttpBody(response, &body)) {
    Serial.println(F("[WATER WARN] feeding/settings response has no body."));
    return false;
  }

  if (body.length() == 0 || body == "null") {
    return false;
  }

  int nextInterval = waterPumpIntervalMin;
  bool parsed = false;
  float floatValue;

  if (jsonReadFloat(body, "waterPumpIntervalMin", &floatValue)) {
    nextInterval = (int)(floatValue + (floatValue >= 0 ? 0.5f : -0.5f));
    parsed = true;
  } else {
    String intervalText;
    if (jsonReadString(body, "waterPumpIntervalMin", &intervalText)) {
      intervalText.trim();
      if (isSignedIntegerString(intervalText)) {
        nextInterval = intervalText.toInt();
        parsed = true;
      }
    }
  }

  if (!parsed) {
    return false;
  }

  nextInterval = sanitizeWaterPumpIntervalMin(nextInterval);
  if (waterPumpIntervalMin != nextInterval) {
    waterPumpIntervalMin = nextInterval;
    waterPumpIntervalMs = (unsigned long)waterPumpIntervalMin * 60UL * 1000UL;

    Serial.print(F("[WATER] Pump interval updated to "));
    Serial.print(waterPumpIntervalMin);
    Serial.println(F(" min"));
  }

  return true;
}

bool firebasePushSensorLatest(bool forcePush) {
  if (!forcePush && !sensorDataChangedSignificantly()) {
    Serial.println(F("[FB] sensors/latest unchanged, push skipped."));
    return true;
  }

  char distanceBuf[16];
  char tempBuf[16];
  char humidityBuf[16];
  char weightBuf[16];
  char thresholdBuf[16];

  if (noEcho || lastDistance < 0) strncpy(distanceBuf, "null", sizeof(distanceBuf) - 1);
  else writeFloatText(distanceBuf, sizeof(distanceBuf), lastDistance, 1);
  distanceBuf[sizeof(distanceBuf) - 1] = '\0';

  if (!dhtOK) {
    strncpy(tempBuf, "null", sizeof(tempBuf) - 1);
    strncpy(humidityBuf, "null", sizeof(humidityBuf) - 1);
  } else {
    writeFloatText(tempBuf, sizeof(tempBuf), dhtTemp, 1);
    writeFloatText(humidityBuf, sizeof(humidityBuf), dhtHumidity, 0);
  }
  tempBuf[sizeof(tempBuf) - 1] = '\0';
  humidityBuf[sizeof(humidityBuf) - 1] = '\0';

  if (!loadCellOK) strncpy(weightBuf, "null", sizeof(weightBuf) - 1);
  else writeFloatText(weightBuf, sizeof(weightBuf), foodWeightGram, 1);
  weightBuf[sizeof(weightBuf) - 1] = '\0';

  writeFloatText(thresholdBuf, sizeof(thresholdBuf), fanAutoThresholdC, 1);

  char payload[640];
  snprintf(payload, sizeof(payload),
           "{"
           "\"id\":\"%s\","
           "\"d\":%s,"
           "\"n\":%s,"
           "\"t\":%s,"
           "\"h\":%s,"
           "\"w\":%s,"
           "\"hf\":%s,"
           "\"f\":%d,"
           "\"fmo\":%s,"
           "\"fmp\":%d,"
           "\"fae\":%s,"
           "\"fat\":%s,"
           "\"ftr\":%s,"
           "\"fcl\":%.1f,"
           "\"fct\":%.1f,"
           "\"wpi\":%d,"
           "\"ts\":{\".sv\":\"timestamp\"}"
           "}",
           DEVICE_ID,
           distanceBuf,
           noEcho ? "true" : "false",
           tempBuf,
           humidityBuf,
           weightBuf,
           hasFoodInContainer ? "true" : "false",
           fanSpeed,
           fanManualOn ? "true" : "false",
           fanManualPercent,
           fanAutoEnabled ? "true" : "false",
           thresholdBuf,
           fanAutoTriggered ? "true" : "false",
           foodConsumedLastGram,
           foodConsumedTotalGram,
           waterPumpIntervalMin);

  String path = "/sensors/latest.json";
  path += firebaseAuthQuery();

  Serial.println(F("[FB] Updating sensors/latest ..."));
  if (!espHttpJsonRequest("PUT", path, String(payload))) {
    Serial.println(F("[FB WARN] sensors/latest update failed."));
    return false;
  }

  updateLastPushedSnapshot();
  return true;
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

void readDistanceSmart() {
  readDistance();

  if (!noEcho && !adaptiveDistancePrevNoEcho && isFiniteFloat(adaptiveDistancePrev)) {
    if (fabsf(lastDistance - adaptiveDistancePrev) < DIST_SIGNIFICANT_CHANGE) {
      currentDistanceInterval = DISTANCE_IDLE_INTERVAL;
    } else {
      currentDistanceInterval = DISTANCE_INTERVAL;
    }
  } else {
    currentDistanceInterval = DISTANCE_INTERVAL;
  }

  adaptiveDistancePrev = lastDistance;
  adaptiveDistancePrevNoEcho = noEcho;
}

void checkOledDimming(unsigned long now) {
  if (!oledOK) return;

  bool hasActivity = (displayMode == MODE_RFID) || (!noEcho && lastDistance > 0.0f && lastDistance < 15.0f);

  if (hasActivity) {
    lastActivityTime = now;
    if (oledDimmed) {
      oled.dim(false);
      oledDimmed = false;
      Serial.println(F("[OLED] Restored brightness."));
    }
    return;
  }

  if (!oledDimmed && (now - lastActivityTime > OLED_DIM_TIMEOUT)) {
    oled.dim(true);
    oledDimmed = true;
    Serial.println(F("[OLED] Dimmed to save power."));
  }
}

void serviceWaterPumpAuto(unsigned long now) {
  if (waterPumpCycleActive) {
    if (now - waterPumpCycleStartedAt >= (unsigned long)WATER_PUMP_RUN_MS_DEFAULT) {
      setFeederPump(false);
      waterPumpCycleActive = false;
      lastWaterPumpCycleAt = now;
      Serial.println(F("[WATER] Auto cycle completed."));
      firebasePushSensorLatest(true);
    }
    return;
  }

  if (waterPumpIntervalMs == 0) {
    return;
  }

  if (lastWaterPumpCycleAt == 0) {
    lastWaterPumpCycleAt = now;
    return;
  }

  if (now - lastWaterPumpCycleAt >= waterPumpIntervalMs) {
    setFeederPump(true);
    waterPumpCycleActive = true;
    waterPumpCycleStartedAt = now;
    Serial.print(F("[WATER] Auto cycle started for "));
    Serial.print(WATER_PUMP_RUN_MS_DEFAULT);
    Serial.println(F(" ms."));
  }
}

void firebaseServiceWindow(unsigned long now) {
  if (!wifiConnected) {
    return;
  }

  bool dueFan = (now - lastFanControlPull >= FIREBASE_FAN_CONTROL_INTERVAL);
  bool dueFeedSettings = (now - lastFeedingSettingsPull >= FIREBASE_FEEDING_SETTINGS_INTERVAL);
  bool dueFeed = (now - lastFeedingControlPull >= FIREBASE_FEEDING_CONTROL_INTERVAL);
  bool dueWeight = (now - lastWeightControlPull >= FIREBASE_WEIGHT_CONTROL_INTERVAL);
  bool duePush = (now - lastFirebasePush >= FIREBASE_SENSOR_INTERVAL);

  if (!dueFan && !dueFeedSettings && !dueFeed && !dueWeight && !duePush) {
    return;
  }

  if (duePush) {
    lastFirebasePush = now;
    firebasePushSensorLatest(false);
  }

  if (dueFan) {
    lastFanControlPull = now;
    firebasePullFanSettings();
  }

  if (dueFeedSettings) {
    lastFeedingSettingsPull = now;
    firebasePullFeedingSettings();
  }

  if (dueFeed) {
    lastFeedingControlPull = now;
    firebasePullFeedingCommand();
  }

  if (dueWeight) {
    lastWeightControlPull = now;
    firebasePullWeightCommand();
  }
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
    applyFanControlLogic();
    return;
  }
  dhtOK       = true;
  dhtTemp     = t;
  dhtHumidity = h;

  applyFanControlLogic();

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
    foodConsumedLastGram = 0.0f;
    hasFoodInContainer = false;
    Serial.println(F("[HX711] Not ready — check wiring."));
    return;
  }

  float rawWeight = scale.get_units(10);

  // Weight cannot be negative.
  if (rawWeight < 0.0f) {
    rawWeight = 0.0f;
  }

  float lastValidWeight = (isFiniteFloat(foodWeightGram) ? foodWeightGram : NAN);
  foodWeightGram = rawWeight;

  float consumed = 0.0f;
  if (isFiniteFloat(lastValidWeight)) {
    float delta = lastValidWeight - foodWeightGram;
    if (delta >= FOOD_CONSUMED_MIN_DELTA_G) {
      consumed = delta;
      foodConsumedTotalGram += consumed;
      if (foodConsumedTotalGram < 0.0f) {
        foodConsumedTotalGram = 0.0f;
      }
      Serial.print(F("[HX711] Food consumed: "));
      Serial.print(consumed, 1);
      Serial.print(F(" g | Total: "));
      Serial.print(foodConsumedTotalGram, 1);
      Serial.println(F(" g"));
    }
  }

  foodConsumedLastGram = consumed;
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

  triggerRfidDispenseOnce();

  displayMode    = MODE_RFID;
  rfidDisplayEnd = millis() + RFID_DISPLAY_DURATION;
  if (oledOK) { glitchEffect(); displayRFID(); }
}


// ═══════════════════════════════════════════════════════════
//  SETUP
// ═══════════════════════════════════════════════════════════

void setup() {
  wdt_enable(WDTO_8S);

  Serial.begin(115200);
  while (!Serial && millis() < 3000);

  Serial.println(F("============================================"));
  Serial.println(F("RFID + HC-SR04 + DHT11 + HX711 + OLED + ESP + FAN + FEEDER"));
  Serial.println(F("           CYBERPUNK HUD  v1.4              "));
  Serial.println(F("============================================"));
  Serial.println(F("[FAN] Type 0-100 and Enter to set manual fan speed."));

  // ── EEPROM offline queue ──────────────────────────────
  offlineQueueInit();

  // ── Fan ───────────────────────────────────────────────
  pinMode(FAN_PIN, OUTPUT);
  analogWrite(FAN_PIN, 0);  // Start off
  applyFanControlLogic();
  Serial.println(F("[FAN] N-MOSFET fan ready on pin 6."));

  // ── Feeder Motor + Pump ───────────────────────────────
  pinMode(FEED_MOTOR_ENA_PIN, OUTPUT);
  pinMode(FEED_MOTOR_IN1_PIN, OUTPUT);
  pinMode(FEED_MOTOR_IN2_PIN, OUTPUT);
  pinMode(FEED_PUMP_PIN, OUTPUT);

  digitalWrite(FEED_MOTOR_IN1_PIN, LOW);
  digitalWrite(FEED_MOTOR_IN2_PIN, LOW);
  analogWrite(FEED_MOTOR_ENA_PIN, 0);
  digitalWrite(FEED_PUMP_PIN, LOW);
  feederMotorSpeed = 0;
  feederPumpOn = false;

  Serial.print(F("[FEED] Motor ready on ENA="));
  Serial.print(FEED_MOTOR_ENA_PIN);
  Serial.print(F(", IN1="));
  Serial.print(FEED_MOTOR_IN1_PIN);
  Serial.print(F(", IN2="));
  Serial.print(FEED_MOTOR_IN2_PIN);
  Serial.print(F(" | Pump pin="));
  Serial.print(FEED_PUMP_PIN);
  Serial.print(F(" | Pump with motor="));
  Serial.println(FEED_PUMP_WITH_MOTOR ? F("ON") : F("OFF"));

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
  if (wifiConnected) {
    configureESP8266SSL();
    configureESP8266PowerSave();
  }

  // Pull fan/feeding settings + first sensor sync right after WiFi comes up
  if (wifiConnected) {
    firebasePullFanSettings();
    lastFanControlPull = millis();

    firebasePullFeedingSettings();
    lastFeedingSettingsPull = millis();

    firebasePullFeedingCommand();
    lastFeedingControlPull = millis();

    firebasePullWeightCommand();
    lastWeightControlPull = millis();

    firebasePushSensorLatest(true);
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
  lastWaterPumpCycleAt = millis();
  lastFeedingControlPull = millis();
  lastFeedingSettingsPull = millis();
  lastWeightControlPull = millis();
  lastOfflineStoreTime = millis();
  lastOfflineFlushTime = millis();
  lastReconnectAttempt = millis();
  currentDistanceInterval = DISTANCE_INTERVAL;
  lastActivityTime = millis();
  oledDimmed = false;
  previousWifiConnected = wifiConnected;
}


// ═══════════════════════════════════════════════════════════
//  LOOP
// ═══════════════════════════════════════════════════════════

void loop() {
  wdt_reset();

  unsigned long now = millis();

  if (wifiConnected != previousWifiConnected) {
    Serial.print(F("[NET] WiFi state changed -> "));
    Serial.println(wifiConnected ? F("ONLINE") : F("OFFLINE"));

    if (!wifiConnected) {
      // Start a fresh 5-minute offline capture window from disconnect time.
      lastOfflineStoreTime = now;
    } else {
      // Trigger immediate backlog flush right after reconnect.
      lastOfflineFlushTime = 0;
    }

    previousWifiConnected = wifiConnected;
  }

  attemptWiFiReconnect(now);

  // ── Blink ticker ───────────────────────────────────────
  if (now - lastBlinkTime >= BLINK_INTERVAL) {
    lastBlinkTime = now;
    blinkState    = !blinkState;
  }

  // ── Serial commands (fan + feeder diagnostics) ─────────
  checkSerialCommandInput();

  // ── Distance reading ───────────────────────────────────
  if (now - lastDistanceTime >= currentDistanceInterval) {
    lastDistanceTime = now;
    readDistanceSmart();
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

  // ── Combined Firebase service window ────────────────────
  firebaseServiceWindow(now);

  // ── Water pump periodic auto-cycle ──────────────────────
  serviceWaterPumpAuto(now);

  // ── Buffer sensors to EEPROM every 5 min while offline ─
  storeOfflineSampleIfDue(now);

  // ── Flush buffered samples to Firebase when online ──────
  flushOfflineQueueIfDue(now);

  // ── RFID check ─────────────────────────────────────────
  if (rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial()) {
    readRFID();
    return;
  }

  // ── Auto-revert to HUD after RFID display timer ────────
  if (displayMode == MODE_RFID && now >= rfidDisplayEnd)
    displayMode = MODE_HUD;

  // ── OLED refresh ───────────────────────────────────────
  checkOledDimming(now);
  if (oledOK && (now - lastOledTime >= OLED_INTERVAL)) {
    lastOledTime = now;
    if (displayMode == MODE_RFID) displayRFID();
    else                          displayHUD();
  }
}
