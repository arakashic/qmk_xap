import React, { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { LightingSub, LightingConfig } from '@/xap/client'
import type { LightingCapabilities, RgbMatrixConfig } from '@/xap/types'
import { useLightingConfig, useSetLightingConfig, useSaveLightingConfig } from '@/queries/lighting'
import { LightingCard } from './LightingCard'

interface LightingCardContainerProps {
  id: string
  sub: LightingSub
  caps: LightingCapabilities
}

export function LightingCardContainer({ id, sub, caps }: LightingCardContainerProps): React.JSX.Element | null {
  // Authoritative source is the device config (query cache). Each patch writes
  // to the device with an optimistic cache update (and rollback on failure), so
  // the enable toggle / mode / HSV reflect the device rather than self-owning a
  // local draft that could diverge. `dirty` only tracks unsaved-to-EEPROM edits.
  const { data: config } = useLightingConfig(id, sub)
  const [dirty, setDirty] = useState(false)
  const qc = useQueryClient()

  const setMut = useSetLightingConfig(id, sub)
  const saveMut = useSaveLightingConfig(id, sub)

  // Switching device/subsystem starts fresh.
  useEffect(() => {
    setDirty(false)
  }, [id, sub])

  if (!config) return null

  function onPatch(patch: Partial<RgbMatrixConfig>): void {
    // Build on the freshest cache value (the optimistic update writes it
    // synchronously) so rapid edits across fields accumulate correctly.
    const base = qc.getQueryData<LightingConfig>(['lighting', id, sub]) ?? config!
    setMut.mutate({ ...base, ...patch } as LightingConfig)
    setDirty(true)
  }

  function onSave(): void {
    saveMut.mutate(undefined, { onSuccess: () => setDirty(false) })
  }

  return (
    <LightingCard
      sub={sub}
      caps={caps}
      config={config}
      dirty={dirty}
      onPatch={onPatch}
      onSave={onSave}
    />
  )
}
