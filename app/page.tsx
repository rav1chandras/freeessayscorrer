'use client'

import { CSSProperties, ClipboardEvent, useEffect, useRef, useState } from 'react'
import { track } from '../lib/track'
import {
  ShareIcon,
  LockIcon,
  ArrowRight,
  CheckIcon,
  AlertIcon,
  SparkleIcon,
  FeatherSparkleLogo,
} from '../components/icons'

// ─── Types ────────────────────────────────────────────────────────────────────

type FreeToolId = 'reader' | 'thesis' | 'outline' | 'score'
type BackendToolId = 'hook' | 'cliche' | 'aicheck' | 'fullscore'
type ToolId =
  | FreeToolId
  | 'studio'
  | 'paragraph'
  | 'evidence'
  | 'conclusion'
  | 'score'
  | 'prompt-fit'

interface HookFinding {
  element: string
  assessment: string
  score: 'strong' | 'moderate' | 'weak'
  suggestion: string
}
interface HookResult {
  overall_score: 'strong' | 'moderate' | 'weak'
  opening_lines: string
  findings: HookFinding[]
  rewrite_suggestion: string
}
interface ClicheFinding {
  phrase: string
  context_sentence: string
  why_problem: string
  replacement: string
  severity: 'high' | 'medium' | 'low'
}
interface ClicheResult {
  findings: ClicheFinding[]
}
interface AiFlag {
  passage: string
  reason: string
  humanization: string
  risk: 'high' | 'medium' | 'low'
}
interface AiCheckResult {
  human_score: number
  overall_risk: 'high' | 'medium' | 'low'
  summary: string
  flags: AiFlag[]
}
interface FullScoreResult {
  overall_score: number
  readiness_label: string
  summary: string
  strengths: string[]
  priorities: string[]
  rubric: Array<{ category: string; score: number; note: string }>
}
interface ScoreResponse {
  tool: FreeToolId
  result: HookResult | ClicheResult | AiCheckResult | FullScoreResult
  quota: { remaining: number; limit: number; resetAt: number }
}

type ToolMeta = {
  id: ToolId
  idx: string
  label: string
  actionLabel: string
  eyebrow: string
  title: string
  description: string
  tagline: string
  intro: string
  maxWords: number
  Icon: React.ComponentType<{ className?: string; size?: number; strokeWidth?: number }>
  isFree: boolean
  tileTone?: 'white' | 'soft' | 'yellow' | 'dark' | 'studio'
  tileShape?: 'circle' | 'rect' | 'diamond' | 'triangle'
  tileLarge?: boolean
  tileWide?: boolean
  tileStudio?: boolean
  tilePro?: boolean
  tileFoot?: string
}

const ADMITLY_NAVY = '#06245B'
const ADMITLY_YELLOW = '#FFE500'

type TileStyleProps = CSSProperties & {
  '--tile-bg'?: string
  '--shape'?: string
  '--dot'?: string
  '--knob'?: string
}

type AdmitlyToolIconProps = {
  className?: string
  size?: number
  strokeWidth?: number
}

const toolIconBase = (size = 18) => ({
  fill: 'none',
  stroke: 'currentColor',
  viewBox: '0 0 24 24',
  strokeWidth: 2.2,
  width: size,
  height: size,
} as const)

function ReaderToolIcon(props: AdmitlyToolIconProps) {
  const width = props.size ?? 18
  return (
    <svg className={props.className} {...toolIconBase(width)}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 10.5v6A2.5 2.5 0 0 0 5.5 19h3.2c.45 0 .8-.36.8-.8V9.8c0-.44-.35-.8-.8-.8H5.5A2.5 2.5 0 0 0 3 11.5ZM18 10.5v6a2.5 2.5 0 0 1-2.5 2.5h-3.2a.8.8 0 0 1-.8-.8V9.8c0-.44.35-.8.8-.8h3.2a2.5 2.5 0 0 1 2.5 2.5ZM9.5 12h5M8 10.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm8 0a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"
      />
    </svg>
  )
}

function StudioToolIcon(props: AdmitlyToolIconProps) {
  const width = props.size ?? 18
  return (
    <svg className={props.className} {...toolIconBase(width)}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h10M18 7h2M4 12h3M11 12h9M4 17h8M16 17h4M14 5v4M7 10v4M12 15v4" />
    </svg>
  )
}

function ThesisToolIcon(props: AdmitlyToolIconProps) {
  const width = props.size ?? 18
  return (
    <svg className={props.className} {...toolIconBase(width)}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.2-5.2m0 0A7.5 7.5 0 1 0 5.2 5.2a7.5 7.5 0 0 0 10.6 10.6Z" />
    </svg>
  )
}

function OutlineToolIcon(props: AdmitlyToolIconProps) {
  const width = props.size ?? 18
  return (
    <svg className={props.className} {...toolIconBase(width)}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6.75h16M4 12h16M4 17.25h16" />
    </svg>
  )
}

function ParagraphToolIcon(props: AdmitlyToolIconProps) {
  const width = props.size ?? 18
  return (
    <svg className={props.className} {...toolIconBase(width)}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.8 15.9 9 18.75l-.8-2.85a4.5 4.5 0 0 0-3.1-3.08L2.25 12l2.85-.82a4.5 4.5 0 0 0 3.1-3.08L9 5.25l.8 2.85a4.5 4.5 0 0 0 3.1 3.08l2.85.82-2.85.82a4.5 4.5 0 0 0-3.1 3.08ZM18 9.75l-.26-1.04a3.38 3.38 0 0 0-2.45-2.45L14.25 6l1.04-.26a3.38 3.38 0 0 0 2.45-2.45L18 2.25l.26 1.04a3.38 3.38 0 0 0 2.45 2.45L21.75 6l-1.04.26a3.38 3.38 0 0 0-2.45 2.45Z"
      />
    </svg>
  )
}

function EvidenceToolIcon(props: AdmitlyToolIconProps) {
  const width = props.size ?? 18
  return (
    <svg className={props.className} {...toolIconBase(width)}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 14.25v-2.63a2.25 2.25 0 0 0-1.32-2.05l-4.5-2.04a2.25 2.25 0 0 0-1.86 0l-4.5 2.04A2.25 2.25 0 0 0 6 11.62v2.63m13.5 0a7.5 7.5 0 1 1-15 0m15 0H4.5"
      />
    </svg>
  )
}

function ConclusionToolIcon(props: AdmitlyToolIconProps) {
  const width = props.size ?? 18
  return (
    <svg className={props.className} {...toolIconBase(width)}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 6.75h15M4.5 12h15M4.5 17.25H12" />
    </svg>
  )
}

function ScoreToolIcon(props: AdmitlyToolIconProps) {
  const width = props.size ?? 18
  return (
    <svg className={props.className} {...toolIconBase(width)}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 18v-5.25m0 0a6 6 0 0 0 1.5-.19m-1.5.19a6 6 0 0 1-1.5-.19m3.75 7.48a12 12 0 0 1-4.5 0M14.25 18v-.2c0-.98.66-1.82 1.51-2.31a7.5 7.5 0 1 0-7.52 0c.85.49 1.51 1.33 1.51 2.31v.2"
      />
    </svg>
  )
}

function PromptFitToolIcon(props: AdmitlyToolIconProps) {
  const width = props.size ?? 18
  return (
    <svg className={props.className} {...toolIconBase(width)}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
    </svg>
  )
}

const TOOLS: ToolMeta[] = [
  {
    id: 'score',
    idx: '08',
    label: 'Full Essay Score',
    actionLabel: 'Run Full Essay Score',
    eyebrow: 'TOOL 09 · SCORE',
    title: 'Rubric Ready.',
    description: 'Get a full readiness review across structure, voice, and specificity.',
    tagline: 'A complete essay view.',
    intro: 'Your final pre-submission diagnostic in one place.',
    maxWords: 1500,
    Icon: ScoreToolIcon,
    isFree: true,
    tileTone: 'dark',
    tileShape: 'diamond',
    tileWide: true,
    tileFoot: 'Free rubric score',
  },
  {
    id: 'reader',
    idx: '01',
    label: 'Reader Simulator',
    actionLabel: 'Run Reader Simulator',
    eyebrow: 'TOOL 01 · READER',
    title: 'Reader Lens.',
    description: 'See how your essay may land with a school teacher.',
    tagline: 'First impression and memorability.',
    intro: 'Preview how a reader likely processes your draft and what you can improve quickly.',
    maxWords: 1500,
    Icon: ReaderToolIcon,
    isFree: true,
    tileTone: 'white',
    tileShape: 'circle',
    tileLarge: true,
    tileFoot: 'Most-used free tool',
  },
  {
    id: 'thesis',
    idx: '03',
    label: 'Thesis Checker',
    actionLabel: 'Check Thesis',
    eyebrow: 'TOOL 03 · THESIS',
    title: 'Sharper Claim.',
    description: 'Check whether your thesis is clear, specific, and debatable.',
    tagline: 'Strengthen your central argument.',
    intro: 'Define the single claim your reader should remember.',
    maxWords: 1500,
    Icon: ThesisToolIcon,
    isFree: true,
    tileTone: 'yellow',
    tileShape: 'triangle',
    tileFoot: 'Fast check',
  },
  {
    id: 'outline',
    idx: '04',
    label: 'Outline Builder',
    actionLabel: 'Build Outline',
    eyebrow: 'TOOL 04 · OUTLINE',
    title: 'Draft Structure.',
    description: 'Turn one prompt into a clear essay plan in one pass.',
    tagline: 'Build cleaner flow quickly.',
    intro: 'Outline a hook-to-conclusion structure before drafting.',
    maxWords: 1500,
    Icon: OutlineToolIcon,
    isFree: true,
    tileTone: 'dark',
    tileShape: 'rect',
    tileFoot: 'Start draft',
  },
  {
    id: 'paragraph',
    idx: '05',
    label: 'Paragraph Fixer',
    actionLabel: 'Open in Admitly',
    eyebrow: 'TOOL 07 · PARAGRAPH',
    title: 'Voice + Clarity.',
    description: 'Polish one paragraph at a time for grammar and specificity.',
    tagline: 'Revise only the part that hurts.',
    intro: 'Identify repetition, vagueness, and weak transitions.',
    maxWords: 400,
    Icon: ParagraphToolIcon,
    isFree: false,
    tileTone: 'white',
    tileShape: 'diamond',
    tileFoot: 'Quick polish',
  },
  {
    id: 'studio',
    idx: '02',
    label: 'Essay Studio',
    actionLabel: 'Open in Admitly',
    eyebrow: 'TOOL 02 · STUDIO',
    title: 'Draft Workspace.',
    description: 'Draft, revise, and track versions inside one workspace.',
    tagline: 'Full writing environment.',
    intro: 'The full production editor for multi-version essay work.',
    maxWords: 1500,
    Icon: StudioToolIcon,
    isFree: false,
    tileTone: 'dark',
    tileShape: 'rect',
    tileStudio: true,
    tilePro: true,
    tileFoot: 'Premium workspace',
  },
  {
    id: 'evidence',
    idx: '06',
    label: 'Evidence Checker',
    actionLabel: 'Open in Admitly',
    eyebrow: 'TOOL 08 · EVIDENCE',
    title: 'Proof Wins.',
    description: 'Find unsupported claims and add concrete proof where needed.',
    tagline: 'Replace claims with real moments.',
    intro: 'Keep claims grounded with examples and details.',
    maxWords: 1500,
    Icon: EvidenceToolIcon,
    isFree: false,
    tileTone: 'soft',
    tileShape: 'circle',
    tileFoot: 'Rubric help',
  },
  {
    id: 'conclusion',
    idx: '07',
    label: 'Conclusion Checker',
    actionLabel: 'Open in Admitly',
    eyebrow: 'TOOL 07 · CONCLUSION',
    title: 'Ending Matters.',
    description: 'Make sure your final lines are memorable and complete.',
    tagline: 'Finish strong.',
    intro: 'Evaluate whether your ending lands clearly and stays in the reader’s memory.',
    maxWords: 1500,
    Icon: ConclusionToolIcon,
    isFree: false,
    tileTone: 'yellow',
    tileShape: 'rect',
    tileFoot: 'Final pass',
  },
  {
    id: 'prompt-fit',
    idx: '09',
    label: 'Prompt Fit',
    actionLabel: 'Open in Admitly',
    eyebrow: 'TOOL 10 · PROMPT FIT',
    title: 'Prompt Focus.',
    description: 'Check whether your draft answers every part of the prompt.',
    tagline: 'Align response to the ask.',
    intro: 'Map prompt asks to your evidence and claim choices.',
    maxWords: 1500,
    Icon: PromptFitToolIcon,
    isFree: false,
    tileTone: 'white',
    tileShape: 'triangle',
    tilePro: true,
    tileFoot: 'High-stakes',
  },
]
const FREE_TOOL_IDS: ReadonlyArray<FreeToolId> = ['score', 'reader', 'thesis', 'outline']
const FREE_TOOLS = TOOLS.filter((tool): tool is ToolMeta & { id: FreeToolId } =>
  FREE_TOOL_IDS.includes(tool.id as FreeToolId),
)
const PREMIUM_TOOLS = TOOLS.filter((tool) => !tool.isFree)

const TOOL_TO_API_BACKEND: Record<FreeToolId, BackendToolId> = {
  reader: 'hook',
  thesis: 'cliche',
  outline: 'aicheck',
  score: 'fullscore',
}

const TOOL_EXECUTION_COPY: Record<
  ToolId,
  {
    inputTitle: string
    inputHint: string
    outputTitle: string
    outputHint: string
    runLabel: string
    miniRows: Array<[string, string]>
  }
