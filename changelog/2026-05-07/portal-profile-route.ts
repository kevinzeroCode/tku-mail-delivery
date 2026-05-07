import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// GET /api/portal/profile?email=xxx
export async function GET(req: NextRequest) {
  try {
    const email = new URL(req.url).searchParams.get('email')?.trim()
    if (!email) return NextResponse.json({ error: '未提供 email' }, { status: 400 })
    if (!EMAIL_RE.test(email)) return NextResponse.json({ error: 'email 格式無效' }, { status: 400 })

    const profile = await prisma.userProfile.findUnique({ where: { email } })
    return NextResponse.json(profile ?? { id: null, email })
  } catch (e) {
    console.error('[GET /api/portal/profile]', e)
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 })
  }
}

// POST /api/portal/profile — upsert profile
export async function POST(req: NextRequest) {
  try {
    const { email, name, studentId, defaultPickup, notifyEmail, schoolStatus, notes } = await req.json()
    if (!email) return NextResponse.json({ error: '未提供 email' }, { status: 400 })
    if (!EMAIL_RE.test(email)) return NextResponse.json({ error: 'email 格式無效' }, { status: 400 })

    // Validate notifyEmail if provided
    if (notifyEmail && !EMAIL_RE.test(notifyEmail)) {
      return NextResponse.json({ error: '通知 email 格式無效' }, { status: 400 })
    }

    const VALID_SCHOOL_STATUSES = ['在學中', '已畢業', '休學中', '在職中', '已離退', null, undefined]
    if (schoolStatus !== undefined && !VALID_SCHOOL_STATUSES.includes(schoolStatus)) {
      return NextResponse.json({ error: '無效的在校狀態' }, { status: 400 })
    }

    const VALID_PICKUP_METHODS = ['自行領取', '代收通知', '付費寄回', '說明告知', '其他', null, undefined]
    if (defaultPickup !== undefined && !VALID_PICKUP_METHODS.includes(defaultPickup)) {
      return NextResponse.json({ error: '無效的領取方式' }, { status: 400 })
    }

    const profile = await prisma.userProfile.upsert({
      where: { email },
      update:  { name, studentId, defaultPickup, notifyEmail, schoolStatus, notes },
      create:  { email, name, studentId, defaultPickup, notifyEmail, schoolStatus, notes },
    })
    return NextResponse.json(profile)
  } catch (e) {
    console.error('[POST /api/portal/profile]', e)
    return NextResponse.json({ error: '儲存失敗' }, { status: 500 })
  }
}
