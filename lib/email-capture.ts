/**
 * Email capture — persists to MySQL via lib/db.ts.
 *
 * Rejects:
 *   - malformed addresses
 *   - domains in the DISPOSABLE_DOMAINS blocklist (throwaway inboxes)
 *
 * Dedupes on email (case-insensitive) via a UNIQUE index; concurrent writes
 * are safe because conflicts are caught at the DB layer, not in JS.
 */

import type { RowDataPacket } from 'mysql2'
import { getDb } from './db'

// Disposable / throwaway email providers — block at capture time.
const DISPOSABLE_DOMAINS = new Set<string>([
  '10minutemail.com', '10minutemail.net',
  'guerrillamail.com', 'guerrillamail.net', 'guerrillamail.org', 'sharklasers.com',
  'grr.la', 'guerrillamailblock.com',
  'mailinator.com', 'mailinator.net', 'mailinator.org',
  'tempmail.com', 'temp-mail.com', 'temp-mail.org',
  'tmpmail.org', 'tmpmail.net',
  'throwaway.email', 'throwawaymail.com',
  'yopmail.com', 'yopmail.fr', 'yopmail.net',
  'trashmail.com', 'trashmail.net',
  'getnada.com', 'nada.email',
  'maildrop.cc', 'discard.email', 'fakeinbox.com', 'mohmal.com',
  'emailondeck.com', 'mintemail.com', 'dispostable.com', 'mytemp.email',
  'spam4.me', 'getairmail.com', 'harakirimail.com', 'dropmail.me',
  'mail.tm', 'tempr.email', 'linshiyouxiang.net', 'mail-temp.com',
  'inboxbear.com', 'tempmailo.com',
])

export type EmailValidation =
  | { ok: true; email: string }
  | { ok: false; reason: 'format' | 'disposable' }

export interface EmailCapture {
  email: string
  firstTool?: string
  source?: string
  createdAt: string
}

export function isValidEmail(email: unknown): email is string {
  if (typeof email !== 'string') return false
  const e = email.trim()
  if (e.length < 5 || e.length > 254) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
}

/**
 * Full validation: format + legitimate-domain check.
 */
export function validateEmail(email: unknown): EmailValidation {
  if (!isValidEmail(email)) return { ok: false, reason: 'format' }
  const normalized = email.trim().toLowerCase()
  const domain = normalized.split('@')[1]
  if (!domain) return { ok: false, reason: 'format' }
  if (DISPOSABLE_DOMAINS.has(domain)) return { ok: false, reason: 'disposable' }
  return { ok: true, email: normalized }
}

/**
 * Capture an email. Returns true if newly captured, false if already present.
 * Safe against concurrent writers: INSERT IGNORE leans on the UNIQUE index.
 */
export async function captureEmail(
  email: string,
  opts: { firstTool?: string; source?: string } = {}
): Promise<boolean> {
  const db = await getDb()
  const normalized = email.trim().toLowerCase()
  const [result] = await db.execute(
    `INSERT IGNORE INTO email_captures (email, first_tool, source)
     VALUES (?, ?, ?)`,
    [normalized, opts.firstTool ?? null, opts.source ?? 'freeessayscorer']
  )
  // mysql2 returns an OkPacket with affectedRows; IGNORE = 0 means dup.
  const affected = (result as { affectedRows?: number }).affectedRows ?? 0
  return affected > 0
}

interface EmailRow extends RowDataPacket {
  email: string
  first_tool: string | null
  source: string | null
  created_at: Date
}

/**
 * Read captures, optionally filtered to an inclusive date range.
 * Returns newest-first; `createdAt` is ISO 8601 to match the old JSON shape.
 */
export async function readEmails(
  from?: Date | null,
  to?: Date | null
): Promise<EmailCapture[]> {
  const db = await getDb()
  const wheres: string[] = []
  const params: Array<string | Date> = []
  if (from) { wheres.push('created_at >= ?'); params.push(from) }
  if (to)   { wheres.push('created_at <= ?'); params.push(to) }
  const whereSql = wheres.length ? 'WHERE ' + wheres.join(' AND ') : ''
  const [rows] = await db.execute<EmailRow[]>(
    `SELECT email, first_tool, source, created_at
       FROM email_captures
       ${whereSql}
       ORDER BY created_at DESC`,
    params
  )
  return rows.map((r) => ({
    email: r.email,
    firstTool: r.first_tool ?? undefined,
    source: r.source ?? undefined,
    createdAt: r.created_at.toISOString(),
  }))
}

/**
 * Count captures in a date range (optionally keyed by source).
 */
export async function countEmails(
  from?: Date | null,
  to?: Date | null
): Promise<number> {
  const db = await getDb()
  const wheres: string[] = []
  const params: Date[] = []
  if (from) { wheres.push('created_at >= ?'); params.push(from) }
  if (to)   { wheres.push('created_at <= ?'); params.push(to) }
  const whereSql = wheres.length ? 'WHERE ' + wheres.join(' AND ') : ''
  const [rows] = await db.execute<(RowDataPacket & { c: number })[]>(
    `SELECT COUNT(*) AS c FROM email_captures ${whereSql}`,
    params
  )
  return Number(rows[0]?.c ?? 0)
}
