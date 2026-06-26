import type { DeviceSummary } from '@/xap/client'
import { ConnectDeviceButton } from './ConnectDeviceButton'

interface DeviceLandingProps {
  /** First-load / arrival window: still looking for a device. */
  searching: boolean
  /** The devices query itself failed (backend unreachable). */
  errored: boolean
  /** Devices mid-handshake (web connecting/interrogating). */
  pending: DeviceSummary[]
  /** Devices whose interrogation failed. */
  failed: DeviceSummary[]
  /** Browser has no WebHID (Firefox/Safari) — no transport at all. */
  unsupported?: boolean
}

const wrap: React.CSSProperties = {
  display: 'flex',
  height: '100vh',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'hsl(var(--background))',
  fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
  fontSize: 12,
}

const col: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 12,
  color: 'hsl(var(--muted-foreground))',
}

/** Full-screen device-lifecycle landing. Renders searching / connecting / failed /
 *  empty distinctly instead of collapsing every non-ready state into "No keyboard
 *  connected." */
export function DeviceLanding({ searching, errored, pending, failed, unsupported }: DeviceLandingProps) {
  let body: React.ReactNode

  if (unsupported) {
    body = (
      <>
        <div style={{ fontSize: 14, color: 'hsl(var(--foreground))' }}>This browser does not support WebHID.</div>
        <div style={{ maxWidth: 360, textAlign: 'center' }}>
          Use Chrome or Edge to connect a keyboard, or open the desktop app.
        </div>
      </>
    )
  } else if (searching) {
    body = (
      <>
        <Spinner />
        <div style={{ fontSize: 14 }}>Searching for keyboards…</div>
      </>
    )
  } else if (errored) {
    body = (
      <>
        <div style={{ fontSize: 14, color: 'hsl(var(--foreground))' }}>Could not reach the backend.</div>
        <div>Check the connection and try again.</div>
      </>
    )
  } else if (pending.length > 0) {
    body = (
      <>
        <Spinner />
        <div style={{ fontSize: 14 }}>Connecting to {pending[0].product}…</div>
      </>
    )
  } else if (failed.length > 0) {
    body = (
      <>
        <div style={{ fontSize: 14, color: 'hsl(var(--foreground))' }}>Could not connect to {failed[0].product}.</div>
        {failed[0].error && <div style={{ maxWidth: 320, textAlign: 'center' }}>{failed[0].error}</div>}
        <ConnectDeviceButton />
      </>
    )
  } else {
    body = (
      <>
        <div style={{ fontSize: 14 }}>No keyboard connected.</div>
        <ConnectDeviceButton />
      </>
    )
  }

  return (
    <div style={wrap}>
      <div style={col}>{body}</div>
    </div>
  )
}

function Spinner() {
  return (
    <div
      aria-hidden
      style={{
        width: 18,
        height: 18,
        borderRadius: '50%',
        border: '2px solid hsl(var(--border))',
        borderTopColor: 'hsl(var(--primary))',
        animation: 'xap-spin 0.7s linear infinite',
      }}
    />
  )
}
