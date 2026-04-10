import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// PUT /api/admin/requests/[id] — 核准或拒絕申請
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: idStr } = await params
    const id = parseInt(idStr, 10)
    if (Number.isNaN(id)) return NextResponse.json({ error: '無效 ID' }, { status: 400 })

    const { action, adminNote } = await req.json()  // action: 'approve' | 'reject'
    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: '無效操作' }, { status: 400 })
    }

    const request = await prisma.mailRequest.findUnique({
      where: { id },
      include: { mailItem: true },
    })
    if (!request) return NextResponse.json({ error: '找不到申請' }, { status: 404 })
    if (request.status !== '待處理') {
      return NextResponse.json({ error: '此申請已處理完畢' }, { status: 409 })
    }

    // 核准時套用對郵件的變更
    if (action === 'approve') {
      const data = request.requestData ? JSON.parse(request.requestData) : {}

      if (request.type === 'reject_return') {
        await prisma.mailItem.update({
          where: { id: request.mailItemId },
          data: { status: '已退回', returnDate: new Date() },
        })
      } else if (request.type === 'change_pickup') {
        await prisma.mailItem.update({
          where: { id: request.mailItemId },
          data: { pickupMethod: data.newMethod ?? null },
        })
      } else if (request.type === 'wrong_recipient') {
        await prisma.mailItem.update({
          where: { id: request.mailItemId },
          data: {
            recipientName:  data.correctName  || request.mailItem.recipientName,
            recipientEmail: data.correctEmail || request.mailItem.recipientEmail,
          },
        })
      } else if (request.type === 'pickup_signed') {
        await prisma.mailItem.update({
          where: { id: request.mailItemId },
          data: {
            status: '已領取',
            pickupDate:   new Date(),
            pickupPerson: data.pickerName ?? null,
          },
        })
      }
    }

    const updated = await prisma.mailRequest.update({
      where: { id },
      data: {
        status:    action === 'approve' ? '已核准' : '已拒絕',
        adminNote: adminNote ?? null,
      },
    })
    return NextResponse.json(updated)
  } catch (e) {
    console.error('[PUT /api/admin/requests/[id]]', e)
    return NextResponse.json({ error: '更新失敗' }, { status: 500 })
  }
}
