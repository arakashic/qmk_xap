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

  if (!lighting) {
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
      {SUBS.filter((sub) => lighting[sub] != null).map((sub) => (
        <LightingCardContainer
          key={sub}
          id={id!}
          sub={sub}
          caps={lighting[sub]!}
        />
      ))}
    </div>
  )
}
