'use client'

import { useCallback, useEffect, useState } from 'react'

interface EmailCapture {
  email: string
  firstTool?: string
  source?: string
  createdAt: string
}

interface TrackedEvent {
  name: string
  sessionId?: string
  tool?: string
  quality?: string
  source?: string
  meta?: Record<string, string | number | boolean>
  createdAt: string
}

interface AdminData {
  range: { from: string | null; to: string | null }
  emails: EmailCapture[]
  emailCount: number
  events: TrackedEvent[]
  totalEvents: number
  eventCounts: Record<string, number>
  toolCounts: Record<string, number>
  qualityCounts: Record<string, number>
  ctaSourceCounts: Record<string, number>
  emailSourceCounts: Record<string, number>
  funnel: {
    landingViews: number
    scoreViews: number
    entryViews: number
    toolsStarted: number
    toolsCompleted: number
    paywallViewed: number
    paywallSubmitted: number
    creditsModalViewed: number
    creditsModalSubmitted: number
    pmpClicks: number
    admitlyClicks: number
    ctaClicksTotal: number
    emailCaptures: number
  }
}

function isoDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export default function AdminPage() {
  const [data, setData] = useState<AdminData | null>(null)
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [tab, setTab] = useState<'overview' | 'emails' | 'events'>('overview')
  // Date range filter — default: last 30 days through today
  const today = new Date()
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
  const [from, setFrom] = useState(isoDateOnly(thirtyDaysAgo))
  const [to, setTo] = useState(isoDateOnly(today))

  const load = useCallback(async () => {
    try {
      const qs = new URLSearchParams()
      if (from) qs.set('from', from)
      if (to) qs.set('to', to)
      const res = await fetch(`/api/admin/data?${qs.toString()}`)
      if (res.status === 401) { setAuthed(false); return }
      const d = await res.json()
      setData(d); setAuthed(true)
    } catch { setAuthed(false) }
  }, [from, to])

  useEffect(() => { load() }, [load])

  async function login() {
    setErr(null); setSubmitting(true)
    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const d = await res.json()
      if (!res.ok) { setErr(d.error ?? 'Sign-in failed'); return }
      setAuthed(true); setPassword(''); load()
    } catch {
      setErr('Network error')
    } finally {
      setSubmitting(false)
    }
  }

  async function logout() {
    await fetch('/api/admin/auth', { method: 'DELETE' })
    setAuthed(false); setData(null); setPassword('')
  }

  function downloadEmails() {
    if (!data) return
    const csv = 'email,firstTool,source,createdAt\n' +
      data.emails.map((e) =>
        [e.email, e.firstTool ?? '', e.source ?? '', e.createdAt].map((v) => `"${v}"`).join(',')
      ).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `email-captures-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function setRangePreset(days: number) {
    const end = new Date()
    const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000)
    setFrom(isoDateOnly(start)); setTo(isoDateOnly(end))
  }

  // ── Loading ─────────────────────────────────────────────────────────────
  if (authed === null) {
    return (
      <div className="min-h-screen bg-admitly-cream flex items-center justify-center">
        <div className="h-10 w-10 rounded-full border-4 border-admitly-black/10 border-t-admitly-black animate-spin" />
      </div>
    )
  }

  // ── Login ──────────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <div className="min-h-screen bg-admitly-cream flex items-center justify-center p-6">
        <div className="max-w-sm w-full rounded-[2rem] bg-white p-8 shadow-lg">
          <div className="flex items-center gap-2 mb-6">
            <div className="h-8 w-8 rounded-full bg-admitly-black flex items-center justify-center">
              <span className="text-admitly-yellow font-black text-sm">F</span>
            </div>
            <span className="font-bold text-admitly-black">Admin</span>
          </div>
          <h1 className="text-2xl font-black text-admitly-black mb-1">Sign in</h1>
          <p className="text-sm text-admitly-black/60 mb-6">Enter the admin password to view captures.</p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && login()}
            placeholder="Password"
            className="w-full rounded-full border-2 border-black/10 px-5 py-3 text-sm font-semibold focus:outline-none focus:border-admitly-black mb-3"
            autoFocus
          />
          {err && <p className="text-sm text-admitly-coral mb-3">{err}</p>}
          <button
            onClick={login}
            disabled={!password || submitting}
            className="btn-primary w-full justify-center !py-3.5 !text-base"
          >
            {submitting ? 'Signing in…' : 'Sign in'} <span aria-hidden>→</span>
          </button>
        </div>
      </div>
    )
  }

  if (!data) return null

  const { funnel } = data
  const pct = (n: number, d: number) => (d > 0 ? ((n / d) * 100).toFixed(1) : '0.0')
  const entryViews = funnel.entryViews || funnel.landingViews || funnel.scoreViews
  const funnelHealth = [
    entryViews === 0 ? 'No page view events in this date range.' : null,
    entryViews > 0 && funnel.toolsStarted === 0 ? 'Visitors are reaching the page, but no free tool starts are recorded.' : null,
    funnel.toolsStarted > 0 && funnel.toolsCompleted === 0 ? 'Tool starts are recorded, but completions are not showing yet.' : null,
    funnel.paywallViewed > 0 && funnel.paywallSubmitted === 0 ? 'Premium tool paywalls are viewed, but no paywall email submits are recorded.' : null,
    funnel.emailCaptures > 0 && Object.keys(data.emailSourceCounts).length === 1 && data.emailSourceCounts.unknown ? 'Captured emails are missing source tags.' : null,
  ].filter(Boolean) as string[]

  // ── Dashboard ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-admitly-cream">
      <nav className="bg-white border-b border-black/5 px-6 lg:px-12 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-admitly-black flex items-center justify-center">
            <span className="text-admitly-yellow font-black text-sm">F</span>
          </div>
          <span className="font-bold text-admitly-black">Admin</span>
        </div>
        <button onClick={logout} className="text-sm font-semibold text-admitly-black/50 hover:text-admitly-black">
          Sign out
        </button>
      </nav>

      <div className="max-w-6xl mx-auto px-6 lg:px-12 py-8 lg:py-12 space-y-6">

        {/* ── Date range filter ─────────────────────────────────────────── */}
        <div className="rounded-[1.5rem] bg-white p-4 lg:p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-admitly-black/50">Range</span>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-lg border border-admitly-black/15 px-3 py-1.5 text-sm font-semibold focus:outline-none focus:border-admitly-black"
            />
            <span className="text-xs text-admitly-black/40">→</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-lg border border-admitly-black/15 px-3 py-1.5 text-sm font-semibold focus:outline-none focus:border-admitly-black"
            />
          </div>
          <div className="flex items-center gap-1.5">
            {[
              { label: '7d', days: 7 },
              { label: '30d', days: 30 },
              { label: '90d', days: 90 },
            ].map((p) => (
              <button
                key={p.label}
                onClick={() => setRangePreset(p.days)}
                className="text-xs font-bold text-admitly-black/60 hover:text-admitly-black hover:bg-admitly-black/5 rounded-full px-2.5 py-1 transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="text-xs text-admitly-black/40 sm:ml-auto">
            Showing {data.totalEvents} events · {data.emailCount} emails
          </div>
        </div>

        {/* Tab pills */}
        <div className="flex flex-wrap gap-2">
          {(['overview', 'emails', 'events'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={[
                'px-4 py-2 rounded-full text-sm font-bold capitalize transition-colors',
                tab === t ? 'bg-admitly-black text-white' : 'bg-white text-admitly-black/60 hover:text-admitly-black border border-black/5',
              ].join(' ')}
            >
              {t}
              {t === 'emails' && <span className="ml-2 text-xs opacity-60">({data.emailCount})</span>}
              {t === 'events' && <span className="ml-2 text-xs opacity-60">({data.totalEvents})</span>}
            </button>
          ))}
        </div>

        {/* ── Overview tab ─────────────────────────────────────────────── */}
        {tab === 'overview' && (
          <div className="space-y-6">
            {/* Headline cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Emails captured', value: funnel.emailCaptures, accent: 'bg-admitly-yellow' },
                { label: 'Entry views', value: entryViews, accent: 'bg-admitly-mint' },
                { label: 'Tools completed', value: funnel.toolsCompleted, accent: 'bg-white' },
                { label: 'Admitly clicks', value: funnel.admitlyClicks, accent: 'bg-white' },
              ].map((m) => (
                <div key={m.label} className={['rounded-[1.5rem] p-5', m.accent].join(' ')}>
                  <p className="text-xs font-bold uppercase tracking-wider text-admitly-black/60 mb-2">{m.label}</p>
                  <p className="text-4xl font-black tabular-nums text-admitly-black">{m.value}</p>
                </div>
              ))}
            </div>

            {/* Funnel */}
            <div className="rounded-[2rem] bg-white p-6 lg:p-8">
              <h2 className="text-xl font-black text-admitly-black mb-1">Conversion funnel</h2>
              <p className="text-sm text-admitly-black/60 mb-6">How traffic flows from the free scorer into Admitly.</p>
              <div className="space-y-3">
                {[
                  { label: 'Entry views', value: entryViews, pct: entryViews > 0 ? '100' : '0', color: 'bg-admitly-black' },
                  { label: 'Landing events', value: funnel.landingViews, pct: pct(funnel.landingViews, entryViews), color: 'bg-admitly-black/80' },
                  { label: 'Score page views', value: funnel.scoreViews, pct: pct(funnel.scoreViews, entryViews), color: 'bg-admitly-black/80' },
                  { label: 'Tools started', value: funnel.toolsStarted, pct: pct(funnel.toolsStarted, entryViews), color: 'bg-admitly-black/70' },
                  { label: 'Tools completed', value: funnel.toolsCompleted, pct: pct(funnel.toolsCompleted, entryViews), color: 'bg-admitly-black/60' },
                  { label: 'Paywall viewed', value: funnel.paywallViewed, pct: pct(funnel.paywallViewed, entryViews), color: 'bg-fes-blue/60' },
                  { label: '  → email submitted', value: funnel.paywallSubmitted, pct: pct(funnel.paywallSubmitted, funnel.paywallViewed), color: 'bg-fes-blue', baseline: funnel.paywallViewed },
                  { label: 'Credits modal viewed', value: funnel.creditsModalViewed, pct: pct(funnel.creditsModalViewed, entryViews), color: 'bg-fes-blue/60' },
                  { label: '  → email submitted', value: funnel.creditsModalSubmitted, pct: pct(funnel.creditsModalSubmitted, funnel.creditsModalViewed), color: 'bg-fes-blue', baseline: funnel.creditsModalViewed },
                  { label: 'Admitly CTA clicks', value: funnel.admitlyClicks, pct: pct(funnel.admitlyClicks, entryViews), color: 'bg-admitly-yellow' },
                  { label: 'PowerMyPrompt clicks', value: funnel.pmpClicks, pct: pct(funnel.pmpClicks, entryViews), color: 'bg-admitly-coral' },
                  { label: 'Emails captured (total)', value: funnel.emailCaptures, pct: pct(funnel.emailCaptures, entryViews), color: 'bg-admitly-green' },
                ].map((row) => (
                  <div key={row.label} className="flex items-center gap-4">
                    <div className="w-44 sm:w-60 text-xs sm:text-sm font-semibold text-admitly-black shrink-0 whitespace-pre">{row.label}</div>
                    <div className="flex-1 bg-admitly-black/5 rounded-full h-7 relative overflow-hidden">
                      <div
                        className={['absolute inset-y-0 left-0 rounded-full flex items-center justify-end pr-3 transition-all', row.color].join(' ')}
                        style={{ width: `${Math.max(2, parseFloat(row.pct))}%` }}
                      >
                        <span className="text-xs font-bold text-white tabular-nums mix-blend-difference">{row.value}</span>
                      </div>
                    </div>
                    <div className="text-xs font-bold tabular-nums w-14 text-right text-admitly-black/60">
                      {row.pct}%
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-admitly-black/40 mt-5">
                Entry views use landing events when present, otherwise score page views. Indented rows use the preceding row as their percentage baseline.
              </p>
            </div>

            <div className="grid md:grid-cols-4 gap-4">
              {[
                { label: 'Start rate', value: `${pct(funnel.toolsStarted, entryViews)}%`, sub: 'tool starts / entry views' },
                { label: 'Completion rate', value: `${pct(funnel.toolsCompleted, funnel.toolsStarted)}%`, sub: 'completed / started' },
                { label: 'Email rate', value: `${pct(funnel.emailCaptures, entryViews)}%`, sub: 'emails / entry views' },
                { label: 'Admitly CTR', value: `${pct(funnel.admitlyClicks, entryViews)}%`, sub: 'Admitly clicks / entry views' },
              ].map((m) => (
                <div key={m.label} className="rounded-[1.5rem] bg-white p-5">
                  <p className="text-xs font-bold uppercase tracking-wider text-admitly-black/50 mb-2">{m.label}</p>
                  <p className="text-3xl font-black tabular-nums text-admitly-black">{m.value}</p>
                  <p className="text-xs font-semibold text-admitly-black/45 mt-1">{m.sub}</p>
                </div>
              ))}
            </div>

            <div className={['rounded-[1.5rem] p-5 border', funnelHealth.length ? 'bg-admitly-yellow/30 border-admitly-yellow' : 'bg-admitly-mint border-admitly-green/20'].join(' ')}>
              <h3 className="font-black text-admitly-black mb-2">Funnel check</h3>
              {funnelHealth.length ? (
                <ul className="space-y-1.5">
                  {funnelHealth.map((item) => (
                    <li key={item} className="text-sm font-semibold text-admitly-black/70">{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm font-semibold text-admitly-black/70">Core funnel events and source tags are flowing for this date range.</p>
              )}
            </div>

            {/* Source breakdowns */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="rounded-[2rem] bg-white p-6">
                <h3 className="font-bold text-admitly-black mb-1">CTA click sources</h3>
                <p className="text-xs text-admitly-black/50 mb-4">Where outbound clicks to Admitly / PowerMyPrompt originated.</p>
                <BreakdownList counts={data.ctaSourceCounts} />
              </div>
              <div className="rounded-[2rem] bg-white p-6">
                <h3 className="font-bold text-admitly-black mb-1">Email capture sources</h3>
                <p className="text-xs text-admitly-black/50 mb-4">Which surface the email came from.</p>
                <BreakdownList counts={data.emailSourceCounts} />
              </div>
            </div>

            {/* Tool + quality breakdowns */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="rounded-[2rem] bg-white p-6">
                <h3 className="font-bold text-admitly-black mb-4">Tool usage</h3>
                <BreakdownList counts={data.toolCounts} />
              </div>
              <div className="rounded-[2rem] bg-white p-6">
                <h3 className="font-bold text-admitly-black mb-4">Result quality</h3>
                <BreakdownList counts={data.qualityCounts} />
              </div>
            </div>
          </div>
        )}

        {/* ── Emails tab ───────────────────────────────────────────────── */}
        {tab === 'emails' && (
          <div className="rounded-[2rem] bg-white overflow-hidden">
            <div className="p-6 flex items-center justify-between border-b border-black/5 flex-wrap gap-3">
              <div>
                <h2 className="text-xl font-black text-admitly-black">Captured emails</h2>
                <p className="text-sm text-admitly-black/60">{data.emailCount} in range</p>
              </div>
              <button onClick={downloadEmails} className="btn-outline !text-sm">Export CSV ↓</button>
            </div>
            {data.emails.length === 0 ? (
              <div className="p-10 text-center text-admitly-black/50">No emails captured in this range.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-admitly-cream">
                    <tr className="text-left">
                      <th className="px-6 py-3 font-bold text-admitly-black/70 text-xs uppercase tracking-wider">Email</th>
                      <th className="px-6 py-3 font-bold text-admitly-black/70 text-xs uppercase tracking-wider">Source</th>
                      <th className="px-6 py-3 font-bold text-admitly-black/70 text-xs uppercase tracking-wider">First tool</th>
                      <th className="px-6 py-3 font-bold text-admitly-black/70 text-xs uppercase tracking-wider">Captured</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.emails.map((e, i) => (
                      <tr key={i} className="border-t border-black/5 hover:bg-admitly-cream/50">
                        <td className="px-6 py-3 font-mono text-admitly-black">{e.email}</td>
                        <td className="px-6 py-3 text-admitly-black/70 text-xs">{e.source ?? '—'}</td>
                        <td className="px-6 py-3 text-admitly-black/70">{e.firstTool ?? '—'}</td>
                        <td className="px-6 py-3 text-admitly-black/60 text-xs">{new Date(e.createdAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Events tab ───────────────────────────────────────────────── */}
        {tab === 'events' && (
          <div className="rounded-[2rem] bg-white overflow-hidden">
            <div className="p-6 border-b border-black/5">
              <h2 className="text-xl font-black text-admitly-black">Recent events</h2>
              <p className="text-sm text-admitly-black/60">Last 100 of {data.totalEvents} in range</p>
            </div>
            {data.events.length === 0 ? (
              <div className="p-10 text-center text-admitly-black/50">No events in this range.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-admitly-cream">
                    <tr className="text-left">
                      <th className="px-6 py-3 font-bold text-admitly-black/70 text-xs uppercase tracking-wider">Event</th>
                      <th className="px-6 py-3 font-bold text-admitly-black/70 text-xs uppercase tracking-wider">Tool</th>
                      <th className="px-6 py-3 font-bold text-admitly-black/70 text-xs uppercase tracking-wider">Quality</th>
                      <th className="px-6 py-3 font-bold text-admitly-black/70 text-xs uppercase tracking-wider">Source</th>
                      <th className="px-6 py-3 font-bold text-admitly-black/70 text-xs uppercase tracking-wider">When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.events.map((e, i) => (
                      <tr key={i} className="border-t border-black/5 hover:bg-admitly-cream/50">
                        <td className="px-6 py-3 font-mono text-xs font-bold text-admitly-black">{e.name}</td>
                        <td className="px-6 py-3 text-admitly-black/70">{e.tool ?? '—'}</td>
                        <td className="px-6 py-3 text-admitly-black/70">{e.quality ?? '—'}</td>
                        <td className="px-6 py-3 text-admitly-black/60 text-xs">{e.source ?? '—'}</td>
                        <td className="px-6 py-3 text-admitly-black/60 text-xs">{new Date(e.createdAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function BreakdownList({ counts }: { counts: Record<string, number> }) {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1])
  const total = entries.reduce((s, [, v]) => s + v, 0)
  if (entries.length === 0) {
    return <p className="text-sm text-admitly-black/40">No data yet.</p>
  }
  return (
    <div className="space-y-2">
      {entries.map(([k, v]) => {
        const pct = total > 0 ? ((v / total) * 100).toFixed(1) : '0.0'
        return (
          <div key={k} className="flex items-center gap-3">
            <div className="w-32 text-xs font-semibold text-admitly-black shrink-0 truncate">{k}</div>
            <div className="flex-1 bg-admitly-black/5 rounded-full h-6 relative">
              <div
                className="absolute inset-y-0 left-0 bg-admitly-black/80 rounded-full transition-all"
                style={{ width: `${Math.max(3, parseFloat(pct))}%` }}
              />
            </div>
            <div className="text-sm font-bold tabular-nums w-16 text-right text-admitly-black/70">
              {v} <span className="text-xs text-admitly-black/40">({pct}%)</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
