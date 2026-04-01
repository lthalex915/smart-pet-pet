int switchPin = 9; // 定義接駁綠色板「開關」嘅 Arduino 腳位 (D9)

void setup() {
  pinMode(switchPin, OUTPUT); // 設定 D9 為輸出模式
}

void loop() {
  // 開風扇
  digitalWrite(switchPin, HIGH); 
  delay(3000); // 著 3 秒 (3000 毫秒)

  // 熄風扇
  digitalWrite(switchPin, LOW);  
  delay(3000); // 熄 3 秒
}