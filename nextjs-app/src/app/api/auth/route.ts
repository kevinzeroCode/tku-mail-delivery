import { NextRequest, NextResponse } from 'next/server'

// POST /api/auth — 簡易密碼驗證（v1 暫用，SSO 上線後移除）
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { password } = body

    if (typeof password !== 'string') {
      return NextResponse.json({ error: '請提供密碼' }, { status: 400 })
    }

    const correct = process.env.ADMIN_PASSWORD ?? 'changeme'

    if (password === correct) {
      return NextResponse.json({ ok: true })
    }
    return NextResponse.json({ error: '密碼錯誤' }, { status: 401 })
  } catch (e) {
    console.error('[POST /api/auth]', e)
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 })
  }
}
