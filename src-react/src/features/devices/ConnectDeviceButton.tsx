import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { connectWebDevice } from '@/xap/web/web-client'
import { activeClientKind } from '@/xap/runtime'

/** Web-only: opens the WebHID device chooser (a user gesture is required), then
 *  refetches the device list. Renders nothing unless the active client is the
 *  web (WebHID) client — i.e. not on desktop, in `?mock=1`, or non-WebHID
 *  browsers. */
export function ConnectDeviceButton() {
  const qc = useQueryClient()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  if (activeClientKind() !== 'web') return null

  async function handleConnect() {
    setErr(null)
    setBusy(true)
    try {
      await connectWebDevice()
      await qc.invalidateQueries({ queryKey: ['devices'] })
    } catch (e) {
      const msg = String((e as Error)?.message ?? e)
      // The chooser being dismissed throws — not worth surfacing as an error.
      if (!/no device selected|cancel/i.test(msg)) setErr(msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <Button onClick={handleConnect} disabled={busy}>
        {busy ? 'Connecting…' : '⌨ Connect keyboard'}
      </Button>
      {err && <div style={{ color: '#c53030', fontSize: 12 }}>{err}</div>}
    </div>
  )
}
