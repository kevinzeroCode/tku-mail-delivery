import path from 'path'

// 上傳檔案儲存目錄。
// - 本機開發：留空 → 用 process.cwd()/public/uploads（Next.js 會直接 serve）
// - Azure App Service：設成 /home/site/uploads（持久化路徑），由 /api/uploads/[filename] serve
export function getUploadsDir(): string {
  const configured = process.env.UPLOADS_DIR
  if (configured && configured.trim()) return configured.trim()
  return path.join(process.cwd(), 'public', 'uploads')
}

// 給前端用的可訪問路徑。
// 若 UPLOADS_DIR 未設（本機）→ 直接走靜態 /uploads；
// 若有設（Azure）→ 透過 /api/uploads serve。
export function publicUrlFor(filename: string): string {
  return process.env.UPLOADS_DIR && process.env.UPLOADS_DIR.trim()
    ? `/api/uploads/${filename}`
    : `/uploads/${filename}`
}
