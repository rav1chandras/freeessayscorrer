import { NextRequest, NextResponse } from 'next/server'
import {
  consumeAnon,
  refundAnon,
  getOrCreateAnonSessionId,
  COOKIE_NAME,
  COOKIE_MAX_AGE,
  DAILY_LIMIT,
} from '@/lib/anon-quota'

import {
  sanitizeEssayText as hookSanitize,
  buildHookAnalysisPrompt,
  parseHookResponse,
} from '@/lib/hook-analyzer-helpers'

import {
  sanitizeEssayText as clicheSanitize,
  buildClicheDetectionPrompt,
  parseClicheResponse,
} from '@/lib/cliche-detector-helpers'

import {
  sanitizeEssayText as aiSanitize,
  buildAiCheckPrompt,
  parseAiCheckResponse,
} from '@/lib/ai-check-helpers'

const MIN_WORDS = 50
const MAX_WORDS = 1500
const META_MODEL = 'muse-spark-1.2-contributor'

type PublicTool = 'hook' | 'cliche' | 'aicheck' | 'fullscore'
const PUBLIC_TOOLS: PublicTool[] = ['hook', 'cliche', 'aicheck', 'fullscore']

type FullScoreResult = {
  overall_score: number
  readiness_label: string
  summary: string
  strengths: string[]
  priorities: string[]
  rubric: Array<{ category: string; score: number; note: string }>
}

function isPublicTool(v: unknown): v is PublicTool {
  return typeof v === 'string' && (PUBLIC_TOOLS as string[]).includes(v)
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function extractMetaDelta(event: unknown): string {
  if (!event || typeof event !== 'object') return ''
  const obj = event as Record<string, unknown>
  if (typeof obj.delta === 'string') return obj.delta
  if (typeof obj.text === 'string' && typeof obj.type === 'string' && obj.type.includes('delta')) {
    return obj.text
  }
  if (obj.delta && typeof obj.delta === 'object') {
    const delta = obj.delta as Record<string, unknown>
    if (typeof delta.text === 'string') return delta.text
    if (typeof delta.content === 'string') return delta.content
  }
  return ''
}

function extractMetaText(value: unknown): string {
  if (!value || typeof value !== 'object') return ''
  const obj = value as Record<string, unknown>

  if (typeof obj.output_text === 'string') return obj.output_text
  if (typeof obj.text === 'string') return obj.text
  if (typeof obj.content === 'string') return obj.content

  if (Array.isArray(obj.output)) {
    return obj.output.map(extractMetaText).filter(Boolean).join('')
  }
  if (Array.isArray(obj.content)) {
    return obj.content.map(extractMetaText).filter(Boolean).join('')
  }
  if (obj.message) return extractMetaText(obj.message)
  if (obj.response) return extractMetaText(obj.response)

  return ''
}

function parseMetaSse(rawStream: string): string {
  const blocks = rawStream.split(/\r?\n\r?\n/)
  const deltas: string[] = []
  let finalText = ''

  for (const block of blocks) {
    const data = block
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart())
      .join('\n')
      .trim()

    if (!data || data === '[DONE]') continue

    try {
      const event = JSON.parse(data)
      const delta = extractMetaDelta(event)
      if (delta) {
        deltas.push(delta)
      } else if (deltas.length === 0) {
        const text = extractMetaText(event)
        if (text) finalText = text
      }
    } catch {
      // Ignore malformed keepalive/event chunks and continue reading.
    }
  }

  return deltas.join('') || finalText
}

async function readMetaResponseText(resp: Response): Promise<string> {
  const bodyText = await resp.text()
  const contentType = resp.headers.get('content-type') ?? ''

  if (contentType.includes('text/event-stream')) {
    return parseMetaSse(bodyText)
  }

  try {
    return extractMetaText(JSON.parse(bodyText))
  } catch {
    return bodyText
  }
}

