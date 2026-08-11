/**
 * Anonymous quota for the public-facing essay scorer.
 * Tracks quota by an anonymous session ID stored in an httpOnly cookie.
 *
 * - 3 free runs per UTC day per browser
 * - Quota resets at 00:00 UTC
 * - In-memory for now; swap for Redis/DB in production
 */

import { randomUUID } from 'crypto'
import { cookies } from 'next/headers'

const COOKIE_NAME = 'fes_session'
const DAILY_LIMIT = 3
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

interface AnonEntry {
  calls: number
  dayKey: string // YYYY-MM-DD (UTC)
}

const store = new Map<string, AnonEntry>()

function utcDayKey(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10) // YYYY-MM-DD
}

function msUntilNextUtcMidnight(): number {
  const now = new Date()
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
  return next.getTime() - now.getTime()
}

/**
 * Get or create the anonymous session ID from the cookie.
 * Must be called inside a route handler (uses next/headers cookies).
 */
export async function getOrCreateAnonSessionId(): Promise<{ sessionId: string; isNew: boolean }> {
  const jar = await cookies()
  const existing = jar.get(COOKIE_NAME)
  if (existing?.value) {
    return { sessionId: existing.value, isNew: false }
  }
  const sessionId = randomUUID()
  // Route handlers can set cookies via the Response — caller handles that.
  // We return isNew so the caller knows to set the cookie on the response.
  return { sessionId, isNew: true }
}

/**
 * Consume one call. Returns remaining + reset, or null if quota exceeded.
 */
export function consumeAnon(sessionId: string): { remaining: number; resetMs: number } | null {
  const today = utcDayKey()
  let entry = store.get(sessionId)
  if (!entry || entry.dayKey !== today) {
    entry = { calls: 0, dayKey: today }
    store.set(sessionId, entry)
  }
  if (entry.calls >= DAILY_LIMIT) {
    return null
  }
  entry.calls += 1
  return {
    remaining: DAILY_LIMIT - entry.calls,
    resetMs: msUntilNextUtcMidnight(),
  }
}

/**
 * Refund one call if the request failed.
 */
export function refundAnon(sessionId: string): void {
  const entry = store.get(sessionId)
  if (entry && entry.calls > 0) entry.calls -= 1
}

/**
 * Peek at remaining quota without consuming.
 */
export function peekAnon(sessionId: string): { remaining: number; limit: number; resetMs: number } {
  const today = utcDayKey()
  const entry = store.get(sessionId)
  const calls = !entry || entry.dayKey !== today ? 0 : entry.calls
  return {
    remaining: Math.max(0, DAILY_LIMIT - calls),
    limit: DAILY_LIMIT,
    resetMs: msUntilNextUtcMidnight(),
  }
}

export { COOKIE_NAME, COOKIE_MAX_AGE, DAILY_LIMIT }
