import * as React from 'react'
import type { XapDeviceState } from '@/xap/types'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog'
import { capabilitiesOf, hardwareStatsOf } from './capabilities'
import { FirmwareConfigModal } from './FirmwareConfigModal'
import { secureToggleLabel } from './secureToggle'
import { useSecureLock, useSecureUnlock, useJumpToBootloader, useReinitializeEeprom } from '@/queries/devices'

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

/** Confirm dialog for irreversible danger actions. */
function DangerConfirmDialog({
  open,
  title,
  description,
  onConfirm,
  onClose,
}: {
  open: boolean
  title: string
  description: string
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent style={{ maxWidth: 380 }}>
        <DialogHeader>
          <DialogTitle style={{ fontSize: 14 }}>{title}</DialogTitle>
        </DialogHeader>
        <p style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))', margin: '8px 0 16px' }}>
          {description}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <DialogClose asChild>
            <Button variant="outline" size="sm">Cancel</Button>
          </DialogClose>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              onConfirm()
              onClose()
            }}
          >
            Confirm
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function DeviceCard({ state, isActive, onSetActive }: DeviceCardProps) {
  const info = state.info
  const qmk = info?.qmk
  const caps = capabilitiesOf(state)
  const stats = hardwareStatsOf(state)

  const [confirmAction, setConfirmAction] = React.useState<'bootloader' | 'eeprom' | null>(null)

  const secureLock = useSecureLock(state.id)
  const secureUnlock = useSecureUnlock(state.id)
  const jumpToBootloader = useJumpToBootloader(state.id)
  const reinitializeEeprom = useReinitializeEeprom(state.id)

  const { label: secureLabel, disabled: secureDisabled, title: secureTitle, color: secureColor } = secureToggleLabel(state.secure_status)
  const isUnlocked = state.secure_status === 'Unlocked'

  function handleSecureToggle() {
    if (state.secure_status === 'Unlocked') {
      secureLock.mutate()
    } else if (state.secure_status === 'Locked') {
      secureUnlock.mutate()
    }
  }

  const jtbEnabled = isUnlocked && (qmk?.jump_to_bootloader_enabled ?? false)
  const eepromEnabled = isUnlocked && (qmk?.eeprom_reset_enabled ?? false)

  const subParts = [
    qmk?.manufacturer,
    qmk ? `QMK ${qmk.version}` : null,
    info?.xap ? `XAP ${formatXapVersion(info.xap.version)}` : null,
    ...stats.map((s) => (s.label === 'Layers' ? `${s.value} layers` : s.label === 'Matrix' ? s.value : `${s.value} encoders`)),
  ].filter(Boolean)

  return (
    <>
      <Card
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

        {/* Action row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginTop: 12,
            paddingTop: 12,
            borderTop: '1px solid hsl(var(--border))',
            flexWrap: 'wrap',
          }}
        >
          <FirmwareConfigModal state={state} />
          {!isActive && (
            <Button size="sm" variant="default" onClick={onSetActive}>
              Set active
            </Button>
          )}
          {isActive && (
            <Button
              size="sm"
              variant="outline"
              disabled={secureDisabled}
              onClick={handleSecureToggle}
              title={secureTitle}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderColor: secureColor, color: secureColor }}
            >
              <span
                aria-hidden
                style={{ width: 7, height: 7, borderRadius: '50%', background: secureColor, boxShadow: `0 0 4px ${secureColor}`, flexShrink: 0 }}
              />
              {secureLabel}
            </Button>
          )}

          {/* Danger group — ACTIVE card only, visually quarantined */}
          {isActive && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginLeft: 'auto',
                paddingLeft: 10,
                borderLeft: '1px solid hsl(var(--destructive) / 0.3)',
              }}
            >
              <Button
                size="sm"
                variant="destructive"
                disabled={!jtbEnabled}
                onClick={() => setConfirmAction('bootloader')}
              >
                Jump to bootloader
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={!eepromEnabled}
                onClick={() => setConfirmAction('eeprom')}
              >
                Reset EEPROM
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Confirm dialogs — rendered outside Card to avoid stacking issues */}
      <DangerConfirmDialog
        open={confirmAction === 'bootloader'}
        title="Jump to bootloader?"
        description="This will immediately reboot the device into bootloader mode. This action cannot be undone."
        onConfirm={() => jumpToBootloader.mutate()}
        onClose={() => setConfirmAction(null)}
      />
      <DangerConfirmDialog
        open={confirmAction === 'eeprom'}
        title="Reset EEPROM?"
        description="This will erase all stored settings and keymaps on the device. This action cannot be undone."
        onConfirm={() => reinitializeEeprom.mutate()}
        onClose={() => setConfirmAction(null)}
      />
    </>
  )
}
