# 更新說明（2026-05-23）

基礎版本：承接 2026-05-21 更新（管理員帳號管理），在此版本之上新增以下功能。

---

## 新增功能

### 1. 掃描狀態欄位（`scanStatus`）

`MailItem` 新增 `scanStatus`（`未掃描` / `已掃描` / `異常`），在郵件清單以 Tag 顯示，可篩選。

### 2. 清單掃描查核面板

後台新增「清單掃描查核」tab（`ListScanCheckPanel`），支援：
- **單筆模式**：相機拍攝或手動輸入追蹤碼，立即比對 DB，顯示郵件詳情，一鍵標記掃描狀態
- **批次模式**：掃描多筆後批量更新欄位（狀態、掃描狀態、備註等），重複代碼自動去重
- **擷取郵件文字**：拍攝郵件標籤取得 OCR 原始文字，內嵌顯示可自由選取部分複製

### 3. OCR 結果可編輯

OCR 完成後不再直接比對，先顯示可編輯輸入框讓操作者修正辨識錯誤，確認後才加入掃描清單。

### 4. 伺服端 JWT 驗證（Auth 強化）

每支 admin API 現在在伺服端驗證 Microsoft Entra ID JWT（使用 `jose` + JWKS），不再只依賴前端傳入的 token 字串。新增 `LOCAL_ADMIN_BYPASS` 開發模式，本機測試不需要 Microsoft 登入。

---

## 異動檔案

### 新增

| 路徑 | 說明 |
|------|------|
| `src/lib/admin-auth.ts` | 伺服端 `requireAdminAuth()`，JWT 驗證 + DB 管理員比對 |
| `src/lib/admin-auth-core.ts` | Bearer token 提取、local bypass 設定 |
| `src/lib/admin-client-auth.ts` | 客戶端 `adminAuthHeaders()`，統一組裝 auth header |
| `src/lib/admin-users.ts` | 管理員 email 正規化、bootstrap 讀取工具 |
| `src/components/ListScanCheckPanel.tsx` | 清單掃描查核面板（單筆 + 批次） |

### 修改

| 路徑 | 說明 |
|------|------|
| `prisma/schema.prisma` | `MailItem` 新增 `scanStatus String @default("未掃描")` |
| `src/lib/types.ts` | 新增 `ScanStatus` type，`MailItem` 加 `scanStatus` 欄位 |
| `src/app/admin/page.tsx` | 新增「清單掃描查核」tab、整合新 auth |
| `src/components/MailTable.tsx` | 新增 scanStatus 欄位（Tag + 篩選） |
| `src/services/mail.ts` | 新增 `batchUpdate()`，改用 `adminAuthHeaders()` |
| 所有 `src/app/api/admin/*` routes | 改用 `requireAdminAuth()` 做伺服端 JWT 驗證 |
| 所有 `src/app/api/items/*`、`notify`、`ocr`、`settings`、`upload` | 同上 |

### 移除

| 路徑 | 原因 |
|------|------|
| `src/app/api/admin/check/route.ts` | 功能已整合進 `requireAdminAuth()`，不再需要獨立端點 |

---

## 部署步驟（推送至私人 repo）

### ⚠️ 注意事項（與前次不同之處）

1. **`/api/admin/check` 端點已移除**  
   如果你有監控腳本或其他程式呼叫這個端點，需要移除或改寫。前台管理員驗證邏輯已整合進各 API route，不再需要獨立的 check 端點。

2. **新增 npm 套件 `jose`**  
   部署前務必確認 `node_modules` 包含 `jose`（`npm ci` 或 `npm install` 即可）。若用 Azure App Service ZIP 部署，zip 裡應排除 `node_modules`，讓 Kudu 在遠端重新安裝。

3. **Schema 異動：需執行 `prisma db push`**  
   `MailItem` 多了 `scanStatus` 欄位（有預設值 `未掃描`），舊資料不受影響。  
   `npm start` 腳本若已設定自動 `prisma db push`（見前次 CHANGELOG），部署後第一次啟動會自動補上這個欄位；若沒有，需手動執行一次。

### 環境變數（新增，選填）

以下為本機開發便利設定，**正式環境（Azure）不建議設定**：

| 名稱 | 值 | 說明 |
|------|----|------|
| `LOCAL_ADMIN_BYPASS` | `true` | 跳過 JWT 驗證，直接以 `LOCAL_ADMIN_EMAIL` 身份進入後台 |
| `LOCAL_ADMIN_EMAIL` | 任意 email | bypass 時使用的假 email |
| `NEXT_PUBLIC_LOCAL_ADMIN_BYPASS` | `true` | 前端對應設定 |
| `NEXT_PUBLIC_LOCAL_ADMIN_EMAIL` | 同上 | 前端對應設定 |

Azure App Service 不需要新增任何 env var（`ADMIN_BOOTSTRAP_EMAILS` 沿用前次設定即可）。

### 部署指令

```bash
cd nextjs-app

zip -r /tmp/deploy.zip . \
  -x "node_modules/*" ".next/*" "*.db" ".env*" "public/uploads/*" "*.tsbuildinfo"

az webapp deploy --name tku-mail-web \
  --resource-group rg-tku-mail-delivery \
  --src-path /tmp/deploy.zip --type zip
```

### 驗證

1. 開啟 `https://tku-mail-web.azurewebsites.net/admin`
2. 登入後確認「清單掃描查核」tab 出現
3. 在「郵件清單」tab 確認掃描狀態欄位顯示正常（預設「未掃描」Tag）
4. 嘗試在掃描 tab 輸入一筆追蹤碼，確認比對功能正常
5. `https://tku-mail-web.azurewebsites.net/api/admin/check` 應回 404（端點已移除）

