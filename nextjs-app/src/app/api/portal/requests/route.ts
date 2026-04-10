import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

const VALID_TYPES = ['reject_return', 'change_pickup', 'wrong_recipient', 'pickup_signed']

// POST /api/portal/requests — 新增申請
export async function POST(req: NextRequest) {
  try {
    const { mailItemId, userEmail, type, requestData } = await req.json()

    if (!mailItemId || !userEmail || !type) {
      return NextResponse.json({ error: '缺少必要欄位' }, { status: 400 })
    }
    if (!VALID_TYPES.includes(type)) {
      return NextResponse.json({ error: '無效的申請類型' }, { status: 400 })
    }

    const item = await prisma.mailItem.findUnique({ where: { id: mailItemId } })
    if (!item) return NextResponse.json({ error: '郵件不存在' }, { status: 404 })
    if (item.status !== '待領取') {
      return NextResponse.json({ error: '此郵件已完成，無法申請' }, { status: 400 })
    }

    // 同一郵件同一類型已有「待處理」申請則不允許重複送出
    const existing = await prisma.mailRequest.findFirst({
      where: { mailItemId, type, status: '待處理' },
    })
    if (existing) {
      return NextResponse.json({ error: '此申請已送出，請等待處理人員回覆' }, { status: 409 })
    }

    const request = await prisma.mailRequest.create({
      data: {
        mailItemId,
        userEmail,
        type,
        requestData: requestData ? JSON.stringify(requestData) : null,
      },
    })
    return NextResponse.json(request)
  } catch (e) {
    console.error('[POST /api/portal/requests]', e)
    return NextResponse.json({ error: '申請失敗' }, { status: 500 })
  }
}
