# 2026-05-07 異動紀錄

## 新增功能

### 1. 領取簽名板（PickupModal + SignaturePad）
- 管理員確認領取時，必須讓收件人手寫簽名才能送出
- 簽名圖片上傳至 `public/uploads/`，路徑存入 DB `signaturePath` 欄位
- 詳細資訊 Modal 新增「領取簽名」區塊，可查看歷史簽名字跡
- **異動檔案**：`PickupModal.tsx`、`MailTable.tsx`

### 2. API 身分驗證機制（admin-auth）
- 新增 `admin-auth.ts`：HMAC-SHA256 簽名 Token，8 小時有效
- 登入後回傳 token，存於 `sessionStorage`
- 所有 admin API 一律加上 `requireAdminAuth(req)` 守門，未授權回 401
- 密碼比對改用 `crypto.timingSafeEqual`（防 timing attack）
- **異動檔案**：`admin-auth.ts`（新增）、`auth-route.ts`、所有 admin API route

### 3. OCR 批量掃描修正
- `/api/ocr` 改為先讀 `text()` 再 `JSON.parse()`，避免 Railway 回傳非 JSON 時直接炸掉
- `OcrUpload.tsx`、`AddMailModal.tsx` fetch 補上 `Authorization` header
- `AddMailModal` 的 `setFieldValue` 改為 `setFieldsValue`，修正 circular reference 警告
- **異動檔案**：`ocr-route.ts`、`OcrUpload.tsx`、`AddMailModal.tsx`

### 4. 學生申請功能強化（Portal）
- `reject_return`（拒收）新增留言欄，可說明原因
- `change_pickup`（異動方式）選「其他」時，動態顯示必填說明欄
- Portal 申請狀態欄改為顯示每筆申請結果（✓ 已核准 / ✗ 已拒絕 / ⏳ 待處理）+ 管理員備註
- `/api/portal/mails` 回傳的 requests 補上 `adminNote` 欄位
- **異動檔案**：`MailRequestModal.tsx`、`portal-page.tsx`、`portal-mails-route.ts`

### 5. 安全性修補（Security Audit）
- 所有 admin API route 加上身分驗證守門
- Portal IDOR 修補：`/api/portal/mails` 加 email 格式驗證；`/api/portal/requests` 加收件人比對
- `/api/portal/profile` POST 加入 `schoolStatus`、`defaultPickup` 白名單驗證
- `RequestsPanel` 備註改為 per-row 狀態，修正備註串位的 bug
- Settings Modal 的 `settingsForm.setFieldsValue` 改為 `afterOpenChange` 觸發，修正 useForm 未連結警告
- **異動檔案**：`admin-requests-route.ts`、`portal-requests-route.ts`、`portal-profile-route.ts`、`query-route.ts`、`RequestsPanel.tsx`、`admin/page.tsx`

### 6. 雜項修正
- 4 個 Modal 的 `destroyOnClose` 改為 `destroyOnHidden`（antd 版本相容）
- `PickupModal` 加上 `null` guard，避免 item 為 null 時 runtime error
- Prisma log 補上 `warn` 等級

---

## 資料庫異動

| 欄位 | 資料表 | 說明 |
|------|--------|------|
| `signaturePath String?` | `MailItem` | 領取手寫簽名圖片路徑（新增） |

執行方式：`cd nextjs-app && npx prisma db push`

---

## 檔案對照表

| 此資料夾檔案 | 原始路徑 |
|-------------|---------|
| `page.tsx` (admin) | `src/app/admin/page.tsx` |
| `portal-page.tsx` | `src/app/portal/page.tsx` |
| `admin-requests-id-route.ts` | `src/app/api/admin/requests/[id]/route.ts` |
| `admin-requests-route.ts` | `src/app/api/admin/requests/route.ts` |
| `auth-route.ts` | `src/app/api/auth/route.ts` |
| `items-id-route.ts` | `src/app/api/items/[id]/route.ts` |
| `items-route.ts` | `src/app/api/items/route.ts` |
| `notify-route.ts` | `src/app/api/notify/route.ts` |
| `ocr-route.ts` | `src/app/api/ocr/route.ts` |
| `portal-mails-route.ts` | `src/app/api/portal/mails/route.ts` |
| `portal-profile-route.ts` | `src/app/api/portal/profile/route.ts` |
| `portal-requests-route.ts` | `src/app/api/portal/requests/route.ts` |
| `query-route.ts` | `src/app/api/query/route.ts` |
| `settings-route.ts` | `src/app/api/settings/route.ts` |
| `upload-route.ts` | `src/app/api/upload/route.ts` |
| `admin-auth.ts` | `src/lib/admin-auth.ts` |
| `db.ts` | `src/lib/db.ts` |
| `mail.ts` | `src/services/mail.ts` |
| `AddMailModal.tsx` | `src/components/AddMailModal.tsx` |
| `MailRequestModal.tsx` | `src/components/MailRequestModal.tsx` |
| `MailTable.tsx` | `src/components/MailTable.tsx` |
| `OcrUpload.tsx` | `src/components/OcrUpload.tsx` |
| `PickupModal.tsx` | `src/components/PickupModal.tsx` |
| `RequestsPanel.tsx` | `src/components/RequestsPanel.tsx` |
