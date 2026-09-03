/**
 * I temi sono l'unica parte della grafica che si possa verificare in modo
 * oggettivo: il contrasto è un numero. Questo test legge davvero il CSS, così
 * un tema aggiunto in futuro con testo illeggibile non passa in silenzio.
 */

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { THEMES } from '../src/store/persist'

const css = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8')

function palette(theme: string): Record<string, string> {
  const block = new RegExp(`\\[data-theme='${theme}'\\]\\s*\\{([^}]*)\\}`).exec(css)
  if (block === null) throw new Error(`tema senza blocco CSS: ${theme}`)
  const tokens: Record<string, string> = {}
  for (const [, name, value] of block[1].matchAll(/--([\w-]+):\s*([^;]+);/g)) {
    tokens[name] = value.trim()
  }
  return tokens
}

const channel = (hex: string, at: number): number => {
  const v = parseInt(hex.slice(at, at + 2), 16) / 255
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}

const luminance = (hex: string): number =>
  0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5)

/** Rapporto di contrasto WCAG fra due colori. */
function contrast(a: string, b: string): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (high + 0.05) / (low + 0.05)
}

describe('contrasto dei temi', () => {
  it('ogni tema dichiarato ha il suo blocco di colori', () => {
    for (const theme of THEMES) expect(Object.keys(palette(theme)).length).toBeGreaterThan(8)
  })

  it('il testo principale è leggibile su ogni sfondo', () => {
    for (const theme of THEMES) {
      const p = palette(theme)
      expect(contrast(p.text, p.bg), `testo del tema ${theme}`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('anche il testo secondario resta leggibile: le note sono in corpo piccolo', () => {
    for (const theme of THEMES) {
      const p = palette(theme)
      expect(contrast(p.muted, p.bg), `testo secondario del tema ${theme}`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('i colori di stato si leggono sullo sfondo', () => {
    for (const theme of THEMES) {
      const p = palette(theme)
      for (const token of ['ok', 'warn', 'bad', 'accent']) {
        expect(contrast(p[token], p.bg), `${token} del tema ${theme}`).toBeGreaterThanOrEqual(4.5)
      }
    }
  })

  it('la scritta sul pulsante principale si legge sul suo fondo', () => {
    for (const theme of THEMES) {
      const p = palette(theme)
      expect(contrast(p['on-accent'], p.accent), `pulsante del tema ${theme}`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('i bordi si distinguono dallo sfondo, altrimenti i riquadri spariscono', () => {
    for (const theme of THEMES) {
      const p = palette(theme)
      expect(contrast(p.line, p.bg), `bordi del tema ${theme}`).toBeGreaterThanOrEqual(1.4)
    }
  })
})
