# Smart Pet Pet Web App（React + TypeScript + Vite）

這是一個智慧寵物監控前端，使用 React 建立介面，並透過 Firebase 完成登入與資料讀取。畫面可顯示感測器資料（距離、溫度、濕度、飼料重量）與 RFID 刷卡紀錄。

## 主要功能

- 使用者註冊 / 登入（Email、Google）
- 即時顯示感測器最新狀態
- 顯示溫濕度趨勢圖
- 顯示 RFID 歷史紀錄
- 每位使用者可設定自己的資料輪詢間隔
- 相容舊版資料路徑（legacy path）

## 技術棧

- React 19
- TypeScript
- Vite
- Firebase Authentication
- Firebase Realtime Database
- Firebase Firestore（已初始化，可依需求使用）

---

## 1) 環境需求

- Node.js 20+（建議 LTS）
- npm 10+

可先確認版本：

```bash
node -v
npm -v
```

---

## 2) 安裝與啟動（React 專案設定）

### Step A. 安裝套件

```bash
npm install
```

### Step B. 建立環境變數

將 `.env.example` 複製為 `.env.local`：

```bash
cp .env.example .env.local
```

接著到 Firebase Console → 專案設定 → 你的 Web App，將設定值填入 `.env.local`：

```env
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://your_project_id-default-rtdb.firebaseio.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

### Step C. 啟動開發伺服器

```bash
npm run dev
```

瀏覽器開啟：

- http://localhost:5173

---

## 3) Firebase 必要設定

### A. Authentication

請在 Firebase Console 啟用：

- Email/Password
- Google（若要使用 Google 登入）

### B. Realtime Database

請建立 Realtime Database，並確認資料路徑與規則可供前端讀取。

本專案主要使用的使用者路徑：

- `users/{uid}/sensors/latest`
- `users/{uid}/sensors/history`
- `users/{uid}/rfidScans`

另外也支援舊版（legacy）全域路徑作為 fallback：

- `sensors/latest`
- `sensors/history`
- `rfidScans`

> 建議正式環境改為僅允許使用者讀寫自己的 `users/{uid}` 區域。

### C. 建議 Rules（開發參考）

以下為示意，請依你的安全需求調整：

```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "auth != null && auth.uid == $uid",
        ".write": "auth != null && auth.uid == $uid"
      }
    },
    "sensors": {
      ".read": true,
      ".write": true
    },
    "rfidScans": {
      ".read": true,
      ".write": true
    }
  }
}
```

---

## 4) Arduino / ESP8266（選用，若你要推送硬體資料）

若你有使用專案內的 Arduino 韌體，請修改：

- `arduino/main.ino`

至少確認以下常數：

- `WIFI_SSID`
- `WIFI_PASS`
- `FIREBASE_HOST`
- `FIREBASE_HOST_IP`（舊 AT 韌體才需要 fallback）
- `FIREBASE_AUTH`
- `DEVICE_ID`

設定完成並上傳韌體後，資料即可推送到 Realtime Database，Web App 端會自動輪詢更新。

---

## 5) 可用指令

```bash
npm run dev      # 啟動開發模式
npm run build    # 編譯 TypeScript 並打包
npm run preview  # 預覽 production build
npm run lint     # 執行 ESLint
```

---

## 6) 常見問題

### Q1. 頁面空白或 Firebase 初始化失敗

請先檢查：

- `.env.local` 是否存在
- 7 個 `VITE_FIREBASE_*` 變數是否正確
- 重啟 `npm run dev`

### Q2. 登入成功但看不到感測器資料

請確認：

- Realtime Database 有資料
- 資料是否寫在 `users/{uid}/...` 或 legacy 路徑
- Realtime Database Rules 是否允許目前使用者讀取

### Q3. Google 登入失敗

請確認：

- Firebase Authentication 已啟用 Google Provider
- 專案授權網域已包含開發主機（如 localhost）

---

## 7) 專案結構（重點）

- `src/firebase.ts`：Firebase 初始化
- `src/App.tsx`：登入/註冊/主畫面路由切換
- `src/pages/Dashboard.tsx`：監控主畫面
- `src/hooks/useSensorData.ts`：感測器資料輪詢
- `src/hooks/useRFIDHistory.ts`：RFID 歷史資料輪詢
- `src/constants/dbPaths.ts`：資料庫路徑定義（含 legacy fallback）

---

完成以上設定後，即可從 React 專案本機啟動並使用完整的智慧寵物監控 Web App。
