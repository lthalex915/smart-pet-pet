#include "HX711.h"

// 定義接線腳位
const int LOADCELL_DOUT_PIN = 2; // DT 接 Pin 2
const int LOADCELL_SCK_PIN = 3;  // SCK 接 Pin 3

HX711 scale;

// 初始比例係數 (我們等一下要找出正確的數字來替換它)
float calibration_factor = 1000.0; 

void setup() {
  Serial.begin(9600);
  Serial.println("HX711 測試與校準程式");

  // 初始化 HX711
  scale.begin(LOADCELL_DOUT_PIN, LOADCELL_SCK_PIN);

  Serial.println("請清空秤盤，不要放任何東西...");
  delay(2000);

  // 設置比例係數並歸零
  scale.set_scale(calibration_factor);
  scale.tare(); 

  Serial.println("歸零完成！");
  Serial.println("請放上一個『已知重量』的物品 (例如 100g 的法碼或手機)");
  Serial.println("您可以在序列埠監控視窗輸入 '+' 或 '-' 來微調重量");
  Serial.println("輸入 'a' 加大調整幅度，輸入 'z' 縮小調整幅度");
}

void loop() {
  // 設置當前的比例係數
  scale.set_scale(calibration_factor);

  // 讀取並印出重量 (取 10 次平均值以求穩定)
  Serial.print("目前讀數: ");
  Serial.print(scale.get_units(10), 1); // 小數點後 1 位
  Serial.print(" g");
  Serial.print("  |  目前比例係數: ");
  Serial.println(calibration_factor);

  // 接收鍵盤指令來調整比例係數
  if (Serial.available()) {
    char temp = Serial.read();
    if (temp == '+' || temp == '=') {
      calibration_factor += 10;
    } else if (temp == '-') {
      calibration_factor -= 10;
    } else if (temp == 'a') {
      calibration_factor += 100; // 大幅增加
    } else if (temp == 'z') {
      calibration_factor -= 100; // 大幅減少
    }
  }
}