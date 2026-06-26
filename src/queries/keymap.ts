import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { KeyCode, MappedKeymap } from '@/xap/types'
import { useXapClient } from './client-context'

type RemapTarget = { layer: number; row: number; column: number }

// Immutably set the matched key's code (matrix coords), mirroring the device
// write so the board updates before the round-trip refetch lands.
function applyRemap(km: MappedKeymap, target: RemapTarget, code: KeyCode): MappedKeymap {
  return {
    ...km,
    keys: km.keys.map((layer, li) =>
      li !== target.layer
        ? layer
        : layer.map((row) =>
            row.map((key) =>
              key &&
              Number(key.layout.matrix.y) === target.row &&
              Number(key.layout.matrix.x) === target.column
                ? { ...key, key: { ...key.key, code } }
                : key,
            ),
          ),
    ),
  }
}

export const useRemapKey = (deviceId: string) => {
  const c = useXapClient()
  const qc = useQueryClient()
  const key = ['keymap', deviceId]
  return useMutation({
    mutationFn: (v: { target: RemapTarget; code: KeyCode }) =>
      c.remapKey(deviceId, v.target, v.code),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<MappedKeymap>(key)
      if (prev) qc.setQueryData(key, applyRemap(prev, v.target, v.code))
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  })
}
