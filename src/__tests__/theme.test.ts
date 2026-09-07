import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf-8')

/** Returns the body of the first `@theme <suffix> { ... }` block. */
function themeBlock(suffix = ''): string {
  const header = `@theme ${suffix}`.trim() + ' {'
  const start = css.indexOf(header)
  if (start === -1) throw new Error(`no ${header} in index.css`)

  let depth = 0
  for (let i = start + header.length - 1; i < css.length; i += 1) {
    if (css[i] === '{') depth += 1
    else if (css[i] === '}') {
      depth -= 1
      if (depth === 0) return css.slice(start + header.length, i)
    }
  }
  throw new Error(`unbalanced braces in ${header}`)
}

function colorNames(block: string): string[] {
  return [...block.matchAll(/^\s*(--color-[\w-]+)\s*:/gm)].map((m) => m[1])
}

describe('theme tokens', () => {
  /*
   * shadcn names a wash `muted` and a hover tint `accent`; this palette uses
   * those words for grey text and the brand blue. Redefining one in terms of
   * the other silently repaints every existing usage, which is invisible in
   * jsdom and shows up only in the browser.
   */
  it('never lets the shadcn layer redefine a palette colour', () => {
    const palette = colorNames(themeBlock())
    const shadcn = colorNames(themeBlock('inline'))
    const collisions = shadcn.filter((name) => palette.includes(name))

    expect(collisions).toEqual([])
  })

  it('keeps the palette colours resolvable to literals, not to each other', () => {
    for (const declaration of themeBlock().split(';')) {
      const [name, value] = declaration.split(':').map((part) => part.trim())
      if (!name?.startsWith('--color-')) continue
      expect(value, `${name} must be a literal colour`).toMatch(/^#|^oklch|^rgb/)
    }
  })
})
