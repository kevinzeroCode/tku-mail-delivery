import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// GET /api/settings — 取得所有設定
export async function GET() {
  try {
    const settings = await prisma.setting.findMany()
    const map = Object.fromEntries(settings.map(s => [s.key, s.value]))
    return NextResponse.json(map)
  } catch (e) {
    console.error('[GET /api/settings]', e)
    return NextResponse.json({ error: '無法載入設定' }, { status: 500 })
  }
}

// POST /api/settings — 更新設定（upsert）
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Record<string, unknown>

    // 只允許已知的設定 key，並確保值為字串
    const allowed = ['deadlineDays']
    const entries = Object.entries(body).filter(
      ([key, val]) => allowed.includes(key) && typeof val === 'string'
    ) as [string, string][]

    if (entries.length === 0) {
      return NextResponse.json({ error: '無有效的設定值' }, { status: 400 })
    }

    // 驗證 deadlineDays 為有效整數
    for (const [key, value] of entries) {
      if (key === 'deadlineDays') {
        const n = parseInt(value, 10)
        if (Number.isNaN(n) || n < 1 || n > 365) {
          return NextResponse.json({ error: 'deadlineDays 必須為 1-365 之間的整數' }, { status: 400 })
        }
      }
    }

    const updates = await Promise.all(
      entries.map(([key, value]) =>
        prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } })
      )
    )

    return NextResponse.json(updates)
  } catch (e) {
    console.error('[POST /api/settings]', e)
    return NextResponse.json({ error: '儲存設定失敗' }, { status: 500 })
  }
}
