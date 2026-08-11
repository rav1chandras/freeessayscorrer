#!/usr/bin/env node
import { sanitizeEssayText as clicheSanitize, buildClicheDetectionPrompt, parseClicheResponse } from './cliche-detector-helpers.js'
import { sanitizeEssayText as aiSanitize, buildAiCheckPrompt, parseAiCheckResponse } from './ai-check-helpers.js'

let passed = 0, failed = 0
const failures = []

function expect(actual) {
  return {
    toBe(e) { if (actual !== e) throw new Error(`Expected ${JSON.stringify(e)}, got ${JSON.stringify(actual)}`) },
    toBeNull() { if (actual !== null) throw new Error(`Expected null, got ${JSON.stringify(actual)}`) },
    not: { toBeNull() { if (actual === null) throw new Error('Expected non-null') } },
    toHaveLength(n) { if ((actual?.length ?? -1) !== n) throw new Error(`Expected length ${n}, got ${actual?.length}`) },
    toContain(s) { if (!actual?.includes?.(s)) throw new Error(`Expected to contain "${s}"`) },
  }
}
async function it(label, fn) {
  try { await fn(); console.log(`  ✓ ${label}`); passed++ }
  catch(e) { console.log(`  ✗ ${label}\n    → ${e.message}`); failed++; failures.push({label, message: e.message}) }
}
function describe(label, fn) { console.log(`\n${label}`); fn() }

const makeC  = (o={}) => ({ phrase:'ever since I was a child', context_sentence:'Ever since I was a child.', why_problem:'Overused.', replacement:'Scene.', severity:'high', ...o })
const makeCs = (n,s='medium') => Array.from({length:n},(_,i)=>makeC({phrase:`p${i}`,severity:s}))
const cRaw   = fs => JSON.stringify({findings:fs})

const makeF  = (o={}) => ({ passage:'Furthermore, this taught me perseverance.', reason:'Smooth opener.', humanization:'Start with moment.', risk:'high', ...o })
const makeFs = (n,r='medium') => Array.from({length:n},(_,i)=>makeF({passage:`p${i}`,risk:r}))
const aiRaw  = (o={}) => JSON.stringify({ human_score:62, overall_risk:'medium', summary:'Mixed.', flags:[makeF()], ...o })

