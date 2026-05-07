import { NextRequest, NextResponse } from 'next/server'

/**
 * Checks whether an incoming API request carries the admin session token.
 *
 * The admin login page POSTs to /api/auth which validates the password and
 * returns a signed JWT.  Every subsequent admin API call must include that
 * token in the `Authorization: Bearer <token>` header.
 *
 * For the current v1 implementation we use a simple HMAC-signed token so
 * we have NO additional dependency.  When O365 / MSAL lands, swap this for
 * a proper JWT library and move to short-lived access tokens.
 */

import { createHmac, timingSafeEqual } from 'crypto'

const SECRET = process.env.ADMIN_JWT_SECRET ?? process.env.ADMIN_PASSWORD ?? 'changeme'
const TOKEN_TTL_MS = 8 * 60 * 60 * 1000 // 8 hours

/** Produce a signed token encoding the current timestamp. */
export function signAdminToken(): string {
  const ts = Date.now().toString()
  const sig = createHmac('sha256', SECRET).update(ts).digest('hex')
  return Buffer.from(`${ts}.${sig}`).toString('base64url')
}

/** Returns true iff the token is valid and not expired. */
export function verifyAdminToken(token: string): boolean {
  try {
    const decoded = Buffer.from(token, 'base64url').toString()
    const dotIdx = decoded.lastIndexOf('.')
    if (dotIdx < 0) return false
    const ts  = decoded.slice(0, dotIdx)
    const sig = decoded.slice(dotIdx + 1)

    // Constant-time comparison to prevent timing attacks
    const expected = createHmac('sha256', SECRET).update(ts).digest('hex')
    const sigBuf      = Buffer.from(sig,      'utf8')
    const expectedBuf = Buffer.from(expected, 'utf8')
    if (sigBuf.length !== expectedBuf.length) return false
    if (!timingSafeEqual(sigBuf, expectedBuf)) return false

    // Check TTL
    const issued = parseInt(ts, 10)
    return Date.now() - issued < TOKEN_TTL_MS
  } catch {
    return false
  }
}

/**
 * Call at the start of every admin API handler.
 * Returns null if the request is authorised, or a 401 NextResponse to return immediately.
 */
export function requireAdminAuth(req: NextRequest): NextResponse | null {
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token || !verifyAdminToken(token)) {
    return NextResponse.json({ error: '未授權，請先登入' }, { status: 401 })
  }
  return null
}
