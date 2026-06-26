import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useXapClient } from './client-context'

// Keep the device list in sync with backend hotplug events. The Rust event loop
// enumerates devices ~1s after startup, so the initial ['devices'] query often
// fires before a device finishes XAP init; without this, the NewDevice event is
// only logged to devtools and the selector never refreshes.
export function useDeviceSync(): void {
  const client = useXapClient()
  const qc = useQueryClient()

  useEffect(() => {
    const off = client.subscribe((e) => {
      if (e.kind === 'NewDevice' || e.kind === 'RemovedDevice') {
        qc.invalidateQueries({ queryKey: ['devices'] })
      } else if (e.kind === 'SecureStatusChanged') {
        // The firmware reports Unlocking immediately and broadcasts the final
        // Unlocked/Locked status only after the hold sequence completes. Without
        // this the secure toggle stays stuck on "Unlocking…".
        qc.invalidateQueries({ queryKey: ['device', e.data.id] })
        qc.invalidateQueries({ queryKey: ['devices'] })
      }
    })
    return off
  }, [client, qc])
}
