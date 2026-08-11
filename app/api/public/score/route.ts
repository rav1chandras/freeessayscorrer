import { NextRequest, NextResponse } from 'next/server'
import {
  consumeAnon,
  refundAnon,
  getOrCreateAnonSessionId,
  COOKIE_NAME,
  COOKIE_MAX_AGE,
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
          'You\'ve used your 3 free analyses for today. Sign up at app.admitly.com for unlimited access, or come back tomorrow.',
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

  // ── Call OpenAI ───────────────────────────────────────────────────────────
  let raw: string
  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) throw new Error('OPENAI_API_KEY not configured')

    const modelResp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: tool === 'hook' || tool === 'fullscore' ? 'gpt-4o' : 'gpt-4o-mini',
        max_tokens: 1500,
        temperature: 0.2,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!modelResp.ok) {
      const errText = await modelResp.text()
      throw new Error(`OpenAI error ${modelResp.status}: ${errText}`)
    }

    const data = await modelResp.json()
    raw = data.choices?.[0]?.message?.content ?? ''
  } catch (err) {
    refundAnon(sessionId)
    console.error('[public/score] OpenAI call failed:', err)
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
    quota: { remaining: quota.remaining, limit: 3, resetAt },
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
