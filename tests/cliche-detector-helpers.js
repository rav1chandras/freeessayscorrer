/**
 * cliche-detector-helpers.js
 * Pure JS mirror of cliche-detector-helpers.ts — used only by the test runner.
 * Keep in sync with the .ts source.
 */

const MAX_FINDINGS = 15
const VALID_SEVERITIES = ['high', 'medium', 'low']

// ─── Sanitizer ────────────────────────────────────────────────────────────────

export function sanitizeEssayText(raw) {
  if (typeof raw !== 'string') return ''
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// ─── Prompt Builder ───────────────────────────────────────────────────────────

export function buildClicheDetectionPrompt(essay, essayType) {
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

function extractJson(raw) {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced) return fenced[1].trim()
  if (raw.trimStart().startsWith('[')) return raw.trim()
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start !== -1 && end > start) return raw.slice(start, end + 1)
  return raw.trim()
}

function isValidSeverity(v) {
  return typeof v === 'string' && VALID_SEVERITIES.includes(v)
}

function parseOneFinding(raw) {
  if (!raw || typeof raw !== 'object') return null
  const phrase = typeof raw.phrase === 'string' ? raw.phrase.trim() : ''
  const context_sentence = typeof raw.context_sentence === 'string' ? raw.context_sentence.trim() : ''
  const why_problem = typeof raw.why_problem === 'string' ? raw.why_problem.trim() : ''
  const replacement = typeof raw.replacement === 'string' ? raw.replacement.trim() : ''
  const severity = isValidSeverity(raw.severity) ? raw.severity : 'medium'
  if (!phrase && !why_problem) return null
  return { phrase, context_sentence, why_problem, replacement, severity }
}

export function parseClicheResponse(raw, remaining, reset) {
  if (!raw || typeof raw !== 'string') return null
  let obj
  try {
    const json = extractJson(raw)
    obj = JSON.parse(json)
  } catch {
    return null
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null
  const rawFindings = Array.isArray(obj.findings) ? obj.findings : []
  const findings = rawFindings
    .slice(0, MAX_FINDINGS)
    .map(parseOneFinding)
    .filter(f => f !== null)
  return {
    findings,
    remaining_scores: typeof remaining === 'number' ? remaining : 0,
    rate_limit_reset: typeof reset === 'number' ? reset : 0,
  }
}
