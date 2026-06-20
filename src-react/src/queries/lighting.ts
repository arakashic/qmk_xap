import { useMutation, useQuery } from '@tanstack/react-query'
import type { LightingSub, LightingConfig } from '@/xap/client'
import { useXapClient } from './client-context'

export const useLightingConfig = (id: string | null, sub: LightingSub) => {
  const c = useXapClient()
  return useQuery({
    queryKey: ['lighting', id, sub],
    queryFn: () => c.getLightingConfig(id!, sub),
    enabled: !!id,
    refetchOnWindowFocus: true,
  })
}

export const useSetLightingConfig = (id: string, sub: LightingSub) => {
  const c = useXapClient()
  return useMutation({
    mutationFn: (config: LightingConfig) => c.setLightingConfig(id, sub, config),
  })
}

export const useSaveLightingConfig = (id: string, sub: LightingSub) => {
  const c = useXapClient()
  return useMutation({
    mutationFn: () => c.saveLightingConfig(id, sub),
  })
}
