import { cp, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

async function copyIfExists(from, to) {
  if (!existsSync(from)) return
  await mkdir(path.dirname(to), { recursive: true })
  await cp(from, to, { recursive: true, force: true })
}

await copyIfExists('.next/static', '.next/standalone/.next/static')
await copyIfExists('public', '.next/standalone/public')
