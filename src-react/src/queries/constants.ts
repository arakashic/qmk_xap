import { useQuery } from '@tanstack/react-query'
import { useXapClient } from './client-context'

export const useConstants = () => {
  const c = useXapClient()
  return useQuery({ queryKey: ['constants'], queryFn: () => c.getConstants(), staleTime: Infinity })
}
