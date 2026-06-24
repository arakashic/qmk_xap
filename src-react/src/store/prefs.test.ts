import { describe, it, expect, beforeEach } from 'vitest'
import { usePrefsStore } from './prefs'

describe('usePrefsStore', () => {
  beforeEach(() => { usePrefsStore.setState({ basicLayout: 'ansi' }) })

  it('defaults basicLayout to ansi', () => {
    expect(usePrefsStore.getState().basicLayout).toBe('ansi')
  })

  it('setBasicLayout updates the value', () => {
    usePrefsStore.getState().setBasicLayout('iso')
    expect(usePrefsStore.getState().basicLayout).toBe('iso')
  })
})