// ═══════════════════════════════════════════════════════════════════════════════
// CLICHÉ DETECTOR (32)
// ═══════════════════════════════════════════════════════════════════════════════
describe('cliche / sanitizeEssayText (6)', () => {
  it('"" for number', async()=>expect(clicheSanitize(42)).toBe(''))
  it('"" for null', async()=>expect(clicheSanitize(null)).toBe(''))
  it('CRLF→LF', async()=>expect(clicheSanitize('a\r\nb')).toBe('a\nb'))
  it('collapses spaces', async()=>expect(clicheSanitize('a   b')).toBe('a b'))
  it('max 2 newlines', async()=>expect(clicheSanitize('a\n\n\n\nb')).toBe('a\n\nb'))
  it('trims', async()=>expect(clicheSanitize('  hi  ')).toBe('hi'))
})
describe('cliche / buildClicheDetectionPrompt (5)', () => {
  it('includes essay text', async()=>expect(buildClicheDetectionPrompt('My essay.','PS')).toContain('My essay.'))
  it('includes essay type', async()=>expect(buildClicheDetectionPrompt('x','Why School')).toContain('Why School'))
  it('includes "findings"', async()=>expect(buildClicheDetectionPrompt('x','PS')).toContain('"findings"'))
  it('severity levels', async()=>{ const p=buildClicheDetectionPrompt('x','PS'); expect(p).toContain('high'); expect(p).toContain('low') })
  it('cap of 15', async()=>expect(buildClicheDetectionPrompt('x','PS')).toContain('15'))
})
describe('cliche / parseClicheResponse (21)', () => {
  it('null for ""', async()=>expect(parseClicheResponse('',10,0)).toBeNull())
  it('null for null', async()=>expect(parseClicheResponse(null,10,0)).toBeNull())
  it('null for number', async()=>expect(parseClicheResponse(42,10,0)).toBeNull())
  it('null for prose', async()=>expect(parseClicheResponse('Sorry.',10,0)).toBeNull())
  it('null for bare array', async()=>expect(parseClicheResponse('[{"phrase":"x"}]',10,0)).toBeNull())
  it('parses 1 finding', async()=>{ const r=parseClicheResponse(cRaw([makeC()]),5,9999); expect(r).not.toBeNull(); expect(r.findings).toHaveLength(1) })
  it('remaining_scores', async()=>expect(parseClicheResponse(cRaw([makeC()]),7,0).remaining_scores).toBe(7))
  it('rate_limit_reset', async()=>expect(parseClicheResponse(cRaw([makeC()]),0,12345).rate_limit_reset).toBe(12345))
  it('empty findings ok', async()=>{ const r=parseClicheResponse('{"findings":[]}',10,0); expect(r).not.toBeNull(); expect(r.findings).toHaveLength(0) })
  it('caps at 15 from 20', async()=>expect(parseClicheResponse(cRaw(makeCs(20)),10,0).findings).toHaveLength(15))
  it('exactly 15 ok', async()=>expect(parseClicheResponse(cRaw(makeCs(15)),10,0).findings).toHaveLength(15))
  it('invalid severity→medium', async()=>expect(parseClicheResponse(cRaw([makeC({severity:'x'})]),10,0).findings[0].severity).toBe('medium'))
  it('accepts high', async()=>expect(parseClicheResponse(cRaw([makeC({severity:'high'})]),10,0).findings[0].severity).toBe('high'))
  it('accepts low', async()=>expect(parseClicheResponse(cRaw([makeC({severity:'low'})]),10,0).findings[0].severity).toBe('low'))
  it('strips ```json', async()=>{ const r=parseClicheResponse('```json\n'+cRaw([makeC()])+'\n```',10,0); expect(r).not.toBeNull() })
  it('strips plain ```', async()=>expect(parseClicheResponse('```\n'+cRaw([makeC()])+'\n```',10,0)).not.toBeNull())
  it('prose preamble', async()=>{ const r=parseClicheResponse('Here:\n\n'+cRaw([makeC()]),10,0); expect(r.findings).toHaveLength(1) })
  it('missing context_sentence→""', async()=>{ const f={phrase:'p',why_problem:'w',replacement:'r',severity:'high'}; expect(parseClicheResponse(JSON.stringify({findings:[f]}),10,0).findings[0].context_sentence).toBe('') })
  it('missing replacement→""', async()=>{ const f={phrase:'p',context_sentence:'s',why_problem:'w',severity:'medium'}; expect(parseClicheResponse(JSON.stringify({findings:[f]}),10,0).findings[0].replacement).toBe('') })
  it('filters both-empty', async()=>{ const bad={phrase:'',context_sentence:'',why_problem:'',replacement:'',severity:'high'}; expect(parseClicheResponse(JSON.stringify({findings:[bad,makeC()]}),10,0).findings).toHaveLength(1) })
  it('handles null items', async()=>{ expect(parseClicheResponse(JSON.stringify({findings:[null,makeC()]}),10,0).findings).toHaveLength(1) })
  it('trims phrase', async()=>expect(parseClicheResponse(cRaw([makeC({phrase:'  phrase  '})]),10,0).findings[0].phrase).toBe('phrase'))
})

