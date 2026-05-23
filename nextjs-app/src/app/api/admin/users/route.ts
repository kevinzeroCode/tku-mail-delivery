import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdminAuth, syncBootstrapAdmins } from '@/lib/admin-auth'
import { normalizeAdminEmail, canDeleteAdminUser } from '@/lib/admin-users'

// GET /api/admin/users — 列出所有管理員（兼作權限檢查）
export async function GET(req: NextRequest) {
  const auth = await requireAdminAuth(req)
  if (!auth.ok) return auth.response

  await syncBootstrapAdmins()

  const users = await prisma.adminUser.findMany({
    orderBy: [{ source: 'asc' }, { createdAt: 'asc' }],
  })
  return NextResponse.json(users)
}

// POST /api/admin/users — 新增管理員
export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth(req)
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => ({}))
  const email = normalizeAdminEmail(body.email)
  if (!email) {
    return NextResponse.json({ error: '請提供有效的 Email' }, { status: 400 })
  }

  const existing = await prisma.adminUser.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json({ error: '此 Email 已是管理員' }, { status: 409 })
  }

  const user = await prisma.adminUser.create({
    data: { email, source: 'manual', createdByEmail: auth.email },
  })
  return NextResponse.json(user, { status: 201 })
}

// DELETE /api/admin/users — 移除管理員（Bootstrap 帳號不可刪）
export async function DELETE(req: NextRequest) {
  const auth = await requireAdminAuth(req)
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => ({}))
  const email = normalizeAdminEmail(body.email)
  if (!email) {
    return NextResponse.json({ error: '請提供有效的 Email' }, { status: 400 })
  }

  if (!canDeleteAdminUser(email)) {
    return NextResponse.json({ error: 'Bootstrap 管理員不可移除' }, { status: 403 })
  }

  await prisma.adminUser.deleteMany({ where: { email } })
  return new NextResponse(null, { status: 204 })
}
