/**
 * AI Check helpers
 * Mirrors the architecture of cliche-detector-helpers.ts:
 *   sanitizeEssayText → buildAiCheckPrompt → parseAiCheckResponse
 *
 * This tool checks whether an essay reads as AI-generated and flags
 * specific passages with humanization suggestions. It does NOT claim
 * to replicate GPTZero/Turnitin — it simulates what patterns those
 * tools look for, so results should be treated as a heuristic.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type AiRisk = 'high' | 'medium' | 'low'

export interface AiFlag {
  passage: string           // verbatim text from the essay
  reason: string            // why this reads as AI-generated
  humanization: string      // concrete rewrite suggestion
  risk: AiRisk
}

export interface AiCheckResult {
  human_score: number       // 0–100, higher = more human
  overall_risk: AiRisk
  summary: string           // 2-3 sentence overall assessment
  flags: AiFlag[]
  remaining_scores: number
  rate_limit_reset: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_FLAGS = 12
const VALID_RISKS: AiRisk[] = ['high', 'medium', 'low']

// ─── Sanitizer ────────────────────────────────────────────────────────────────

/**
 * Normalize line endings, collapse horizontal whitespace, limit blank lines.
 * Returns empty string for non-string input.
 */
export function sanitizeEssayText(raw: string): string {
  if (typeof raw !== 'string') return ''
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// ─── Prompt Builder ───────────────────────────────────────────────────────────

/**
 * Build the prompt for AI pattern detection.
 * @param essay      Sanitized essay text
 * @param essayType  e.g. "Common App Personal Statement"
 */
export function buildAiCheckPrompt(essay: string, essayType: string): string {
  return `You are an expert at identifying AI-generated writing patterns in college admissions essays. Your job is to analyze a student's ${essayType} for patterns that AI detection tools (like GPTZero or Turnitin) commonly flag, and provide actionable humanization suggestions.

AI-generated writing patterns to look for:
- Overly uniform sentence length and structure (every sentence ~20 words)
- Suspiciously smooth transitions ("Furthermore", "Moreover", "In conclusion", "It is worth noting")
- Generic, interchangeable observations that could apply to any student
- Lack of specific sensory detail, place names, personal quirks, or idiosyncratic phrasing
- Passive voice overuse or formal register that doesn't match a teenager's voice
- Perfectly balanced paragraph structure (every paragraph same length)
- Abstract philosophical statements without grounding in personal experience
- Hedging language ("one might argue", "it can be said", "this experience allowed me to")
- Vocabulary that feels slightly too elevated or formal for the context
- Conclusions that restate themes too neatly

Essay type: ${essayType}

Essay to analyze:
"""
${essay}
"""

Return ONLY valid JSON with this exact shape — no markdown fences, no preamble, no trailing text:
{
  "human_score": <integer 0-100, where 100 = clearly human, 0 = clearly AI>,
  "overall_risk": "high" | "medium" | "low",
  "summary": "<2-3 sentences: overall assessment of how human vs AI this reads, and the most important pattern you noticed>",
  "flags": [
    {
      "passage": "<verbatim text from the essay — the specific phrase or sentence that triggered this flag>",
      "reason": "<1-2 sentences: why this specific passage reads as AI-generated>",
      "humanization": "<concrete rewrite or approach that would sound more authentically like a real student>",
      "risk": "high" | "medium" | "low"
    }
  ]
}

Risk guide:
- high: Very likely to be flagged by AI detection tools; strongly undermines authenticity
- medium: Somewhat suspicious; weakens the human voice
- low: Minor pattern; unlikely to trigger detection but worth polishing

Cap flags at ${MAX_FLAGS}. Order by risk descending. If the essay reads as genuinely human with few AI patterns, report a high human_score and only flag what you actually find — do not invent problems. Be honest: if it reads human, say so.`
}

// ─── Parser ───────────────────────────────────────────────────────────────────

function extractJson(raw: string): string {
  // 1. Fenced code block
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced) return fenced[1].trim()

  // 2. Bare array guard — return as-is so Array.isArray check rejects it
  if (raw.trimStart().startsWith('[')) return raw.trim()

  // 3. First { ... } block (handles prose preamble)
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start !== -1 && end > start) return raw.slice(start, end + 1)

  return raw.trim()
}

function isValidRisk(v: unknown): v is AiRisk {
  return typeof v === 'string' && (VALID_RISKS as string[]).includes(v)
}

function clampScore(v: unknown): number {
  const n = typeof v === 'number' ? v : parseInt(String(v), 10)
  if (isNaN(n)) return 50
  return Math.min(100, Math.max(0, Math.round(n)))
}

function parseOneFlag(raw: unknown): AiFlag | null {
  if (!raw || typeof raw !== 'object') return null
  const f = raw as Record<string, unknown>

  const passage = typeof f.passage === 'string' ? f.passage.trim() : ''
  const reason = typeof f.reason === 'string' ? f.reason.trim() : ''
  const humanization = typeof f.humanization === 'string' ? f.humanization.trim() : ''
  const risk: AiRisk = isValidRisk(f.risk) ? f.risk : 'medium'

  // Need at least passage and reason to be meaningful
  if (!passage && !reason) return null

  return { passage, reason, humanization, risk }
}

/**
 * Parse raw model output into an AiCheckResult.
 * Returns null on garbage input, parse failure, or missing required structure.
 * Caps flags at MAX_FLAGS.
 */
export function parseAiCheckResponse(
  raw: string,
  remaining: number,
  reset: number
): AiCheckResult | null {
  if (!raw || typeof raw !== 'string') return null

  let obj: Record<string, unknown>
  try {
    const json = extractJson(raw)
    obj = JSON.parse(json)
  } catch {
    return null
  }

  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null

  const human_score = clampScore(obj.human_score)
  const overall_risk: AiRisk = isValidRisk(obj.overall_risk) ? obj.overall_risk : 'medium'
  const summary = typeof obj.summary === 'string' ? obj.summary.trim() : ''

  const rawFlags = Array.isArray(obj.flags) ? obj.flags : []
  const flags: AiFlag[] = rawFlags
    .slice(0, MAX_FLAGS)
    .map(parseOneFlag)
    .filter((f): f is AiFlag => f !== null)

  return {
    human_score,
    overall_risk,
    summary,
    flags,
    remaining_scores: typeof remaining === 'number' ? remaining : 0,
    rate_limit_reset: typeof reset === 'number' ? reset : 0,
  }
}
