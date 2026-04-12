/*
 * MOTOR & PUMP TEST SKETCH - L298N + IRLZ44N with Arduino Mega
 * 
 * Wiring:
 * - L298N ENA  → Mega Pin 12 (PWM)
 * - L298N IN1  → Mega Pin 7
 * - L298N IN2  → Mega Pin 11
 * - L298N +12V → 6V Power Supply (+)
 * - L298N GND  → 6V Power Supply (-) AND Mega GND
 * - Motor       → L298N OUT1 and OUT2
 * 
 * - IRLZ44N Gate   → Mega Pin 9
 * - IRLZ44N Drain  → Pump negative (USB black wire)
 * - IRLZ44N Source → Mega GND
 * - Pump positive  → USB 5V (red wire)
 * - Diode 1N4148   → Cathode to pump+, Anode to pump- (across pump)
 * 
 * Commands (Serial Monitor @ 115200 baud):
 *   motor 50   → Forward 50% speed
 *   motor -30  → Reverse 30% speed
 *   motor 0    → Stop motor
 *   pump on    → Turn pump ON
 *   pump off   → Turn pump OFF
 *   help       → Show all commands
 */

#define ENA_PIN   12   // Motor PWM speed control
#define IN1_PIN   7    // Motor direction 1
#define IN2_PIN   11   // Motor direction 2
#define PUMP_PIN  10    // Pump MOSFET gate

bool pumpState = false;

void setup() {
  Serial.begin(115200);
  Serial.println(F("\n=== MOTOR & PUMP TEST SKETCH ==="));
  Serial.println(F("Commands:"));
  Serial.println(F("  motor <speed>   (-100 to 100)"));
  Serial.println(F("  pump on         Turn pump ON"));
  Serial.println(F("  pump off        Turn pump OFF"));
  Serial.println(F("  help            Show this menu"));
  Serial.println(F("----------------------------------\n"));

  pinMode(ENA_PIN, OUTPUT);
  pinMode(IN1_PIN, OUTPUT);
  pinMode(IN2_PIN, OUTPUT);
  pinMode(PUMP_PIN, OUTPUT);

  // Start with everything off
  digitalWrite(IN1_PIN, LOW);
  digitalWrite(IN2_PIN, LOW);
  analogWrite(ENA_PIN, 0);
  digitalWrite(PUMP_PIN, LOW);
  pumpState = false;
}

void loop() {
  if (Serial.available() > 0) {
    String input = Serial.readStringUntil('\n');
    input.trim();
    if (input.length() == 0) return;

    // ── Help ──────────────────────────────────────────────
    if (input.equalsIgnoreCase("help")) {
      Serial.println(F("\n--- Available Commands ---"));
      Serial.println(F("motor <speed>   : -100 (full reverse) to 100 (full forward)"));
      Serial.println(F("motor 0         : stop motor"));
      Serial.println(F("pump on         : turn pump ON"));
      Serial.println(F("pump off        : turn pump OFF"));
      Serial.println(F("help            : show this message"));
      Serial.println(F("---------------------------\n"));
      return;
    }

    // ── Motor Control ─────────────────────────────────────
    if (input.startsWith("motor ")) {
      String param = input.substring(6);
      param.trim();
      int speedVal = param.toInt();
      speedVal = constrain(speedVal, -100, 100);
      
      setMotorSpeed(speedVal);
      
      Serial.print(F("Motor speed set to: "));
      Serial.print(speedVal);
      Serial.println(F("%"));
      return;
    }

    // ── Pump Control ──────────────────────────────────────
    if (input.equalsIgnoreCase("pump on")) {
      pumpState = true;
      digitalWrite(PUMP_PIN, HIGH);
      Serial.println(F("Pump turned ON"));
      return;
    }
    
    if (input.equalsIgnoreCase("pump off")) {
      pumpState = false;
      digitalWrite(PUMP_PIN, LOW);
      Serial.println(F("Pump turned OFF"));
      return;
    }

    // ── Unknown Command ───────────────────────────────────
    Serial.println(F("Unknown command. Type 'help' for list."));
  }
}

void setMotorSpeed(int speedPercent) {
  if (speedPercent > 0) {
    // Forward
    digitalWrite(IN1_PIN, HIGH);
    digitalWrite(IN2_PIN, LOW);
  } else if (speedPercent < 0) {
    // Reverse
    digitalWrite(IN1_PIN, LOW);
    digitalWrite(IN2_PIN, HIGH);
  } else {
    // Stop (brake)
    digitalWrite(IN1_PIN, LOW);
    digitalWrite(IN2_PIN, LOW);
  }
  
  int pwmValue = map(abs(speedPercent), 0, 100, 0, 255);
  analogWrite(ENA_PIN, pwmValue);
}