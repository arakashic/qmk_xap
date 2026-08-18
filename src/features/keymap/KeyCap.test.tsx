import { render, screen } from '@testing-library/react'
import { KeyCap } from './KeyCap'

it('renders a basic label', () => {
  render(<KeyCap code={{ key: 'KC_A', label: 'A' }} />)
  expect(screen.getByText('A')).toBeInTheDocument()
})

it('renders the transparent glyph', () => {
  render(<KeyCap code={{ key: 'KC_TRNS' }} />)
  expect(screen.getByText('▽')).toBeInTheDocument()
})

it('live ghost renders resolved key label recursively', () => {
  render(
    <KeyCap
      code={{ key: 'KC_TRNS' }}
      live
      resolvedCode={{ key: 'KC_A', label: 'A' }}
    />
  )
  expect(screen.getByText('A')).toBeInTheDocument()
})

it('holeZone=tap on a split cap renders amber dashed "?" tap zone', () => {
  // A ModTap key has a split legend
  const mtCode = {
    key: 'MT(MOD_LCTL,KC_S)',
    label: 'S',
    top: 'Ctrl',
    group: 'ModTap',
    template: { kind: 'ModTap' as const, mod_mask: 0x01, tap_kc: 0x16 },
  }
  render(<KeyCap code={mtCode} holeZone="tap" />)
  expect(screen.getByTestId('hole-zone')).toBeInTheDocument()
  expect(screen.getByText('?')).toBeInTheDocument()
})

it('renders a hard-broken cap_label as two lines', () => {
  render(<KeyCap code={{ key: 'KC_BACKSPACE', label: 'Backspace', cap_label: 'Back\nSpace' }} />)
  const legend = screen.getByTestId('cap-legend')
  expect(legend.textContent).toBe('Back\nSpace')
  expect(legend).toHaveStyle({ whiteSpace: 'pre' })
})

it('wraps a long multi-word legend onto several lines', () => {
  render(<KeyCap code={{ key: 'KC_X', label: 'Backlight Step' }} />)
  expect(screen.getByTestId('cap-legend').textContent).toBe('Backlight\nStep')
})

it('wraps the tap zone of a split cap', () => {
  render(
    <KeyCap
      code={{
        key: 'LCTL_T(Backspace)',
        label: 'LCTL_T(Backspace)',
        top: 'LCTL_T',
        bottom: 'Back\nSpace',
        template: { kind: 'ModTap', mod_mask: 0x01, tap_kc: 0x2a },
      }}
    />,
  )
  expect(screen.getByTestId('cap-tap').textContent).toBe('Back\nSpace')
})
