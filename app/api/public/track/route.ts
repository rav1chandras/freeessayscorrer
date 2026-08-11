import { NextRequest, NextResponse } from 'next/server'
import { logEvent, isValidEventName } from '@/lib/analytics'
import { getOrCreateAnonSessionId, COOKIE_NAME, COOKIE_MAX_AGE } from '@/lib/anon-quota'

const isProd = process.env.NODE_ENV === 'production'

export async function POST(req: NextRequest) {
  let body: {
    name?: unknown
    tool?: unknown
    quality?: unknown
    source?: unknown
    meta?: unknown
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!isValidEventName(body.name)) {
    return NextResponse.json({ error: 'Unknown event name' }, { status: 422 })
  }

  const { sessionId, isNew } = await getOrCreateAnonSessionId()

  const tool = typeof body.tool === 'string' ? body.tool : undefined
  const quality =
    body.quality === 'great' || body.quality === 'okay' || body.quality === 'needs-work'
      ? body.quality
      : undefined
  const source = typeof body.source === 'string' ? body.source : undefined

  // Lightly sanitize meta: only allow primitive values, max 10 keys
  let meta: Record<string, string | number | boolean> | undefined
  if (body.meta && typeof body.meta === 'object' && !Array.isArray(body.meta)) {
    meta = {}
    const entries = Object.entries(body.meta as Record<string, unknown>).slice(0, 10)
    for (const [k, v] of entries) {
      if (typeof v === 'string' && v.length < 200) meta[k] = v
      else if (typeof v === 'number' && isFinite(v)) meta[k] = v
      else if (typeof v === 'boolean') meta[k] = v
    }
    if (Object.keys(meta).length === 0) meta = undefined
  }

  await logEvent({ name: body.name, sessionId, tool, quality, source, meta })

  const res = NextResponse.json({ ok: true })
  if (isNew) {
    res.cookies.set(COOKIE_NAME, sessionId, {
      httpOnly: true, sameSite: 'lax', secure: isProd, path: '/', maxAge: COOKIE_MAX_AGE,
    })
  }
  return res
}
