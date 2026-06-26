import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useXapClient } from './client-context'

export const useDevices = () => {
  const c = useXapClient()
  return useQuery({ queryKey: ['devices'], queryFn: () => c.listDevices() })
}

export const useDeviceState = (id: string | null) => {
  const c = useXapClient()
  return useQuery({
    queryKey: ['device', id],
    queryFn: () => c.getDeviceState(id!),
    enabled: !!id,
  })
}

export const useMappedKeymap = (id: string | null) => {
  const c = useXapClient()
  return useQuery({
    queryKey: ['keymap', id],
    queryFn: () => c.getMappedKeymap(id!),
    enabled: !!id,
  })
}

export const useSecureLock = (id: string) => {
  const c = useXapClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => c.secureLock(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['device', id] })
      qc.invalidateQueries({ queryKey: ['devices'] })
    },
  })
}

export const useSecureUnlock = (id: string) => {
  const c = useXapClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => c.secureUnlock(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['device', id] })
      qc.invalidateQueries({ queryKey: ['devices'] })
    },
  })
}

export const useJumpToBootloader = (id: string) => {
  const c = useXapClient()
  return useMutation({ mutationFn: () => c.jumpToBootloader(id) })
}

export const useReinitializeEeprom = (id: string) => {
  const c = useXapClient()
  return useMutation({ mutationFn: () => c.reinitializeEeprom(id) })
}
