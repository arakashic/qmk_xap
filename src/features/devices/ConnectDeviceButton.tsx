import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { connectWebDevice } from '@/xap/web/web-client'
import { activeClientKind } from '@/xap/runtime'

/** Web-only: opens the WebHID device chooser (a user gesture is required), then
 *  refetches the device list. Renders nothing unless the active client is the
 *  web (WebHID) client — i.e. not on desktop, in a mock build, or non-WebHID
 *  browsers. */
export function ConnectDeviceButton() {
  const qc = useQueryClient()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)

  if (activeClientKind() !== 'web') return null

  async function handleConnect() {
    setErr(null)
    setNote(null)
    setBusy(true)
    try {
      const { added, alreadyConnected } = await connectWebDevice()
      await qc.invalidateQueries({ queryKey: ['devices'] })
      // Re-picking a granted device is a no-op in WebHID; say so rather than
      // looking broken. A plain dismissed chooser adds nothing and is silent.
      if (added === 0 && alreadyConnected) setNote('That keyboard is already connected.')
    } catch (e) {
      setErr(String((e as Error)?.message ?? e))
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
      {note && <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 12 }}>{note}</div>}
    </div>
  )
}
