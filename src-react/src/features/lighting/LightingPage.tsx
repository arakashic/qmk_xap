import React from 'react'
import { useUiStore } from '@/store/ui'
import { useDeviceState } from '@/queries/devices'
import type { LightingSub } from '@/xap/client'
import { LightingCardContainer } from './LightingCardContainer'

const SUBS: LightingSub[] = ['backlight', 'rgblight', 'rgbmatrix']

export function LightingPage(): React.JSX.Element {
  const id = useUiStore((s) => s.activeDeviceId)
  const { data: state } = useDeviceState(id)
  const lighting = state?.info?.lighting
  // Real firmware reports `info.lighting` as a present object with every
  // subsystem null when the board has no lighting (the mock used a plain
  // null). Treat "all subsystems null" the same as no lighting.
  const present = lighting ? SUBS.filter((sub) => lighting[sub] != null) : []

  if (present.length === 0) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'hsl(var(--muted-foreground))',
        }}
      >
        This device reports no lighting subsystems.
      </div>
    )
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', paddingTop: 18 }}>
      {present.map((sub) => (
        <LightingCardContainer
          key={sub}
          id={id!}
          sub={sub}
          caps={lighting![sub]!}
        />
      ))}
    </div>
  )
}
