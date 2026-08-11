import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import {
  getAdminPassword,
  verifyPassword,
  createAdminSession,
  revokeAdminSession,
  ADMIN_COOKIE_NAME,
  ADMIN_SESSION_TTL_MS,
} from '@/lib/admin-auth'

const isProd = process.env.NODE_ENV === 'production'

function shouldUseSecureCookie(req: NextRequest): boolean {
  if (!isProd) return false
  const host = req.headers.get('host') ?? ''
  return !(
    host.startsWith('localhost') ||
    host.startsWith('127.0.0.1') ||
    host.startsWith('[::1]')
  )
}

export async function POST(req: NextRequest) {
  const configured = getAdminPassword()
  if (!configured) {
    return NextResponse.json(
      { error: 'Admin not configured. Set ADMIN_PASSWORD env var.' },
      { status: 503 }
    )
  }

  let body: { password?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  if (!verifyPassword(body.password, configured)) {
    return NextResponse.json({ error: 'Wrong password' }, { status: 401 })
  }

  // Valid password. Issue a random session token; the password itself
  // never touches the cookie.
  const token = createAdminSession()
  const res = NextResponse.json({ ok: true })
  res.cookies.set(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: shouldUseSecureCookie(req),
    path: '/',
    maxAge: Math.floor(ADMIN_SESSION_TTL_MS / 1000),
  })
  return res
}

export async function DELETE(req: NextRequest) {
  // Revoke the current token server-side AND clear the cookie client-side.
  const jar = await cookies()
  const existing = jar.get(ADMIN_COOKIE_NAME)
  if (existing?.value) revokeAdminSession(existing.value)

  const res = NextResponse.json({ ok: true })
  res.cookies.set(ADMIN_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: shouldUseSecureCookie(req),
    path: '/',
    maxAge: 0,
  })
  return res
}
