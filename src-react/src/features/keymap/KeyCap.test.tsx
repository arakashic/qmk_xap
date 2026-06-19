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
