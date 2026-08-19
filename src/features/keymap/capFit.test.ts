import { describe, it, expect } from 'vitest'
import { fitLines } from './capFit'

// A 1u cap is 58px in the standalone specimen; board caps are ~60px.
const CAP = 58

describe('fitLines', () => {
  it('short label: one line at the top of the ladder', () => {
    expect(fitLines('A', CAP, CAP)).toEqual({ lines: ['A'], fontSize: 14 })
  })

  it('multi-word label wraps on whitespace and shrinks to fit', () => {
    const fit = fitLines('Backlight Step', CAP, CAP)
    expect(fit.lines).toEqual(['Backlight', 'Step'])
    expect(fit.fontSize).toBeLessThan(14)
  })

  it('honors a hard break and keeps the larger font', () => {
    const fit = fitLines('Back\nSpace', CAP, CAP)
    expect(fit.lines).toEqual(['Back', 'Space'])
    expect(fit.fontSize).toBe(14)
  })

  it('three words wrap to three lines', () => {
    const fit = fitLines('Bluetooth Profile Previous', CAP, CAP)
    expect(fit.lines).toEqual(['Bluetooth', 'Profile', 'Previous'])
    expect(fit.fontSize).toBeLessThan(14)
  })

  it('a word wider than the cap at the floor size returns one clipped line', () => {
    const fit = fitLines('Supercalifragilistic', 30, 30)
    expect(fit.lines).toEqual(['Supercalifragilistic'])
    expect(fit.fontSize).toBe(8)
  })

  it('a wide cap fits a two-word label on one line', () => {
    const fit = fitLines('Backlight Step', 124, CAP)
    expect(fit.lines).toEqual(['Backlight Step'])
    expect(fit.fontSize).toBe(14)
  })

  it('a short cap shrinks rather than overflowing vertically', () => {
    const fit = fitLines('Caps Lock Toggle', CAP, 20)
    expect(fit.lines.length).toBeGreaterThan(1)
    expect(fit.fontSize).toBeLessThan(14)
  })

  it('empty text yields a single empty line', () => {
    expect(fitLines('', CAP, CAP).lines).toEqual([''])
  })

  it('defaults to the 8px legend floor even when nothing fits', () => {
    // Guards the payload path: adding the 7/6 tag rungs must not let a legend
    // shrink past 8.
    expect(fitLines('Supercalifragilistic', 30, 30).fontSize).toBe(8)
  })

  it('minFontSize opens the smaller rungs for secondary text like group tags', () => {
    const fit = fitLines('programmable button', 54, 24, 8, 6)
    expect(fit.lines).toEqual(['programmable', 'button'])
    expect(fit.fontSize).toBe(6)
  })

  it('a short tag stays at the top of the tag ladder', () => {
    const fit = fitLines('joystick', 54, 24, 8, 6)
    expect(fit.lines).toEqual(['joystick'])
    expect(fit.fontSize).toBe(8)
  })

  it('maxFontSize caps the ladder', () => {
    expect(fitLines('A', CAP, CAP, 11).fontSize).toBe(11)
  })

  it('maxFontSize below the ladder floor still wraps, at the floor size', () => {
    const fit = fitLines('Backlight Step', CAP, CAP, 5)
    expect(fit.lines).toEqual(['Backlight', 'Step'])
    expect(fit.fontSize).toBe(8)
  })
})
