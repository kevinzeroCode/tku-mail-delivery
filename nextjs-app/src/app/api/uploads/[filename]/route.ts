import { NextRequest, NextResponse } from 'next/server'
import { stat, readFile } from 'fs/promises'
import path from 'path'
import { getUploadsDir } from '@/lib/uploads'

const MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
}

// GET /api/uploads/<filename> — serve 上傳目錄裡的圖片
// Azure 把 UPLOADS_DIR 設為 /home/site/uploads（持久化），但 Next.js 不會自動 serve /home，
// 所以由此 route 負責讀檔回傳。
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ filename: string }> },
) {
  const { filename } = await ctx.params

  // 防止路徑穿越：只允許單一檔名
  if (!filename || filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
    return NextResponse.json({ error: 'invalid filename' }, { status: 400 })
  }

  const dir = getUploadsDir()
  const fullPath = path.join(dir, filename)
  const resolved = path.resolve(fullPath)
  const dirResolved = path.resolve(dir)
  if (!resolved.startsWith(dirResolved + path.sep) && resolved !== dirResolved) {
    return NextResponse.json({ error: 'invalid path' }, { status: 400 })
  }

  try {
    await stat(resolved)
    const data = await readFile(resolved)
    const ext = filename.split('.').pop()?.toLowerCase() ?? ''
    const mime = MIME[ext] ?? 'application/octet-stream'
    return new NextResponse(data, {
      headers: {
        'Content-Type': mime,
        'Cache-Control': 'private, max-age=300',
      },
    })
  } catch {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }
}
