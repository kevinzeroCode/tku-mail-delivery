import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdminAuth } from '@/lib/admin-auth'

// GET /api/items — 取得所有郵件（支援篩選）— admin only
export async function GET(req: NextRequest) {
  const auth = await requireAdminAuth(req)
  if (!auth.ok) return auth.response

  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const mailType = searchParams.get('mailType')
    const search = searchParams.get('search')

    const items = await prisma.mailItem.findMany({
      where: {
        ...(status && { status }),
        ...(mailType && { mailType }),
        ...(search && {
          OR: [
            { trackingCode: { contains: search } },
            { recipientName: { contains: search } },
            { foreignName: { contains: search } },
          ],
        }),
      },
      orderBy: { receivedDate: 'desc' },
    })

    return NextResponse.json(items)
  } catch (e) {
    console.error('[GET /api/items]', e)
    return NextResponse.json({ error: '伺服器錯誤，無法載入郵件清單' }, { status: 500 })
  }
}

// POST /api/items — 新增郵件 — admin only
export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth(req)
  if (!auth.ok) return auth.response

  try {
    const body = await req.json()

    if (!body.trackingCode || typeof body.trackingCode !== 'string' || !body.trackingCode.trim()) {
      return NextResponse.json({ error: '追蹤碼為必填欄位' }, { status: 400 })
    }

    const defaultDaysSetting = await prisma.setting.findUnique({ where: { key: 'deadlineDays' } })
    const parsedDefault = defaultDaysSetting ? parseInt(defaultDaysSetting.value, 10) : NaN
    const fallbackDays = Number.isNaN(parsedDefault) ? 7 : parsedDefault

    const item = await prisma.mailItem.create({
      data: {
        trackingCode: body.trackingCode.trim(),
        mailType: body.mailType ?? '掛號',
        receivedDate: body.receivedDate ? new Date(body.receivedDate) : new Date(),
        photoPath: body.photoPath ?? null,
        listImagePath: body.listImagePath ?? null,
        ocrRawText: body.ocrRawText ?? null,
        recipientName: body.recipientName ?? null,
        foreignName: body.foreignName ?? null,
        recipientEmail: body.recipientEmail ?? null,
        pickupMethod: body.pickupMethod ?? null,
        deadlineDays: body.deadlineDays ?? fallbackDays,
        notes: body.notes ?? null,
      },
    })

    return NextResponse.json(item, { status: 201 })
  } catch (e) {
    console.error('[POST /api/items]', e)
    return NextResponse.json({ error: '新增郵件失敗' }, { status: 500 })
  }
}