export async function POST(req: NextRequest) {
  // ── Parse body ────────────────────────────────────────────────────────────
  let body: { tool?: string; essay?: string; essayType?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!isPublicTool(body.tool)) {
    return NextResponse.json(
      { error: 'Unknown or gated tool. Sign up at app.admitly.com to access all tools.', gated: true },
      { status: 400 }
    )
  }

  const tool = body.tool
  const rawEssay = body.essay ?? ''
  const essayType =
    typeof body.essayType === 'string' ? body.essayType.trim() : 'Personal Statement'

  // ── Validate BEFORE consuming quota ───────────────────────────────────────
  let essay: string
  switch (tool) {
    case 'hook':    essay = hookSanitize(rawEssay); break
    case 'cliche':  essay = clicheSanitize(rawEssay); break
    case 'aicheck': essay = aiSanitize(rawEssay); break
    case 'fullscore': essay = aiSanitize(rawEssay); break
  }

  const wc = wordCount(essay)
  if (wc < MIN_WORDS) {
    return NextResponse.json(
      { error: `Essay too short — minimum ${MIN_WORDS} words (got ${wc})` },
      { status: 422 }
    )
  }
  if (wc > MAX_WORDS) {
    return NextResponse.json(
      { error: `Essay too long — maximum ${MAX_WORDS} words (got ${wc})` },
      { status: 422 }
    )
  }

  // ── Anonymous quota ───────────────────────────────────────────────────────
  const { sessionId, isNew } = await getOrCreateAnonSessionId()
  const quota = consumeAnon(sessionId)

  if (!quota) {
    const res = NextResponse.json(
      {
        error:
          `You've used your ${DAILY_LIMIT} free analyses for today. Sign up at app.admitly.com for unlimited access, or come back tomorrow.`,
        quota_exceeded: true,
      },
      { status: 429 }
    )
    if (isNew) {
      res.cookies.set(COOKIE_NAME, sessionId, {
        httpOnly: true, sameSite: 'lax', secure: isProd, path: '/',
        maxAge: COOKIE_MAX_AGE,
      })
    }
    return res
  }

  // ── Build prompt ──────────────────────────────────────────────────────────
  let prompt: string
  switch (tool) {
    case 'hook':    prompt = buildHookAnalysisPrompt(essay, essayType); break
    case 'cliche':  prompt = buildClicheDetectionPrompt(essay, essayType); break
    case 'aicheck': prompt = buildAiCheckPrompt(essay, essayType); break
    case 'fullscore': prompt = buildFullScorePrompt(essay, essayType); break
  }

  // ── Call Meta Model API ───────────────────────────────────────────────────
  let raw: string
  try {
    const apiKey = process.env.MODEL_API_KEY
    if (!apiKey) throw new Error('MODEL_API_KEY not configured')

    const modelResp = await fetch('https://api.meta.ai/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: META_MODEL,
        input: [
          {
            role: 'user',
            content: [{ type: 'input_text', text: prompt }],
          },
        ],
        stream: true,
        temperature: 1,
        max_output_tokens: 32000,
        top_p: 1,
        reasoning: { effort: 'medium' },
      }),
    })

    if (!modelResp.ok) {
      const errText = await modelResp.text()
      throw new Error(`Meta Model API error ${modelResp.status}: ${errText}`)
    }

    raw = await readMetaResponseText(modelResp)
  } catch (err) {
    refundAnon(sessionId)
    console.error('[public/score] Meta Model API call failed:', err)
    const res = NextResponse.json({ error: 'AI service error. Please try again.' }, { status: 502 })
    if (isNew) res.cookies.set(COOKIE_NAME, sessionId, { httpOnly: true, sameSite: 'lax', secure: isProd, path: '/', maxAge: COOKIE_MAX_AGE })
    return res
  }

  // ── Parse ─────────────────────────────────────────────────────────────────
  // We reset = now + resetMs (as an absolute ms timestamp for the client)
  const resetAt = Date.now() + quota.resetMs

  let result: unknown
  switch (tool) {
    case 'hook':    result = parseHookResponse(raw, quota.remaining, resetAt); break
    case 'cliche':  result = parseClicheResponse(raw, quota.remaining, resetAt); break
    case 'aicheck': result = parseAiCheckResponse(raw, quota.remaining, resetAt); break
    case 'fullscore': result = parseFullScoreResponse(raw); break
  }

  if (!result) {
    refundAnon(sessionId)
    console.error('[public/score] Parse failure. Raw:', raw?.slice(0, 200))
    const res = NextResponse.json({ error: 'Failed to parse AI response. Please retry.' }, { status: 502 })
    if (isNew) res.cookies.set(COOKIE_NAME, sessionId, { httpOnly: true, sameSite: 'lax', secure: isProd, path: '/', maxAge: COOKIE_MAX_AGE })
    return res
  }

  // Wrap with tool metadata for the client
  const response = NextResponse.json({
    tool,
    result,
    quota: { remaining: quota.remaining, limit: DAILY_LIMIT, resetAt },
  })

  if (isNew) {
    response.cookies.set(COOKIE_NAME, sessionId, {
      httpOnly: true, sameSite: 'lax', secure: isProd, path: '/',
      maxAge: COOKIE_MAX_AGE,
    })
  }

  return response
}

