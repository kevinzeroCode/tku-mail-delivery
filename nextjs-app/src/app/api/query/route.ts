import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// GET /api/query?code=123456 — 公開查詢（只回傳必要欄位）
export async function GET(req: NextRequest) {
  const code = new URL(req.url).searchParams.get('code')?.trim()

  if (!code) return NextResponse.json({ error: '請輸入查詢編號' }, { status: 400 })

  const items = await prisma.mailItem.findMany({
    where: { trackingCode: { contains: code } },
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
      notes: true,
    },
    orderBy: { receivedDate: 'desc' },
  })

  if (items.length === 0) return NextResponse.json({ error: '查無此編號' }, { status: 404 })

  return NextResponse.json(items)
}
