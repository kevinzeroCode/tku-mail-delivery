import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdminAuth } from '@/lib/admin-auth'

// GET /api/admin/requests — 列出所有申請（後台用）
export async function GET(req: NextRequest) {
  const auth = await requireAdminAuth(req)
  if (!auth.ok) return auth.response

  try {
    const requests = await prisma.mailRequest.findMany({
      include: {
        mailItem: {
          select: { trackingCode: true, mailType: true, recipientName: true, status: true },
        },
      },
      orderBy: [
        { status: 'asc' },   // 待處理排前面
        { createdAt: 'desc' },
      ],
    })
    return NextResponse.json(requests)
  } catch (e) {
    console.error('[GET /api/admin/requests]', e)
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 })
  }
}
