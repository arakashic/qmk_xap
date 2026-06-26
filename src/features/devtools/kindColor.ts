import type { EntryKind } from '../../store/devtools'

export const KIND_COLOR: Record<EntryKind, string> = {
  call: '#63b3ed',
  secure: '#fbd38d',
  log: '#9ae6b4',
  broadcast: '#b794f4',
  device: '#fc8181',
}
