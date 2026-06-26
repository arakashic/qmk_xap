import React from 'react'
import { useUiStore } from '@/store/ui'
import { useDeviceState } from '@/queries/devices'
import type { LightingSub } from '@/xap/client'
import { LightingCardContainer } from './LightingCardContainer'

const SUBS: LightingSub[] = ['backlight', 'rgblight', 'rgbmatrix']

function Centered({ children }: { children: React.ReactNode }): React.JSX.Element {
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
      {children}
    </div>
  )
}

export function LightingPage(): React.JSX.Element {
  const id = useUiStore((s) => s.activeDeviceId)
  const { data: state, isLoading, isError } = useDeviceState(id)

  // A loading or errored fetch must not read as "no lighting subsystems".
  if (isLoading) return <Centered>Loading lighting…</Centered>
  if (isError) return <Centered>Could not load lighting.</Centered>

  const lighting = state?.info?.lighting
  // Real firmware reports `info.lighting` as a present object with every
  // subsystem null when the board has no lighting (the mock used a plain
  // null). Treat "all subsystems null" the same as no lighting.
  const present = lighting ? SUBS.filter((sub) => lighting[sub] != null) : []

  if (present.length === 0) {
    return <Centered>This device reports no lighting subsystems.</Centered>
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
