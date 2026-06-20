import React, { useState, useEffect } from 'react'
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
  const { data: loaded } = useLightingConfig(id, sub)
  const [draft, setDraft] = useState<LightingConfig | null>(null)
  const [dirty, setDirty] = useState(false)

  const setMut = useSetLightingConfig(id, sub)
  const saveMut = useSaveLightingConfig(id, sub)

  // Reset draft whenever loaded identity changes (fresh load / focus refetch)
  useEffect(() => {
    if (loaded !== undefined) {
      setDraft(loaded)
      setDirty(false)
    }
  }, [loaded])

  const config = draft ?? loaded
  if (!config) return null

  function onPatch(patch: Partial<RgbMatrixConfig>): void {
    const next = { ...config!, ...patch } as LightingConfig
    setDraft(next)
    setDirty(true)
    setMut.mutate(next)
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
