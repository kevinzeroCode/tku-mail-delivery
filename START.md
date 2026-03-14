# 啟動說明

## 第一次設定

### 1. Next.js 主體

```bash
cd nextjs-app

# 安裝套件
npm install

# 複製環境變數
cp .env.local.example .env.local
# 編輯 .env.local，填入 TEAMS_WEBHOOK_URL

# 建立資料庫
npm run db:push

# 啟動開發伺服器
npm run dev
```

瀏覽器開啟：
- 公開查詢頁：http://localhost:3000
- 管理員後台：http://localhost:3000/admin

---

### 2. Python OCR 微服務

```bash
cd ocr-service

# 建立虛擬環境
python -m venv venv
venv\Scripts\activate      # Windows
# source venv/bin/activate  # Mac/Linux

# 安裝套件（第一次較慢，easyocr 需下載模型）
pip install -r requirements.txt

# 啟動
python main.py
```

OCR 服務運行於：http://localhost:8000

---

## 目錄結構

```
mailchecklist/
├── nextjs-app/          # Next.js 前端 + API
│   ├── src/app/         # 頁面與 API Routes
│   ├── src/components/  # UI 元件
│   ├── src/lib/         # 工具函式
│   ├── prisma/          # 資料庫 schema
│   └── public/uploads/  # 上傳的圖片
└── ocr-service/         # Python OCR 微服務
```

## Teams Webhook 設定

1. 在 Teams 頻道右鍵 > 管理頻道 > 連接器
2. 新增「Incoming Webhook」
3. 複製 URL 填入 `.env.local` 的 `TEAMS_WEBHOOK_URL`
