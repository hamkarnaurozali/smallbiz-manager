import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import en from '../i18n/en.js'

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? (f === 'test' ? [] : walk(p)) : /\.(jsx?|js)$/.test(f) ? [p] : []
  })
}

describe('i18n', () => {
  it('every t(...) key used in the source exists in en.js', () => {
    const missing = new Set()
    for (const file of walk(new URL('..', import.meta.url).pathname)) {
      const src = readFileSync(file, 'utf8')
      for (const m of src.matchAll(/\bt\(\s*['"`]([a-zA-Z0-9_.]+)['"`]/g)) if (!(m[1] in en)) missing.add(`${file}: ${m[1]}`)
      for (const m of src.matchAll(/'((?:err|f|nav|dash|sales|exp|prod|rep|settings|common|app)\.[a-zA-Z0-9_.]+)'/g)) if (!(m[1] in en)) missing.add(`${file}: ${m[1]}`)
    }
    expect([...missing]).toEqual([])
  })
})
