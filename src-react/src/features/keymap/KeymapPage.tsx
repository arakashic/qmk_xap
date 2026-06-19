import { useCallback } from 'react'
import { useUiStore } from '@/store/ui'
import { usePickerStore } from '@/store/picker'
import { useMappedKeymap } from '@/queries/devices'
import { useRemapKey } from '@/queries/keymap'
import { startFill, completeFill } from '@/features/keycode-picker/templateFill'
import type { FillTarget } from '@/features/keycode-picker/templateFill'
import { PickerDock } from '@/features/keycode-picker/PickerDock'
import type { KeyCode } from '@/xap/types'
import { Board } from './Board'
import { LayerBar } from './LayerBar'

export function KeymapPage() {
  const activeDeviceId = useUiStore((s) => s.activeDeviceId)
  const selectedLayer = useUiStore((s) => s.selectedLayer)
  const { data: keymap, isLoading } = useMappedKeymap(activeDeviceId)

  const picker = usePickerStore()
  const remapKey = useRemapKey(activeDeviceId ?? '')

  // Handle board key click: open picker for this target, cancel any pending fill.
  const handleSelectKey = useCallback(
    (target: FillTarget) => {
      if (picker.pending) {
        // Clicking another key while pending = cancel (no write)
        picker.setPending(null)
      }
      picker.open(target)
    },
    [picker],
  )

  // Handle a pick from the picker catalog.
  const handlePick = useCallback(
    (code: KeyCode) => {
      const target = picker.target
      if (!target || !activeDeviceId) return

      const tmpl = code.template

      // Two-step check: ModTap with null tap slot → start fill flow
      if (tmpl?.kind === 'ModTap' && tmpl.tap_kc === null) {
        const pendingFill = startFill(target, { kind: 'MT', mods: [] }, { mod_mask: tmpl.mod_mask })
        if (pendingFill) {
          picker.setPending(pendingFill)
          picker.setTab('basic')
        }
        return
      }

      // Two-step check: LayerTap with null tap slot → start fill flow
      if (tmpl?.kind === 'LayerTap' && tmpl.tap_kc === null) {
        const pendingFill = startFill(target, { kind: 'LT' }, { layer: tmpl.layer })
        if (pendingFill) {
          picker.setPending(pendingFill)
          picker.setTab('basic')
        }
        return
      }

      // Two-step check: LayerMod with null mod slot → start fill flow
      // TODO Plan 2 follow-up: LM modgrid — modgrid tab not in current fixture;
      // LM two-step is stubbed (no modgrid surface to fill the mod hole).
      if (tmpl?.kind === 'LayerMod' && tmpl.mod_mask === null) {
        const pendingFill = startFill(target, { kind: 'LM' }, { layer: tmpl.layer })
        if (pendingFill) {
          picker.setPending(pendingFill)
          // setTab('modgrid') when modgrid tab exists; for now stay on current tab
        }
        return
      }

      // If we have a pending fill and the user picked a basic key (the tap hole),
      // complete the fill and write once.
      if (picker.pending) {
        const finalCode = completeFill(picker.pending, code)
        remapKey.mutate({ target: picker.pending.target, code: finalCode })
        picker.setPending(null)
        return
      }

      // Basic / one-step code → write immediately, keep dock open.
      remapKey.mutate({ target, code })
    },
    [picker, activeDeviceId, remapKey],
  )

  if (!activeDeviceId) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'hsl(var(--muted-foreground))',
          fontSize: 12,
        }}
      >
        No device selected
      </div>
    )
  }

  if (isLoading) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'hsl(var(--muted-foreground))',
          fontSize: 12,
        }}
      >
        Loading keymap…
      </div>
    )
  }

  if (!keymap) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'hsl(var(--muted-foreground))',
          fontSize: 12,
        }}
      >
        No keymap data
      </div>
    )
  }

  const layerCount = keymap.keys.length

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
      <LayerBar layerCount={layerCount} />
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: 12,
        }}
      >
        <Board
          keymap={keymap}
          layer={selectedLayer}
          onSelectKey={handleSelectKey}
          selectedTarget={picker.target}
          pendingFill={picker.pending}
        />
      </div>
      <PickerDock layerCount={layerCount} onPick={handlePick} />
    </div>
  )
}
