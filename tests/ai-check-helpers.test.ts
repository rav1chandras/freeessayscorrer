/**
 * tests/ai-check-helpers.test.ts
 * ~30 vitest tests — same patterns as cliche-detector-helpers.test.ts
 */

import { describe, it, expect } from 'vitest'
import {
  sanitizeEssayText,
  buildAiCheckPrompt,
  parseAiCheckResponse,
  type AiFlag,
  type AiRisk,
} from '../lib/ai-check-helpers'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeFlag(overrides: Partial<AiFlag> = {}): AiFlag {
  return {
    passage: 'Furthermore, this experience taught me the importance of perseverance.',
    reason: 'Smooth transitional opener combined with a generic life lesson reads as AI-generated.',
    humanization: 'Start with the specific moment — what were you doing when you realized this?',
    risk: 'high',
    ...overrides,
  }
}

function makeFlags(count: number, risk: AiRisk = 'medium'): AiFlag[] {
  return Array.from({ length: count }, (_, i) =>
    makeFlag({ passage: `ai passage ${i + 1}`, risk })
  )
}

function makeRaw(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    human_score: 62,
    overall_risk: 'medium',
    summary: 'The essay has some human moments but contains several AI-like patterns.',
    flags: [makeFlag()],
    ...overrides,
  })
}

// ─── sanitizeEssayText (6) ────────────────────────────────────────────────────

describe('sanitizeEssayText', () => {
  it('returns empty string for number input', () => {
    // @ts-expect-error
    expect(sanitizeEssayText(42)).toBe('')
  })
  it('returns empty string for null', () => {
    // @ts-expect-error
    expect(sanitizeEssayText(null)).toBe('')
  })
  it('normalizes CRLF to LF', () => {
    expect(sanitizeEssayText('line one\r\nline two')).toBe('line one\nline two')
  })
  it('collapses multiple spaces and tabs', () => {
    expect(sanitizeEssayText('word1   word2\t\tword3')).toBe('word1 word2 word3')
  })
  it('allows at most two consecutive newlines', () => {
    expect(sanitizeEssayText('a\n\n\n\n\nb')).toBe('a\n\nb')
  })
  it('trims leading and trailing whitespace', () => {
    expect(sanitizeEssayText('   hello world   ')).toBe('hello world')
  })
})

// ─── buildAiCheckPrompt (5) ───────────────────────────────────────────────────

describe('buildAiCheckPrompt', () => {
  it('includes the essay text', () => {
    const essay = 'Furthermore, I have always been passionate about science.'
    expect(buildAiCheckPrompt(essay, 'Personal Statement')).toContain(essay)
  })
  it('includes the essay type', () => {
    expect(buildAiCheckPrompt('essay text', 'Why School Essay')).toContain('Why School Essay')
  })
  it('instructs JSON-only output with flags array', () => {
    const p = buildAiCheckPrompt('text', 'Supplemental')
    expect(p).toContain('"flags"')
    expect(p.toLowerCase()).toContain('json')
  })
  it('includes human_score field in schema', () => {
    expect(buildAiCheckPrompt('text', 'PS')).toContain('human_score')
  })
  it('mentions the cap of 12 flags', () => {
    expect(buildAiCheckPrompt('text', 'PS')).toContain('12')
  })
})

// ─── parseAiCheckResponse (21) ────────────────────────────────────────────────

