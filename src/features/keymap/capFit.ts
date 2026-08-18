// Fits legend text to a key cap: wrap on whitespace, then step the font size
// down until the text fits. `\n` in the text is a hard break, which is how
// keycode_display.hjson `cap_label` entries express a break the wrap rule
// cannot find (e.g. "Back\nSpace"). No per-key rules live here.

/** Font sizes tried in order. 14 matches the KeyCap base size. */
const LADDER = [14, 13, 12, 11, 10, 9, 8]

/** Inset on each side, px. */
const PAD = 3

/** Average glyph advance as a fraction of the font size, for the UI font. */
const CHAR_RATIO = 0.58

/** Rendered line height, matching the KeyCap base. */
export const LINE_RATIO = 1.15

export interface FitResult {
  lines: string[]
  fontSize: number
}

/** Greedy word wrap. A word longer than maxChars gets its own overlong line. */
function wrapWords(segment: string, maxChars: number): string[] {
  const words = segment.split(/\s+/).filter(Boolean)
  if (words.length === 0) return ['']

  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (candidate.length <= maxChars || !current) {
      current = candidate
    } else {
      lines.push(current)
      current = word
    }
  }
  lines.push(current)
  return lines
}

/**
 * Lay `text` out inside a `width` x `height` cap. Returns the wrapped lines and
 * the font size to render them at. If nothing on the ladder fits, returns the
 * floor size — the cap's `overflow: hidden` clips the remainder.
 */
export function fitLines(
  text: string,
  width: number,
  height: number,
  maxFontSize: number = LADDER[0],
): FitResult {
  const usableW = Math.max(width - PAD * 2, 1)
  const usableH = Math.max(height - PAD * 2, 1)
  const segments = text.split('\n')
  const ladder = LADDER.filter((size) => size <= maxFontSize)
  // Below the floor, still run one pass at the floor size instead of
  // skipping the loop and returning un-wrapped segments.
  const rungs = ladder.length ? ladder : [LADDER[LADDER.length - 1]]

  let result: FitResult = { lines: segments, fontSize: LADDER[LADDER.length - 1] }
  for (const fontSize of rungs) {
    const maxChars = Math.max(Math.floor(usableW / (fontSize * CHAR_RATIO)), 1)
    const lines = segments.flatMap((segment) => wrapWords(segment, maxChars))
    result = { lines, fontSize }

    const widest = Math.max(...lines.map((line) => line.length))
    if (widest <= maxChars && lines.length * fontSize * LINE_RATIO <= usableH) {
      return result
    }
  }
  return result
}
