/**
 * Cliche Detector helpers
 * Mirrors the architecture of hook-analyzer-helpers.ts and reader-simulator-helpers.ts:
 *   sanitizeEssayText → buildClicheDetectionPrompt → parseClicheResponse
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type ClicheSeverity = 'high' | 'medium' | 'low'

export interface ClicheFinding {
  phrase: string
  context_sentence: string
  why_problem: string
  replacement: string
  severity: ClicheSeverity
}

export interface ClicheResult {
  findings: ClicheFinding[]
  remaining_scores: number
  rate_limit_reset: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_FINDINGS = 15

const VALID_SEVERITIES: ClicheSeverity[] = ['high', 'medium', 'low']

// ─── Sanitizer ────────────────────────────────────────────────────────────────

/**
 * Normalize line endings, collapse horizontal whitespace, limit blank lines.
 * Returns empty string for non-string input.
 */
export function sanitizeEssayText(raw: string): string {
  if (typeof raw !== 'string') return ''
  return raw
    .replace(/\r\n/g, '\n')   // Windows → Unix
    .replace(/\r/g, '\n')     // old Mac → Unix
    .replace(/[^\S\n]+/g, ' ') // collapse spaces/tabs (not newlines)
    .replace(/\n{3,}/g, '\n\n') // at most two consecutive blank lines
    .trim()
}

// ─── Prompt Builder ───────────────────────────────────────────────────────────

/**
 * Build the system+user prompt for cliche detection.
 * @param essay   Sanitized essay text
 * @param essayType  e.g. "Common App Personal Statement", "Supplemental Essay"
 */
export function buildClicheDetectionPrompt(essay: string, essayType: string): string {
  return `You are an expert college admissions essay editor. Your task is to identify clichés, overused phrases, and tired tropes in a student's ${essayType}.

Clichés include:
- Overused opening moves ("Ever since I was a child...", "I have always been passionate about...")
- Generic mission statements ("I want to make a difference", "change the world")
- Vague platitudes ("This experience taught me the importance of hard work")
- Sports/leadership tropes ("As team captain, I learned...", "We were down by one point...")
- Humble-brag setups ("Although I had never failed before...")
- Dramatic epiphanies that feel manufactured

Essay type: ${essayType}

Essay to analyze:
"""
${essay}
"""

Return ONLY valid JSON with this exact shape — no markdown fences, no preamble, no trailing text:
{
  "findings": [
    {
      "phrase": "<the clichéd phrase or sentence fragment, verbatim from the essay>",
      "context_sentence": "<the full sentence containing the phrase>",
      "why_problem": "<1-2 sentences explaining why this is a cliché in admissions essays>",
      "replacement": "<a concrete, specific alternative approach or rewrite>",
      "severity": "high" | "medium" | "low"
    }
  ]
}

Severity guide:
- high: Admission readers will immediately recognize as a red flag; weakens the essay significantly
- medium: Common enough to feel generic; misses an opportunity for authenticity
- low: Minor; slightly overused but not a dealbreaker

Cap your findings at ${MAX_FINDINGS}. If the essay has fewer than 3 clichés, still report what you find — don't invent problems. Focus on the most impactful issues first (highest severity first).`
}

// ─── Parser ───────────────────────────────────────────────────────────────────

/**
 * Extract a JSON block from raw model output.
 * Handles: fenced code blocks, prose preamble, bare JSON.
 */
function extractJson(raw: string): string {
  // 1. Fenced code block (```json ... ``` or ``` ... ```)
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced) return fenced[1].trim()

  // 2. First { ... } in the string
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start !== -1 && end > start) return raw.slice(start, end + 1)

  // 3. Fall through — return trimmed raw and let JSON.parse throw
  return raw.trim()
}

function isValidSeverity(v: unknown): v is ClicheSeverity {
  return typeof v === 'string' && (VALID_SEVERITIES as string[]).includes(v)
}

function parseOneFinding(raw: unknown): ClicheFinding | null {
  if (!raw || typeof raw !== 'object') return null
  const f = raw as Record<string, unknown>

  const phrase = typeof f.phrase === 'string' ? f.phrase.trim() : ''
  const context_sentence = typeof f.context_sentence === 'string' ? f.context_sentence.trim() : ''
  const why_problem = typeof f.why_problem === 'string' ? f.why_problem.trim() : ''
  const replacement = typeof f.replacement === 'string' ? f.replacement.trim() : ''
  const severity: ClicheSeverity = isValidSeverity(f.severity) ? f.severity : 'medium'

  // Require at least phrase and why_problem to be non-empty
  if (!phrase && !why_problem) return null

  return { phrase, context_sentence, why_problem, replacement, severity }
}

/**
 * Parse raw model output into a ClicheResult.
 * Returns null on garbage input, missing required structure, or JSON parse failure.
 * Always caps findings at MAX_FINDINGS.
 */
export function parseClicheResponse(
  raw: string,
  remaining: number,
  reset: number
): ClicheResult | null {
  if (!raw || typeof raw !== 'string') return null

  let obj: Record<string, unknown>
  try {
    const json = extractJson(raw)
    obj = JSON.parse(json)
  } catch {
    return null
  }

  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null

  const rawFindings = Array.isArray(obj.findings) ? obj.findings : []

  const findings: ClicheFinding[] = rawFindings
    .slice(0, MAX_FINDINGS)
    .map(parseOneFinding)
    .filter((f): f is ClicheFinding => f !== null)

  return {
    findings,
    remaining_scores: typeof remaining === 'number' ? remaining : 0,
    rate_limit_reset: typeof reset === 'number' ? reset : 0,
  }
}
