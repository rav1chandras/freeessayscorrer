import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'

export async function GET() {
  let buildTime = 'unknown'
  try {
    buildTime = (await fs.readFile('/app/.build-timestamp', 'utf8')).trim()
  } catch {
    // local dev
  }

  return NextResponse.json({
    ok: true,
    product: 'freeessayscorer',
    buildTime,
    version: '2026-04-19-split-layout',
    routes: {
      home: '/',
      admin: '/admin',
    },
    api: {
      score: '/api/public/score',
      emailCapture: '/api/public/capture-email',
      track: '/api/public/track',
      ogShare: '/api/og/score',
      adminAuth: '/api/admin/auth',
      adminData: '/api/admin/data',
    },
  })
}
