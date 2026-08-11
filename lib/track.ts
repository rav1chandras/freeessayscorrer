/**
 * Tiny client-side tracking helper. Fire-and-forget; never throws.
 */

export type ClientEventName =
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

interface TrackPayload {
  name: ClientEventName
  tool?: string
  quality?: 'great' | 'okay' | 'needs-work'
  source?: string
  meta?: Record<string, string | number | boolean>
}

export function track(payload: TrackPayload): void {
  if (typeof window === 'undefined') return
  try {
    const body = JSON.stringify(payload)
    // Use sendBeacon if available (survives page unload — great for cta_clicked on external links)
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' })
      navigator.sendBeacon('/api/public/track', blob)
      return
    }
    fetch('/api/public/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {})
  } catch {
    // silent
  }
}
