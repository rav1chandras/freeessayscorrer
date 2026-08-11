/**
 * Email capture — persists to MySQL via lib/db.ts, with a local JSONL
 * fallback so signup still works while hosted DB settings are being fixed.
 *
 * Rejects:
 *   - malformed addresses
 *   - domains in the DISPOSABLE_DOMAINS blocklist (throwaway inboxes)
 *
 * Dedupes on email (case-insensitive) via a UNIQUE index; concurrent writes
 * are safe because conflicts are caught at the DB layer, not in JS.
 */

import type { RowDataPacket } from 'mysql2'
import { promises as fs } from 'fs'
import path from 'path'
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

const FALLBACK_DIR = path.join(process.cwd(), '.data')
const FALLBACK_EMAILS_FILE = path.join(FALLBACK_DIR, 'email-captures.jsonl')

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

function isInRange(createdAt: string, from?: Date | null, to?: Date | null): boolean {
  const t = new Date(createdAt).getTime()
  if (!Number.isFinite(t)) return false
  if (from && t < from.getTime()) return false
  if (to && t > to.getTime()) return false
  return true
}

async function readFallbackEmails(
  from?: Date | null,
  to?: Date | null
): Promise<EmailCapture[]> {
  try {
    const raw = await fs.readFile(FALLBACK_EMAILS_FILE, 'utf8')
    const seen = new Set<string>()
    return raw
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line) as EmailCapture
        } catch {
          return null
        }
      })
      .filter((item): item is EmailCapture =>
        !!item &&
        typeof item.email === 'string' &&
        typeof item.createdAt === 'string' &&
        isInRange(item.createdAt, from, to)
      )
      .filter((item) => {
        if (seen.has(item.email)) return false
        seen.add(item.email)
        return true
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code !== 'ENOENT') {
      console.error('[email-capture] fallback read failed:', err)
    }
    return []
  }
}

async function captureFallbackEmail(
  email: string,
  opts: { firstTool?: string; source?: string } = {}
): Promise<boolean> {
  const normalized = email.trim().toLowerCase()
  const existing = await readFallbackEmails()
  if (existing.some((item) => item.email === normalized)) return false

  await fs.mkdir(FALLBACK_DIR, { recursive: true })
  await fs.appendFile(
    FALLBACK_EMAILS_FILE,
    JSON.stringify({
      email: normalized,
      firstTool: opts.firstTool,
      source: opts.source ?? 'freeessayscorer',
      createdAt: new Date().toISOString(),
    }) + '\n',
    'utf8'
  )
  return true
}

/**
 * Capture an email. Returns true if newly captured, false if already present.
 * Safe against concurrent writers: INSERT IGNORE leans on the UNIQUE index.
 */
export async function captureEmail(
  email: string,
  opts: { firstTool?: string; source?: string } = {}
): Promise<boolean> {
  const normalized = email.trim().toLowerCase()
  try {
    const db = await getDb()
    const [result] = await db.execute(
      `INSERT IGNORE INTO email_captures (email, first_tool, source)
       VALUES (?, ?, ?)`,
      [normalized, opts.firstTool ?? null, opts.source ?? 'freeessayscorer']
    )
    // mysql2 returns an OkPacket with affectedRows; IGNORE = 0 means dup.
    const affected = (result as { affectedRows?: number }).affectedRows ?? 0
    return affected > 0
  } catch (err) {
    console.error('[email-capture] DB capture failed, using fallback file:', err)
    return captureFallbackEmail(normalized, opts)
  }
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
  try {
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
    const dbEmails = rows.map((r) => ({
      email: r.email,
      firstTool: r.first_tool ?? undefined,
      source: r.source ?? undefined,
      createdAt: r.created_at.toISOString(),
    }))
    const fallbackEmails = await readFallbackEmails(from, to)
    const seen = new Set<string>()
    return [...dbEmails, ...fallbackEmails]
      .filter((item) => {
        if (seen.has(item.email)) return false
        seen.add(item.email)
        return true
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  } catch (err) {
    console.error('[email-capture] DB read failed, using fallback file:', err)
    return readFallbackEmails(from, to)
  }
}

/**
 * Count captures in a date range (optionally keyed by source).
 */
export async function countEmails(
  from?: Date | null,
  to?: Date | null
): Promise<number> {
  return (await readEmails(from, to)).length
}
