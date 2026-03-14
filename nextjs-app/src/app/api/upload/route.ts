import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

// POST /api/upload — 純檔案儲存，不呼叫 OCR 服務
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) return NextResponse.json({ error: '未上傳檔案' }, { status: 400 })

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: '檔案過大，上限為 10MB' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const originalExt = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
    const safeExt = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(originalExt)
      ? originalExt
      : 'jpg'
    const filename = `photo_${Date.now()}.${safeExt}`
    const uploadDir = path.join(process.cwd(), 'public', 'uploads')
    const savePath = path.join(uploadDir, filename)

    await mkdir(uploadDir, { recursive: true })
    await writeFile(savePath, buffer)

    return NextResponse.json({ savedPath: `/uploads/${filename}` })
  } catch (e) {
    console.error('[POST /api/upload]', e)
    return NextResponse.json({ error: '上傳失敗' }, { status: 500 })
  }
}
