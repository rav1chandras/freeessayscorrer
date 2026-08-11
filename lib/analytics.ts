/**
 * Anonymous event tracking — persists to MySQL.
 *
 * The public surface stays identical to the old JSON-file version:
 *   logEvent(event)             → fire-and-forget write
 *   readEvents(from?, to?)      → newest-first rows, optional date range
 *   isValidEventName(name)      → type guard
 *
 * The admin dashboard reads through this; tight event-name validation
 * keeps the API route from getting spammed with arbitrary strings.
 */

import type { RowDataPacket } from 'mysql2'
import { getDb } from './db'

export type EventName =
  | 'landing_view'
  | 'score_view'
  | 'tool_started'
  | 'tool_completed'
  | 'tool_failed'
  | 'quota_exceeded'
  | 'email_captured'
  | 'email_dismissed'
  | 'share_clicked'
  | 'cta_admitly_clicked'
  | 'gated_tool_clicked'
  | 'paywall_viewed'
  | 'paywall_cta_clicked'
  | 'paywall_dismissed'
  | 'credits_modal_viewed'
  | 'credits_modal_submitted'
  | 'credits_modal_dismissed'

export interface TrackedEvent {
  name: EventName
  sessionId?: string
  tool?: string
  quality?: 'great' | 'okay' | 'needs-work'
  source?: string
  meta?: Record<string, string | number | boolean>
  createdAt: string
}

export async function logEvent(
  event: Omit<TrackedEvent, 'createdAt'>
): Promise<void> {
  try {
    const db = await getDb()
    await db.execute(
      `INSERT INTO analytics_events (name, session_id, tool, quality, source, meta)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        event.name,
        event.sessionId ?? null,
        event.tool ?? null,
        event.quality ?? null,
        event.source ?? null,
        event.meta ? JSON.stringify(event.meta) : null,
      ]
    )
  } catch (err) {
    // Never throw — analytics failures must not break real requests.
    console.error('[analytics] insert failed:', err)
  }
}

interface EventRow extends RowDataPacket {
  name: EventName
  session_id: string | null
  tool: string | null
  quality: 'great' | 'okay' | 'needs-work' | null
  source: string | null
  meta: string | Record<string, unknown> | null
  created_at: Date
}

/**
 * Read events, optionally filtered to an inclusive date range.
 * Returns newest-first; capped at 50k rows as a safety net.
 */
export async function readEvents(
  from?: Date | null,
  to?: Date | null
): Promise<TrackedEvent[]> {
  try {
    const db = await getDb()
    const wheres: string[] = []
    const params: Date[] = []
    if (from) { wheres.push('created_at >= ?'); params.push(from) }
    if (to)   { wheres.push('created_at <= ?'); params.push(to) }
    const whereSql = wheres.length ? 'WHERE ' + wheres.join(' AND ') : ''
    const [rows] = await db.execute<EventRow[]>(
      `SELECT name, session_id, tool, quality, source, meta, created_at
         FROM analytics_events
         ${whereSql}
         ORDER BY created_at DESC
         LIMIT 50000`,
      params
    )
    return rows.map((r) => {
      let meta: TrackedEvent['meta']
      if (r.meta) {
        // mysql2 may return JSON columns as parsed object OR as string depending on driver settings.
        if (typeof r.meta === 'string') {
          try { meta = JSON.parse(r.meta) as TrackedEvent['meta'] } catch { meta = undefined }
        } else {
          meta = r.meta as TrackedEvent['meta']
        }
      }
      return {
        name: r.name,
        sessionId: r.session_id ?? undefined,
        tool: r.tool ?? undefined,
        quality: r.quality ?? undefined,
        source: r.source ?? undefined,
        meta,
        createdAt: r.created_at.toISOString(),
      }
    })
  } catch (err) {
    console.error('[analytics] read failed:', err)
    return []
  }
}

export const VALID_EVENT_NAMES: EventName[] = [
  'landing_view', 'score_view', 'tool_started', 'tool_completed', 'tool_failed',
  'quota_exceeded', 'email_captured', 'email_dismissed', 'share_clicked',
  'cta_admitly_clicked', 'gated_tool_clicked',
  'paywall_viewed', 'paywall_cta_clicked', 'paywall_dismissed',
  'credits_modal_viewed', 'credits_modal_submitted', 'credits_modal_dismissed',
]

export function isValidEventName(v: unknown): v is EventName {
  return typeof v === 'string' && (VALID_EVENT_NAMES as string[]).includes(v)
}
