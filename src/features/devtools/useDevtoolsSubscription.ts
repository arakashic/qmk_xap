import { useEffect } from 'react'
import { useXapClient } from '@/queries/client-context'
import { useDevtoolsStore } from '@/store/devtools'
import { eventToEntry } from './eventToEntry'

export function useDevtoolsSubscription(): void {
  const client = useXapClient()

  useEffect(() => {
    const off = client.subscribe((e) => {
      const { kind, label } = eventToEntry(e)
      useDevtoolsStore.getState().pushEntry(kind, label)
    })
    return off
  }, [client])
}
