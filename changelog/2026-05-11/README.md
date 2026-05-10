# 2026-05-11 異動紀錄

## 新增功能

### 1. EditMailModal 新增直接拍照功能
- 編輯郵件時，「貨物照片」區塊新增「直接拍照」按鈕，緊鄰原有的「新增照片 / 更換照片」按鈕
- 拍照後自動填入預覽縮圖，並觸發 OCR 辨識貨物文字（與上傳照片行為一致）
- **異動檔案**：`EditMailModal.tsx`

### 2. Webcam OCR 失敗改為軟提示
- `AddMailModal` 拍攝貨物照片後 OCR 失敗，原本靜音（`catch { /* silent */ }`）
- 現在改為 `message.warning('OCR 辨識失敗，可手動填寫追蹤碼')`，不影響後續操作
- **異動檔案**：`AddMailModal.tsx`

---

## Bug 修復

### 3. OCR 上傳清單 504 逾時修復（`OcrUpload.tsx`）
**根本原因**：手機、掃描器拍攝的清單圖片常見 3–5 MB，EasyOCR 處理需要 30–90 秒，超過 Vercel Hobby 方案 60 秒上限。Vercel 回傳 HTML 504 頁面，前端直接對 HTML 做 `res.json()` 炸掉，瀏覽器 F12 顯示「Unexpected non-whitespace character after JSON at position 6」。

**修法（兩層）**：
- **Client-side 圖片壓縮**：`compressImage()`，上傳前用 Canvas 縮放至最長邊 ≤ 1280px、JPEG 85% 品質，大幅降低圖片大小（3–5 MB → ~300 KB），OCR 時間縮短至 5–10 秒以內。Webcam 截圖原本就小，不受影響。
- **防禦性 JSON 解析**：`parseOcrResponse()`，先用 `res.text()` 接收，再嘗試 `JSON.parse`。非 JSON 時特別判斷 504 狀態，顯示友善提示「OCR 逾時（圖片過大？已自動壓縮，請再試一次）」。
- **異動檔案**：`OcrUpload.tsx`

### 4. 申請核准 Race Condition 修復（`admin-requests-id-route.ts`）
- 兩個管理員視窗同時點「核准」，原本可能雙重執行（更新郵件狀態兩次）
- 改用 `prisma.$transaction()` 包住整個核准流程，在 transaction 內重新讀取申請狀態，確保原子性
- **異動檔案**：`admin-requests-id-route.ts`

### 5. Portal IDOR 漏洞修補（`portal-requests-route.ts`）
- 原本：`if (item.recipientEmail && item.recipientEmail !== userEmail)` — 若郵件尚未登記 Email，任何人可送出申請
- 改為：`if (!item.recipientEmail || item.recipientEmail !== userEmail)` — Email 未登記的郵件也拒絕申請
- **異動檔案**：`portal-requests-route.ts`

### 6. Teams 通知連結修復（`notify-route.ts`）
- `NEXT_PUBLIC_BASE_URL` 未設時通知連結變相對路徑，Teams 無法點擊
- 改為在發送前先驗證環境變數，未設時直接回傳 500 並提示
- **異動檔案**：`notify-route.ts`

### 7. OCR 錯誤回應假路徑修復（`ocr-route.ts`）
- OCR 服務連線失敗時，即使檔案未存到磁碟，錯誤回應也回傳了 `savedPath: /uploads/...`（路徑不存在）
- 改為用 `savedFilename` 判斷，未存檔時回傳 `savedPath: null`
- **異動檔案**：`ocr-route.ts`

---

## 無資料庫異動

本次所有修改均在 API 路由邏輯與前端元件，不需執行 migration 或 `db push`。

---

## 檔案對照表

| 此資料夾檔案 | 原始路徑 |
|-------------|---------|
| `admin-requests-id-route.ts` | `src/app/api/admin/requests/[id]/route.ts` |
| `notify-route.ts` | `src/app/api/notify/route.ts` |
| `ocr-route.ts` | `src/app/api/ocr/route.ts` |
| `portal-requests-route.ts` | `src/app/api/portal/requests/route.ts` |
| `AddMailModal.tsx` | `src/components/AddMailModal.tsx` |
| `EditMailModal.tsx` | `src/components/EditMailModal.tsx` |
| `OcrUpload.tsx` | `src/components/OcrUpload.tsx` |
