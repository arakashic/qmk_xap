import { useQuery } from '@tanstack/react-query'
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
