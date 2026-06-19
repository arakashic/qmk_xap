import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { KeyCode } from '@/xap/types'
import { useXapClient } from './client-context'

export const useRemapKey = (deviceId: string) => {
  const c = useXapClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { target: { layer: number; row: number; column: number }; code: KeyCode }) =>
      c.remapKey(deviceId, v.target, v.code),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['keymap', deviceId] }),
  })
}
