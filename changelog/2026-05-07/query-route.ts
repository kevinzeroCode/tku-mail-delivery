import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// GET /api/query?code=123456 — 公開查詢（只回傳必要欄位）
export async function GET(req: NextRequest) {
  try {
    const code = new URL(req.url).searchParams.get('code')?.trim()

    if (!code) return NextResponse.json({ error: '請輸入查詢編號' }, { status: 400 })

    const threeMonthsAgo = new Date()
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)

    const items = await prisma.mailItem.findMany({
      where: {
        trackingCode: { contains: code },
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
        status: true,
        notificationSent: true,
        notificationDate: true,
        deadlineDays: true,
        pickupDate: true,
        returnDate: true,
        notes: true,
      },
      orderBy: { receivedDate: 'desc' },
    })

    if (items.length === 0) return NextResponse.json({ error: '查無此編號' }, { status: 404 })

    return NextResponse.json(items)
  } catch (e) {
    console.error('[GET /api/query]', e)
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 })
  }
}
