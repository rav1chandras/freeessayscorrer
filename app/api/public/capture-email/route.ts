import { NextRequest, NextResponse } from 'next/server'
import { ALLOWED_EMAIL_DOMAIN_HINT, captureEmail, validateEmail } from '../../../../lib/email-capture'

const MIN_FORM_AGE_MS = 1200
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000
const MAX_SIGNUPS_PER_WINDOW = 8
const signupAttempts = new Map<string, { count: number; resetAt: number }>()

function getClientKey(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwarded || req.headers.get('x-real-ip') || 'unknown'
}

function isRateLimited(key: string): boolean {
  const now = Date.now()
  const current = signupAttempts.get(key)
  if (!current || current.resetAt <= now) {
    signupAttempts.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return false
  }

  current.count += 1
  return current.count > MAX_SIGNUPS_PER_WINDOW
}

export async function POST(req: NextRequest) {
  let body: { email?: unknown; firstTool?: unknown; source?: unknown; website?: unknown; startedAt?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (typeof body.website === 'string' && body.website.trim()) {
    return NextResponse.json({ ok: true, captured: false })
  }

  const startedAt = typeof body.startedAt === 'number' ? body.startedAt : 0
  if (!startedAt || Date.now() - startedAt < MIN_FORM_AGE_MS) {
    return NextResponse.json(
      { error: 'Please wait a second and try again.', code: 'form_submitted_too_fast' },
      { status: 429 }
    )
  }

  if (isRateLimited(getClientKey(req))) {
    return NextResponse.json(
      { error: 'Too many signup attempts. Please try again later.', code: 'rate_limited' },
      { status: 429 }
    )
  }

  const validation = validateEmail(body.email)
  if (!validation.ok) {
    const error = validation.reason === 'domain'
      ? ALLOWED_EMAIL_DOMAIN_HINT
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
    return NextResponse.json(
      { error: 'Email signup is temporarily unavailable. Please try again soon.', code: 'email_capture_unavailable' },
      { status: 503 }
    )
  }
}
