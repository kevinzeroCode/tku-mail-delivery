import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// GET /api/portal/mails?email=xxx
// 回傳：待領取（所有）＋ 已領取/已退回（三個月以內），最多 50 筆
export async function GET(req: NextRequest) {
  const email = new URL(req.url).searchParams.get('email')?.trim()
  if (!email) return NextResponse.json({ error: '未提供 email' }, { status: 400 })

  const threeMonthsAgo = new Date()
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)

  const items = await prisma.mailItem.findMany({
    where: {
      recipientEmail: email,
      OR: [
        { status: '待領取' },
        { status: { in: ['已領取', '已退回'] }, updatedAt: { gte: threeMonthsAgo } },
      ],
    },
    select: {
      id: true,
      trackingCode: true,
      mailType: true,
      receivedDate: true,
      deadlineDays: true,
      status: true,
      notificationSent: true,
      pickupDate: true,
      returnDate: true,
      pickupMethod: true,
      pickupPerson: true,
      notes: true,
      updatedAt: true,
      requests: {
        select: { id: true, type: true, status: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      },
    },
    orderBy: { receivedDate: 'desc' },
    take: 50,
  })

  return NextResponse.json(items)
}
