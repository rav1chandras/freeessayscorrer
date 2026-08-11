import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

const SIZE = { width: 1200, height: 630 }

function clampScore(raw: string | null): number {
  if (!raw) return 72
  const n = parseInt(raw, 10)
  if (isNaN(n)) return 72
  return Math.min(100, Math.max(0, n))
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + '…'
}

type CardKind = 'hook' | 'cliche' | 'aicheck'

function isKind(v: string | null): v is CardKind {
  return v === 'hook' || v === 'cliche' || v === 'aicheck'
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)

  const rawKind = searchParams.get('kind')
  const kind: CardKind = isKind(rawKind) ? rawKind : 'hook'
  const score = clampScore(searchParams.get('score'))
  const label = truncate(searchParams.get('label') ?? defaultLabel(kind, score), 40)

  // Color & copy varies by kind
  const { accent, toolLabel, unit } = kindStyles(kind, score)

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          backgroundColor: '#FFD43B', padding: '80px', fontFamily: 'Inter',
          position: 'relative',
        }}
      >
        {/* Top: brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '9999px',
            backgroundColor: '#0A0A0A', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            color: '#FFD43B', fontSize: '28px', fontWeight: 900,
          }}>F</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#0A0A0A' }}>
            freeessayscorer<span style={{ opacity: 0.4 }}>.com</span>
          </div>
        </div>

        {/* Middle: big score */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#0A0A0A', opacity: 0.6, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            {toolLabel}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '20px' }}>
            <div style={{
              fontSize: '280px', fontWeight: 900, color: accent,
              lineHeight: 1, letterSpacing: '-0.05em', fontVariantNumeric: 'tabular-nums',
            }}>
              {score}
            </div>
            <div style={{ fontSize: '56px', fontWeight: 700, color: '#0A0A0A', opacity: 0.5 }}>
              {unit}
            </div>
          </div>
          <div style={{ fontSize: '40px', fontWeight: 800, color: '#0A0A0A', marginTop: '8px', lineHeight: 1.1 }}>
            {label}
          </div>
        </div>

        {/* Bottom: CTA strip */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          paddingTop: '32px', borderTop: '3px solid #0A0A0A',
        }}>
          <div style={{ fontSize: '24px', fontWeight: 600, color: '#0A0A0A', opacity: 0.7 }}>
            Score your essay in 30 seconds
          </div>
          <div style={{
            backgroundColor: '#0A0A0A', color: '#FFD43B',
            padding: '14px 28px', borderRadius: '9999px',
            fontSize: '22px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            Try it free →
          </div>
        </div>
      </div>
    ),
    { ...SIZE }
  )
}

function defaultLabel(kind: CardKind, score: number): string {
  if (kind === 'hook') {
    if (score >= 80) return 'Strong hook'
    if (score >= 60) return 'Moderate hook'
    return 'Needs a stronger hook'
  }
  if (kind === 'cliche') {
    if (score === 0) return 'No clichés detected!'
    if (score <= 3) return `${score} clichés found`
    return `${score} clichés to fix`
  }
  // aicheck
  if (score >= 80) return 'Reads authentically human'
  if (score >= 60) return 'Mostly human voice'
  if (score >= 40) return 'Mixed AI signals'
  return 'Reads AI-generated'
}

function kindStyles(kind: CardKind, score: number): { accent: string; toolLabel: string; unit: string } {
  if (kind === 'hook') {
    return {
      accent: '#0A0A0A',
      toolLabel: '🪝 Hook Analyzer',
      unit: '/ 100',
    }
  }
  if (kind === 'cliche') {
    return {
      accent: score === 0 ? '#0FA968' : score <= 3 ? '#0A0A0A' : '#FF6B5E',
      toolLabel: '🚩 Cliché Detector',
      unit: score === 1 ? 'issue' : 'issues',
    }
  }
  // aicheck
  return {
    accent: score >= 75 ? '#0FA968' : score >= 50 ? '#0A0A0A' : '#FF6B5E',
    toolLabel: '🤖 AI Check',
    unit: '/ 100 human',
  }
}