// ═══════════════════════════════════════════════════════════════════════════════
// AI CHECK (32)
// ═══════════════════════════════════════════════════════════════════════════════
describe('aicheck / sanitizeEssayText (6)', () => {
  it('"" for number', async()=>expect(aiSanitize(42)).toBe(''))
  it('"" for null', async()=>expect(aiSanitize(null)).toBe(''))
  it('CRLF→LF', async()=>expect(aiSanitize('a\r\nb')).toBe('a\nb'))
  it('collapses spaces', async()=>expect(aiSanitize('a   b')).toBe('a b'))
  it('max 2 newlines', async()=>expect(aiSanitize('a\n\n\n\nb')).toBe('a\n\nb'))
  it('trims', async()=>expect(aiSanitize('  hi  ')).toBe('hi'))
})
describe('aicheck / buildAiCheckPrompt (5)', () => {
  it('includes essay', async()=>expect(buildAiCheckPrompt('My text.','PS')).toContain('My text.'))
  it('includes type', async()=>expect(buildAiCheckPrompt('x','Why School')).toContain('Why School'))
  it('includes "flags"', async()=>expect(buildAiCheckPrompt('x','PS')).toContain('"flags"'))
  it('human_score in schema', async()=>expect(buildAiCheckPrompt('x','PS')).toContain('human_score'))
  it('cap of 12', async()=>expect(buildAiCheckPrompt('x','PS')).toContain('12'))
})
describe('aicheck / parseAiCheckResponse (21)', () => {
  it('null for ""', async()=>expect(parseAiCheckResponse('',10,0)).toBeNull())
  it('null for null', async()=>expect(parseAiCheckResponse(null,10,0)).toBeNull())
  it('null for number', async()=>expect(parseAiCheckResponse(42,10,0)).toBeNull())
  it('null for prose', async()=>expect(parseAiCheckResponse('Sorry.',10,0)).toBeNull())
  it('null for bare array', async()=>expect(parseAiCheckResponse('[{"passage":"x"}]',10,0)).toBeNull())
  it('parses valid', async()=>{ const r=parseAiCheckResponse(aiRaw(),5,9999); expect(r).not.toBeNull(); expect(r.human_score).toBe(62) })
  it('remaining_scores', async()=>expect(parseAiCheckResponse(aiRaw(),7,0).remaining_scores).toBe(7))
  it('rate_limit_reset', async()=>expect(parseAiCheckResponse(aiRaw(),0,12345).rate_limit_reset).toBe(12345))
  it('clamps >100→100', async()=>expect(parseAiCheckResponse(aiRaw({human_score:150}),10,0).human_score).toBe(100))
  it('clamps <0→0', async()=>expect(parseAiCheckResponse(aiRaw({human_score:-10}),10,0).human_score).toBe(0))
  it('bad string→50', async()=>expect(parseAiCheckResponse(aiRaw({human_score:'banana'}),10,0).human_score).toBe(50))
  it('numeric string ok', async()=>expect(parseAiCheckResponse(aiRaw({human_score:'75'}),10,0).human_score).toBe(75))
  it('invalid risk→medium', async()=>expect(parseAiCheckResponse(aiRaw({overall_risk:'x'}),10,0).overall_risk).toBe('medium'))
  it('accepts high risk', async()=>expect(parseAiCheckResponse(aiRaw({overall_risk:'high'}),10,0).overall_risk).toBe('high'))
  it('accepts low risk', async()=>expect(parseAiCheckResponse(aiRaw({overall_risk:'low'}),10,0).overall_risk).toBe('low'))
  it('caps at 12 from 20', async()=>expect(parseAiCheckResponse(aiRaw({flags:makeFs(20)}),10,0).flags).toHaveLength(12))
  it('empty flags ok', async()=>expect(parseAiCheckResponse(aiRaw({flags:[]}),10,0).flags).toHaveLength(0))
  it('strips ```json', async()=>expect(parseAiCheckResponse('```json\n'+aiRaw()+'\n```',10,0)).not.toBeNull())
  it('prose preamble', async()=>{ const r=parseAiCheckResponse('Analysis:\n\n'+aiRaw(),10,0); expect(r.flags).toHaveLength(1) })
  it('invalid flag risk→medium', async()=>expect(parseAiCheckResponse(aiRaw({flags:[makeF({risk:'x'})]}),10,0).flags[0].risk).toBe('medium'))
  it('missing humanization→""', async()=>{ const f={passage:'t',reason:'r',risk:'high'}; expect(parseAiCheckResponse(aiRaw({flags:[f]}),10,0).flags[0].humanization).toBe('') })
  it('filters both-empty flags', async()=>{ const bad={passage:'',reason:'',humanization:'',risk:'high'}; expect(parseAiCheckResponse(aiRaw({flags:[bad,makeF()]}),10,0).flags).toHaveLength(1) })
})

console.log(`\n${'─'.repeat(60)}`)
console.log(`✓ ${passed} passed  ✗ ${failed} failed  (${passed+failed} total)`)
if(failures.length){ console.log('\nFailed:'); failures.forEach(f=>console.log(`  ✗ ${f.label}: ${f.message}`)); process.exit(1) }
else console.log('\nAll tests passed!')
