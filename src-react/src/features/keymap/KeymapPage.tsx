import { useCallback, useEffect } from 'react'
import { useUiStore } from '@/store/ui'
import { usePickerStore } from '@/store/picker'
import { useMappedKeymap } from '@/queries/devices'
import { useRemapKey } from '@/queries/keymap'
import { useEncoderKeymap, useSetEncoderKeycode } from '@/queries/encoders'
import { startFill, completeFill, shouldComplete } from '@/features/keycode-picker/templateFill'
import type { PickerTarget } from '@/features/keycode-picker/templateFill'
import { PickerDock } from '@/features/keycode-picker/PickerDock'
import { EncoderRail } from '@/features/encoders/EncoderRail'
import type { KeyCode } from '@/xap/types'
import { Board } from './Board'
import { LayerBar } from './LayerBar'

export function KeymapPage() {
  const activeDeviceId = useUiStore((s) => s.activeDeviceId)
  const selectedLayer = useUiStore((s) => s.selectedLayer)
  const { data: keymap, isLoading } = useMappedKeymap(activeDeviceId)

  const { data: encoders } = useEncoderKeymap(activeDeviceId)

  const picker = usePickerStore()
  const remapKey = useRemapKey(activeDeviceId ?? '')
  const setEnc = useSetEncoderKeycode(activeDeviceId ?? '')

  // Document-level Esc: cancel pending fill while pending is set.
  useEffect(() => {
    if (!picker.pending) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        picker.setPending(null)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [picker, picker.pending])

  // Handle board key click: open picker for this target, cancel any pending fill.
  // picker.open() already clears pending, so no explicit setPending(null) needed.
  const handleSelectKey = useCallback(
    (target: PickerTarget) => {
      picker.open(target)
    },
    [picker],
  )

  // Handle encoder slot click: open picker for the encoder target.
  const handleSelectSlot = useCallback(
    (encoder: number, clockwise: number) => {
      picker.open({ kind: 'encoder', layer: selectedLayer, encoder, clockwise })
    },
    [picker, selectedLayer],
  )

  // Route a write to the correct mutation based on target kind.
  const writeTarget = useCallback(
    (target: PickerTarget, code: KeyCode) => {
      if (target.kind === 'key') {
        remapKey.mutate({ target, code })
      } else {
        setEnc.mutate({ target, code })
      }
    },
    [remapKey, setEnc],
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

      // If we have a pending fill and the active tab can fill the current hole,
      // complete the fill and write once. Otherwise ignore the pick (no write).
      if (picker.pending) {
        if (shouldComplete(picker.pending, picker.activeTab)) {
          const finalCode = completeFill(picker.pending, code)
          writeTarget(picker.pending.target, finalCode)
          picker.setPending(null)
        }
        return
      }

      // Basic / one-step code → write immediately, keep dock open.
      writeTarget(target, code)
    },
    [picker, activeDeviceId, writeTarget],
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
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
      <LayerBar layerCount={layerCount} />
      {/* Keymap region: board + encoder rail scroll together, independently of the picker. */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: 12 }}>
          <Board
            keymap={keymap}
            layer={selectedLayer}
            onSelectKey={handleSelectKey}
            selectedTarget={picker.target}
            pendingFill={picker.pending}
          />
        </div>
        <EncoderRail
          layer={selectedLayer}
          encoders={encoders?.[selectedLayer] ?? []}
          selectedTarget={picker.target}
          pendingFill={picker.pending}
          onSelectSlot={handleSelectSlot}
        />
      </div>
      <PickerDock layerCount={layerCount} onPick={handlePick} />
    </div>
  )
}
