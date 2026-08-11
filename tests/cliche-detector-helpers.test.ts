/**
 * tests/cliche-detector-helpers.test.ts
 * ~30 vitest tests following the same patterns as reader-simulator-helpers.test.ts
 */

import { describe, it, expect } from 'vitest'
import {
  sanitizeEssayText,
  buildClicheDetectionPrompt,
  parseClicheResponse,
  type ClicheFinding,
  type ClicheResult,
  type ClicheSeverity,
} from '../lib/cliche-detector-helpers'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeFinding(overrides: Partial<ClicheFinding> = {}): ClicheFinding {
  return {
    phrase: 'ever since I was a child',
    context_sentence: 'Ever since I was a child, I dreamed of becoming a doctor.',
    why_problem: 'This is one of the most overused openings in college admissions essays.',
    replacement: 'Open with a specific memory or scene that shows your passion concretely.',
    severity: 'high',
    ...overrides,
  }
}

function makeFindings(count: number, severity: ClicheSeverity = 'medium'): ClicheFinding[] {
  return Array.from({ length: count }, (_, i) =>
    makeFinding({ phrase: `cliché phrase ${i + 1}`, severity })
  )
}

function makeRaw(findings: ClicheFinding[]): string {
  return JSON.stringify({ findings })
}

// ─── sanitizeEssayText ────────────────────────────────────────────────────────

describe('sanitizeEssayText', () => {
  it('returns empty string for non-string input (number)', () => {
    // @ts-expect-error — deliberate runtime test
    expect(sanitizeEssayText(42)).toBe('')
  })

  it('returns empty string for null', () => {
    // @ts-expect-error
    expect(sanitizeEssayText(null)).toBe('')
  })

  it('returns empty string for undefined', () => {
    // @ts-expect-error
    expect(sanitizeEssayText(undefined)).toBe('')
  })

  it('normalizes Windows line endings (CRLF → LF)', () => {
    const input = 'line one\r\nline two\r\nline three'
    expect(sanitizeEssayText(input)).toBe('line one\nline two\nline three')
  })

  it('normalizes old Mac line endings (CR → LF)', () => {
    const input = 'line one\rline two\rline three'
    expect(sanitizeEssayText(input)).toBe('line one\nline two\nline three')
  })

  it('collapses multiple spaces and tabs into single space', () => {
    const input = 'word1   word2\t\tword3'
    expect(sanitizeEssayText(input)).toBe('word1 word2 word3')
  })

  it('allows at most two consecutive newlines', () => {
    const input = 'para one\n\n\n\n\npara two'
    expect(sanitizeEssayText(input)).toBe('para one\n\npara two')
  })

  it('trims leading and trailing whitespace', () => {
    expect(sanitizeEssayText('   hello world   ')).toBe('hello world')
  })

  it('preserves internal newlines that are within the two-newline cap', () => {
    const input = 'para one\n\npara two\n\npara three'
    expect(sanitizeEssayText(input)).toBe('para one\n\npara two\n\npara three')
  })

  it('handles an already-clean string unchanged (modulo trim)', () => {
    const clean = 'This is a clean essay sentence.\nAnd another one.'
    expect(sanitizeEssayText(clean)).toBe(clean)
  })
})

// ─── buildClicheDetectionPrompt ───────────────────────────────────────────────

describe('buildClicheDetectionPrompt', () => {
  it('includes the essay text in the prompt', () => {
    const essay = 'Ever since I was young, I loved science.'
    const prompt = buildClicheDetectionPrompt(essay, 'Personal Statement')
    expect(prompt).toContain(essay)
  })

  it('includes the essay type in the prompt', () => {
    const prompt = buildClicheDetectionPrompt('Some essay text here.', 'Why School Essay')
    expect(prompt).toContain('Why School Essay')
  })

  it('instructs the model to return JSON with a findings array', () => {
    const prompt = buildClicheDetectionPrompt('Essay text.', 'Supplemental')
    expect(prompt).toContain('"findings"')
    expect(prompt.toLowerCase()).toContain('json')
  })

  it('specifies severity levels in the prompt', () => {
    const prompt = buildClicheDetectionPrompt('Essay text.', 'Supplemental')
    expect(prompt).toContain('high')
    expect(prompt).toContain('medium')
    expect(prompt).toContain('low')
  })

  it('mentions cap of 15 findings', () => {
    const prompt = buildClicheDetectionPrompt('Essay text.', 'Supplemental')
    expect(prompt).toContain('15')
  })
})

// ─── parseClicheResponse ──────────────────────────────────────────────────────

