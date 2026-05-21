import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// GET /api/admin/check?email=xxx
export async function GET(req: NextRequest) {
  try {
    const email = new URL(req.url).searchParams.get('email')?.trim().toLowerCase()
    if (!email) return NextResponse.json({ isAdmin: false })

    const bootstrapEmails = (process.env.ADMIN_BOOTSTRAP_EMAILS ?? '')
      .split(',').map(e => e.trim().toLowerCase()).filter(Boolean)

    if (bootstrapEmails.includes(email)) {
      return NextResponse.json({ isAdmin: true, source: 'bootstrap' })
    }

    const admin = await prisma.adminUser.findUnique({ where: { email } })
    return NextResponse.json({ isAdmin: !!admin, source: admin ? 'db' : null })
  } catch (e) {
    console.error('[GET /api/admin/check]', e)
    return NextResponse.json({ isAdmin: false }, { status: 500 })
  }
}
