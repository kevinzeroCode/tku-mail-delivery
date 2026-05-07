import { NextRequest, NextResponse } from 'next/server'
import { signAdminToken } from '@/lib/admin-auth'

// POST /api/auth — 簡易密碼驗證（v1 暫用，SSO 上線後移除）
// On success returns a short-lived signed token the client must include in
// subsequent admin API calls as:  Authorization: Bearer <token>
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { password } = body

    if (typeof password !== 'string') {
      return NextResponse.json({ error: '請提供密碼' }, { status: 400 })
    }

    const correct = process.env.ADMIN_PASSWORD ?? 'changeme'

    // Constant-time string comparison to resist timing attacks
    const { timingSafeEqual } = await import('crypto')
    const pwBuf = Buffer.from(password)
    const okBuf = Buffer.from(correct)

    // Pad to equal length before comparison so timingSafeEqual doesn't throw
    const maxLen = Math.max(pwBuf.length, okBuf.length)
    const padded   = Buffer.concat([pwBuf, Buffer.alloc(maxLen - pwBuf.length)])
    const paddedOk = Buffer.concat([okBuf, Buffer.alloc(maxLen - okBuf.length)])

    const match = timingSafeEqual(padded, paddedOk) && pwBuf.length === okBuf.length

    if (match) {
      const token = signAdminToken()
      return NextResponse.json({ ok: true, token })
    }
    return NextResponse.json({ error: '密碼錯誤' }, { status: 401 })
  } catch (e) {
    console.error('[POST /api/auth]', e)
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 })
  }
}
