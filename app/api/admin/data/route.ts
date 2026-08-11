import { NextRequest, NextResponse } from 'next/server'
import { isAdminAuthed } from '@/lib/admin-auth'
import { readEvents } from '@/lib/analytics'
import { readEmails } from '@/lib/email-capture'

function parseDate(v: string | null): Date | null {
  if (!v) return null
  const d = new Date(v)
  return isNaN(d.getTime()) ? null : d
}

export async function GET(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parse optional ?from=YYYY-MM-DD&to=YYYY-MM-DD
  const url = new URL(req.url)
  const from = parseDate(url.searchParams.get('from'))
  const toBase = parseDate(url.searchParams.get('to'))
  // "to" is inclusive — bump it to the end of the day
  const to = toBase ? new Date(toBase.getTime() + 24 * 60 * 60 * 1000 - 1) : null

  // MySQL pushes the date filter down; no in-memory filtering needed.
  const [emails, events] = await Promise.all([
    readEmails(from, to),
    readEvents(from, to),
  ])

  // Aggregate stats
  const eventCounts: Record<string, number> = {}
  const toolCounts: Record<string, number> = {}
  const qualityCounts: Record<string, number> = {}
  const ctaSourceCounts: Record<string, number> = {}
  const emailSourceCounts: Record<string, number> = {}
  for (const e of events) {
    eventCounts[e.name] = (eventCounts[e.name] ?? 0) + 1
    if (e.tool) toolCounts[e.tool] = (toolCounts[e.tool] ?? 0) + 1
    if (e.quality) qualityCounts[e.quality] = (qualityCounts[e.quality] ?? 0) + 1
    if (e.name === 'cta_admitly_clicked' && e.source) {
      ctaSourceCounts[e.source] = (ctaSourceCounts[e.source] ?? 0) + 1
    }
  }
  for (const em of emails) {
    const src = em.source ?? 'unknown'
    emailSourceCounts[src] = (emailSourceCounts[src] ?? 0) + 1
  }

  // Split CTA clicks: PowerMyPrompt vs Admitly (everything else)
  const pmpClicks = ctaSourceCounts['sidebar_pmp'] ?? 0
  const ctaClicksTotal = eventCounts['cta_admitly_clicked'] ?? 0
  const admitlyClicks = ctaClicksTotal - pmpClicks

  // Funnel
  const landingViews = eventCounts['landing_view'] ?? 0
  const scoreViews = eventCounts['score_view'] ?? 0
  const entryViews = landingViews > 0 ? landingViews : scoreViews
  const toolsStarted = eventCounts['tool_started'] ?? 0
  const toolsCompleted = eventCounts['tool_completed'] ?? 0
  const paywallViewed = eventCounts['paywall_viewed'] ?? 0
  const paywallSubmitted = eventCounts['paywall_cta_clicked'] ?? 0
  const creditsModalViewed = eventCounts['credits_modal_viewed'] ?? 0
  const creditsModalSubmitted = eventCounts['credits_modal_submitted'] ?? 0
  const emailCaptures = emails.length

  return NextResponse.json({
    range: {
      from: from ? from.toISOString() : null,
      to: toBase ? toBase.toISOString() : null,
    },
    emails,
    emailCount: emails.length,
    events: events.slice(0, 100), // already newest-first from SQL
    totalEvents: events.length,
    eventCounts,
    toolCounts,
    qualityCounts,
    ctaSourceCounts,
    emailSourceCounts,
    funnel: {
      landingViews,
      scoreViews,
      entryViews,
      toolsStarted,
      toolsCompleted,
      paywallViewed,
      paywallSubmitted,
      creditsModalViewed,
      creditsModalSubmitted,
      pmpClicks,
      admitlyClicks,
      ctaClicksTotal,
      emailCaptures,
    },
  })
}
