/**
 * ai-check-helpers.js — pure JS mirror of ai-check-helpers.ts
 * Used only by the test runner (no npm deps needed).
 */

const MAX_FLAGS = 12
const VALID_RISKS = ['high', 'medium', 'low']

export function sanitizeEssayText(raw) {
  if (typeof raw !== 'string') return ''
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function buildAiCheckPrompt(essay, essayType) {
  return `You are an expert at identifying AI-generated writing patterns in college admissions essays. Your job is to analyze a student's ${essayType} for patterns that AI detection tools (like GPTZero or Turnitin) commonly flag, and provide actionable humanization suggestions.

AI-generated writing patterns to look for:
- Overly uniform sentence length and structure
- Suspiciously smooth transitions ("Furthermore", "Moreover", "In conclusion")
- Generic observations that could apply to any student
- Lack of specific sensory detail or idiosyncratic phrasing
- Passive voice overuse or register mismatch
- Abstract philosophical statements without personal grounding

Essay type: ${essayType}

Essay to analyze:
"""
${essay}
"""

Return ONLY valid JSON with this exact shape — no markdown fences, no preamble, no trailing text:
{
  "human_score": <integer 0-100>,
  "overall_risk": "high" | "medium" | "low",
  "summary": "<2-3 sentence overall assessment>",
  "flags": [
    {
      "passage": "<verbatim text from essay>",
      "reason": "<why this reads as AI-generated>",
      "humanization": "<concrete rewrite suggestion>",
      "risk": "high" | "medium" | "low"
    }
  ]
}

Cap flags at ${MAX_FLAGS}. Order by risk descending.`
}

function extractJson(raw) {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced) return fenced[1].trim()
  if (raw.trimStart().startsWith('[')) return raw.trim()
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start !== -1 && end > start) return raw.slice(start, end + 1)
  return raw.trim()
}

function isValidRisk(v) {
  return typeof v === 'string' && VALID_RISKS.includes(v)
}

function clampScore(v) {
  const n = typeof v === 'number' ? v : parseInt(String(v), 10)
  if (isNaN(n)) return 50
  return Math.min(100, Math.max(0, Math.round(n)))
}

function parseOneFlag(raw) {
  if (!raw || typeof raw !== 'object') return null
  const passage = typeof raw.passage === 'string' ? raw.passage.trim() : ''
  const reason = typeof raw.reason === 'string' ? raw.reason.trim() : ''
  const humanization = typeof raw.humanization === 'string' ? raw.humanization.trim() : ''
  const risk = isValidRisk(raw.risk) ? raw.risk : 'medium'
  if (!passage && !reason) return null
  return { passage, reason, humanization, risk }
}

export function parseAiCheckResponse(raw, remaining, reset) {
  if (!raw || typeof raw !== 'string') return null
  let obj
  try {
    const json = extractJson(raw)
    obj = JSON.parse(json)
  } catch {
    return null
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null

  const human_score = clampScore(obj.human_score)
  const overall_risk = isValidRisk(obj.overall_risk) ? obj.overall_risk : 'medium'
  const summary = typeof obj.summary === 'string' ? obj.summary.trim() : ''
  const rawFlags = Array.isArray(obj.flags) ? obj.flags : []
  const flags = rawFlags
    .slice(0, MAX_FLAGS)
    .map(parseOneFlag)
    .filter(f => f !== null)

  return {
    human_score,
    overall_risk,
    summary,
    flags,
    remaining_scores: typeof remaining === 'number' ? remaining : 0,
    rate_limit_reset: typeof reset === 'number' ? reset : 0,
  }
}
