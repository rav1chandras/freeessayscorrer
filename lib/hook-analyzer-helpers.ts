/**
 * Hook Analyzer helpers
 * Sanitizer → prompt builder → defensive parser
 */

export type HookScore = 'strong' | 'moderate' | 'weak'

export interface HookFinding {
  element: string
  assessment: string
  score: HookScore
  suggestion: string
}

export interface HookResult {
  overall_score: HookScore
  opening_lines: string
  findings: HookFinding[]
  rewrite_suggestion: string
  remaining_scores: number
  rate_limit_reset: number
}

// ─── Sanitizer ────────────────────────────────────────────────────────────────

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

export function buildHookAnalysisPrompt(essay: string, essayType: string): string {
  const opening = essay.slice(0, 300)
  return `You are an expert college admissions essay coach analyzing the hook (opening) of a student essay.

Essay type: ${essayType}
Opening excerpt (first ~300 chars):
"""
${opening}
"""

Full essay for context:
"""
${essay}
"""

Analyze the hook quality. Return ONLY valid JSON with this exact shape:
{
  "overall_score": "strong" | "moderate" | "weak",
  "opening_lines": "<first 1-2 sentences verbatim>",
  "findings": [
    {
      "element": "<hook element name>",
      "assessment": "<what works or doesn't>",
      "score": "strong" | "moderate" | "weak",
      "suggestion": "<specific improvement>"
    }
  ],
  "rewrite_suggestion": "<optional rewritten opening>"
}

Provide 2–5 findings. Be specific and actionable. No markdown fences, no preamble.`
}

// ─── Parser ───────────────────────────────────────────────────────────────────

const VALID_SCORES: HookScore[] = ['strong', 'moderate', 'weak']

function isValidScore(v: unknown): v is HookScore {
  return typeof v === 'string' && (VALID_SCORES as string[]).includes(v)
}

function extractJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced) return fenced[1].trim()
  if (raw.trimStart().startsWith('[')) return raw.trim()
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start !== -1 && end > start) return raw.slice(start, end + 1)
  return raw.trim()
}

export function parseHookResponse(
  raw: string,
  remaining: number,
  reset: number
): HookResult | null {
  if (!raw || typeof raw !== 'string') return null
  try {
    const json = extractJson(raw)
    const obj = JSON.parse(json)
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null

    const overall_score = isValidScore(obj.overall_score) ? obj.overall_score : 'moderate'
    const opening_lines = typeof obj.opening_lines === 'string' ? obj.opening_lines.trim() : ''
    const rewrite_suggestion =
      typeof obj.rewrite_suggestion === 'string' ? obj.rewrite_suggestion.trim() : ''

    const rawFindings = Array.isArray(obj.findings) ? obj.findings : []
    const findings: HookFinding[] = rawFindings.slice(0, 5).map((f: unknown) => {
      const finding = f as Record<string, unknown>
      return {
        element: typeof finding.element === 'string' ? finding.element.trim() : 'Unknown',
        assessment: typeof finding.assessment === 'string' ? finding.assessment.trim() : '',
        score: isValidScore(finding.score) ? finding.score : 'moderate',
        suggestion: typeof finding.suggestion === 'string' ? finding.suggestion.trim() : '',
      }
    })

    return {
      overall_score,
      opening_lines,
      findings,
      rewrite_suggestion,
      remaining_scores: remaining,
      rate_limit_reset: reset,
    }
  } catch {
    return null
  }
}
