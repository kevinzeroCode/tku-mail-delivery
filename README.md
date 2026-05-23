# 淡江大學郵件收發管理系統

淡江大學收發室專用的郵件管理系統。支援 OCR 批量建檔、攝影機拍照、MS Teams 通知、逾期追蹤，以及用戶自助入口（手寫簽名領取、線上申請拒收 / 更改方式）。

---

## 技術棧

| 層次 | 技術 |
|------|------|
| 前端 / 後端 | Next.js 15 App Router（React 19） |
| UI 元件 | Ant Design v5 |
| 資料庫 | SQLite（Prisma ORM，file-based，不需安裝 DB server） |
| 身分驗證 | Microsoft MSAL（Azure Entra ID / O365 SSO） |
| OCR | Python FastAPI + EasyOCR（繁體中文 + 英文） |
| 通知 | MS Teams Incoming Webhook |
| 部署 | Azure App Service（Next.js + SQLite 同機） |

---

## 功能概覽

### 公開查詢（`/`）
- 輸入追蹤碼查詢郵件狀態，不需登入
- 顯示：待領取（全部）+ 已領取 / 已退回（三個月內）

### 用戶自助入口（`/portal`）
- O365 帳號 SSO 登入
- 查看個人郵件清單
- 申請操作：本人簽名領取 / 申請拒收 / 更改領取方式 / 更正收件人

### 管理後台（`/admin`）
- O365 登入 + 管理員授權（Azure App Role **或** DB 名單，擇一即可）
- **郵件清單 Tab**：新增 / 編輯 / 刪除，OCR 批量掃描，Webcam 拍照，逾期標色，Teams 通知
- **清單掃描查核 Tab**：比對簽收清單與系統資料，標記掃描狀態
- **申請處理 Tab**：審核用戶申請，核准後自動更新郵件狀態
- **管理員設定 Tab**：新增 / 移除管理員，不需到 Azure Portal 手動操作

---

## 本機開發

### 前置需求
- Node.js 18+
- Python 3.11+（OCR 服務選填，不安裝可指向 Azure 已部署的 OCR）

### 1. 環境變數

```bash
cd nextjs-app
cp .env.local.example .env.local
```

`.env.local` 最少需填：

```env
DATABASE_URL="file:./dev.db"
NEXT_PUBLIC_AZURE_CLIENT_ID=<Azure App Registration Client ID>
NEXT_PUBLIC_AZURE_TENANT_ID=<Azure Tenant ID>
ADMIN_BOOTSTRAP_EMAILS=你的O365信箱@o365.tku.edu.tw
```

> 本機開發快速繞過 MSAL 登入：設 `LOCAL_ADMIN_BYPASS=true` 與 `NEXT_PUBLIC_LOCAL_ADMIN_BYPASS=true`

### 2. 安裝 + 建立資料庫

```bash
npm install
npx prisma db push
```

### 3. 啟動

```bash
npm run dev
# http://localhost:3000       公開查詢
# http://localhost:3000/portal  用戶入口
# http://localhost:3000/admin   管理後台
```

### 4. OCR 服務（選填）

```bash
cd ../ocr-service
python -m venv venv && venv\Scripts\activate   # Windows
pip install -r requirements.txt
python main.py   # http://localhost:8000
```

或直接在 `.env.local` 填入 Azure 上的 OCR URL：

```env
OCR_SERVICE_URL=https://tku-mail-ocr.azurewebsites.net
```

---

## 資料庫 Schema（Prisma + SQLite）

5 個 Model：

| Model | 說明 |
|-------|------|
| `MailItem` | 每筆郵件主表，含狀態、OCR 文字、簽名路徑、掃描狀態等 |
| `MailRequest` | 用戶送出的申請（拒收、更改方式、更正收件人、簽名領取） |
| `UserProfile` | 用戶個人資料（姓名、學號、預設領取方式等） |
| `Setting` | 系統設定 key-value（如預設逾期天數） |
| `AdminUser` | DB 管理員名單（配合 `ADMIN_BOOTSTRAP_EMAILS` 使用） |

schema 變更後執行 `npx prisma db push` 同步，`npm start` 部署時自動執行。

---

## 環境變數

