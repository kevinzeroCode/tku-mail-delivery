import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

function parseId(idStr: string): number | null {
  const id = parseInt(idStr, 10)
  return Number.isNaN(id) ? null : id
}

// GET /api/items/[id]
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: idStr } = await params
    const id = parseId(idStr)
    if (id === null) return NextResponse.json({ error: '無效的郵件 ID' }, { status: 400 })

    const item = await prisma.mailItem.findUnique({ where: { id } })
    if (!item) return NextResponse.json({ error: '找不到郵件' }, { status: 404 })
    return NextResponse.json(item)
  } catch (e) {
    console.error('[GET /api/items/[id]]', e)
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 })
  }
}

// PUT /api/items/[id] — 更新欄位（狀態、領取人等）
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await req.json()
    const { id: idStr } = await params
    const id = parseId(idStr)
    if (id === null) return NextResponse.json({ error: '無效的郵件 ID' }, { status: 400 })

    const updateData: Record<string, unknown> = {}

    if (body.status !== undefined) {
      updateData.status = body.status
      // 自動記錄退回時間（若前端未明確傳入 returnDate）
      if (body.status === '已退回' && body.returnDate === undefined) {
        updateData.returnDate = new Date()
      }
    }
    if (body.pickupMethod !== undefined) updateData.pickupMethod = body.pickupMethod
    if (body.pickupPerson !== undefined) updateData.pickupPerson = body.pickupPerson
    if (body.pickupDate !== undefined) updateData.pickupDate = body.pickupDate ? new Date(body.pickupDate) : null
    if (body.returnDate !== undefined) updateData.returnDate = body.returnDate ? new Date(body.returnDate) : null
    if (body.recipientName !== undefined) updateData.recipientName = body.recipientName
    if (body.recipientEmail !== undefined) updateData.recipientEmail = body.recipientEmail
    if (body.mailType !== undefined) updateData.mailType = body.mailType
    if (body.deadlineDays !== undefined) {
      const days = Number(body.deadlineDays)
      updateData.deadlineDays = Number.isNaN(days) ? undefined : days
    }
    if (body.photoPath !== undefined) updateData.photoPath = body.photoPath || null
    if (body.notes !== undefined) updateData.notes = body.notes
    if (body.photoOcrText !== undefined) updateData.photoOcrText = body.photoOcrText || null
    if (body.notificationSent !== undefined) {
      updateData.notificationSent = body.notificationSent
      updateData.notificationDate = body.notificationSent ? new Date() : null
    }

    const item = await prisma.mailItem.update({ where: { id }, data: updateData })
    return NextResponse.json(item)
  } catch (e: unknown) {
    if (e instanceof Error && 'code' in e && (e as { code: string }).code === 'P2025') {
      return NextResponse.json({ error: '找不到郵件' }, { status: 404 })
    }
    console.error('[PUT /api/items/[id]]', e)
    return NextResponse.json({ error: '更新失敗' }, { status: 500 })
  }
}

// DELETE /api/items/[id]
export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: idStr } = await params
    const id = parseId(idStr)
    if (id === null) return NextResponse.json({ error: '無效的郵件 ID' }, { status: 400 })

    await prisma.mailItem.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    if (e instanceof Error && 'code' in e && (e as { code: string }).code === 'P2025') {
      return NextResponse.json({ error: '找不到郵件' }, { status: 404 })
    }
    console.error('[DELETE /api/items/[id]]', e)
    return NextResponse.json({ error: '刪除失敗' }, { status: 500 })
  }
}