describe('parseClicheResponse', () => {
  // Null / garbage input
  it('returns null for empty string', () => {
    expect(parseClicheResponse('', 10, 0)).toBeNull()
  })

  it('returns null for null input', () => {
    // @ts-expect-error
    expect(parseClicheResponse(null, 10, 0)).toBeNull()
  })

  it('returns null for non-string input', () => {
    // @ts-expect-error
    expect(parseClicheResponse(42, 10, 0)).toBeNull()
  })

  it('returns null for completely non-JSON garbage', () => {
    expect(parseClicheResponse('Sorry, I cannot do that.', 10, 0)).toBeNull()
  })

  it('returns null for bare array (no findings wrapper)', () => {
    expect(parseClicheResponse('[{"phrase":"test"}]', 10, 0)).toBeNull()
  })

  // Happy path
  it('parses a valid response with one finding', () => {
    const raw = makeRaw([makeFinding()])
    const result = parseClicheResponse(raw, 5, 9999)
    expect(result).not.toBeNull()
    expect(result!.findings).toHaveLength(1)
    expect(result!.findings[0].phrase).toBe('ever since I was a child')
  })

  it('populates remaining_scores and rate_limit_reset', () => {
    const raw = makeRaw([makeFinding()])
    const result = parseClicheResponse(raw, 7, 12345)
    expect(result!.remaining_scores).toBe(7)
    expect(result!.rate_limit_reset).toBe(12345)
  })

  it('returns empty findings array when findings key is empty array', () => {
    const raw = JSON.stringify({ findings: [] })
    const result = parseClicheResponse(raw, 10, 0)
    expect(result).not.toBeNull()
    expect(result!.findings).toHaveLength(0)
  })

  it('caps findings at 15 even if model returns more', () => {
    const raw = makeRaw(makeFindings(20))
    const result = parseClicheResponse(raw, 10, 0)
    expect(result!.findings).toHaveLength(15)
  })

  it('returns exactly 15 findings when model returns exactly 15', () => {
    const raw = makeRaw(makeFindings(15))
    const result = parseClicheResponse(raw, 10, 0)
    expect(result!.findings).toHaveLength(15)
  })

  // Severity coercion
  it('defaults severity to "medium" for invalid severity value', () => {
    const raw = makeRaw([makeFinding({ severity: 'critical' as ClicheSeverity })])
    const result = parseClicheResponse(raw, 10, 0)
    expect(result!.findings[0].severity).toBe('medium')
  })

  it('accepts all three valid severity values', () => {
    const findings = [
      makeFinding({ severity: 'high' }),
      makeFinding({ severity: 'medium', phrase: 'make a difference' }),
      makeFinding({ severity: 'low', phrase: 'hard work' }),
    ]
    const result = parseClicheResponse(makeRaw(findings), 10, 0)!
    expect(result.findings[0].severity).toBe('high')
    expect(result.findings[1].severity).toBe('medium')
    expect(result.findings[2].severity).toBe('low')
  })

  // Fenced JSON handling
  it('strips markdown json fences and parses correctly', () => {
    const inner = makeRaw([makeFinding()])
    const raw = `\`\`\`json\n${inner}\n\`\`\``
    const result = parseClicheResponse(raw, 10, 0)
    expect(result).not.toBeNull()
    expect(result!.findings).toHaveLength(1)
  })

  it('strips generic markdown fences (no language tag)', () => {
    const inner = makeRaw([makeFinding()])
    const raw = `\`\`\`\n${inner}\n\`\`\``
    const result = parseClicheResponse(raw, 10, 0)
    expect(result).not.toBeNull()
  })

  // Prose preamble
  it('extracts JSON when model prepends prose preamble', () => {
    const inner = makeRaw([makeFinding()])
    const raw = `Here are the clichés I found in your essay:\n\n${inner}`
    const result = parseClicheResponse(raw, 10, 0)
    expect(result).not.toBeNull()
    expect(result!.findings).toHaveLength(1)
  })

  // Missing optional fields
  it('handles missing context_sentence gracefully', () => {
    const finding = { ...makeFinding() }
    delete (finding as Partial<ClicheFinding>).context_sentence
    const raw = JSON.stringify({ findings: [finding] })
    const result = parseClicheResponse(raw, 10, 0)
    expect(result!.findings[0].context_sentence).toBe('')
  })

  it('handles missing replacement gracefully', () => {
    const finding = { ...makeFinding() }
    delete (finding as Partial<ClicheFinding>).replacement
    const raw = JSON.stringify({ findings: [finding] })
    const result = parseClicheResponse(raw, 10, 0)
    expect(result!.findings[0].replacement).toBe('')
  })

  // Filtering bad findings
  it('filters out findings where both phrase and why_problem are empty', () => {
    const bad = { phrase: '', context_sentence: '', why_problem: '', replacement: '', severity: 'high' }
    const good = makeFinding()
    const raw = JSON.stringify({ findings: [bad, good] })
    const result = parseClicheResponse(raw, 10, 0)
    // bad finding is filtered out, only good remains
    expect(result!.findings).toHaveLength(1)
    expect(result!.findings[0].phrase).toBe('ever since I was a child')
  })

  it('handles non-object items in findings array without throwing', () => {
    const raw = JSON.stringify({ findings: [null, 'garbage', 42, makeFinding()] })
    const result = parseClicheResponse(raw, 10, 0)
    // null/string/number entries are filtered; valid entry remains
    expect(result).not.toBeNull()
    expect(result!.findings).toHaveLength(1)
  })

  it('trims whitespace from string fields', () => {
    const finding = makeFinding({
      phrase: '  ever since I was a child  ',
      why_problem: '  This is overused.  ',
    })
    const result = parseClicheResponse(makeRaw([finding]), 10, 0)
    expect(result!.findings[0].phrase).toBe('ever since I was a child')
    expect(result!.findings[0].why_problem).toBe('This is overused.')
  })

  it('returns 0 for remaining_scores when passed 0', () => {
    const result = parseClicheResponse(makeRaw([makeFinding()]), 0, 0)
    expect(result!.remaining_scores).toBe(0)
  })

  it('handles findings with only phrase set (why_problem empty) — keeps it if phrase non-empty', () => {
    const finding = { phrase: 'make a difference', context_sentence: '', why_problem: '', replacement: '', severity: 'medium' }
    const raw = JSON.stringify({ findings: [finding] })
    const result = parseClicheResponse(raw, 10, 0)
    // phrase is non-empty, so finding should not be filtered (only filtered if BOTH are empty)
    expect(result!.findings).toHaveLength(1)
  })
})
