import { NextRequest, NextResponse } from 'next/server'
import { captureEmail, validateEmail } from '../../../../lib/email-capture'

export async function POST(req: NextRequest) {
  let body: { email?: unknown; firstTool?: unknown; source?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const validation = validateEmail(body.email)
  if (!validation.ok) {
    const error = validation.reason === 'disposable'
      ? 'Please use a real email address — disposable addresses aren\u2019t accepted.'
      : 'Please enter a valid email address.'
    return NextResponse.json({ error, reason: validation.reason }, { status: 422 })
  }

  const firstTool = typeof body.firstTool === 'string' ? body.firstTool : undefined
  const source = typeof body.source === 'string' ? body.source : undefined

  try {
    const wasNew = await captureEmail(validation.email, { firstTool, source })
    return NextResponse.json({ ok: true, captured: wasNew })
  } catch (err) {
    console.error('[capture-email] write failed:', err)
    return NextResponse.json({ error: 'Could not save email. Please try again.' }, { status: 500 })
  }
}
