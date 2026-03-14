import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// POST /api/notify — 發送 MS Teams 通知給指定郵件
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { itemId } = body

    if (!itemId || typeof itemId !== 'number') {
      return NextResponse.json({ error: '缺少有效的郵件 ID' }, { status: 400 })
    }

    const item = await prisma.mailItem.findUnique({ where: { id: itemId } })
    if (!item) return NextResponse.json({ error: '找不到郵件' }, { status: 404 })

    const webhookUrl = process.env.TEAMS_WEBHOOK_URL
    if (!webhookUrl) return NextResponse.json({ error: '未設定 Teams Webhook URL' }, { status: 500 })

    const deadline = new Date(item.receivedDate)
    deadline.setDate(deadline.getDate() + item.deadlineDays)

    const message = {
      "@type": "MessageCard",
      "@context": "http://schema.org/extensions",
      "themeColor": "0076D7",
      "summary": "郵件待領取通知",
      "sections": [{
        "activityTitle": "📬 您有郵件待領取",
        "activitySubtitle": `收件人：${item.recipientName ?? '未登記'}`,
        "facts": [
          { "name": "追蹤編號", "value": item.trackingCode },
          { "name": "郵件類型", "value": item.mailType },
          { "name": "到件日期", "value": new Date(item.receivedDate).toLocaleDateString('zh-TW') },
          { "name": "領取期限", "value": deadline.toLocaleDateString('zh-TW') },
          { "name": "備註", "value": item.notes ?? '無' },
        ],
        "markdown": true
      }],
      "potentialAction": [{
        "@type": "OpenUri",
        "name": "查詢狀態",
        "targets": [{ "os": "default", "uri": `${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/?code=${item.trackingCode}` }]
      }]
    }

    let teamsRes: Response
    try {
      teamsRes = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      })
    } catch (networkErr) {
      console.error('[notify] Teams webhook 網路錯誤', networkErr)
      return NextResponse.json({ error: 'Teams 通知發送失敗（網路錯誤）' }, { status: 502 })
    }

    if (!teamsRes.ok) {
      return NextResponse.json({ error: 'Teams 通知發送失敗' }, { status: 502 })
    }

    // 更新通知狀態
    await prisma.mailItem.update({
      where: { id: itemId },
      data: { notificationSent: true, notificationDate: new Date() },
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[POST /api/notify]', e)
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 })
  }
}
