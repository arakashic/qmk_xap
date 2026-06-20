import React, { useState } from 'react'
import {
  ColorArea,
  ColorSlider,
  ColorThumb,
  SliderTrack,
  parseColor,
} from 'react-aria-components'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { qmkToHsb, hsbToQmk } from './lightingModel'

export interface HsvControlProps {
  hue: number
  sat: number
  val: number
  onChange: (next: { hue: number; sat: number; val: number }) => void
  disabled?: boolean
}

export function HsvControl({ hue, sat, val, onChange, disabled }: HsvControlProps): React.JSX.Element {
  const { hue: h, saturation: s, brightness: b } = qmkToHsb(hue, sat, val)
  const color = parseColor(`hsb(${h}, ${s}%, ${b}%)`)
  const swatchBg = `hsl(${h}, ${s}%, ${Math.round(b / 2 + 25)}%)`

  const [open, setOpen] = useState(false)

  function handleColorAreaChange(c: typeof color) {
    const hsb = c.toFormat('hsb')
    const ch = hsb.getChannelValue('hue')
    const cs = hsb.getChannelValue('saturation')
    const cv = hsb.getChannelValue('brightness')
    onChange(hsbToQmk(ch, cs, cv))
  }

  function handleSliderChange(c: typeof color) {
    const hsb = c.toFormat('hsb')
    const ch = hsb.getChannelValue('hue')
    const cs = hsb.getChannelValue('saturation')
    const cv = hsb.getChannelValue('brightness')
    onChange(hsbToQmk(ch, cs, cv))
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          aria-label="color swatch"
          disabled={disabled}
          onClick={() => !disabled && setOpen(o => !o)}
          style={{
            width: 48,
            height: 48,
            borderRadius: 6,
            border: '1px solid var(--border, #e2e8f0)',
            backgroundColor: swatchBg,
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.4 : 1,
            padding: 0,
          }}
        />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <ColorArea
            xChannel="saturation"
            yChannel="brightness"
            value={color}
            onChange={handleColorAreaChange}
            style={{ width: 160, height: 160, borderRadius: 4 }}
          >
            <ColorThumb style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid white', boxShadow: '0 0 0 1px rgba(0,0,0,0.3)' }} />
          </ColorArea>
          <ColorSlider
            channel="hue"
            value={color}
            onChange={handleSliderChange}
            style={{ width: 160 }}
          >
            <SliderTrack
              style={{
                height: 12,
                borderRadius: 6,
                background: 'linear-gradient(to right, hsl(0,100%,50%), hsl(60,100%,50%), hsl(120,100%,50%), hsl(180,100%,50%), hsl(240,100%,50%), hsl(300,100%,50%), hsl(360,100%,50%))',
              }}
            >
              <ColorThumb style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid white', boxShadow: '0 0 0 1px rgba(0,0,0,0.3)', top: '50%' }} />
            </SliderTrack>
          </ColorSlider>
        </div>
      </PopoverContent>
    </Popover>
  )
}
