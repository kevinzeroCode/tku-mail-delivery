import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { getUploadsDir, publicUrlFor } from '@/lib/uploads'

export const maxDuration = 60

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

// POST /api/ocr — 接收圖片，轉發給 Python OCR 服務
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) return NextResponse.json({ error: '未上傳圖片' }, { status: 400 })

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: '檔案過大，上限為 10MB' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const originalExt = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
    const safeExt = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(originalExt)
      ? originalExt
      : 'jpg'
    const filename = `ocr_${Date.now()}.${safeExt}`
    const uploadDir = getUploadsDir()
    const savePath = path.join(uploadDir, filename)

    let savedPath: string | null = publicUrlFor(filename)
    try {
      await mkdir(uploadDir, { recursive: true })
      await writeFile(savePath, buffer)
    } catch (fsErr) {
      console.warn('[ocr] 無法儲存上傳檔案，繼續 OCR', fsErr)
      savedPath = null
    }

    const ocrUrl = process.env.OCR_SERVICE_URL ?? 'http://localhost:8000'
    const ocrForm = new FormData()
    ocrForm.append('file', new Blob([buffer], { type: file.type || 'image/jpeg' }), filename)

    let ocrRes: Response
    try {
      ocrRes = await fetch(`${ocrUrl}/ocr`, { method: 'POST', body: ocrForm })
    } catch (networkErr) {
      console.error('[ocr] OCR 服務無法連線', networkErr)
      return NextResponse.json(
        { error: 'OCR 服務無法連線', savedPath },
        { status: 502 },
      )
    }

    if (!ocrRes.ok) {
      const errText = await ocrRes.text().catch(() => '')
      console.error('[ocr] OCR 服務異常，status:', ocrRes.status, '，body:', errText.slice(0, 300))
      return NextResponse.json({ error: 'OCR 服務異常' }, { status: 502 })
    }

    const rawBody = await ocrRes.text()
    let result: { trackingCodes: string[]; rawText: string; lineCount: number }
    try {
      result = JSON.parse(rawBody)
    } catch {
      console.error('[ocr] OCR 回傳非 JSON，前 300 字：', rawBody.slice(0, 300))
      return NextResponse.json({ error: 'OCR 服務回傳格式錯誤，請確認服務狀態' }, { status: 502 })
    }
    return NextResponse.json({ ...result, savedPath })
  } catch (e) {
    console.error('[POST /api/ocr]', e)
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 })
  }
}
