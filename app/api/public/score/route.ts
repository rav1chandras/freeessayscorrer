import { NextRequest, NextResponse } from 'next/server'
import {
  consumeAnon,
  refundAnon,
  getOrCreateAnonSessionId,
  COOKIE_NAME,
  COOKIE_MAX_AGE,
  DAILY_LIMIT,
} from '../../../../lib/anon-quota'

import {
  sanitizeEssayText as hookSanitize,
  parseHookResponse,
} from '../../../../lib/hook-analyzer-helpers'

import {
  sanitizeEssayText as clicheSanitize,
  parseClicheResponse,
} from '../../../../lib/cliche-detector-helpers'

import {
  sanitizeEssayText as aiSanitize,
} from '../../../../lib/ai-check-helpers'

const MIN_WORDS = 50
const MAX_WORDS = 1500
const META_MODEL = 'muse-spark-1.2-contributor'

type PublicTool = 'reader' | 'thesis' | 'outline' | 'score'
type PublicToolInput = PublicTool | 'hook' | 'cliche' | 'aicheck' | 'fullscore'

const PUBLIC_TOOL_ALIASES: Record<PublicToolInput, PublicTool> = {
  reader: 'reader',
  thesis: 'thesis',
  outline: 'outline',
  score: 'score',
  hook: 'reader',
  cliche: 'thesis',
  aicheck: 'outline',
  fullscore: 'score',
}

type FullScoreResult = {
  overall_score: number
  readiness_label: string
  summary: string
  strengths: string[]
  priorities: string[]
  rubric: Array<{ category: string; score: number; note: string }>
}

type OutlineResult = {
  summary: string
  thesis: string
  sections: Array<{ label: string; purpose: string; suggestion: string }>
  priorities: string[]
}

function normalizePublicTool(v: unknown): PublicTool | null {
  if (typeof v !== 'string') return null
  return PUBLIC_TOOL_ALIASES[v as PublicToolInput] ?? null
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

  const tool = normalizePublicTool(body.tool)
  if (!tool) {
    return NextResponse.json(
      { error: 'Unknown or gated tool. Sign up at app.admitly.com to access all tools.', gated: true },
      { status: 400 }
    )
  }

  const rawEssay = body.essay ?? ''
  const essayType =
    typeof body.essayType === 'string' ? body.essayType.trim() : 'Personal Statement'

  // ── Validate BEFORE consuming quota ───────────────────────────────────────
  let essay: string
  switch (tool) {
    case 'reader':  essay = hookSanitize(rawEssay); break
    case 'thesis':  essay = clicheSanitize(rawEssay); break
    case 'outline': essay = aiSanitize(rawEssay); break
    case 'score':   essay = aiSanitize(rawEssay); break
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
    case 'reader':  prompt = buildReaderSimulatorPrompt(essay, essayType); break
    case 'thesis':  prompt = buildThesisCheckerPrompt(essay, essayType); break
    case 'outline': prompt = buildOutlinePrompt(essay, essayType); break
    case 'score':   prompt = buildFullScorePrompt(essay, essayType); break
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
    case 'reader':  result = parseHookResponse(raw, quota.remaining, resetAt); break
    case 'thesis':  result = parseClicheResponse(raw, quota.remaining, resetAt); break
    case 'outline': result = parseOutlineResponse(raw); break
    case 'score':   result = parseFullScoreResponse(raw); break
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
import { peekAnon } from '../../../../lib/anon-quota'

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

function buildReaderSimulatorPrompt(essay: string, essayType: string): string {
  return `
You are a college essay reader simulating a first admissions read. Evaluate this ${essayType} for first impression, memorability, clarity, and emotional pull.

Return ONLY valid JSON with this exact shape:
{
  "overall_score": "weak | moderate | strong",
  "opening_lines": "the opening line(s) you evaluated",
  "findings": [
    {
      "element": "First impression | Memorability | Clarity | Emotional pull",
      "assessment": "specific reader-facing assessment",
      "score": "weak | moderate | strong",
      "suggestion": "concrete next revision"
    }
  ],
  "rewrite_suggestion": "optional 1-2 sentence reader-focused revision idea"
}

Give 3-5 findings. Be concrete and student-friendly.

Essay:
"""${essay}"""
`.trim()
}

function buildThesisCheckerPrompt(essay: string, essayType: string): string {
  return `
You are a thesis and central-claim coach for college essays. Check whether this ${essayType} has a clear, specific, arguable central claim or controlling insight.

Return ONLY valid JSON with this exact shape:
{
  "findings": [
    {
      "phrase": "short excerpt or issue label",
      "context_sentence": "sentence from the essay, if relevant",
      "why_problem": "why this weakens the thesis or controlling idea",
      "replacement": "a stronger thesis/claim direction or rewrite",
      "severity": "high | medium | low"
    }
  ]
}

If the thesis is already strong, return {"findings":[]}. Do not flag clichés unless they weaken the central claim.

Essay:
"""${essay}"""
`.trim()
}

function buildOutlinePrompt(essay: string, essayType: string): string {
  return `
You are an essay structure coach. Build or improve a clean outline for this ${essayType}. Focus on narrative flow, paragraph purpose, and what each section should prove.

Return ONLY valid JSON with this exact shape:
{
  "summary": "2 sentence overview of the current structure and best path forward",
  "thesis": "one sentence working thesis or controlling insight",
  "sections": [
    {
      "label": "Hook / Setup / Turning point / Reflection / Conclusion",
      "purpose": "what this section should accomplish",
      "suggestion": "specific content to add, move, cut, or clarify"
    }
  ],
  "priorities": ["highest-impact structure fix", "second fix", "third fix"]
}

Provide 4-6 sections. Keep every suggestion actionable and tied to the essay.

Essay:
"""${essay}"""
`.trim()
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

function parseOutlineResponse(raw: string): OutlineResult | null {
  try {
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return null
    const parsed = JSON.parse(match[0]) as Partial<OutlineResult>
    const sections = Array.isArray(parsed.sections)
      ? parsed.sections
        .filter((item): item is OutlineResult['sections'][number] => !!item && typeof item === 'object')
        .slice(0, 6)
        .map((item) => ({
          label: typeof item.label === 'string' ? item.label.slice(0, 60) : 'Section',
          purpose: typeof item.purpose === 'string' ? item.purpose.slice(0, 260) : 'Clarify this part of the essay.',
          suggestion: typeof item.suggestion === 'string' ? item.suggestion.slice(0, 360) : 'Add a specific example or transition here.',
        }))
      : []
    if (sections.length === 0) return null
    return {
      summary: typeof parsed.summary === 'string' ? parsed.summary.slice(0, 600) : 'Your essay has a workable structure and needs clearer section goals.',
      thesis: typeof parsed.thesis === 'string' ? parsed.thesis.slice(0, 280) : '',
      sections,
      priorities: Array.isArray(parsed.priorities) ? parsed.priorities.filter((v): v is string => typeof v === 'string').slice(0, 4) : [],
    }
  } catch {
    return null
  }
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
