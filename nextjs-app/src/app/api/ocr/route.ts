import { NextRequest, NextResponse } from 'next/server'
import { writeFile } from 'fs/promises'
import path from 'path'

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

    // 保留原始副檔名
    const originalExt = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
    const safeExt = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(originalExt)
      ? originalExt
      : 'jpg'
    const filename = `ocr_${Date.now()}.${safeExt}`
    const savePath = path.join(process.cwd(), 'public', 'uploads', filename)

    try {
      await writeFile(savePath, buffer)
    } catch (fsErr) {
      console.error('[ocr] 無法儲存上傳檔案', fsErr)
      return NextResponse.json({ error: '檔案儲存失敗' }, { status: 500 })
    }

    // 轉發給 Python OCR 微服務
    const ocrUrl = process.env.OCR_SERVICE_URL ?? 'http://localhost:8000'
    const ocrForm = new FormData()
    ocrForm.append('file', new Blob([buffer], { type: file.type || 'image/jpeg' }), filename)

    let ocrRes: Response
    try {
      ocrRes = await fetch(`${ocrUrl}/ocr`, { method: 'POST', body: ocrForm })
    } catch (networkErr) {
      console.error('[ocr] OCR 服務無法連線', networkErr)
      // 檔案已存好，回傳 savedPath 讓呼叫端至少能記住圖片位置
      return NextResponse.json(
        { error: 'OCR 服務無法連線', savedPath: `/uploads/${filename}` },
        { status: 502 },
      )
    }

    if (!ocrRes.ok) {
      return NextResponse.json({ error: 'OCR 服務異常' }, { status: 502 })
    }

    const result = await ocrRes.json()
    return NextResponse.json({ ...result, savedPath: `/uploads/${filename}` })
  } catch (e) {
    console.error('[POST /api/ocr]', e)
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 })
  }
}
