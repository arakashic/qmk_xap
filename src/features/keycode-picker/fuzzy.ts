import type { KeyCode } from '@gen/xap-types'

/**
 * Scores a single keycode against a query.
 * Returns a number (higher = better match) or null if no match.
 * Scoring: substring match > scattered character match > no match.
 */
export function fuzzyScore(query: string, code: KeyCode): number | null {
  if (!query) return 0 // empty query matches everything with neutral score

  const searchable = buildSearchableString(code)
  const q = query.toLowerCase()
  const s = searchable.toLowerCase()

  // Check if substring match exists
  const substringIndex = s.indexOf(q)
  if (substringIndex !== -1) {
    // Reward matches that appear earlier and longer contiguous matches
    // Score: 1000 (base) + (1000 - position) + length bonus
    return 1000 + (1000 - substringIndex) + q.length * 10
  }

  // Check for scattered character match
  let qIdx = 0
  let lastMatchIdx = -1
  for (let i = 0; i < s.length && qIdx < q.length; i++) {
    if (s[i] === q[qIdx]) {
      lastMatchIdx = i
      qIdx++
    }
  }

  if (qIdx === q.length) {
    // All characters matched in scatter pattern
    // Score lower than substring, based on how scattered the matches are
    return 100 + (q.length * 5)
  }

  // No match at all
  return null
}

/**
 * Filters and sorts keycodes by fuzzy score.
 * Empty query returns codes in original order.
 * Non-matching codes are excluded.
 */
export function filterCodes(query: string, codes: KeyCode[]): KeyCode[] {
  if (!query) {
    return codes
  }

  const scored = codes
    .map((code) => ({ code, score: fuzzyScore(query, code) }))
    .filter((item) => item.score !== null)
    .sort((a, b) => (b.score as number) - (a.score as number))
    .map((item) => item.code)

  return scored
}

/**
 * Builds a searchable string from a keycode's relevant fields.
 */
function buildSearchableString(code: KeyCode): string {
  const parts: string[] = [
    code.key,
    code.label || '',
    code.description || '',
    ...(code.aliases || []),
  ]
  return parts.filter(Boolean).join(' ')
}
