/**
 * Admin auth. Password-only gate for the captures dashboard.
 *
 * On login: the submitted password is compared to ADMIN_PASSWORD in constant time,
 * and on success a cryptographically-random session token is generated, stored
 * in an in-memory Map with an expiry, and sent to the client as an httpOnly cookie.
 * The cookie NEVER contains the password.
 *
 * Sessions live only as long as the server process. Admins re-auth after a restart.
 * For horizontal-scale production, move the session store to Redis or a DB.
 */

import { cookies } from 'next/headers'
import { randomBytes, timingSafeEqual } from 'crypto'

const COOKIE_NAME = 'fes_admin'
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

// token → expiresAtMs
const sessions = new Map<string, number>()

function sweepExpired(now: number): void {
  sessions.forEach((expiresAt, token) => {
    if (expiresAt < now) sessions.delete(token)
  })
}

export function getAdminPassword(): string | null {
  return process.env.ADMIN_PASSWORD ?? null
}

/**
 * Constant-time password comparison. Returns true only when both strings
 * match exactly AND have the same length. The padding trick ensures
 * timingSafeEqual is always called on equal-length buffers (it throws otherwise).
 */
export function verifyPassword(submitted: unknown, configured: string): boolean {
  if (typeof submitted !== 'string' || submitted.length === 0) return false
  const a = Buffer.from(submitted, 'utf8')
  const b = Buffer.from(configured, 'utf8')
  const len = Math.max(a.length, b.length)
  const aPad = Buffer.alloc(len)
  const bPad = Buffer.alloc(len)
  a.copy(aPad)
  b.copy(bPad)
  return timingSafeEqual(aPad, bPad) && a.length === b.length
}

/**
 * Generate a random session token, store it with an expiry, return it.
 */
export function createAdminSession(): string {
  sweepExpired(Date.now())
  const token = randomBytes(32).toString('hex')
  sessions.set(token, Date.now() + SESSION_TTL_MS)
  return token
}

/**
 * Revoke a specific session token (logout).
 */
export function revokeAdminSession(token: string): void {
  sessions.delete(token)
}

/**
 * Is the current request carrying a valid, unexpired admin session?
 */
export async function isAdminAuthed(): Promise<boolean> {
  const pw = getAdminPassword()
  if (!pw) return false
  const jar = await cookies()
  const c = jar.get(COOKIE_NAME)
  if (!c?.value) return false
  const now = Date.now()
  sweepExpired(now)
  const expiresAt = sessions.get(c.value)
  return expiresAt !== undefined && expiresAt > now
}

export { COOKIE_NAME as ADMIN_COOKIE_NAME, SESSION_TTL_MS as ADMIN_SESSION_TTL_MS }
