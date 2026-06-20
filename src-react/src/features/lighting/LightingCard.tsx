import React from 'react'
import { Card } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { HsvControl } from './HsvControl'
import { subsystemMeta, effectOptions } from './lightingModel'
import type { LightingSub, LightingConfig } from '@/xap/client'
import type { LightingCapabilities, RgbMatrixConfig } from '@/xap/types'

export interface LightingCardProps {
  sub: LightingSub
  caps: LightingCapabilities
  config: LightingConfig
  dirty: boolean
  onPatch: (patch: Partial<RgbMatrixConfig>) => void
  onSave: () => void
}

export function LightingCard({ sub, caps, config, dirty, onPatch, onSave }: LightingCardProps): React.JSX.Element {
  const meta = subsystemMeta(sub)
  const opts = effectOptions(caps.effects)
  // Cast to widest type for field access; guards via meta flags prevent unsafe reads
  const wide = config as RgbMatrixConfig
  const enabled = config.enable !== 0

  return (
    <Card style={{ margin: '0 14px 12px' }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', gap: 10 }}>
        <Switch
          checked={enabled}
          onCheckedChange={(checked) => onPatch({ enable: checked ? 1 : 0 })}
        />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{meta.title}</div>
          <div style={{ fontSize: 12, color: 'var(--muted-foreground, #718096)' }}>{meta.subtitle}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {dirty ? (
            <>
              <span
                style={{
                  fontSize: 12,
                  padding: '2px 8px',
                  borderRadius: 9999,
                  border: '1px solid #fcd34d',
                  color: '#b45309',
                }}
              >
                ● not saved to EEPROM
              </span>
              <Button size="sm" onClick={onSave}>Save</Button>
            </>
          ) : (
            <span style={{ fontSize: 12, color: '#16a34a' }}>&#10003; saved</span>
          )}
        </div>
      </div>

      {/* Controls region */}
      <div style={{ padding: '0 16px 12px', opacity: enabled ? 1 : 0.5 }}>
        {/* Effect Select */}
        <div style={{ marginBottom: 10 }}>
          <Select
            value={String(config.mode)}
            onValueChange={(v) => onPatch({ mode: Number(v) })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {opts.map((opt) => (
                <SelectItem key={opt.value} value={String(opt.value)}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* HSV Control — only for subsystems with color */}
        {meta.hasColor && (
          <div style={{ marginBottom: 10 }}>
            <HsvControl
              hue={wide.hue}
              sat={wide.sat}
              val={wide.val}
              onChange={(next) => onPatch(next)}
              disabled={!enabled}
            />
          </div>
        )}

        {/* Speed slider — only for subsystems with speed */}
        {meta.hasSpeed && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, marginBottom: 4, color: 'var(--muted-foreground, #718096)' }}>Speed</div>
            <Slider
              min={0}
              max={255}
              step={1}
              value={[wide.speed]}
              onValueChange={(v) => onPatch({ speed: v[0] })}
              disabled={!enabled}
            />
          </div>
        )}

        {/* Brightness slider — only for backlight */}
        {meta.hasBrightness && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, marginBottom: 4, color: 'var(--muted-foreground, #718096)' }}>Bright</div>
            <Slider
              min={0}
              max={255}
              step={1}
              value={[wide.val]}
              onValueChange={(v) => onPatch({ val: v[0] })}
              disabled={!enabled}
            />
          </div>
        )}
      </div>
    </Card>
  )
}
