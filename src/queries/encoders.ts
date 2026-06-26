import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { KeyCode } from '@/xap/types'
import type { EncoderKeymap } from '@/xap/client'
import { useXapClient } from './client-context'

export const useEncoderKeymap = (id: string | null) => {
  const c = useXapClient()
  return useQuery({
    queryKey: ['encoderKeymap', id],
    queryFn: () => c.getEncoderKeymap(id!),
    enabled: !!id,
  })
}

type EncoderTarget = { layer: number; encoder: number; clockwise: number }

function applyEncoder(ek: EncoderKeymap, target: EncoderTarget, code: KeyCode): EncoderKeymap {
  return ek.map((layer, li) =>
    li !== target.layer
      ? layer
      : layer.map((slot, ei) =>
          ei !== target.encoder ? slot : { ...slot, [target.clockwise ? 'cw' : 'ccw']: code },
        ),
  )
}

export const useSetEncoderKeycode = (id: string) => {
  const c = useXapClient()
  const qc = useQueryClient()
  const key = ['encoderKeymap', id]
  return useMutation({
    mutationFn: (v: { target: EncoderTarget; code: KeyCode }) =>
      c.setEncoderKeycode(id, v.target, v.code),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<EncoderKeymap>(key)
      if (prev) qc.setQueryData(key, applyEncoder(prev, v.target, v.code))
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  })
}
