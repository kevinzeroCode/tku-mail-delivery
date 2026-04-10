import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// GET /api/admin/requests — 列出所有申請（後台用）
export async function GET() {
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
}
