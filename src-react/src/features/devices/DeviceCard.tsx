import type { XapDeviceState } from '@/xap/types'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { capabilitiesOf, hardwareStatsOf } from './capabilities'

interface DeviceCardProps {
  state: XapDeviceState
  isActive: boolean
  onSetActive: () => void
}

function formatXapVersion(v: number): string {
  const major = (v >> 8) & 0xff
  const minor = (v >> 4) & 0xf
  const patch = v & 0xf
  return `${major}.${minor}.${patch}`
}

function secureLabel(status: string): string {
  if (status === 'Locked') return '🔒 locked'
  if (status === 'Unlocking') return '🔓 unlocking'
  return ''
}

export function DeviceCard({ state, isActive, onSetActive }: DeviceCardProps) {
  const info = state.info
  const qmk = info?.qmk
  const caps = capabilitiesOf(state)
  const stats = hardwareStatsOf(state)

  const subParts = [
    qmk?.manufacturer,
    qmk ? `QMK ${qmk.version}` : null,
    info?.xap ? `XAP ${formatXapVersion(info.xap.version)}` : null,
    ...stats.map((s) => (s.label === 'Layers' ? `${s.value} layers` : s.label === 'Matrix' ? s.value : `${s.value} encoders`)),
  ].filter(Boolean)

  const lockLabel = secureLabel(state.secure_status)

  return (
    <Card
      className={isActive ? '' : undefined}
      style={{
        padding: 14,
        margin: '0 14px 12px',
        position: 'relative',
        borderRadius: 'var(--radius)',
        boxShadow: isActive
          ? '0 0 0 1px hsl(var(--ring))'
          : '0 1px 2px rgb(0 0 0 / .05)',
        ...(isActive ? { borderColor: 'hsl(var(--ring))' } : {}),
      }}
    >
      {isActive && (
        <span
          style={{
            position: 'absolute',
            top: -9,
            left: 12,
            background: 'hsl(var(--primary))',
            color: 'hsl(var(--primary-foreground))',
            fontSize: 9,
            fontWeight: 600,
            borderRadius: 9999,
            padding: '1px 9px',
          }}
        >
          ACTIVE
        </span>
      )}

      {/* Header */}
      <div style={{ fontSize: 13, fontWeight: 600, color: 'hsl(var(--foreground))' }}>
        {qmk?.product_name ?? state.id}
        {subParts.length > 0 && (
          <span
            style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))', fontWeight: 400, marginLeft: 6 }}
          >
            {subParts.join(' · ')}
          </span>
        )}
        {lockLabel && (
          <span
            style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))', fontWeight: 400, marginLeft: 6 }}
          >
            {lockLabel}
          </span>
        )}
      </div>

      {/* Capability badges */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
        {caps.map((cap) =>
          cap.present ? (
            <Badge key={cap.label} variant="secondary" style={{ borderRadius: 9999, fontSize: 10, padding: '2px 9px' }}>
              {cap.label.toLowerCase()}
            </Badge>
          ) : (
            <Badge
              key={cap.label}
              variant="outline"
              style={{
                borderRadius: 9999,
                fontSize: 10,
                padding: '2px 9px',
                color: 'hsl(var(--muted-foreground) / 0.7)',
              }}
            >
              {cap.label.toLowerCase()}
            </Badge>
          ),
        )}
      </div>

      {/* Action row — only rendered when there's content; Tasks 4-5 will add active-card actions */}
      {!isActive && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginTop: 12,
            paddingTop: 12,
            borderTop: '1px solid hsl(var(--border))',
          }}
        >
          <Button size="sm" variant="default" onClick={onSetActive}>
            Set active
          </Button>
        </div>
      )}
    </Card>
  )
}