// ── GET quota peek (for the UI to know remaining without consuming) ──────────
import { peekAnon } from '@/lib/anon-quota'

const isProd = process.env.NODE_ENV === 'production'

export async function GET() {
  const { sessionId, isNew } = await getOrCreateAnonSessionId()
  const peek = peekAnon(sessionId)
  const res = NextResponse.json({
    remaining: peek.remaining,
    limit: peek.limit,
    resetAt: Date.now() + peek.resetMs,
  })
  if (isNew) {
    res.cookies.set(COOKIE_NAME, sessionId, { httpOnly: true, sameSite: 'lax', secure: isProd, path: '/', maxAge: COOKIE_MAX_AGE })
  }
  return res
}

function buildFullScorePrompt(essay: string, essayType: string): string {
  return `
You are an expert essay evaluator. Score this ${essayType} for readiness.

Return ONLY valid JSON with this exact shape:
{
  "overall_score": 0,
  "readiness_label": "Needs work | Developing | Strong | Submission-ready",
  "summary": "2 sentence summary",
  "strengths": ["specific strength", "specific strength"],
  "priorities": ["highest-impact revision", "second revision", "third revision"],
  "rubric": [
    {"category": "Structure", "score": 0, "note": "short note"},
    {"category": "Voice", "score": 0, "note": "short note"},
    {"category": "Specificity", "score": 0, "note": "short note"},
    {"category": "Reflection", "score": 0, "note": "short note"}
  ]
}

Scores must be integers from 0 to 100. Be concrete, kind, and revision-focused.

Essay:
"""${essay}"""
`.trim()
}

function parseFullScoreResponse(raw: string): FullScoreResult | null {
  try {
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return null
    const parsed = JSON.parse(match[0]) as Partial<FullScoreResult>
    const clampScore = (n: unknown) => {
      const value = typeof n === 'number' && Number.isFinite(n) ? Math.round(n) : 0
      return Math.max(0, Math.min(100, value))
    }
    const rubric = Array.isArray(parsed.rubric) ? parsed.rubric.slice(0, 4).map((item) => ({
      category: typeof item?.category === 'string' ? item.category.slice(0, 40) : 'Rubric',
      score: clampScore(item?.score),
      note: typeof item?.note === 'string' ? item.note.slice(0, 240) : 'Review this area for clarity and specificity.',
    })) : []
    if (rubric.length === 0) return null
    return {
      overall_score: clampScore(parsed.overall_score),
      readiness_label: typeof parsed.readiness_label === 'string' ? parsed.readiness_label.slice(0, 40) : 'Developing',
      summary: typeof parsed.summary === 'string' ? parsed.summary.slice(0, 500) : 'Your essay has a workable foundation and needs targeted revision.',
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths.filter((v): v is string => typeof v === 'string').slice(0, 3) : [],
      priorities: Array.isArray(parsed.priorities) ? parsed.priorities.filter((v): v is string => typeof v === 'string').slice(0, 4) : [],
      rubric,
    }
  } catch {
    return null
  }
}
