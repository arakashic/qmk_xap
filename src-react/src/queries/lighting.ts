import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
  const qc = useQueryClient()
  const key = ['lighting', id, sub]
  return useMutation({
    mutationFn: (config: LightingConfig) => c.setLightingConfig(id, sub, config),
    onMutate: async (config) => {
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<LightingConfig>(key)
      qc.setQueryData(key, config)
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      qc.setQueryData(key, ctx?.prev)
    },
    // Was missing entirely — without it the lighting cache drifts from the device.
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  })
}

export const useSaveLightingConfig = (id: string, sub: LightingSub) => {
  const c = useXapClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => c.saveLightingConfig(id, sub),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lighting', id, sub] }),
  })
}
