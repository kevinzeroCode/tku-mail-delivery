import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// GET /api/portal/profile?email=xxx
export async function GET(req: NextRequest) {
  const email = new URL(req.url).searchParams.get('email')?.trim()
  if (!email) return NextResponse.json({ error: '未提供 email' }, { status: 400 })

  const profile = await prisma.userProfile.findUnique({ where: { email } })
  return NextResponse.json(profile ?? { id: null, email })
}

// POST /api/portal/profile — upsert profile
export async function POST(req: NextRequest) {
  try {
    const { email, name, studentId, defaultPickup, notifyEmail, schoolStatus, notes } = await req.json()
    if (!email) return NextResponse.json({ error: '未提供 email' }, { status: 400 })

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
