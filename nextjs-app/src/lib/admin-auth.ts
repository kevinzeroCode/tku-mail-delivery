import { NextRequest, NextResponse } from 'next/server'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import { prisma } from '@/lib/db'
import {
  bootstrapAdminEmails,
  extractAdminEmailFromClaims,
  isBootstrapAdminEmail,
} from '@/lib/admin-users'
import { extractBearerToken, localAdminBypassEmail, validateAdminAuthConfig } from '@/lib/admin-auth-core'

const tenantId = process.env.NEXT_PUBLIC_AZURE_TENANT_ID ?? ''
const clientId = process.env.NEXT_PUBLIC_AZURE_CLIENT_ID ?? ''
const issuer = `https://login.microsoftonline.com/${tenantId}/v2.0`
const jwks = createRemoteJWKSet(
  new URL(`https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`)
)

export type AdminAuthResult =
  | { ok: true; email: string }
  | { ok: false; response: NextResponse }

async function ensureBootstrapAdmin(email: string) {
  if (!isBootstrapAdminEmail(email)) return

  await prisma.adminUser.upsert({
    where: { email },
    update: { source: 'bootstrap' },
    create: {
      email,
      source: 'bootstrap',
      createdByEmail: 'ADMIN_BOOTSTRAP_EMAILS',
    },
  })
}

export async function syncBootstrapAdmins() {
  const emails = bootstrapAdminEmails()
  if (emails.length === 0) return

  await Promise.all(
    emails.map(email =>
      prisma.adminUser.upsert({
        where: { email },
        update: { source: 'bootstrap' },
        create: {
          email,
          source: 'bootstrap',
          createdByEmail: 'ADMIN_BOOTSTRAP_EMAILS',
        },
      })
    )
  )
}

async function authorizeAdminEmail(email: string): Promise<AdminAuthResult> {
  await ensureBootstrapAdmin(email)

  const admin = await prisma.adminUser.findUnique({
    where: { email },
    select: { email: true },
  })
  if (!admin) {
    return {
      ok: false,
      response: NextResponse.json({ error: '沒有後台管理權限' }, { status: 403 }),
    }
  }

  return { ok: true, email }
}

export async function requireAdminAuth(req: NextRequest): Promise<AdminAuthResult> {
  const localEmail = localAdminBypassEmail({
    nodeEnv: process.env.NODE_ENV,
    enabled: process.env.LOCAL_ADMIN_BYPASS,
    configuredEmail: process.env.LOCAL_ADMIN_EMAIL,
    headerEmail: req.headers.get('x-local-admin-email'),
  })
  if (localEmail) {
    return authorizeAdminEmail(localEmail)
  }

  const config = validateAdminAuthConfig({ tenantId, clientId })
  if (!config.ok) {
    return {
      ok: false,
      response: NextResponse.json({ error: '管理員登入設定未完成' }, { status: 500 }),
    }
  }

  const token = extractBearerToken(req.headers.get('authorization'))
  if (!token) {
    return {
      ok: false,
      response: NextResponse.json({ error: '請先登入' }, { status: 401 }),
    }
  }

  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer,
      audience: clientId,
    })

    if (payload.tid !== tenantId) {
      return {
        ok: false,
        response: NextResponse.json({ error: '登入租用戶不正確' }, { status: 401 }),
      }
    }

    const email = extractAdminEmailFromClaims(payload)
    if (!email) {
      return {
        ok: false,
        response: NextResponse.json({ error: 'Microsoft token 缺少 email' }, { status: 401 }),
      }
    }

    return authorizeAdminEmail(email)
  } catch (e) {
    console.error('[admin-auth] token verification failed', e)
    return {
      ok: false,
      response: NextResponse.json({ error: '登入驗證失敗' }, { status: 401 }),
    }
  }
}
