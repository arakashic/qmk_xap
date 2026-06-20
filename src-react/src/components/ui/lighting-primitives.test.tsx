import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Switch } from './switch'
import { Slider } from './slider'
import { Select, SelectTrigger, SelectValue } from './select'

describe('lighting primitives smoke tests', () => {
  it('Switch renders with role="switch"', () => {
    const { getByRole } = render(<Switch />)
    expect(getByRole('switch')).toBeInTheDocument()
  })

  it('Slider renders with role="slider"', () => {
    const { getByRole } = render(<Slider defaultValue={[50]} max={100} />)
    expect(getByRole('slider')).toBeInTheDocument()
  })

  it('Select renders trigger', () => {
    const { getByRole } = render(
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="Choose..." />
        </SelectTrigger>
      </Select>,
    )
    expect(getByRole('combobox')).toBeInTheDocument()
  })
})
