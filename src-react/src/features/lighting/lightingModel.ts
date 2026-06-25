import type { LightingEffect } from '@/xap/types'
import type { LightingSub } from '@/xap/client'

export type SubsystemMeta = {
  title: string
  subtitle: string
  hasColor: boolean
  hasSpeed: boolean
  hasBrightness: boolean
}

export function qmkToHsb(h: number, s: number, v: number): { hue: number; saturation: number; brightness: number } {
  return {
    hue: Math.round(h / 255 * 360),
    saturation: Math.round(s / 255 * 100),
    brightness: Math.round(v / 255 * 100),
  }
}

function clamp(n: number): number {
  return Math.max(0, Math.min(255, n))
}

export function hsbToQmk(hue: number, saturation: number, brightness: number): { hue: number; sat: number; val: number } {
  return {
    hue: clamp(Math.round(hue / 360 * 255)),
    sat: clamp(Math.round(saturation / 100 * 255)),
    val: clamp(Math.round(brightness / 100 * 255)),
  }
}

export function effectOptions(effects: LightingEffect[]): { value: number; label: string }[] {
  // Drop code-less effects: `mode` is a numeric code, so an effect with no code
  // can never be the selected mode, and defaulting several of them to 0 would
  // produce duplicate Select values that collide.
  return effects
    .filter((e): e is LightingEffect & { code: number } => e.code != null)
    .map(e => ({ value: e.code, label: e.label ?? e.key }))
}

export function effectLabel(effects: LightingEffect[], mode: number): string {
  const found = effects.find(e => e.code === mode)
  return found?.label ?? `Mode ${mode}`
}

const META: Record<LightingSub, SubsystemMeta> = {
  rgbmatrix: { title: 'Per-key RGB', subtitle: 'rgb matrix', hasColor: true, hasSpeed: true, hasBrightness: false },
  rgblight:  { title: 'Underglow',   subtitle: 'rgblight',   hasColor: true, hasSpeed: true, hasBrightness: false },
  backlight: { title: 'Backlight',   subtitle: 'backlight',  hasColor: false, hasSpeed: false, hasBrightness: true },
}

export function subsystemMeta(sub: LightingSub): SubsystemMeta {
  return META[sub]
}
