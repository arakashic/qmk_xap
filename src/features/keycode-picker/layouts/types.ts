export interface PhysicalKey {
  key: string
  aliases?: string[]
  x: number
  y: number
  w: number
  h: number
}

export interface KeyboardLayoutDef {
  id: string
  label: string
  width: number
  height: number
  keys: PhysicalKey[]
}
