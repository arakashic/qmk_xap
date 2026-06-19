import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { KeyCode } from '@/xap/types'
import { useXapClient } from './client-context'

export const useEncoderKeymap = (id: string | null) => {
  const c = useXapClient()
  return useQuery({
    queryKey: ['encoderKeymap', id],
    queryFn: () => c.getEncoderKeymap(id!),
    enabled: !!id,
  })
}

export const useSetEncoderKeycode = (id: string) => {
  const c = useXapClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { target: { layer: number; encoder: number; clockwise: number }; code: KeyCode }) =>
      c.setEncoderKeycode(id, v.target, v.code),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['encoderKeymap', id] }),
  })
}
