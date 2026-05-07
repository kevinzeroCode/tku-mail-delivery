import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// Basic email format check — not a full RFC validator, but blocks obvious injections.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// GET /api/portal/mails?email=xxx
// 回傳：待領取（所有）＋ 已領取/已退回（三個月以內），最多 50 筆
export async function GET(req: NextRequest) {
  try {
    const email = new URL(req.url).searchParams.get('email')?.trim()
    if (!email) return NextResponse.json({ error: '未提供 email' }, { status: 400 })
    if (!EMAIL_RE.test(email)) return NextResponse.json({ error: 'email 格式無效' }, { status: 400 })

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
          select: { id: true, type: true, status: true, adminNote: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { receivedDate: 'desc' },
      take: 50,
    })

    return NextResponse.json(items)
  } catch (e) {
    console.error('[GET /api/portal/mails]', e)
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 })
  }
}