---

## 相容性說明

- `MailItem` 現有資料不受影響，`scanStatus` 欄位會自動填入預設值 `未掃描`
- `AdminUser` table 與 `MailRequest` table 均未異動
- Azure AD App Role 登入流程不變，新的伺服端 JWT 驗證是在相同 token 上多做一層校驗
- `另外` Portal（學生端）功能未異動

---

# 更新說明（2026-05-21）

基礎版本：`ryanjih/tku-mail-delivery-private` commit `3682077`（即 `ORIGN/` 資料夾內容）

---

## 新增功能：後台管理員帳號管理

原本 `/admin` 後台的進入權限完全依賴 Azure AD App Role（`Admin`），  
新增管理員唯一方式是到 Azure Portal 手動指派 App Role，無法在 app 內操作。  
本次更新改為支援 **DB 管理員名單**，可在後台 UI 直接新增或移除管理員。

---

## 異動檔案

### 新增

#### `nextjs-app/src/app/api/admin/users/route.ts`
管理員名單 API。

| Method | 說明 |
|--------|------|
| `GET /api/admin/users` | 列出所有管理員（含 bootstrap 管理員） |
| `POST /api/admin/users` | 新增管理員，body: `{ email, createdByEmail }` |
| `DELETE /api/admin/users` | 移除管理員，body: `{ email }`（bootstrap 管理員不可移除） |

啟動時自動同步 `ADMIN_BOOTSTRAP_EMAILS` 環境變數中的 email 到 DB。

#### `nextjs-app/src/app/api/admin/check/route.ts`
查詢某 email 是否具有管理員權限。

| Method | 說明 |
|--------|------|
| `GET /api/admin/check?email=xxx` | 回傳 `{ isAdmin: boolean, source: "bootstrap" \| "db" \| null }` |

依序檢查：① `ADMIN_BOOTSTRAP_EMAILS` env var → ② `AdminUser` DB table。

---

### 修改

#### `nextjs-app/prisma/schema.prisma`
新增 `AdminUser` model：

```prisma
model AdminUser {
  id             Int      @id @default(autoincrement())
  email          String   @unique
  source         String   @default("manual")   // "bootstrap" | "manual"
  createdAt      DateTime @default(now())
  createdByEmail String?

  @@index([createdAt])
}
```

部署時 `npm start` 會自動執行 `prisma db push`，schema 同步無需手動操作。

#### `nextjs-app/src/app/admin/page.tsx`
兩處改動：

1. **DB 權限檢查**：MSAL 登入後額外呼叫 `/api/admin/check`，Azure AD App Role **或** DB 名單其中一個符合即可進入後台。

   ```ts
   // 登入後查 DB
   useEffect(() => {
     if (!user) return
     fetch(`/api/admin/check?email=${encodeURIComponent(user.email)}`)
       .then(r => r.json())
       .then(d => setDbAdmin(d.isAdmin === true))
   }, [user?.email])

   const authed = isAdmin(user) || dbAdmin === true
   ```

2. **新增「管理員設定」tab**：列出現有管理員名單，提供新增 / 移除操作。Bootstrap 管理員（來自 env var）顯示為「不可移除」。

#### `nextjs-app/src/components/ConfirmActionModal.tsx`
修正 antd 棄用警告：

```diff
- destroyOnClose
+ destroyOnHidden
```

---

## 部署步驟（給遠端同仁）

### 1. Azure App Service 環境變數

在 Azure Portal → App Service → 設定 → 環境變數，新增：

| 名稱 | 值 |
|------|----|
| `ADMIN_BOOTSTRAP_EMAILS` | `410410681@o365.tku.edu.tw`（可用逗號分隔多個 email） |

Bootstrap 管理員會在首次啟動後自動寫入 DB，之後可從後台 UI 繼續新增其他人。

### 2. 部署

流程與原本相同，`npm start` 會自動 `prisma db push` 建立 `AdminUser` table：

```bash
cd nextjs-app

zip -r /tmp/deploy.zip . \
  -x "node_modules/*" ".next/*" "*.db" ".env*" "public/uploads/*" "*.tsbuildinfo"

az webapp deploy --name tku-mail-web \
  --resource-group rg-tku-mail-delivery \
  --src-path /tmp/deploy.zip --type zip
```

### 3. 驗證

部署完成後：
1. 開啟 `https://tku-mail-web.azurewebsites.net/admin`
2. 以 `410410681@o365.tku.edu.tw` 登入（bootstrap 管理員，直接放行）
3. 點「管理員設定」tab，確認名單顯示正常
4. 新增其他管理員 email，確認新帳號可登入後台

---

## 本機開發設定（`.env.local`）

```env
DATABASE_URL="file:./dev.db"
NEXT_PUBLIC_AZURE_CLIENT_ID=c2eae6e2-8ebc-4c0d-b0bc-5a35de299a49
NEXT_PUBLIC_AZURE_TENANT_ID=4f201ef2-463e-4ee1-a2c4-e76f9a1b9fae
OCR_SERVICE_URL=https://tku-mail-ocr.azurewebsites.net
TEAMS_WEBHOOK_URL=
NEXT_PUBLIC_BASE_URL=http://localhost:3000
ADMIN_BOOTSTRAP_EMAILS=你的學校email@o365.tku.edu.tw
```

---

## 相容性說明

- Azure AD App Role（`Admin`）**仍然有效**，不需移除。DB 名單是額外的 OR 條件。
- 現有已部署的資料（`MailItem`、`MailRequest` 等）不受影響，`AdminUser` 是全新的 table。
- 其他所有檔案（`portal-auth.ts`、`msal-config.ts`、`uploads.ts`、OCR route 等）**均未修改**，與 ORIGN 完全相同。