| 變數 | 必填 | 說明 |
|------|------|------|
| `DATABASE_URL` | ✓ | 本機：`file:./dev.db`；Azure：`file:/home/site/db/app.db` |
| `NEXT_PUBLIC_AZURE_CLIENT_ID` | ✓ | Azure App Registration Client ID |
| `NEXT_PUBLIC_AZURE_TENANT_ID` | ✓ | Azure Tenant ID |
| `ADMIN_BOOTSTRAP_EMAILS` | ✓ | 初始管理員 email，逗號分隔，自動寫入 AdminUser 表 |
| `OCR_SERVICE_URL` | | OCR 服務 URL，不填則預設 `http://localhost:8000` |
| `TEAMS_WEBHOOK_URL` | | Teams Incoming Webhook，不填則通知功能無效 |
| `UPLOADS_DIR` | | 圖片儲存路徑；Azure 填 `/home/site/uploads`，本機留空 |
| `LOCAL_ADMIN_BYPASS` | | `true` 可繞過 MSAL（僅 `NODE_ENV=development`） |
| `NEXT_PUBLIC_BASE_URL` | | 完整 base URL，用於 Teams 通知連結 |

---

## Azure 部署

### 架構
```
Azure App Service (tku-mail-web)
  ├── Next.js 15 (npm start)
  ├── SQLite DB → /home/site/db/app.db  (持久磁碟)
  └── 上傳圖片 → /home/site/uploads/    (持久磁碟)

Azure App Service (tku-mail-ocr)
  └── Python FastAPI + EasyOCR
```

### 打包部署

```bash
cd nextjs-app

zip -r /tmp/deploy.zip . \
  -x "node_modules/*" ".next/*" "*.db" ".env*" \
     "public/uploads/*" "*.tsbuildinfo"

az webapp deploy --name tku-mail-web \
  --resource-group rg-tku-mail-delivery \
  --src-path /tmp/deploy.zip --type zip
```

`SCM_DO_BUILD_DURING_DEPLOYMENT=true` 時 Azure 自動執行 `npm ci && npm run build`，`npm start` 會自動 `prisma db push`。

### Azure App Service 環境變數

| 變數 | 值 |
|------|----|
| `DATABASE_URL` | `file:/home/site/db/app.db` |
| `UPLOADS_DIR` | `/home/site/uploads` |
| `NEXT_PUBLIC_AZURE_CLIENT_ID` | App Registration Client ID |
| `NEXT_PUBLIC_AZURE_TENANT_ID` | Tenant ID |
| `ADMIN_BOOTSTRAP_EMAILS` | 初始管理員信箱 |
| `OCR_SERVICE_URL` | `https://tku-mail-ocr.azurewebsites.net` |
| `NEXT_PUBLIC_BASE_URL` | `https://tku-mail-web.azurewebsites.net` |
| `SCM_DO_BUILD_DURING_DEPLOYMENT` | `true` |

---

## 分支說明

| 分支 | 說明 |
|------|------|
| `main` | 主開發分支（本 README 對應） |
| `v2-azure` | 基於 ryanjih 原版 + AdminUser 功能，SQLite，供遠端同仁部署參考 |

---

## 目錄結構

```
mailchecklist/
├── nextjs-app/
│   ├── prisma/schema.prisma          # 5 個 Model
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx              # 公開查詢頁
│   │   │   ├── portal/page.tsx       # 用戶自助入口
│   │   │   ├── admin/page.tsx        # 管理後台
│   │   │   └── api/                  # 所有 API 端點
│   │   ├── components/
│   │   │   ├── ListScanCheckPanel.tsx # 清單掃描查核
│   │   │   ├── RequestsPanel.tsx      # 申請審核
│   │   │   ├── SignaturePad.tsx       # 手寫簽名
│   │   │   └── ...
│   │   └── lib/
│   │       ├── portal-auth.ts         # MSAL 登入邏輯
│   │       ├── admin-auth.ts          # 管理員驗證（MSAL + DB）
│   │       └── uploads.ts             # 圖片路徑處理
│   └── .env.local.example
└── ocr-service/                       # Python FastAPI OCR 微服務
    ├── main.py
    └── requirements.txt
```