describe('parseAiCheckResponse', () => {
  // Null / garbage
  it('returns null for empty string', () => {
    expect(parseAiCheckResponse('', 10, 0)).toBeNull()
  })
  it('returns null for null input', () => {
    // @ts-expect-error
    expect(parseAiCheckResponse(null, 10, 0)).toBeNull()
  })
  it('returns null for number input', () => {
    // @ts-expect-error
    expect(parseAiCheckResponse(42, 10, 0)).toBeNull()
  })
  it('returns null for pure prose garbage', () => {
    expect(parseAiCheckResponse('Sorry, I cannot help with that.', 10, 0)).toBeNull()
  })
  it('returns null for a bare JSON array', () => {
    expect(parseAiCheckResponse('[{"passage":"x"}]', 10, 0)).toBeNull()
  })

  // Happy path
  it('parses a valid full response', () => {
    const result = parseAiCheckResponse(makeRaw(), 5, 9999)
    expect(result).not.toBeNull()
    expect(result!.flags).toHaveLength(1)
    expect(result!.human_score).toBe(62)
    expect(result!.overall_risk).toBe('medium')
  })
  it('populates remaining_scores', () => {
    expect(parseAiCheckResponse(makeRaw(), 7, 0)!.remaining_scores).toBe(7)
  })
  it('populates rate_limit_reset', () => {
    expect(parseAiCheckResponse(makeRaw(), 0, 12345)!.rate_limit_reset).toBe(12345)
  })
  it('populates summary', () => {
    const result = parseAiCheckResponse(makeRaw(), 10, 0)
    expect(result!.summary).toBe('The essay has some human moments but contains several AI-like patterns.')
  })

  // Score clamping
  it('clamps human_score above 100 to 100', () => {
    expect(parseAiCheckResponse(makeRaw({ human_score: 150 }), 10, 0)!.human_score).toBe(100)
  })
  it('clamps human_score below 0 to 0', () => {
    expect(parseAiCheckResponse(makeRaw({ human_score: -10 }), 10, 0)!.human_score).toBe(0)
  })
  it('defaults invalid human_score string to 50', () => {
    expect(parseAiCheckResponse(makeRaw({ human_score: 'banana' }), 10, 0)!.human_score).toBe(50)
  })
  it('parses human_score from numeric string', () => {
    expect(parseAiCheckResponse(makeRaw({ human_score: '75' }), 10, 0)!.human_score).toBe(75)
  })

  // Risk coercion
  it('defaults invalid overall_risk to medium', () => {
    expect(parseAiCheckResponse(makeRaw({ overall_risk: 'extreme' }), 10, 0)!.overall_risk).toBe('medium')
  })
  it('accepts high overall_risk', () => {
    expect(parseAiCheckResponse(makeRaw({ overall_risk: 'high' }), 10, 0)!.overall_risk).toBe('high')
  })
  it('accepts low overall_risk', () => {
    expect(parseAiCheckResponse(makeRaw({ overall_risk: 'low' }), 10, 0)!.overall_risk).toBe('low')
  })

  // Flags cap
  it('caps flags at 12 when model returns more', () => {
    const result = parseAiCheckResponse(makeRaw({ flags: makeFlags(20) }), 10, 0)
    expect(result!.flags).toHaveLength(12)
  })
  it('returns empty flags array when none found', () => {
    const result = parseAiCheckResponse(makeRaw({ flags: [] }), 10, 0)
    expect(result!.flags).toHaveLength(0)
  })

  // Fenced JSON / preamble
  it('strips ```json fences', () => {
    const raw = '```json\n' + makeRaw() + '\n```'
    expect(parseAiCheckResponse(raw, 10, 0)).not.toBeNull()
  })
  it('handles prose preamble before JSON', () => {
    const raw = 'Here is my analysis:\n\n' + makeRaw()
    expect(parseAiCheckResponse(raw, 10, 0)!.flags).toHaveLength(1)
  })

  // Flag field handling
  it('defaults flag risk to medium for invalid value', () => {
    const raw = makeRaw({ flags: [makeFlag({ risk: 'extreme' as AiRisk })] })
    expect(parseAiCheckResponse(raw, 10, 0)!.flags[0].risk).toBe('medium')
  })
  it('handles missing humanization — returns empty string', () => {
    const f = { passage: 'text', reason: 'reason', risk: 'high' }
    const raw = makeRaw({ flags: [f] })
    expect(parseAiCheckResponse(raw, 10, 0)!.flags[0].humanization).toBe('')
  })
  it('filters out flags where both passage and reason are empty', () => {
    const bad = { passage: '', reason: '', humanization: '', risk: 'high' }
    const good = makeFlag()
    const raw = makeRaw({ flags: [bad, good] })
    expect(parseAiCheckResponse(raw, 10, 0)!.flags).toHaveLength(1)
  })
  it('handles null items in flags array', () => {
    const raw = JSON.stringify({
      human_score: 60, overall_risk: 'medium', summary: 'ok',
      flags: [null, makeFlag()],
    })
    expect(parseAiCheckResponse(raw, 10, 0)!.flags).toHaveLength(1)
  })
  it('trims whitespace from passage field', () => {
    const raw = makeRaw({ flags: [makeFlag({ passage: '  Furthermore text  ' })] })
    expect(parseAiCheckResponse(raw, 10, 0)!.flags[0].passage).toBe('Furthermore text')
  })
})
