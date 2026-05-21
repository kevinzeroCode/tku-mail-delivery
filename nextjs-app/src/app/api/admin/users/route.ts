import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

function normalizeEmail(email: unknown): string | null {
  if (typeof email !== 'string') return null
  const e = email.trim().toLowerCase()
  return e.includes('@') ? e : null
}

function bootstrapEmails(): string[] {
  return (process.env.ADMIN_BOOTSTRAP_EMAILS ?? '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)
}

async function syncBootstrap(emails: string[]) {
  for (const email of emails) {
    await prisma.adminUser.upsert({
      where: { email },
      update: {},
      create: { email, source: 'bootstrap' },
    })
  }
}

// GET /api/admin/users
export async function GET() {
  try {
    await syncBootstrap(bootstrapEmails())
    const users = await prisma.adminUser.findMany({
      orderBy: { createdAt: 'asc' },
      select: { id: true, email: true, source: true, createdAt: true, createdByEmail: true },
    })
    return NextResponse.json(users)
  } catch (e) {
    console.error('[GET /api/admin/users]', e)
    return NextResponse.json({ error: '讀取管理員名單失敗' }, { status: 500 })
  }
}

// POST /api/admin/users { email, createdByEmail }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const email = normalizeEmail(body.email)
    if (!email) return NextResponse.json({ error: '請輸入有效 email' }, { status: 400 })

    const user = await prisma.adminUser.upsert({
      where: { email },
      update: {},
      create: { email, source: 'manual', createdByEmail: normalizeEmail(body.createdByEmail) ?? undefined },
      select: { id: true, email: true, source: true, createdAt: true, createdByEmail: true },
    })
    return NextResponse.json(user, { status: 201 })
  } catch (e) {
    console.error('[POST /api/admin/users]', e)
    return NextResponse.json({ error: '新增管理員失敗' }, { status: 500 })
  }
}

// DELETE /api/admin/users { email }
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const email = normalizeEmail(body.email)
    if (!email) return NextResponse.json({ error: '請輸入有效 email' }, { status: 400 })

    if (bootstrapEmails().includes(email)) {
      return NextResponse.json({ error: 'Bootstrap 管理員不可從系統內移除' }, { status: 400 })
    }

    await prisma.adminUser.delete({ where: { email } })
    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    if (e instanceof Error && 'code' in e && (e as { code: string }).code === 'P2025') {
      return NextResponse.json({ error: '找不到管理員' }, { status: 404 })
    }
    console.error('[DELETE /api/admin/users]', e)
    return NextResponse.json({ error: '移除管理員失敗' }, { status: 500 })
  }
}