> = {
  reader: {
    inputTitle: 'Essay Input',
    inputHint: 'Paste the prompt and essay, then run the reader.',
    outputTitle: 'Reader output',
    outputHint: 'See how a reader may react.',
    runLabel: 'Run Reader',
    miniRows: [
      ['Reader lens', 'High-school reader for first-pass impact'],
      ['Focus', 'Clarity, memorability, and opening strength'],
      ['Output', 'Immediate feedback and top fixes'],
    ],
  },
  studio: {
    inputTitle: 'Essay Studio',
    inputHint: 'Open the full drafting workspace.',
    outputTitle: 'Essay Studio',
    outputHint: 'Multi-tool production workflow.',
    runLabel: 'Open Studio',
    miniRows: [
      ['Workspace', 'Draft, revise, and review essays.'],
      ['Mode', 'Shareable, versioned writing workflow.'],
      ['Output', 'Workspace launch.'],
    ],
  },
  thesis: {
    inputTitle: 'Thesis Input',
    inputHint: 'Paste your intro or opening paragraph.',
    outputTitle: 'Thesis result',
    outputHint: 'See what your central idea should focus on.',
    runLabel: 'Check Thesis',
    miniRows: [
      ['Checks', 'Clarity, specificity, and arguable claim'],
      ['Best for', 'Intro-focused essays and arguments'],
      ['Output', 'Claim quality and rewrite options'],
    ],
  },
  outline: {
    inputTitle: 'Outline Input',
    inputHint: 'Paste your prompt and early draft idea.',
    outputTitle: 'Outline result',
    outputHint: 'Review your full essay structure plan.',
    runLabel: 'Build Outline',
    miniRows: [
      ['Builds', 'Hook, body points, counterpoint, conclusion'],
      ['Best for', 'Prompt interpretation and planning'],
      ['Output', 'Essay map and next-step checklist'],
    ],
  },
  paragraph: {
    inputTitle: 'Paragraph Input',
    inputHint: 'Paste one paragraph you want polished.',
    outputTitle: 'Paragraph fix',
    outputHint: 'Targeted edits for that section.',
    runLabel: 'Fix Paragraph',
    miniRows: [
      ['Fixes', 'Clarity, flow, and repetition'],
      ['Best for', 'One dense paragraph at a time'],
      ['Output', 'Before and after revision notes'],
    ],
  },
  evidence: {
    inputTitle: 'Evidence Input',
    inputHint: 'Paste your essay and mark weak claims.',
    outputTitle: 'Evidence result',
    outputHint: 'Find claims that need stronger support.',
    runLabel: 'Check Evidence',
    miniRows: [
      ['Checks', 'Claim strength and proof quality'],
      ['Best for', 'Argument and analysis essays'],
      ['Output', 'Proof gaps and support suggestions'],
    ],
  },
  conclusion: {
    inputTitle: 'Conclusion Input',
    inputHint: 'Paste your conclusion or final paragraph.',
    outputTitle: 'Conclusion result',
    outputHint: 'Review closure quality and next-step fixes.',
    runLabel: 'Check Conclusion',
    miniRows: [
      ['Checks', 'Closure, reflection, and memorability'],
      ['Best for', 'Ending and last-impression drafts'],
      ['Output', 'Closure score and stronger closer'],
    ],
  },
  score: {
    inputTitle: 'Essay Input',
    inputHint: 'Paste your draft for full readiness scoring.',
    outputTitle: 'Score result',
    outputHint: 'Read your full readiness profile.',
    runLabel: 'Run Score',
    miniRows: [
      ['Checks', 'Structure, voice, and detail balance'],
      ['Best for', 'Final draft validation'],
      ['Output', 'Readiness score and rubric notes'],
    ],
  },
  'prompt-fit': {
    inputTitle: 'Prompt Input',
    inputHint: 'Paste your prompt and a draft response.',
    outputTitle: 'Prompt fit result',
    outputHint: 'See how fully your essay matches asks.',
    runLabel: 'Check Prompt Fit',
    miniRows: [
      ['Checks', 'Prompt asks and response coverage'],
      ['Best for', 'Short-answer and statement drafts'],
      ['Output', 'Coverage score and gaps'],
    ],
  },
}

const TOOL_SIDE_ICONS: Record<ToolId, string> = {
  reader: 'RS',
  studio: 'ES',
  thesis: 'TC',
  outline: 'OB',
  paragraph: 'PF',
  evidence: 'EC',
  conclusion: 'CC',
  score: 'FS',
  'prompt-fit': 'PF',
}

const TOOL_OUTPUT_STATS: Record<ToolId, Array<[string, string]>> = {
  reader: [['First read', 'impact'], ['Hook notes', '2-5'], ['Top fixes', 'clear']],
  studio: [['Workspace', 'drafting'], ['Versions', 'saved'], ['Workflow', 'guided']],
  thesis: [['Claim check', 'focused'], ['Rewrite', 'options'], ['Risk flags', 'clear']],
  outline: [['Essay map', 'planned'], ['Sections', 'ordered'], ['Next steps', 'ready']],
  paragraph: [['Flow fix', 'targeted'], ['Before/after', 'notes'], ['Polish', 'line-level']],
  evidence: [['Proof gaps', 'found'], ['Claim strength', 'scored'], ['Support', 'suggested']],
  conclusion: [['Closure', 'scored'], ['Reflection', 'checked'], ['Stronger end', 'drafted']],
  score: [['Score', '/100'], ['Rubric notes', '4 areas'], ['Priority fixes', '3 steps']],
  'prompt-fit': [['Coverage', 'scored'], ['Missing asks', 'flagged'], ['Prompt fit', 'mapped']],
}

function reviewChipsForTool(rows: Array<[string, string]>): string[] {
  const source = rows[0]?.[1] ?? ''
  return source
    .replace(/\band\b/g, ',')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 4)
}

const DEFAULT_ESSAY_TYPE = 'Common App Personal Statement'
const MIN_WORDS = 50

function isFreeTool(tool: ToolId): tool is FreeToolId {
  return FREE_TOOL_IDS.includes(tool as FreeToolId)
}


function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function clampByWords(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words.length <= maxWords) return text
  return words.slice(0, maxWords).join(' ')
}

type ResultQuality = 'great' | 'okay' | 'needs-work'

function interpretQuality(tool: FreeToolId, result: ScoreResponse['result']): ResultQuality {
  if (tool === 'reader') {
    const s = (result as HookResult).overall_score
    return s === 'strong' ? 'great' : s === 'moderate' ? 'okay' : 'needs-work'
  }
  if (tool === 'thesis') {
    const c = (result as ClicheResult).findings.length
    return c === 0 ? 'great' : c <= 3 ? 'okay' : 'needs-work'
  }
  if (tool === 'score') {
    const s = (result as FullScoreResult).overall_score
    return s >= 85 ? 'great' : s >= 70 ? 'okay' : 'needs-work'
  }
  const s = (result as AiCheckResult).human_score
  return s >= 75 ? 'great' : s >= 50 ? 'okay' : 'needs-work'
}

function shareScore(tool: FreeToolId, result: ScoreResponse['result']): number {
  if (tool === 'reader') {
    const s = (result as HookResult).overall_score
    return s === 'strong' ? 85 : s === 'moderate' ? 65 : 40
  }
  if (tool === 'thesis') return (result as ClicheResult).findings.length
  if (tool === 'score') return (result as FullScoreResult).overall_score
  return (result as AiCheckResult).human_score
}

const SEV_BG: Record<'high' | 'medium' | 'low', string> = {
  high: 'border-admitly-coral/30 bg-admitly-coral/5',
  medium: 'border-fes-blue/30 bg-fes-blue/5',
  low: 'border-admitly-black/10 bg-admitly-black/[0.04]',
}
const SEV_BADGE: Record<'high' | 'medium' | 'low', string> = {
  high: 'bg-admitly-coral/15 text-admitly-coral',
  medium: 'bg-fes-blue/15 text-fes-blue',
  low: 'bg-admitly-black/10 text-admitly-black/70',
}
const SCORE_COLOR: Record<string, string> = {
  strong: 'text-admitly-green',
  moderate: 'text-fes-blue',
  weak: 'text-admitly-coral',
}

function humanScoreColor(n: number) {
  if (n >= 75) return 'text-admitly-green'
  if (n >= 50) return 'text-fes-blue'
  return 'text-admitly-coral'
}
function humanScoreLabel(n: number) {
  if (n >= 80) return 'Reads Human'
  if (n >= 60) return 'Mostly Human'
  if (n >= 40) return 'Mixed Signals'
  if (n >= 20) return 'AI-Like'
  return 'Very AI-Like'
}

function admitlyToolUrl(tool: ToolId, quality?: ResultQuality, source = 'tool_grid') {
  const q = quality ? `&q=${quality}` : ''
  return `https://app.admitly.com/?ref=fes&tool=${tool}&source=${source}${q}`
}

function tileVarsForTool(tool: ToolMeta): TileStyleProps {
  const toneDefaults: Record<NonNullable<ToolMeta['tileTone']>, { '--tile-bg': string; '--shape': string; '--dot': string }> = {
    white: { '--tile-bg': '#ffffff', '--shape': '#edf4ff', '--dot': 'rgba(255,255,255,.55)' },
    soft: { '--tile-bg': '#f8fbff', '--shape': '#edf4ff', '--dot': ADMITLY_YELLOW },
    yellow: { '--tile-bg': '#fff7cc', '--shape': 'rgba(6,36,91,.13)', '--dot': 'rgba(255,255,255,.72)' },
    dark: { '--tile-bg': ADMITLY_NAVY, '--shape': 'rgba(255,255,255,.14)', '--dot': 'rgba(255,255,255,.4)' },
    studio: { '--tile-bg': '#0b347d', '--shape': 'rgba(255,229,0,.14)', '--dot': 'rgba(255,255,255,.18)' },
  }
  const byTool: Partial<Record<ToolId, TileStyleProps>> = {
    reader: { '--shape': '#edf4ff', '--dot': ADMITLY_YELLOW },
    studio: { '--shape': 'rgba(255,229,0,.16)', '--dot': 'rgba(255,255,255,.18)' },
    thesis: { '--shape': 'rgba(6,36,91,.09)', '--dot': 'rgba(255,255,255,.72)' },
    outline: { '--shape': 'rgba(255,229,0,.16)', '--dot': 'rgba(255,255,255,.18)' },
    paragraph: { '--tile-bg': '#ffffff', '--shape': '#fff7cc', '--dot': '#edf4ff' },
    evidence: { '--shape': '#edf4ff', '--dot': ADMITLY_YELLOW },
    conclusion: { '--shape': 'rgba(6,36,91,.08)', '--dot': 'rgba(255,255,255,.72)' },
    score: { '--shape': 'rgba(255,229,0,.15)', '--dot': 'rgba(255,255,255,.16)' },
    'prompt-fit': { '--tile-bg': '#ffffff', '--shape': '#fff7cc', '--dot': '#edf4ff' },
  }
  const tone = tool.tileTone ?? 'white'
  return {
    ...toneDefaults[tone],
    ...(byTool[tool.id] || {}),
  }
}

function tileShapeShape(shape: ToolMeta['tileShape'], toolId?: ToolId) {
  if (shape === 'circle' && toolId === 'evidence') return <circle cx="50" cy="50" r="42" />
  if (shape === 'circle') return <circle cx="50" cy="50" r="50" />
  if (shape === 'diamond') return <path d="M50 0 100 50 50 100 0 50Z" />
  if (shape === 'triangle') return <polygon points="50,0 100,100 0,100" />
  if (shape === 'rect' && toolId === 'outline') return <rect x="10" y="10" width="80" height="80" rx="20" />
  if (shape === 'rect' && toolId === 'conclusion') return <rect x="12" y="12" width="76" height="76" rx="18" />
  if (shape === 'rect') return <rect x="9" y="9" width="82" height="82" rx="24" />
}

function tileGraphic(toolId: ToolId) {
  if (toolId === 'reader') {
    return (
      <div className="toolArt tileViz">
        <div className="bubble">First impression</div>
        <div className="barChart">
          <div className="miniBar" style={{ height: 18 }} />
          <div className="miniBar" style={{ height: 32 }} />
          <div className="miniBar" style={{ height: 24 }} />
        </div>
      </div>
    )
  }
  if (toolId === 'studio') {
    return (
      <div className="toolArt tileViz">
        <div className="sliderArt">
          <div className="slider" style={{ '--knob': '72%' } as CSSProperties}><span style={{ width: '72%' }} /></div>
          <div className="slider" style={{ '--knob': '48%' } as CSSProperties}><span style={{ width: '48%' }} /></div>
          <div className="slider" style={{ '--knob': '84%' } as CSSProperties}><span style={{ width: '84%' }} /></div>
        </div>
        <div className="studioSpark">
          <i />
          <i />
          <i />
        </div>
      </div>
    )
  }
  if (toolId === 'outline') {
    return (
      <div className="toolArt tileViz">
        <div className="nodeChart">
          <span />
          <span />
          <span />
        </div>
        <div className="outlineLines">
          <i />
          <i />
          <i />
        </div>
      </div>
    )
  }
  if (toolId === 'paragraph') {
    return (
      <div className="toolArt tileViz">
        <div className="rewriteCard">
          <span />
          <span />
          <b />
        </div>
      </div>
    )
  }
  if (toolId === 'conclusion') {
    return (
      <div className="toolArt tileViz">
        <div className="flagMark">
          <span />
          <b />
        </div>
        <em>Land it</em>
      </div>
    )
  }
  if (toolId === 'score') {
    return (
      <div className="toolArt tileViz">
        <div className="scoreRing"><span>92</span></div>
        <div className="scoreDash">
          <div className="scoreDashHead">
            <b>Rubric</b>
            <span>A-</span>
          </div>
          <div className="scoreMeters">
            <i style={{ width: '88%' }} />
            <i style={{ width: '76%' }} />
            <i style={{ width: '94%' }} />
          </div>
        </div>
      </div>
    )
  }
  if (toolId === 'thesis') {
    return (
      <div className="toolArt tileViz">
        <div className="targetMark">
          <span />
          <b />
        </div>
        <em>Clear?</em>
      </div>
    )
  }
  if (toolId === 'evidence') {
    return (
      <div className="toolArt tileViz">
        <div className="checkStack">
          <span><i /></span>
          <span><i /></span>
          <span />
        </div>
      </div>
    )
  }
  if (toolId === 'prompt-fit') {
    return (
      <div className="toolArt tileViz">
        <div className="promptCard">
          <span />
          <span />
          <b />
        </div>
      </div>
    )
  }
  return (
    <div className="toolArt">
      <div className="bubble">{toolId === 'prompt-fit' ? 'Missing ask?' : 'Ready'}</div>
    </div>
  )
}

