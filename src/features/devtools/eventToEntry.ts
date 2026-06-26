import type { XapEvent } from '@gen/xap-types'
import type { EntryKind } from '../../store/devtools'

export function eventToEntry(e: XapEvent): { kind: EntryKind; label: string } {
  switch (e.kind) {
    case 'SecureStatusChanged':
      return { kind: 'secure', label: `secure -> ${e.data.secure_status}` }
    case 'LogReceived':
      return { kind: 'log', label: `log: ${e.data.log}` }
    case 'RawBroadcastReceived':
      return { kind: 'broadcast', label: `broadcast ${e.data.broadcast_type} [${e.data.payload.length}B]` }
    case 'NewDevice':
      return { kind: 'device', label: `device + ${e.data.id}` }
    case 'RemovedDevice':
      return { kind: 'device', label: `device - ${e.data.id}` }
  }
}
