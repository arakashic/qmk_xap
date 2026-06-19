import type { XapDeviceState } from '@/xap/types'

export type Capability = { label: string; present: boolean }
export type HardwareStat = { label: string; value: string }

export function capabilitiesOf(s: XapDeviceState): Capability[] {
  const info = s.info
  return [
    { label: 'Keymap', present: info?.keymap != null },
    { label: 'Remap', present: info?.remap != null },
    { label: 'Lighting', present: info?.lighting != null },
    { label: 'Encoders', present: (s.config.encoder_count ?? 0) > 0 },
  ]
}

export function hardwareStatsOf(s: XapDeviceState): HardwareStat[] {
  const info = s.info
  const stats: HardwareStat[] = []

  if (info?.keymap?.layer_count != null) {
    stats.push({ label: 'Layers', value: String(info.keymap.layer_count) })
  }

  const { x, y } = s.config.matrix_size
  stats.push({ label: 'Matrix', value: `${Number(x)}×${Number(y)}` })

  const enc = s.config.encoder_count ?? 0
  if (enc > 0) {
    stats.push({ label: 'Encoders', value: String(enc) })
  }

  return stats
}