export default function ScorePage() {
  const [activeTool, setActiveTool] = useState<ToolId>('score')
  const [activePane, setActivePane] = useState<'input' | 'output'>('input')
  const [prompt, setPrompt] = useState('')
  const [essay, setEssay] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [quotaExceeded, setQuotaExceeded] = useState(false)
  const [response, setResponse] = useState<ScoreResponse | null>(null)
  const [quota, setQuota] = useState<{ remaining: number; limit: number } | null>(null)
  const [promptOpen, setPromptOpen] = useState(false)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [emailCaptured, setEmailCaptured] = useState(false)
  const [paywallTool, setPaywallTool] = useState<ToolId | null>(null)
  const resultRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    track({ name: 'score_view' })
    fetch('/api/public/score')
      .then((r) => r.json())
      .then((d) => setQuota({ remaining: d.remaining, limit: d.limit }))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (response && resultRef.current) {
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    }
  }, [response])

  useEffect(() => {
    if (response && !emailCaptured) {
      const dismissed = typeof window !== 'undefined' && sessionStorage.getItem('fes_email_dismissed')
      if (!dismissed) {
        const t = setTimeout(() => setShowEmailModal(true), 2000)
        return () => clearTimeout(t)
      }
    }
  }, [response, emailCaptured])

  function clearResults() {
    setResponse(null)
    setError(null)
    setQuotaExceeded(false)
    setActivePane('input')
  }

  function setEssayLimited(value: string, maxWords: number = activeToolMeta.maxWords) {
    setEssay((prev) => {
      const next = clampByWords(value, maxWords)
      if (next === prev) return prev
      return next
    })
  }

  function setPromptLimited(value: string) {
    const next = clampByWords(value, 100)
    setPrompt((prev) => {
      if (next === prev) return prev
      return next
    })
  }

  function handleLimitedPaste(
    event: React.ClipboardEvent<HTMLTextAreaElement>,
    limit: number,
    setter: (value: string) => void,
    currentValue: string,
  ) {
    const pasted = event.clipboardData.getData('text/plain')
    if (!pasted) return
    event.preventDefault()
    const target = event.currentTarget as HTMLTextAreaElement
    const start = target.selectionStart ?? currentValue.length
    const end = target.selectionEnd ?? currentValue.length
    setter(clampByWords(`${currentValue.slice(0, start)}${pasted}${currentValue.slice(end)}`, limit))
  }

  async function handleSubmit() {
    if (!isFreeTool(activeTool)) {
      setPaywallTool(activeTool)
      track({ name: 'paywall_viewed', tool: activeTool, source: 'main_action' })
      return
    }
    setError(null)
    setLoading(true)
    setResponse(null)
    track({ name: 'tool_started', tool: activeTool })
    try {
      const res = await fetch('/api/public/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: TOOL_TO_API_BACKEND[activeTool],
          essay,
          essayType: prompt ? prompt : DEFAULT_ESSAY_TYPE,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.quota_exceeded) {
          setQuotaExceeded(true)
          track({ name: 'quota_exceeded', tool: activeTool })
        }
        if (!data.quota_exceeded) setError(data.error ?? 'Something went wrong')
        if (data.error) track({ name: 'tool_failed', tool: activeTool, meta: { status: res.status } })
        throw new Error(data.error ?? 'Something went wrong')
      }
      setResponse({ tool: activeTool, result: data.result, quota: data.quota })
      setQuota({ remaining: data.quota.remaining, limit: data.quota.limit })
      setActivePane('output')
      track({ name: 'tool_completed', tool: activeTool, quality: interpretQuality(activeTool, data.result) })
    } catch (err) {
      if (!error && response === null) setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  function onSelectTool(nextTool: ToolId) {
    clearResults()
    setActiveTool(nextTool)
    setEssay('')
    setPrompt('')
    setPromptOpen(false)
    setActivePane('input')
    if (isFreeTool(nextTool)) {
      return
    }
    setPaywallTool(nextTool)
    track({ name: 'paywall_viewed', tool: nextTool, source: 'tool_grid' })
  }

  const wc = wordCount(essay)
  const promptWords = wordCount(prompt)
  const activeToolMeta = TOOLS.find((tool) => tool.id === activeTool) ?? TOOLS[0]
  const sideCopy = TOOL_EXECUTION_COPY[activeTool]
  const isActiveFree = isFreeTool(activeTool)
  const canSubmit = isActiveFree && wc >= MIN_WORDS && wc <= activeToolMeta.maxWords && !loading && !quotaExceeded

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="h-14 shrink-0 border-b border-admitly-black/6 bg-white flex items-center justify-between px-3 sm:px-5 z-40">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2.5">
            <FeatherSparkleLogo size={38} />
            <span className="font-display font-extrabold text-[18px] sm:text-[20px] leading-none text-admitly-black tracking-[-0.025em]">
              Free Essay Scorer<span className="text-fes-blue">.</span>
            </span>
          </div>
        </div>

        <div className="inline-flex items-center gap-2 rounded-full bg-fes-blue-soft px-3 sm:px-3.5 py-1.5">
          {quota ? (
            <>
              <div className="flex gap-1" aria-hidden>
                {Array.from({ length: quota.limit }).map((_, i) => (
                  <span
                    key={i}
                    className={[
                      'h-2 w-2 rounded-full transition-colors',
                      i < quota.remaining ? 'bg-fes-blue' : 'bg-fes-blue/20',
                    ].join(' ')}
                  />
                ))}
              </div>
              <span className="text-xs font-bold text-admitly-black tabular-nums">
                {quota.remaining}
              </span>
              <span className="text-xs text-admitly-black/60 hidden sm:inline">left today</span>
            </>
          ) : (
            <span className="text-xs text-admitly-black/60">Checking free quota…</span>
          )}
        </div>
      </header>

      <main className="essayLabPage">
        <div className="pageFrame">
          <section className="toolLevel">
            <div className="toolsShell">
              <div className="tools">
                {TOOLS.map((tool) => (
                  <button
                    key={tool.id}
                    type="button"
                    onClick={() => onSelectTool(tool.id)}
                    className={[
                      'toolTile',
                      tool.tileTone ?? 'white',
                      tool.tileLarge ? 'large' : '',
                      tool.tileWide ? 'wide' : '',
                      tool.id === 'score' ? 'scoreLead' : '',
                      tool.tileStudio || tool.id === 'studio' ? 'studio' : '',
                      activeTool === tool.id ? 'active' : '',
                    ].join(' ')}
                    style={tileVarsForTool(tool)}
                    aria-label={tool.label}
                  >
                    <svg
                      className="bgGraphic"
                      viewBox="0 0 100 100"
                      fill="var(--shape, rgba(6,36,91,.07))"
                      aria-hidden="true"
                      style={{
                        position: 'absolute',
                        right: -18,
                        bottom: -19,
                        width: 82,
                        height: 82,
                        color: 'var(--shape, rgba(6,36,91,.07))',
                        opacity: 0.75,
                        zIndex: 0,
                        pointerEvents: 'none',
                      }}
                    >
                      {tileShapeShape(tool.tileShape, tool.id)}
                    </svg>
                    <div className="toolTop">
                      <span className="toolIcon">
                        <tool.Icon size={18} />
                      </span>
                      {(!tool.isFree || tool.tilePro) && <span className="proPill lock">PRO</span>}
                    </div>
                    <div>
                      <h3>{tool.label}</h3>
                      <p>{tool.description}</p>
                    </div>
                    {tileGraphic(tool.id)}
                    <div className="toolFoot">{tool.tileFoot ?? (tool.isFree ? 'Free tool' : 'Premium tool')}</div>
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="launchArea">
            <aside className="infoPane">
              <div className="staticTitle">
                <div className="staticIcon">{TOOL_SIDE_ICONS[activeTool]}</div>
                <div>
                  <h2>{activeToolMeta.label}</h2>
                  <p>{activeToolMeta.tagline}</p>
                </div>
              </div>

              <p className="staticCopy">{activeToolMeta.intro}</p>

              <div className="toolBrief">
                <div className="briefBlock">
                  <div className="briefLabel">{sideCopy.miniRows[1]?.[0] ?? 'Best for'}</div>
                  <p>{sideCopy.miniRows[1]?.[1] ?? activeToolMeta.tagline}</p>
                </div>

                <div className="briefBlock">
                  <div className="briefLabel">{sideCopy.miniRows[0]?.[0] ?? 'Reviews'}</div>
                  <div className="reviewChips">
                    {reviewChipsForTool(sideCopy.miniRows).map((chip) => (
                      <span key={chip}><CheckIcon size={12} />{chip}</span>
                    ))}
                  </div>
                </div>

                <div className="briefStats" aria-label="Expected output">
                  {TOOL_OUTPUT_STATS[activeTool].map(([label, value]) => (
                    <div className="briefStat" key={label}>
                      <strong>{value}</strong>
                      <span>{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {!isActiveFree && (
                <button className="upgradeCard" type="button" onClick={() => setPaywallTool(activeTool)}>
                  <span><LockIcon size={14} /></span>
                  <strong>Unlock all premium tools</strong>
                  <small>Free analysis is limited to Reader, Thesis, and Outline.</small>
                </button>
              )}
            </aside>

            <section className={`rightAccordion ${activePane === 'output' ? 'outputOpen' : 'inputOpen'}`}>
              <article className="workAcc inputPanel">
                <div className="workHead inputWorkHead">
                  <span className="workNum">1</span>
                  <button type="button" className="workTitle workTitleButton" onClick={() => setActivePane('input')}>
                    <strong>{sideCopy.inputTitle}</strong>
                    <small>{sideCopy.inputHint}</small>
                  </button>
                  <div className="workControls">
                    {isActiveFree && (
                      <button
                        className="runButton headerRunButton"
                        onClick={handleSubmit}
                        disabled={!canSubmit}
                      >
                        {loading ? (
                          <LoadingSpinner />
                        ) : (
                          <span className="inline-flex items-center gap-1.5">
                            {sideCopy.runLabel}
                            <ArrowRight size={14} strokeWidth={2.5} />
                          </span>
                        )}
                      </button>
                    )}
                  </div>
                </div>
                <div className="workBody">
                  {isActiveFree ? (
                    <>
                      <div className={['promptStrip', promptOpen ? 'open' : 'collapsed'].join(' ')}>
                        <button type="button" className="promptToggle" onClick={() => setPromptOpen((open) => !open)}>
                          <span>
                            <b>Optional prompt</b>
                            <small>{promptWords} / 100 words</small>
                          </span>
                          <strong>{promptOpen ? 'Hide' : prompt ? 'Edit prompt' : 'Add prompt'}</strong>
                        </button>
                        {promptOpen && (
                          <textarea
                            value={prompt}
                            onChange={(event) => {
                              setPromptLimited(event.target.value)
                              clearResults()
                            }}
                            onPaste={(event) => handleLimitedPaste(event, 100, setPrompt, prompt)}
                            rows={2}
                            placeholder="Paste the essay prompt or assignment context..."
                          />
                        )}
                      </div>
                      <div className="essayInputWrap">
                        <textarea
                          className="essayInput"
                          value={essay}
                          onChange={(event) => {
                            setEssayLimited(event.target.value, activeToolMeta.maxWords)
                            clearResults()
                          }}
                          onPaste={(event) => handleLimitedPaste(event, activeToolMeta.maxWords, (value) => setEssayLimited(value, activeToolMeta.maxWords), essay)}
                          placeholder={`Paste your essay here (${MIN_WORDS}–${activeToolMeta.maxWords} words)…`}
                        />
                      </div>
                      <span className="essayWordCount">{wc} / {activeToolMeta.maxWords} words</span>
                      </>
                  ) : (
                    <p className="p-4 text-sm text-admitly-black/60">
                      {activeToolMeta.intro}
                    </p>
                  )}
                  {loading && <AnalyzingSkeleton tool={activeTool} />}
                  {isActiveFree && error && !quotaExceeded && (
                    <div className="rounded-2xl border-2 border-admitly-coral/30 bg-admitly-coral/5 px-4 py-3 text-sm text-admitly-coral font-semibold mt-2">
                      {error}
                    </div>
                  )}
                  {isActiveFree && essay.trim() && wc < MIN_WORDS && !loading && (
                    <div className="rounded-2xl border-2 border-fes-blue/30 bg-fes-blue/5 px-4 py-3 text-sm text-fes-blue font-semibold mt-2">
                      Keep going — you need at least {MIN_WORDS} words. You&apos;re at {wc}.
                    </div>
                  )}
                  {quotaExceeded && <QuotaExceededCard />}
                </div>
              </article>

              <article className="workAcc outputPanel">
                <button type="button" className="workHead" onClick={() => setActivePane('output')}>
                  <span className="workNum">2</span>
                  <span className="workTitle">
                    <strong>{sideCopy.outputTitle}</strong>
                    <small>{response ? sideCopy.outputHint : isActiveFree ? 'Run your analysis to view results.' : 'Preview your premium tool on Admitly.'}</small>
                  </span>
                  <span className="workState">{isActiveFree && response ? 'Complete' : 'Ready'}</span>
                </button>
                <div className="workBody outputBody">
                  {isActiveFree ? (
                    <>
                      {response ? (
                        <section ref={resultRef} className="space-y-3 w-full">
                          <ResultPanel response={response} />
                          <ShareAndCta
                            tool={response.tool}
                            quality={interpretQuality(response.tool, response.result)}
                            score={shareScore(response.tool, response.result)}
                          />
                        </section>
                      ) : (
                        <div className="readiness">
                          <div>
                            <span>Output panel</span>
                            <h3>Run a free analysis to unlock output</h3>
                            <p>Paste your essay, click {sideCopy.runLabel}, then your result appears right here.</p>
                          </div>
                          <div className="admitScore">
                            <small>Free checks</small>
                            <b>{quota ? quota.remaining : 0}</b>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="rounded-2xl bg-admitly-black/95 text-white p-4">
                      <p className="text-[10px] font-black tracking-[0.16em] text-white/70 uppercase mb-2 inline-flex items-center gap-1.5">
                        Premium tool preview
                        <LockIcon size={11} />
                      </p>
                      <h3 className="font-display text-2xl sm:text-3xl font-black leading-tight tracking-[-0.025em]">
                        {activeToolMeta.title}
                      </h3>
                      <p className="text-sm text-white/80 mt-2 mb-4">{activeToolMeta.description}</p>
                      <div className="grid sm:grid-cols-2 gap-2.5">
                        <button
                          onClick={() => setPaywallTool(activeTool)}
                          className="inline-flex items-center justify-center gap-2 rounded-full bg-white text-admitly-black font-black text-sm px-5 py-3 hover:bg-white/85 transition-colors"
                        >
                          {activeToolMeta.actionLabel}
                          <ArrowRight size={14} />
                        </button>
                        <a
                          href={admitlyToolUrl(activeTool, 'okay', 'tool_preview')}
                          onClick={() => track({ name: 'cta_admitly_clicked', source: 'tool_preview', tool: activeTool })}
                          className="inline-flex items-center justify-center gap-2 rounded-full bg-admitly-yellow text-admitly-black text-sm font-black px-5 py-3 hover:bg-admitly-yellow-hover transition-colors"
                        >
                          Open on Admitly
                          <ArrowRight size={14} />
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </article>
            </section>
          </section>
        </div>
        <style jsx>{`
          .toolsShell {
            position: relative;
            overflow: visible;
          }
          .toolsShell::before {
            display: none;
          }
          .tools {
            position: relative;
            z-index: 1;
            display: flex;
            gap: 12px;
            overflow-x: auto;
            padding: 3px 0 8px;
            scrollbar-width: thin;
          }
          .toolTile {
            position: relative;
            flex: 0 0 142px;
            width: 142px;
            height: 182px;
            min-height: 0;
            border: 1px solid rgba(6,36,91,.12);
            border-radius: 20px;
            padding: 13px;
            text-align: left;
            cursor: pointer;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            color: ${ADMITLY_NAVY};
            transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease;
            overflow: hidden;
            font-family: inherit;
            background: var(--tile-bg, #fff);
          }
          .toolTile::after {
            content: "";
            position: absolute;
            right: -22px;
            bottom: -22px;
            width: 82px;
            height: 82px;
            border-radius: 28px;
            background: var(--shape, rgba(6,36,91,.06));
            transform: rotate(12deg);
            opacity: .85;
            pointer-events: none;
          }
          .toolTile::before {
            content: "";
            position: absolute;
            right: 12px;
            bottom: 12px;
            width: 28px;
            height: 28px;
            border-radius: 50%;
            background: var(--dot, rgba(255,255,255,.58));
            opacity: .78;
            pointer-events: none;
          }
          .toolTile:hover,
          .toolTile.active {
            transform: translateY(-3px);
            border-color: ${ADMITLY_NAVY};
            box-shadow: 0 18px 42px rgba(6,36,91,.16), 0 0 0 4px rgba(6,36,91,.04);
          }
          .toolTile h3 {
            margin: 16px 0 4px;
            color: inherit;
            font-size: 14px;
            line-height: 1.15;
            font-weight: 900;
            letter-spacing: 0;
          }
          .toolTile p {
            margin: 0;
            color: #64748b;
            font-size: 10px;
            line-height: 1.3;
            font-weight: 700;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
          }
          .toolTile.white { background: linear-gradient(145deg, rgba(255,255,255,.96), rgba(248,251,255,.92)), var(--tile-bg, #fff); }
          .toolTile.soft { background: linear-gradient(145deg, rgba(255,255,255,.78), rgba(239,246,255,.9)), var(--tile-bg, #f8fbff); }
          .toolTile.yellow { background: linear-gradient(145deg, #ffe500, #ffd900); }
          .toolTile.dark,
          .toolTile.studio {
            background: ${ADMITLY_NAVY};
            color: #fff;
            border-color: transparent;
          }
          .toolTile.studio {
            background: linear-gradient(135deg, ${ADMITLY_NAVY} 0%, #0b347d 58%, #102f66 100%);
            box-shadow: 0 18px 42px rgba(6,36,91,.18);
          }
          .toolTile.dark p,
          .toolTile.studio p,
          .toolTile.dark .toolFoot,
          .toolTile.studio .toolFoot {
            color: #fff;
            opacity: .78;
          }
          .toolTile.yellow p,
          .toolTile.yellow .toolFoot { color: ${ADMITLY_NAVY}; }
          .toolTile.large { flex-basis: 184px; width: 184px; }
          .toolTile.wide { flex-basis: 176px; width: 176px; }
          .toolTile.scoreLead {
            flex-basis: 292px;
            width: 292px;
            background: linear-gradient(135deg, ${ADMITLY_NAVY} 0%, #123f8b 54%, #0b2d6f 100%);
            box-shadow: 0 18px 42px rgba(6,36,91,.18);
          }
          .toolTile.scoreLead h3 {
            margin-top: 12px;
          }
          .toolTile.scoreLead p {
            max-width: 252px;
            -webkit-line-clamp: 2;
          }
          .toolTile.studio { flex-basis: 276px; width: 276px; }
          .bgGraphic {
            position: absolute;
            right: -18px;
            bottom: -19px;
            width: 82px;
            height: 82px;
            color: var(--shape, rgba(6,36,91,.07));
            opacity: .75;
            z-index: 0;
            pointer-events: none;
          }
          .toolTop,
          .toolTile h3,
          .toolTile p,
          .toolArt,
          .toolFoot {
            position: relative;
            z-index: 1;
          }
          .toolTop {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 8px;
          }
          .toolIcon {
            width: 32px;
            height: 32px;
            border-radius: 11px;
            display: grid;
            place-items: center;
            background: rgba(255,255,255,.78);
            color: ${ADMITLY_NAVY};
            border: 1px solid rgba(6,36,91,.08);
            box-shadow: 0 9px 22px rgba(15,23,42,.08);
            font-weight: 950;
          }
          .dark .toolIcon,
          .studio .toolIcon,
          .toolTile.dark .toolIcon,
          .toolTile.studio .toolIcon {
            background: rgba(255,255,255,.13);
            border-color: rgba(255,255,255,.14);
            color: #fff;
          }
          .toolIcon svg { width: 17px; height: 17px; }
          .proPill {
            position: relative;
            display: inline-flex;
            align-items: center;
            gap: 5px;
            padding: 5px 8px 5px 20px;
            border-radius: 999px;
            background: ${ADMITLY_NAVY};
            color: #fff;
            font-size: 9px;
            font-weight: 900;
            text-transform: uppercase;
          }
          .proPill.lock {
            padding-left: 20px;
          }
          .proPill.lock::before {
            content: "";
            position: absolute;
            left: 8px;
            top: 10px;
            width: 8px;
            height: 7px;
            border: 1.8px solid currentColor;
            border-radius: 2px;
            box-sizing: border-box;
          }
          .proPill.lock::after {
            content: "";
            position: absolute;
            left: 8.5px;
            top: 5px;
            width: 7px;
            height: 6px;
            border: 1.8px solid currentColor;
            border-bottom: 0;
            border-radius: 6px 6px 0 0;
            box-sizing: border-box;
          }
          .dark .proPill,
          .studio .proPill {
            background: ${ADMITLY_YELLOW};
            color: ${ADMITLY_NAVY};
          }
          .toolFoot {
            flex: 0 0 auto;
            color: #8491a3;
            font-size: 10px;
            font-weight: 900;
            margin-top: 6px;
            line-height: 1.1;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .dark .toolFoot,
          .studio .toolFoot { color: #fff; opacity: .78; }
          .yellow .toolFoot { color: ${ADMITLY_NAVY}; }
          .toolArt {
            height: 42px;
            min-height: 0;
            display: flex;
            align-items: flex-end;
            gap: 7px;
            margin-top: auto;
            padding-top: 10px;
            overflow: hidden;
          }
          .tileViz {
            position: relative;
            display: flex;
            align-items: flex-end;
            gap: 7px;
            width: 100%;
            height: 42px;
          }
          .tileViz em {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-height: 24px;
            padding: 5px 8px;
            border-radius: 999px;
            background: rgba(255,255,255,.72);
            border: 1px solid rgba(6,36,91,.08);
            color: ${ADMITLY_NAVY};
            font-size: 9px;
            line-height: 1;
            font-style: normal;
            font-weight: 950;
            box-shadow: 0 8px 18px rgba(15,23,42,.06);
          }
          .dark .tileViz em,
          .studio .tileViz em {
            background: rgba(255,255,255,.12);
            border-color: rgba(255,255,255,.16);
            color: #fff;
          }
          .feedbackCard,
          .rewriteCard,
          .promptCard {
            position: relative;
            display: grid;
            gap: 4px;
            width: 58px;
            min-height: 36px;
            padding: 8px;
            border-radius: 13px;
            background: rgba(255,255,255,.82);
            border: 1px solid rgba(6,36,91,.08);
            box-shadow: 0 10px 22px rgba(15,23,42,.08);
          }
          .feedbackCard span,
          .rewriteCard span,
          .promptCard span,
          .outlineLines i {
            display: block;
            height: 4px;
            border-radius: 999px;
            background: rgba(6,36,91,.22);
          }
          .feedbackCard span:first-child,
          .rewriteCard span:first-child,
          .promptCard span:first-child,
          .outlineLines i:first-child {
            width: 72%;
            background: ${ADMITLY_NAVY};
          }
          .feedbackCard span:nth-child(2),
          .rewriteCard span:nth-child(2),
          .promptCard span:nth-child(2),
          .outlineLines i:nth-child(2) {
            width: 100%;
          }
          .feedbackCard b,
          .rewriteCard b,
          .promptCard b {
            position: absolute;
            right: 7px;
            bottom: 6px;
            width: 12px;
            height: 12px;
            border-radius: 999px;
            background: ${ADMITLY_YELLOW};
            box-shadow: 0 0 0 4px rgba(255,229,0,.22);
          }
          .rewriteCard b {
            border-radius: 5px;
            background: ${ADMITLY_NAVY};
          }
          .promptCard b {
            width: 14px;
            height: 14px;
            border-radius: 6px;
            background:
              linear-gradient(135deg, transparent 0 38%, #fff 39% 52%, transparent 53%),
              ${ADMITLY_NAVY};
          }
          .barChart {
            display: flex;
            align-items: flex-end;
            gap: 4px;
            height: 28px;
          }
          .miniBar {
            width: 9px;
            border-radius: 999px 999px 4px 4px;
            background: ${ADMITLY_NAVY};
            opacity: .9;
          }
          .bar {
            width: 9px;
            border-radius: 999px 999px 4px 4px;
            background: ${ADMITLY_NAVY};
            opacity: .9;
          }
          .dark .miniBar,
          .studio .miniBar,
          .dark .bar,
          .studio .bar {
            background: ${ADMITLY_YELLOW};
          }
          .miniBars,
          .barChart {
            display: flex;
            align-items: flex-end;
            gap: 4px;
            height: 28px;
          }
          .miniBars i {
            width: 7px;
            border-radius: 999px 999px 4px 4px;
            background: linear-gradient(180deg, ${ADMITLY_NAVY}, #2f6bd9);
          }
          .dark .miniBars i,
          .studio .miniBars i {
            background: ${ADMITLY_YELLOW};
          }
          .toolArt .bubble {
            border-radius: 12px;
            max-width: 116px;
            background: rgba(255,255,255,.8);
            border: 1px solid rgba(6,36,91,.08);
            padding: 5px 7px;
            color: ${ADMITLY_NAVY};
            font-size: 9px;
            line-height: 1.25;
            font-weight: 900;
            box-shadow: 0 8px 18px rgba(15,23,42,.05);
          }
          .toolArt .sliderArt {
            display: grid;
            gap: 7px;
            width: 100%;
            max-width: 138px;
            align-self: center;
          }
          .slider {
            position: relative;
            height: 7px;
            border-radius: 999px;
            background: rgba(255,255,255,.16);
          }
          .slider span {
            display: block;
            height: 100%;
            border-radius: inherit;
            background: ${ADMITLY_YELLOW};
            box-shadow: 0 0 18px rgba(255,229,0,.35);
          }
          .slider::after {
            content: "";
            position: absolute;
            top: 50%;
            left: var(--knob, 70%);
            width: 13px;
            height: 13px;
            border-radius: 999px;
            background: #fff;
            transform: translate(-50%, -50%);
            box-shadow: 0 4px 10px rgba(0,0,0,.18);
          }
          .nodeChart {
            display: flex;
            align-items: center;
            gap: 6px;
            padding-left: 2px;
          }
          .nodeChart span {
            position: relative;
            width: 9px;
            height: 9px;
            border-radius: 999px;
            background: ${ADMITLY_YELLOW};
            box-shadow: 0 0 0 5px rgba(255,229,0,.18);
          }
          .nodeChart span::after {
            content: "";
            position: absolute;
            left: 9px;
            top: 50%;
            width: 13px;
            height: 2px;
            border-radius: 999px;
            background: rgba(255,229,0,.55);
            transform: translateY(-50%);
          }
          .nodeChart span:last-child::after { display: none; }
          .nodeChart {
            margin-bottom: 9px;
          }
          .outlineLines {
            display: grid;
            gap: 4px;
            width: 58px;
            padding: 8px;
            border-radius: 12px;
            background: rgba(255,255,255,.10);
            border: 1px solid rgba(255,255,255,.14);
          }
          .outlineLines i {
            display: block;
            height: 4px;
            border-radius: 999px;
            background: rgba(255,255,255,.34);
          }
          .outlineLines i:first-child {
            background: ${ADMITLY_YELLOW};
          }
          .checkStack {
            display: grid;
            gap: 6px;
            width: 66px;
            padding: 9px;
            border-radius: 13px;
            background: rgba(255,255,255,.84);
            border: 1px solid rgba(6,36,91,.08);
            box-shadow: 0 10px 22px rgba(15,23,42,.07);
          }
          .checkStack span {
            position: relative;
            height: 5px;
            border-radius: 999px;
            background: rgba(6,36,91,.16);
          }
          .checkStack span i {
            position: absolute;
            inset: 0 auto 0 0;
            width: 66%;
            border-radius: inherit;
            background: ${ADMITLY_NAVY};
          }
          .checkStack span:nth-child(2) i {
            width: 82%;
            background: ${ADMITLY_YELLOW};
          }
          .targetMark {
            position: relative;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background:
              radial-gradient(circle, ${ADMITLY_NAVY} 0 5px, transparent 6px),
              radial-gradient(circle, transparent 0 13px, rgba(6,36,91,.20) 14px 16px, transparent 17px),
              radial-gradient(circle, transparent 0 24px, rgba(6,36,91,.15) 25px 27px, transparent 28px);
          }
          .targetMark span {
            position: absolute;
            inset: 8px;
            border-radius: inherit;
            border: 2px solid rgba(6,36,91,.18);
          }
          .targetMark b {
            position: absolute;
            top: 7px;
            right: 4px;
            width: 9px;
            height: 9px;
            border-radius: 50%;
            background: #ef4444;
            box-shadow: 0 0 0 3px rgba(239,68,68,.16);
          }
          .flagMark {
            position: relative;
            width: 44px;
            height: 36px;
            flex: 0 0 auto;
          }
          .flagMark span {
            position: absolute;
            left: 8px;
            top: 3px;
            width: 3px;
            height: 31px;
            border-radius: 999px;
            background: ${ADMITLY_NAVY};
          }
          .flagMark b {
            position: absolute;
            left: 12px;
            top: 5px;
            width: 28px;
            height: 19px;
            border-radius: 5px 12px 12px 5px;
            background: rgba(6,36,91,.12);
            border: 2px solid ${ADMITLY_NAVY};
          }
          .studioSpark {
            display: flex;
            align-items: center;
            gap: 4px;
            margin-left: 2px;
            padding-bottom: 1px;
          }
          .studioSpark i {
            width: 5px;
            height: 5px;
            border-radius: 50%;
            background: rgba(255,255,255,.42);
          }
          .studioSpark i:nth-child(2) {
            background: ${ADMITLY_YELLOW};
            box-shadow: 0 0 12px rgba(255,229,0,.6);
          }
          .scoreRing {
            position: relative;
            width: 31px;
            height: 31px;
            border-radius: 50%;
            display: grid;
            place-items: center;
            background: conic-gradient(${ADMITLY_YELLOW} 0 330deg, rgba(255,255,255,.15) 0);
            box-shadow: 0 8px 18px rgba(0,0,0,.16);
          }
          .scoreRing::before {
            content: "";
            position: absolute;
            inset: 5px;
            width: auto;
            height: auto;
            border-radius: inherit;
            background: ${ADMITLY_NAVY};
          }
          .scoreRing span {
            position: relative;
            z-index: 1;
            color: ${ADMITLY_YELLOW};
            font-size: 11px;
            font-weight: 950;
          }
          .toolTile.yellow .bubble,
          .toolTile.dark .bubble,
          .toolTile.studio .bubble {
            background: rgba(255,255,255,.12);
            border-color: rgba(255,255,255,.16);
            color: #fff;
          }
          .toolTile :global(.toolArt) {
            position: relative;
            z-index: 1;
            flex: 0 0 42px;
            height: 42px;
            min-height: 0;
            display: flex;
            align-items: flex-end;
            gap: 7px;
            margin-top: auto;
            padding-top: 10px;
            overflow: hidden;
          }
          .toolTile.scoreLead :global(.toolArt) {
            flex-basis: 42px;
            height: 42px;
            align-items: flex-end;
            gap: 8px;
            margin-top: auto;
            padding-top: 0;
            max-width: 190px;
          }
          .toolTile :global(.tileViz) {
            width: 100%;
          }
          .toolTile :global(.tileViz em) {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-height: 24px;
            padding: 5px 8px;
            border-radius: 999px;
            background: rgba(255,255,255,.72);
            border: 1px solid rgba(6,36,91,.08);
            color: ${ADMITLY_NAVY};
            font-size: 9px;
            line-height: 1;
            font-style: normal;
            font-weight: 950;
            box-shadow: 0 8px 18px rgba(15,23,42,.06);
          }
          .toolTile.dark :global(.tileViz em),
          .toolTile.studio :global(.tileViz em) {
            background: rgba(255,255,255,.12);
            border-color: rgba(255,255,255,.16);
            color: #fff;
          }
          .toolTile :global(.bubble) {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            max-width: 116px;
            min-height: 24px;
            border-radius: 12px;
            background: rgba(255,255,255,.8);
            border: 1px solid rgba(6,36,91,.08);
            padding: 5px 7px;
            color: ${ADMITLY_NAVY};
            font-size: 9px;
            line-height: 1.25;
            font-weight: 900;
            box-shadow: 0 8px 18px rgba(15,23,42,.05);
          }
          .toolTile.yellow :global(.bubble) {
            background: rgba(255,255,255,.6);
            color: ${ADMITLY_NAVY};
          }
          .toolTile.dark :global(.bubble),
          .toolTile.studio :global(.bubble) {
            background: rgba(255,255,255,.12);
            border-color: rgba(255,255,255,.16);
            color: #fff;
          }
          .toolTile :global(.barChart),
          .toolTile :global(.miniBars) {
            display: flex;
            align-items: flex-end;
            gap: 4px;
            height: 28px;
          }
          .toolTile :global(.miniBar),
          .toolTile :global(.bar),
          .toolTile :global(.miniBars i) {
            width: 9px;
            border-radius: 999px 999px 4px 4px;
            background: ${ADMITLY_NAVY};
            opacity: .9;
          }
          .toolTile :global(.miniBars i) {
            width: 7px;
            background: linear-gradient(180deg, ${ADMITLY_NAVY}, #2f6bd9);
          }
          .toolTile.dark :global(.miniBar),
          .toolTile.studio :global(.miniBar),
          .toolTile.dark :global(.bar),
          .toolTile.studio :global(.bar),
          .toolTile.dark :global(.miniBars i),
          .toolTile.studio :global(.miniBars i) {
            background: ${ADMITLY_YELLOW};
          }
          .toolTile :global(.sliderArt) {
            display: grid;
            gap: 7px;
            width: 100%;
            max-width: 138px;
            align-self: center;
          }
          .toolTile :global(.slider) {
            position: relative;
            height: 7px;
            border-radius: 999px;
            background: rgba(255,255,255,.16);
          }
          .toolTile :global(.slider span) {
            display: block;
            height: 100%;
            border-radius: inherit;
            background: ${ADMITLY_YELLOW};
            box-shadow: 0 0 18px rgba(255,229,0,.35);
          }
          .toolTile :global(.slider::after) {
            content: "";
            position: absolute;
            top: 50%;
            left: var(--knob, 70%);
            width: 13px;
            height: 13px;
            border-radius: 999px;
            background: #fff;
            transform: translate(-50%, -50%);
            box-shadow: 0 4px 10px rgba(0,0,0,.18);
          }
          .toolTile :global(.nodeChart) {
            display: flex;
            align-items: center;
            gap: 6px;
            padding-left: 2px;
            margin-bottom: 9px;
          }
          .toolTile :global(.nodeChart span) {
            position: relative;
            width: 9px;
            height: 9px;
            border-radius: 999px;
            background: ${ADMITLY_YELLOW};
            box-shadow: 0 0 0 5px rgba(255,229,0,.18);
          }
          .toolTile :global(.nodeChart span::after) {
            content: "";
            position: absolute;
            left: 9px;
            top: 50%;
            width: 13px;
            height: 2px;
            border-radius: 999px;
            background: rgba(255,229,0,.55);
            transform: translateY(-50%);
          }
          .toolTile :global(.nodeChart span:last-child::after) {
            display: none;
          }
          .toolTile :global(.feedbackCard),
          .toolTile :global(.rewriteCard),
          .toolTile :global(.promptCard),
          .toolTile :global(.outlineLines),
          .toolTile :global(.checkStack) {
            position: relative;
            display: grid;
            gap: 4px;
            width: 58px;
            min-height: 36px;
            padding: 8px;
            border-radius: 13px;
            background: rgba(255,255,255,.82);
            border: 1px solid rgba(6,36,91,.08);
            box-shadow: 0 10px 22px rgba(15,23,42,.08);
          }
          .toolTile :global(.feedbackCard span),
          .toolTile :global(.rewriteCard span),
          .toolTile :global(.promptCard span),
          .toolTile :global(.outlineLines i) {
            display: block;
            height: 4px;
            border-radius: 999px;
            background: rgba(6,36,91,.22);
          }
          .toolTile :global(.feedbackCard span:first-child),
          .toolTile :global(.rewriteCard span:first-child),
          .toolTile :global(.promptCard span:first-child),
          .toolTile :global(.outlineLines i:first-child) {
            width: 72%;
            background: ${ADMITLY_NAVY};
          }
          .toolTile :global(.feedbackCard span:nth-child(2)),
          .toolTile :global(.rewriteCard span:nth-child(2)),
          .toolTile :global(.promptCard span:nth-child(2)),
          .toolTile :global(.outlineLines i:nth-child(2)) {
            width: 100%;
          }
          .toolTile :global(.feedbackCard b),
          .toolTile :global(.rewriteCard b),
          .toolTile :global(.promptCard b) {
            position: absolute;
            right: 7px;
            bottom: 6px;
            width: 12px;
            height: 12px;
            border-radius: 999px;
            background: ${ADMITLY_YELLOW};
            box-shadow: 0 0 0 4px rgba(255,229,0,.22);
          }
          .toolTile :global(.rewriteCard b) {
            border-radius: 5px;
            background: ${ADMITLY_NAVY};
          }
          .toolTile :global(.promptCard b) {
            width: 14px;
            height: 14px;
            border-radius: 6px;
            background:
              linear-gradient(135deg, transparent 0 38%, #fff 39% 52%, transparent 53%),
              ${ADMITLY_NAVY};
          }
          .toolTile :global(.outlineLines) {
            background: rgba(255,255,255,.10);
            border: 1px solid rgba(255,255,255,.14);
            box-shadow: none;
          }
          .toolTile :global(.outlineLines i) {
            background: rgba(255,255,255,.34);
          }
          .toolTile :global(.outlineLines i:first-child) {
            background: ${ADMITLY_YELLOW};
          }
          .toolTile :global(.checkStack) {
            gap: 6px;
            width: 66px;
            padding: 9px;
          }
          .toolTile :global(.checkStack span) {
            position: relative;
            height: 5px;
            border-radius: 999px;
            background: rgba(6,36,91,.16);
          }
          .toolTile :global(.checkStack span i) {
            position: absolute;
            inset: 0 auto 0 0;
            width: 66%;
            border-radius: inherit;
            background: ${ADMITLY_NAVY};
          }
          .toolTile :global(.checkStack span:nth-child(2) i) {
            width: 82%;
            background: ${ADMITLY_YELLOW};
          }
          .toolTile :global(.scoreRing) {
            position: relative;
            width: 31px;
            height: 31px;
            border-radius: 50%;
            display: grid;
            place-items: center;
            background: conic-gradient(${ADMITLY_YELLOW} 0 330deg, rgba(255,255,255,.15) 0);
            box-shadow: 0 8px 18px rgba(0,0,0,.16);
          }
          .toolTile :global(.scoreRing::before) {
            content: "";
            position: absolute;
            inset: 5px;
            border-radius: inherit;
            background: ${ADMITLY_NAVY};
          }
          .toolTile :global(.scoreRing span) {
            position: relative;
            z-index: 1;
            color: ${ADMITLY_YELLOW};
            font-size: 11px;
            font-weight: 950;
          }
          .toolTile :global(.scoreDash) {
            width: 112px;
            flex: 0 0 112px;
            display: grid;
            gap: 5px;
            padding: 7px;
            border-radius: 12px;
            background: rgba(255,255,255,.10);
            border: 1px solid rgba(255,255,255,.14);
            box-shadow: 0 10px 22px rgba(0,0,0,.10);
          }
          .toolTile :global(.scoreDashHead) {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            color: #fff;
            font-size: 9px;
            line-height: 1;
            font-weight: 950;
          }
          .toolTile :global(.scoreDashHead span) {
            color: ${ADMITLY_YELLOW};
            font-size: 11px;
          }
          .toolTile :global(.scoreMeters) {
            display: grid;
            gap: 4px;
          }
          .toolTile :global(.scoreMeters i) {
            display: block;
            height: 4px;
            border-radius: 999px;
            background: linear-gradient(90deg, ${ADMITLY_YELLOW}, #fff7a8);
            box-shadow: 0 0 12px rgba(255,229,0,.24);
          }
          .toolTile :global(.targetMark) {
            position: relative;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background:
              radial-gradient(circle, ${ADMITLY_NAVY} 0 5px, transparent 6px),
              radial-gradient(circle, transparent 0 13px, rgba(6,36,91,.20) 14px 16px, transparent 17px),
              radial-gradient(circle, transparent 0 24px, rgba(6,36,91,.15) 25px 27px, transparent 28px);
          }
          .toolTile :global(.targetMark span) {
            position: absolute;
            inset: 8px;
            border-radius: inherit;
            border: 2px solid rgba(6,36,91,.18);
          }
          .toolTile :global(.targetMark b) {
            position: absolute;
            top: 7px;
            right: 4px;
            width: 9px;
            height: 9px;
            border-radius: 50%;
            background: #ef4444;
            box-shadow: 0 0 0 3px rgba(239,68,68,.16);
          }
          .toolTile :global(.flagMark) {
            position: relative;
            width: 44px;
            height: 36px;
            flex: 0 0 auto;
          }
          .toolTile :global(.flagMark span) {
            position: absolute;
            left: 8px;
            top: 3px;
            width: 3px;
            height: 31px;
            border-radius: 999px;
            background: ${ADMITLY_NAVY};
          }
          .toolTile :global(.flagMark b) {
            position: absolute;
            left: 12px;
            top: 5px;
            width: 28px;
            height: 19px;
            border-radius: 5px 12px 12px 5px;
            background: rgba(6,36,91,.12);
            border: 2px solid ${ADMITLY_NAVY};
          }
          .toolTile :global(.studioSpark) {
            display: flex;
            align-items: center;
            gap: 4px;
            margin-left: 2px;
            padding-bottom: 1px;
          }
          .toolTile :global(.studioSpark i) {
            width: 5px;
            height: 5px;
            border-radius: 50%;
            background: rgba(255,255,255,.42);
          }
          .toolTile :global(.studioSpark i:nth-child(2)) {
            background: ${ADMITLY_YELLOW};
            box-shadow: 0 0 12px rgba(255,229,0,.6);
          }

          .essayLabPage {
            flex: 1;
            overflow-y: auto;
            padding: 24px;
            background:
              radial-gradient(circle at 92% 4%, rgba(255,229,0,.18), transparent 24%),
              linear-gradient(180deg, #f7faff 0%, #f4f7fb 100%);
            color: #102033;
          }

          .pageFrame {
            max-width: 1440px;
            margin: 0 auto;
            display: grid;
            gap: 16px;
          }

          .toolLevel {
            min-width: 0;
          }

          .launchArea {
            display: grid;
            grid-template-columns: minmax(260px, 320px) minmax(0, 1fr);
            gap: 16px;
            min-height: 520px;
            align-items: stretch;
          }

          .infoPane,
          .workAcc {
            border: 1px solid #d8e4f5;
            border-radius: 22px;
            background: #fff;
            box-shadow: 0 12px 34px rgba(15,23,42,.052);
            overflow: hidden;
          }

          .infoPane {
            padding: 18px;
            position: relative;
            display: flex;
            flex-direction: column;
            gap: 14px;
          }

          .infoPane::after {
            content: "";
            position: absolute;
            right: -62px;
            bottom: -72px;
            width: 190px;
            height: 190px;
            border-radius: 44px;
            background: linear-gradient(135deg, rgba(255,229,0,.22), rgba(237,244,255,.9));
            transform: rotate(13deg);
            z-index: 0;
          }

          .infoPane > * { position: relative; z-index: 1; }

          .staticTitle {
            display: flex;
            align-items: center;
            gap: 12px;
          }

          .staticIcon {
            width: 54px;
            height: 54px;
            border-radius: 17px;
            display: grid;
            place-items: center;
            background: linear-gradient(135deg, #eef4ff, #fffde8);
            color: ${ADMITLY_NAVY};
            font-size: 19px;
            font-weight: 950;
            box-shadow: inset 0 0 0 1px #dfe8f6;
            flex: 0 0 auto;
          }

          .staticTitle h2,
          .workTitle strong {
            display: block;
            margin: 0;
            color: ${ADMITLY_NAVY};
            font-size: 20px;
            line-height: 1.2;
            font-weight: 900;
            letter-spacing: 0;
          }

          .staticTitle p,
          .workTitle small {
            display: block;
            margin: 5px 0 0;
            color: #64748b;
            font: 400 15px/1.75 'DM Sans', system-ui, sans-serif;
          }

          .staticCopy {
            margin: 0;
            color: #64748b;
            font: 400 15px/1.75 'DM Sans', system-ui, sans-serif;
          }

          .toolBrief {
            border: 1px solid #e0e9f6;
            border-radius: 18px;
            background:
              linear-gradient(180deg, rgba(248,251,255,.96), rgba(255,255,255,.98)),
              radial-gradient(circle at 100% 0%, rgba(255,229,0,.22), transparent 45%);
            padding: 12px;
            display: grid;
            gap: 12px;
            box-shadow: inset 0 1px 0 rgba(255,255,255,.72);
          }

          .briefBlock {
            min-width: 0;
          }

          .briefLabel {
            color: ${ADMITLY_NAVY};
            font-size: 11px;
            line-height: 1.2;
            font-weight: 950;
            text-transform: uppercase;
            letter-spacing: .08em;
            margin-bottom: 7px;
          }

          .briefBlock p {
            margin: 0;
            color: #64748b;
            font: 700 15px/1.45 'DM Sans', system-ui, sans-serif;
          }

          .reviewChips {
            display: flex;
            flex-wrap: wrap;
            gap: 7px;
          }

          .reviewChips span {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            min-width: 0;
            border: 1px solid rgba(6,36,91,.1);
            border-radius: 999px;
            background: #fff;
            color: ${ADMITLY_NAVY};
            padding: 6px 8px;
            font-size: 12px;
            line-height: 1;
            font-weight: 850;
            box-shadow: 0 6px 16px rgba(15,23,42,.045);
          }

          .reviewChips svg {
            color: #0f9f6e;
            flex: 0 0 auto;
          }

          .briefStats {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 7px;
          }

          .briefStat {
            min-width: 0;
            border-radius: 13px;
            background: ${ADMITLY_NAVY};
            color: #fff;
            padding: 10px 8px;
          }

          .briefStat strong,
          .briefStat span {
            display: block;
            overflow-wrap: anywhere;
          }

          .briefStat strong {
            color: ${ADMITLY_YELLOW};
            font-size: 13px;
            line-height: 1.1;
            font-weight: 950;
          }

          .briefStat span {
            margin-top: 5px;
            color: rgba(255,255,255,.72);
            font-size: 10px;
            line-height: 1.2;
            font-weight: 800;
          }

          .upgradeCard {
            margin-top: auto;
            border: 0;
            border-radius: 16px;
            background: ${ADMITLY_NAVY};
            color: #fff;
            padding: 15px;
            text-align: left;
            cursor: pointer;
            font-family: inherit;
            box-shadow: 0 14px 30px rgba(6,36,91,.18);
          }

          .upgradeCard span {
            width: 32px;
            height: 32px;
            display: grid;
            place-items: center;
            border-radius: 999px;
            background: ${ADMITLY_YELLOW};
            color: ${ADMITLY_NAVY};
            margin-bottom: 10px;
          }

          .upgradeCard strong,
          .upgradeCard small {
            display: block;
          }

          .upgradeCard strong {
            font-size: 15px;
            color: ${ADMITLY_YELLOW};
          }

          .upgradeCard small {
            color: rgba(255,255,255,.72);
            margin-top: 4px;
            line-height: 1.45;
            font-size: 12px;
          }

          .rightAccordion {
            display: grid;
            gap: 12px;
            min-width: 0;
          }

          .rightAccordion.inputOpen { grid-template-rows: minmax(0, 1fr) auto; }
          .rightAccordion.outputOpen { grid-template-rows: auto minmax(0, 1fr); }

          .workAcc {
            display: flex;
            flex-direction: column;
            min-height: 0;
          }

          .workHead {
            display: grid;
            grid-template-columns: 42px minmax(0, 1fr) minmax(118px, auto);
            align-items: center;
            gap: 12px;
            padding: 14px 16px;
            border: 0;
            border-bottom: 1px solid #e2e8f0;
            min-height: 82px;
            background: #fff;
            text-align: left;
            cursor: pointer;
            font-family: inherit;
          }

          .inputWorkHead {
            cursor: default;
          }

          .workNum {
            width: 34px;
            height: 34px;
            border-radius: 12px;
            display: grid;
            place-items: center;
            background: ${ADMITLY_NAVY};
            color: #fff;
            font-size: 12px;
            font-weight: 950;
          }

          .workTitleButton {
            appearance: none;
            border: 0;
            background: transparent;
            padding: 0;
            text-align: left;
            font-family: inherit;
            cursor: pointer;
            min-width: 0;
          }

          .workControls {
            display: grid;
            justify-items: end;
            align-items: center;
            gap: 7px;
            min-width: 0;
          }

          .workState {
            color: #64748b;
            font-size: 11px;
            font-weight: 900;
            white-space: nowrap;
          }

          .workBody {
            padding: 16px;
            flex: 1;
            min-height: 0;
            display: flex;
            flex-direction: column;
            gap: 12px;
          }

          .inputOpen .outputPanel {
            min-height: 104px;
            flex: 0 0 auto;
          }

          .inputOpen .outputPanel .workHead {
            border-bottom: 0;
          }

          .inputOpen .outputPanel .workBody {
            display: none;
          }

          .inputOpen .outputPanel .workNum,
          .outputOpen .inputPanel .workNum {
            background: #eef4ff;
            color: ${ADMITLY_NAVY};
          }

          .outputOpen .inputPanel {
            min-height: 104px;
          }

          .outputOpen .inputPanel .workHead {
            border-bottom: 0;
          }

          .outputOpen .inputPanel .workBody {
            display: none;
          }

          .outputOpen .outputPanel .workHead {
            display: none;
          }

          .promptStrip {
            border: 1px solid #e1e8f2;
            border-radius: 14px;
            background: #f8fafc;
            padding: 8px 10px;
            color: #526174;
            display: grid;
            gap: 8px;
          }

          .promptToggle {
            appearance: none;
            border: 0;
            background: transparent;
            padding: 0;
            min-width: 0;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            font-family: inherit;
            text-align: left;
            cursor: pointer;
          }

          .promptToggle span,
          .promptToggle b,
          .promptToggle small,
          .promptToggle strong {
            display: block;
          }

          .promptToggle b {
            color: ${ADMITLY_NAVY};
            font-size: 12px;
            line-height: 1.2;
          }

          .promptToggle small {
            color: #64748b;
            font-size: 10px;
            font-weight: 800;
            margin-top: 3px;
          }

          .promptToggle strong {
            border-radius: 999px;
            background: #fff;
            color: ${ADMITLY_NAVY};
            box-shadow: inset 0 0 0 1px rgba(6,36,91,.1);
            padding: 7px 10px;
            font-size: 11px;
            line-height: 1;
            font-weight: 900;
            white-space: nowrap;
          }

          .promptStrip textarea {
            width: 100%;
            min-height: 39px;
            max-height: 62px;
            resize: none;
            overflow-y: auto;
            border: 0;
            outline: 0;
            background: transparent;
            color: #223046;
            font: 400 15px/1.75 'DM Sans', system-ui, sans-serif;
          }

          .essayInputWrap {
            position: relative;
            width: 100%;
            min-height: 260px;
            flex: 1;
            display: flex;
            min-width: 0;
          }

          .essayInput {
            width: 100%;
            min-height: 260px;
            flex: 1;
            resize: none;
            overflow-y: auto;
            border: 1px solid #e2e8f0;
            border-radius: 16px;
            outline: 0;
            padding: 17px;
            color: #223046;
            font: 400 15px/1.75 'DM Sans', system-ui, sans-serif;
            background: #fff;
          }

          .essayWordCount {
            display: block;
            align-self: flex-end;
            margin-top: -4px;
            color: #64748b;
            font-size: 11px;
            line-height: 1;
            font-weight: 400;
          }

          .runButton {
            border: 0;
            border-radius: 14px;
            padding: 13px 18px;
            background: ${ADMITLY_NAVY};
            color: #fff;
            font-size: 13px;
            font-weight: 900;
            cursor: pointer;
            font-family: inherit;
            white-space: nowrap;
          }

          .headerRunButton {
            min-width: 126px;
            padding: 10px 15px;
            border-radius: 13px;
            box-shadow: 0 10px 22px rgba(6,36,91,.15);
          }

          .runButton:disabled {
            opacity: .45;
            cursor: not-allowed;
          }

          .outputBody {
            display: flex;
          }

          .readiness {
            margin: -16px -16px 2px;
            border-radius: 22px 22px 0 0;
            background: ${ADMITLY_NAVY};
            color: #fff;
            padding: 24px 26px;
            min-height: 124px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
          }

          .readiness span {
            color: rgba(255,255,255,.76);
            font-size: 12px;
            font-weight: 800;
          }

          .readiness h3 {
            margin: 0;
            color: #fff;
            font-size: 20px;
            line-height: 1.2;
            letter-spacing: 0;
          }

          .readiness p {
            margin: 5px 0 0;
            color: rgba(255,255,255,.72);
            font: 400 15px/1.75 'DM Sans', system-ui, sans-serif;
          }

          .readiness b {
            color: ${ADMITLY_YELLOW};
            font-size: 46px;
            line-height: 1;
            white-space: nowrap;
          }

          .admitScore {
            min-width: 118px;
            border: 1px solid rgba(255,255,255,.18);
            border-radius: 22px;
            padding: 15px 16px;
            background: rgba(255,255,255,.1);
            text-align: center;
            box-shadow: inset 0 1px 0 rgba(255,255,255,.1);
          }

          .admitScore small {
            display: block;
            color: rgba(255,255,255,.75);
            font-size: 12px;
            font-weight: 900;
            letter-spacing: .15px;
          }

          .admitScore b {
            display: block;
            margin-top: 6px;
            color: ${ADMITLY_YELLOW};
            font-size: 44px;
            line-height: .95;
            font-weight: 950;
          }

          @media (max-width: 1100px) {
            .launchArea {
              grid-template-columns: 1fr;
            }
          }

          @media (max-width: 760px) {
            .essayLabPage {
              padding: 20px;
            }

            .workHead {
              grid-template-columns: 36px minmax(0, 1fr);
            }

            .workControls {
              grid-column: 2;
              justify-items: start;
            }

            .headerRunButton {
              min-width: 0;
            }
          }
        `}</style>
      </main>

      {showEmailModal && response && (
        <EmailCaptureModal
          tool={response.tool}
          onClose={() => {
            setShowEmailModal(false)
            sessionStorage.setItem('fes_email_dismissed', '1')
            track({ name: 'email_dismissed', tool: response.tool })
          }}
          onCaptured={() => {
            setEmailCaptured(true)
            setShowEmailModal(false)
            track({ name: 'email_captured', tool: response.tool })
          }}
        />
      )}
      {paywallTool && (
        <PaywallModal
          toolId={paywallTool}
          onClose={() => setPaywallTool(null)}
        />
      )}
    </div>
  )
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

function LoadingSpinner() {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="inline-block h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
      Analyzing…
    </span>
  )
}

function AnalyzingSkeleton({ tool }: { tool: ToolId }) {
  const labels: Record<FreeToolId, string[]> = {
    reader: ['Reading your opening…', 'Evaluating first impression…', 'Checking for attention grabbers…'],
    thesis: ['Scanning for thesis clarity…', 'Checking specificity and claim strength…', 'Preparing revision guidance…'],
    outline: ['Structuring your draft by prompt…', 'Checking for strong progression…', 'Building a cleaner outline…'],
    score: ['Reading the full draft…', 'Scoring structure and voice…', 'Preparing rubric notes…'],
  }
  const [i, setI] = useState(0)

  useEffect(() => {
    if (!isFreeTool(tool)) return
    const id = setInterval(() => setI((v) => (v + 1) % labels[tool].length), 1400)
    return () => clearInterval(id)
  }, [tool])

  if (!isFreeTool(tool)) return null

  return (
    <div className="rounded-2xl bg-fes-blue-50 border border-fes-blue/20 p-5 space-y-4 mt-5">
      <div className="flex items-center gap-3">
        <span className="inline-block h-5 w-5 rounded-full border-2 border-fes-blue/30 border-t-fes-blue animate-spin" />
        <span className="text-sm font-semibold text-fes-blue">{labels[tool][i]}</span>
      </div>
      <div className="space-y-2">
        <div className="h-3 bg-fes-blue/10 rounded-full w-full animate-pulse" />
        <div className="h-3 bg-fes-blue/10 rounded-full w-5/6 animate-pulse" />
        <div className="h-3 bg-fes-blue/10 rounded-full w-2/3 animate-pulse" />
      </div>
    </div>
  )
}

function QuotaExceededCard() {
  return (
    <div className="rounded-3xl bg-admitly-yellow p-6 sm:p-7 mt-5">
      <div className="inline-flex items-center gap-2 rounded-full bg-admitly-black/10 px-3 py-1 text-xs font-black text-admitly-black">
        <AlertIcon size={13} /> Daily limit reached
      </div>
      <h3 className="text-xl sm:text-2xl font-black mt-3 mb-2 leading-tight text-admitly-black">
        You&apos;ve used all 5 free analyses today.
      </h3>
      <p className="text-admitly-black/70 mb-5 text-sm">
        Come back tomorrow, or unlock all tools and unlimited analyses on Admitly.
      </p>
      <a
        href="https://app.admitly.com"
        onClick={() => track({ name: 'cta_admitly_clicked', source: 'quota_exceeded' })}
        className="inline-flex items-center gap-2 rounded-full bg-admitly-black px-5 py-2.5 text-sm font-black text-white hover:bg-admitly-off-black transition-colors"
      >
        Get unlimited on Admitly <ArrowRight size={14} />
      </a>
    </div>
  )
}

function ResultPanel({ response }: { response: ScoreResponse }) {
  const { tool, result } = response
  if (tool === 'reader') return <HookResultView result={result as HookResult} />
  if (tool === 'thesis') return <ClicheResultView result={result as ClicheResult} />
  if (tool === 'score') return <FullScoreResultView result={result as FullScoreResult} />
  return <AiCheckResultView result={result as AiCheckResult} />
}

function FullScoreResultView({ result }: { result: FullScoreResult }) {
  const scoreClass = result.overall_score >= 85
    ? 'text-admitly-green'
    : result.overall_score >= 70
      ? 'text-fes-blue'
      : 'text-admitly-coral'

  return (
    <section className="space-y-3 animate-in fade-in duration-500">
      <div className="rounded-3xl bg-admitly-black text-white p-6 sm:p-7">
        <div className="text-xs font-black tracking-[0.15em] text-white/60 uppercase">Full essay score</div>
        <div className="flex items-end gap-4 mt-2">
          <span className={['font-display text-7xl sm:text-8xl font-black tabular-nums tracking-[-0.04em]', scoreClass].join(' ')}>
            {result.overall_score}
          </span>
          <div className="pb-4">
            <p className="text-base font-black text-admitly-yellow">{result.readiness_label}</p>
            <p className="text-xs text-white/55">Readiness / 100</p>
          </div>
        </div>
        <div className="w-full bg-white/12 rounded-full h-2 mt-4">
          <div
            className={[
              'h-2 rounded-full transition-all',
              result.overall_score >= 85 ? 'bg-admitly-green' : result.overall_score >= 70 ? 'bg-admitly-yellow' : 'bg-admitly-coral',
            ].join(' ')}
            style={{ width: `${result.overall_score}%` }}
          />
        </div>
        <p className="text-sm text-white/78 mt-4 leading-relaxed">{result.summary}</p>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2">
        {result.rubric.map((item) => (
          <div key={item.category} className="rounded-2xl bg-white border border-admitly-black/10 p-4 sm:p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3 mb-2">
              <h3 className="text-sm font-black text-admitly-black">{item.category}</h3>
              <span className="text-lg font-black text-fes-blue tabular-nums">{item.score}</span>
            </div>
            <div className="h-1.5 rounded-full bg-admitly-black/10 mb-3 overflow-hidden">
              <div className="h-full rounded-full bg-fes-blue" style={{ width: `${item.score}%` }} />
            </div>
            <p className="text-sm text-admitly-black/70">{item.note}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-admitly-mint border border-admitly-green/20 p-4 sm:p-5">
          <div className="text-xs font-black tracking-[0.15em] text-admitly-green uppercase mb-2">Strengths</div>
          <ul className="space-y-2">
            {(result.strengths.length ? result.strengths : ['The draft has a workable foundation.']).map((item) => (
              <li key={item} className="text-sm text-admitly-black/75 font-semibold">{item}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl bg-fes-blue-50 border border-fes-blue/15 p-4 sm:p-5">
          <div className="text-xs font-black tracking-[0.15em] text-fes-blue uppercase mb-2">Priority fixes</div>
          <ul className="space-y-2">
            {(result.priorities.length ? result.priorities : ['Add more specific examples and tighten the reflection.']).map((item) => (
              <li key={item} className="text-sm text-admitly-black/75 font-semibold">{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

function HookResultView({ result }: { result: HookResult }) {
  const tierIdx = result.overall_score === 'weak' ? 0 : result.overall_score === 'moderate' ? 1 : 2
  return (
    <section className="space-y-3 animate-in fade-in duration-500">
      <div className="rounded-3xl bg-fes-blue-50 p-6 sm:p-7 border border-fes-blue/10">
        <div className="text-xs font-black tracking-[0.15em] text-fes-blue uppercase">Hook score</div>
        <div className={['font-display text-5xl sm:text-6xl font-black tracking-[-0.04em] capitalize mt-2', SCORE_COLOR[result.overall_score]].join(' ')}>
          {result.overall_score}
        </div>
        <div className="flex gap-1.5 mt-4" aria-hidden>
          {(['weak', 'moderate', 'strong'] as const).map((label, i) => (
            <div key={label} className="flex-1">
              <div className={[
                'h-1.5 rounded-full transition-all',
                i <= tierIdx
                  ? result.overall_score === 'weak' ? 'bg-admitly-coral' : result.overall_score === 'moderate' ? 'bg-fes-blue' : 'bg-admitly-green'
                  : 'bg-admitly-black/10',
              ].join(' ')} />
              <div className={[
                'text-[10px] font-black uppercase tracking-wider mt-1.5',
                i === tierIdx ? 'text-admitly-black' : 'text-admitly-black/30',
              ].join(' ')}>
                {label}
              </div>
            </div>
          ))}
        </div>
        {result.opening_lines && (
          <blockquote className="border-l-2 border-fes-blue/40 pl-4 text-sm italic text-admitly-black/60 mt-5">
            &ldquo;{result.opening_lines}&rdquo;
          </blockquote>
        )}
      </div>
      <div className="space-y-2">
        {result.findings.map((f, i) => (
          <div key={i} className="rounded-2xl bg-white border border-admitly-black/10 p-4 sm:p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-admitly-black">{f.element}</span>
              <span className={['text-xs font-black uppercase tracking-wide', SCORE_COLOR[f.score]].join(' ')}>{f.score}</span>
            </div>
            <p className="text-sm text-admitly-black/70 mb-3">{f.assessment}</p>
            {f.suggestion && <div className="rounded-xl bg-fes-blue/8 border border-fes-blue/20 px-3 py-2 text-sm text-admitly-black">{f.suggestion}</div>}
          </div>
        ))}
      </div>
      {result.rewrite_suggestion && (
        <div className="rounded-2xl bg-admitly-mint border border-admitly-green/20 p-4 sm:p-5">
          <div className="text-xs font-black tracking-[0.15em] text-admitly-green uppercase mb-2">Suggested rewrite</div>
          <p className="text-sm italic text-admitly-black leading-relaxed">{result.rewrite_suggestion}</p>
        </div>
      )}
    </section>
  )
}

function ClicheResultView({ result }: { result: ClicheResult }) {
  const sevCounts = {
    high: result.findings.filter((f) => f.severity === 'high').length,
    medium: result.findings.filter((f) => f.severity === 'medium').length,
    low: result.findings.filter((f) => f.severity === 'low').length,
  }

  return (
    <section className="space-y-3 animate-in fade-in duration-500">
      <div className="rounded-3xl bg-fes-blue-50 p-6 sm:p-7 border border-fes-blue/10">
        <div className="text-xs font-black tracking-[0.15em] text-fes-blue uppercase">Cliché check</div>
        <div className="flex items-end gap-3 mt-2">
          <span className="font-display text-6xl sm:text-7xl font-black tabular-nums tracking-[-0.04em] text-admitly-black">{result.findings.length}</span>
          <span className="text-lg font-bold text-admitly-black/40 pb-3">
            {result.findings.length === 1 ? 'issue found' : 'issues found'}
          </span>
        </div>
        {result.findings.length > 0 && (
          <div className="flex items-center gap-3 mt-4 text-xs">
            {sevCounts.high > 0 && <span className="inline-flex items-center gap-1.5 font-bold text-admitly-coral"><span className="w-2 h-2 rounded-full bg-admitly-coral" /> {sevCounts.high} high</span>}
            {sevCounts.medium > 0 && <span className="inline-flex items-center gap-1.5 font-bold text-fes-blue"><span className="w-2 h-2 rounded-full bg-fes-blue" /> {sevCounts.medium} medium</span>}
            {sevCounts.low > 0 && <span className="inline-flex items-center gap-1.5 font-bold text-admitly-black/50"><span className="w-2 h-2 rounded-full bg-admitly-black/30" /> {sevCounts.low} low</span>}
          </div>
        )}
      </div>
      {result.findings.length === 0 ? (
        <div className="rounded-2xl bg-admitly-mint border border-admitly-green/20 p-5">
          <div className="flex items-center gap-2">
            <CheckIcon size={18} className="text-admitly-green" />
            <p className="text-sm font-bold text-admitly-green">No significant clichés detected</p>
          </div>
          <p className="text-sm text-admitly-black/70 mt-1">Your essay feels fresh and specific.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {result.findings.map((f, i) => (
            <div key={i} className={['rounded-2xl border p-4 sm:p-5 space-y-2', SEV_BG[f.severity]].join(' ')}>
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-bold text-admitly-black flex-1">&ldquo;{f.phrase}&rdquo;</p>
                <span className={['text-[10px] font-black uppercase tracking-wide rounded-full px-2 py-1 shrink-0', SEV_BADGE[f.severity]].join(' ')}>{f.severity}</span>
              </div>
              {f.context_sentence && <p className="text-xs text-admitly-black/50 italic border-l-2 border-admitly-black/20 pl-3">&ldquo;{f.context_sentence}&rdquo;</p>}
              <p className="text-sm text-admitly-black/80">{f.why_problem}</p>
              {f.replacement && <div className="rounded-xl bg-white border border-admitly-black/10 px-3 py-2 mt-2"><div className="text-[10px] font-black tracking-wide uppercase text-admitly-black/50 mb-1">Try instead</div><p className="text-sm text-admitly-black">{f.replacement}</p></div>}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function AiCheckResultView({ result }: { result: AiCheckResult }) {
  return (
    <section className="space-y-3 animate-in fade-in duration-500">
      <div className="rounded-3xl bg-fes-blue-50 p-6 sm:p-7 border border-fes-blue/10">
        <div className="flex items-start justify-between mb-3">
          <div className="text-xs font-black tracking-[0.15em] text-fes-blue uppercase">AI check</div>
          <span className={['text-[10px] font-black uppercase tracking-wide rounded-full px-2 py-1', SEV_BADGE[result.overall_risk]].join(' ')}>
            {result.overall_risk} risk
          </span>
        </div>
        <div className="flex items-end gap-3">
          <span className={['font-display text-7xl sm:text-8xl font-black tabular-nums tracking-[-0.04em]', humanScoreColor(result.human_score)].join(' ')}>
            {result.human_score}
          </span>
          <div className="pb-3">
            <p className={['text-base font-bold', humanScoreColor(result.human_score)].join(' ')}>{humanScoreLabel(result.human_score)}</p>
            <p className="text-xs text-admitly-black/50">Human score / 100</p>
          </div>
        </div>
        <div className="w-full bg-admitly-black/10 rounded-full h-2 mt-4">
          <div
            className={['h-2 rounded-full transition-all', result.human_score >= 75 ? 'bg-admitly-green' : result.human_score >= 50 ? 'bg-fes-blue' : 'bg-admitly-coral'].join(' ')}
            style={{ width: `${result.human_score}%` }}
          />
        </div>
        <p className="text-sm text-admitly-black/80 mt-4">{result.summary}</p>
      </div>
      {result.flags.length === 0 ? (
        <div className="rounded-2xl bg-admitly-mint border border-admitly-green/20 p-5">
          <div className="flex items-center gap-2">
            <CheckIcon size={18} className="text-admitly-green" />
            <p className="text-sm font-bold text-admitly-green">No AI patterns detected</p>
          </div>
          <p className="text-sm text-admitly-black/70 mt-1">This essay reads as authentically human.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="text-xs font-black tracking-[0.15em] text-admitly-black/50 uppercase">
            {result.flags.length} pattern{result.flags.length !== 1 ? 's' : ''} flagged
          </div>
          {result.flags.map((f, i) => (
            <div key={i} className={['rounded-2xl border p-4 sm:p-5 space-y-2', SEV_BG[f.risk]].join(' ')}>
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-bold text-admitly-black flex-1">&ldquo;{f.passage}&rdquo;</p>
                <span className={['text-[10px] font-black uppercase tracking-wide rounded-full px-2 py-1 shrink-0', SEV_BADGE[f.risk]].join(' ')}>{f.risk}</span>
              </div>
              <p className="text-sm text-admitly-black/80">{f.reason}</p>
              {f.humanization && <div className="rounded-xl bg-white border border-admitly-black/10 px-3 py-2 mt-2"><div className="text-[10px] font-black tracking-wide uppercase text-admitly-black/50 mb-1">Make it more human</div><p className="text-sm text-admitly-black">{f.humanization}</p></div>}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function ShareAndCta({ tool, quality, score }: { tool: FreeToolId; quality: ResultQuality; score: number }) {
  const [copied, setCopied] = useState(false)
  const shareUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const shareText = shareMessage(tool, score)

  async function onShare() {
    track({ name: 'share_clicked', tool, quality })
    const payload = { title: 'Free Essay Scorer', text: shareText, url: shareUrl }
    if (typeof navigator !== 'undefined' && navigator.share) {
      try { await navigator.share(payload); return } catch {}
    }
    try {
      await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2400)
    } catch {}
  }

  const cta = {
    'needs-work': { title: 'Your essay needs work — and that&apos;s fixable.', sub: 'Get matched with an Admitly counselor to tighten it.', label: 'Work with a counselor' },
    okay: { title: 'Good start — room to go from okay to standout.', sub: 'Unlock premium tools and counselor review on Admitly.', label: 'Level up on Admitly' },
    great: { title: 'Nice work. Now polish it to perfect.', sub: 'An Admitly counselor can help you make it memorable.', label: 'Get human review' },
  }[quality]

  return (
    <div className="space-y-3">
      <button
        onClick={onShare}
        className="w-full flex items-center justify-between rounded-2xl bg-white border border-admitly-black/10 hover:border-admitly-black/30 px-4 py-3.5 shadow-sm transition-colors"
      >
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-admitly-black">
          <ShareIcon size={16} className="text-admitly-black/50" />
          {copied ? 'Copied!' : 'Share this score'}
        </span>
        <span className="text-xs font-bold tracking-wide text-admitly-black/40 uppercase">{copied ? '✓' : 'Tap to share'}</span>
      </button>

      <PremiumInsightsTeaser tool={tool} quality={quality} />

      <div className="rounded-3xl bg-admitly-yellow p-6 sm:p-8 relative overflow-hidden">
        <div className="relative">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-admitly-black px-3 py-1 text-[10px] font-black tracking-[0.12em] uppercase text-admitly-yellow mb-4">
            <SparkleIcon size={11} /> Admitly Premium
          </div>
          <h3 className="font-display text-2xl sm:text-3xl font-black leading-[1.1] tracking-[-0.02em] mb-2 text-admitly-black">{cta.title}</h3>
          <p className="text-sm text-admitly-black/70 mb-5 leading-relaxed">{cta.sub}</p>
          <ul className="space-y-2 mb-6">
            <li className="flex items-start gap-2.5 text-sm text-admitly-black">
              <span className="w-5 h-5 rounded-full bg-admitly-black flex items-center justify-center shrink-0 mt-0.5">
                <CheckIcon size={11} className="text-admitly-yellow" strokeWidth={3} />
              </span>
              <span className="font-semibold">Unlimited analyses across all 11 tools</span>
            </li>
            <li className="flex items-start gap-2.5 text-sm text-admitly-black">
              <span className="w-5 h-5 rounded-full bg-admitly-black flex items-center justify-center shrink-0 mt-0.5">
                <CheckIcon size={11} className="text-admitly-yellow" strokeWidth={3} />
              </span>
              <span className="font-semibold">Reader Simulator &amp; full studio workflow</span>
            </li>
            <li className="flex items-start gap-2.5 text-sm text-admitly-black">
              <span className="w-5 h-5 rounded-full bg-admitly-black flex items-center justify-center shrink-0 mt-0.5">
                <CheckIcon size={11} className="text-admitly-yellow" strokeWidth={3} />
              </span>
              <span className="font-semibold">Counselor review and launch-ready edits</span>
            </li>
          </ul>
          <a
            href={`https://app.admitly.com?ref=fes&tool=${tool}&q=${quality}`}
            onClick={() => track({ name: 'cta_admitly_clicked', source: 'result_cta', tool, quality })}
            className="group inline-flex items-center justify-center gap-2 rounded-full bg-admitly-black px-6 py-3.5 text-sm font-black text-white hover:bg-admitly-off-black transition-all w-full sm:w-auto shadow-[0_4px_14px_rgba(0,0,0,0.2)]"
          >
            {cta.label}
            <ArrowRight size={15} strokeWidth={2.5} className="group-hover:translate-x-0.5 transition-transform" />
          </a>
          <p className="text-xs text-admitly-black/50 mt-3 font-semibold">Free to start · No credit card required</p>
        </div>
      </div>
    </div>
  )
}

function PremiumInsightsTeaser({ tool, quality }: { tool: FreeToolId; quality: ResultQuality }) {
  const previews = PREMIUM_TOOLS.slice(0, 4).map((t) => ({
    id: t.id,
    label: t.label,
    tagline: t.tagline,
    blurb: t.description,
    Icon: t.Icon,
  }))
  return (
    <div className="rounded-3xl bg-admitly-black text-white p-6 sm:p-7 relative overflow-hidden">
      <div className="flex items-start justify-between mb-4 gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 text-white px-3 py-1 text-[10px] font-black tracking-[0.12em] uppercase mb-2">
            <LockIcon size={10} /> More tools on Admitly
          </div>
          <h3 className="font-display text-xl sm:text-2xl font-black leading-tight tracking-[-0.02em]">Premium tools your essay can try next</h3>
        </div>
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2 mb-5">
        {previews.map((p) => (
          <div key={p.id} className="rounded-2xl bg-white/5 border border-white/10 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="rounded-lg bg-white/10 p-1.5 text-white"><p.Icon size={15} /></div>
              <span className="text-sm font-black">{p.label}</span>
            </div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-white/50 mb-1.5">{p.tagline}</p>
            <p className="text-xs text-white/70 leading-relaxed">{p.blurb}</p>
          </div>
        ))}
      </div>
      <a
        href={`https://app.admitly.com?ref=fes&source=premium_teaser&tool=${tool}&q=${quality}`}
        onClick={() => track({ name: 'cta_admitly_clicked', source: 'premium_teaser', tool, quality })}
        className="group inline-flex items-center justify-center gap-2 rounded-full bg-admitly-yellow hover:bg-admitly-yellow-hover px-5 py-3 text-sm font-black text-admitly-black transition-colors"
      >
        Unlock on Admitly
        <ArrowRight size={14} strokeWidth={2.5} className="group-hover:translate-x-0.5 transition-transform" />
      </a>
    </div>
  )
}

function shareMessage(tool: FreeToolId, score: number): string {
  if (tool === 'reader') {
    if (score >= 80) return `Just scored my college essay opening: strong hook!`
    if (score >= 60) return `My college essay hook scored "moderate" — room to level up`
    return `My college essay hook needs work. Let’s fix this`
  }
  if (tool === 'thesis') {
    if (score === 0) return `My college essay has zero clichés.`
    return `Found ${score} clichéd phrases in my college essay.`
  }
  if (tool === 'score') {
    return `My college essay readiness score is ${score}/100.`
  }
  return `My college essay scored ${score}/100 on human-voice.`
}

function EmailCaptureModal({
  tool, onClose, onCaptured,
}: { tool: FreeToolId; onClose: () => void; onCaptured: () => void }) {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function submit() {
    setErr(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/public/capture-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, firstTool: tool, source: 'result_modal' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setSuccess(true)
      setTimeout(onCaptured, 1500)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-admitly-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div className="relative rounded-[1.75rem] bg-white max-w-md w-full p-7 shadow-2xl animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-admitly-black/40 hover:text-admitly-black text-lg" aria-label="Close">✕</button>
        {success ? (
          <div className="text-center py-4">
            <CheckIcon size={40} className="text-admitly-green mx-auto mb-3" />
            <h3 className="text-2xl font-black text-admitly-black mb-2">You&apos;re in!</h3>
            <p className="text-sm text-admitly-black/60">We&apos;ll send your analysis tips soon.</p>
          </div>
        ) : (
          <>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-fes-blue-soft px-3 py-1 text-xs font-black text-fes-blue mb-3">
              <SparkleIcon size={12} /> FREE TIPS
            </div>
            <h3 className="text-2xl font-black text-admitly-black mb-2 leading-tight">Want more essay tips?</h3>
            <p className="text-sm text-admitly-black/60 mb-5">Weekly tips on writing essays that stand out — and we&apos;ll save this analysis to your inbox.</p>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@school.edu"
              className="w-full rounded-full border border-admitly-black/10 bg-admitly-cream px-5 py-3 text-sm font-semibold text-admitly-black placeholder:text-admitly-black/30 focus:outline-none focus:border-fes-blue focus:bg-white mb-3 transition-colors"
              autoFocus
            />
            {err && <p className="text-sm text-admitly-coral mb-3">{err}</p>}
            <button
              onClick={submit}
              disabled={!email || submitting}
              className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-fes-blue px-6 py-3.5 text-base font-black text-white hover:bg-fes-blue-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? 'Saving…' : <>Send me tips <ArrowRight size={16} /></>}
            </button>
            <button
              onClick={onClose}
              className="w-full mt-3 text-xs font-semibold text-admitly-black/40 hover:text-admitly-black"
            >
              No thanks, I&apos;m good
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function PaywallModal({
  toolId,
  generic,
  onClose,
}: { toolId?: ToolId; generic?: boolean; onClose: () => void }) {
  const tool = toolId ? TOOLS.find((item) => item.id === toolId) : null
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  if (!tool && !generic) return null

  const heading = tool?.label ?? 'Free Admitly Credits'
  const eyebrow = tool ? 'Premium Tool' : 'Free Credits'
  const subcopy = tool
    ? `${tool.tagline}. Drop your email and we’ll send you free credits to unlock it.`
    : 'Unlock premium tools, full counselor feedback, and unlimited analyses.'
  const identifier = tool ? toolId! : 'credits'

  async function submit() {
    setErr(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/public/capture-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, firstTool: identifier, source: tool ? 'paywall_modal' : 'credits_modal' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to save')
      setSuccess(true)
      track({ name: tool ? 'paywall_cta_clicked' : 'credits_modal_submitted', tool: identifier, source: tool ? 'paywall_modal' : 'credits_modal' })
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSubmitting(false)
    }
  }

  function dismiss() {
    track({ name: tool ? 'paywall_dismissed' : 'credits_modal_dismissed', tool: identifier })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-admitly-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={dismiss}>
      <div className="relative rounded-[1.75rem] bg-white max-w-md w-full p-6 sm:p-7 shadow-2xl animate-in zoom-in-95 duration-200 text-center" onClick={(e) => e.stopPropagation()}>
        <button onClick={dismiss} className="absolute top-4 right-4 text-admitly-black/40 hover:text-admitly-black text-lg" aria-label="Close">✕</button>
        {success ? (
          <div className="py-4">
            <div className="w-14 h-14 rounded-2xl bg-admitly-mint mx-auto mb-4 flex items-center justify-center text-admitly-green">
              <CheckIcon size={28} strokeWidth={3} />
            </div>
            <h3 className="font-display text-2xl font-black text-admitly-black mb-2 tracking-tight">You&apos;re on the list</h3>
            <p className="text-sm text-admitly-black/60 leading-relaxed">
              We&apos;ll email free Admitly credits to unlock <span className="font-bold text-admitly-black">{heading}</span> as soon as they&apos;re ready.
            </p>
            <button
              onClick={onClose}
              className="mt-5 text-xs font-bold text-admitly-black/50 hover:text-admitly-black underline"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <div className="w-14 h-14 rounded-2xl bg-fes-blue-soft text-fes-blue mx-auto mb-4 flex items-center justify-center">
              <LockIcon size={26} strokeWidth={2} />
            </div>
            <p className="text-[10px] font-black tracking-[0.18em] text-fes-blue uppercase mb-1.5">{eyebrow}</p>
            <h3 className="font-display text-2xl font-black text-admitly-black mb-2 leading-tight tracking-tight">{heading}</h3>
            <p className="text-sm text-admitly-black/60 mb-6 leading-relaxed">{subcopy}</p>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@school.edu"
              className="w-full rounded-full border border-admitly-black/10 bg-admitly-cream px-5 py-3 text-sm font-semibold text-admitly-black placeholder:text-admitly-black/30 focus:outline-none focus:border-fes-blue focus:bg-white mb-3 transition-colors text-center"
              autoFocus
              onKeyDown={(event) => {
                if (event.key === 'Enter' && email && !submitting) submit()
              }}
            />
            {err && <p className="text-xs text-admitly-coral mb-3 font-semibold">{err}</p>}
            <button
              onClick={submit}
              disabled={!email || submitting}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-fes-blue hover:bg-fes-blue-hover px-6 py-3 text-sm font-black text-white transition-colors w-full mb-3 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {submitting ? 'Saving…' : <>Send me free credits <ArrowRight size={14} strokeWidth={2.5} /></>}
            </button>
            <button onClick={dismiss} className="text-xs font-semibold text-admitly-black/50 hover:text-admitly-black underline">
              {tool ? 'Stay on free tools' : 'Maybe later'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
