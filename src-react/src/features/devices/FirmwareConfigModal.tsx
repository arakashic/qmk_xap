import * as React from 'react'
import type { XapDeviceState } from '@/xap/types'
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConfigTree } from './ConfigTree'

interface FirmwareConfigModalProps {
  state: XapDeviceState
}

export function FirmwareConfigModal({ state }: FirmwareConfigModalProps) {
  const [query, setQuery] = React.useState('')
  const [copied, setCopied] = React.useState(false)

  let parsed: unknown = null
  let parseError = false
  try {
    parsed = JSON.parse(state.config_json)
  } catch {
    parseError = true
  }

  function handleCopy() {
    navigator.clipboard.writeText(state.config_json).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" style={{ fontSize: 12 }}>
          ⚙ Firmware config
        </Button>
      </DialogTrigger>
      <DialogContent
        style={{
          maxWidth: 520,
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          gap: 0,
          padding: 0,
          overflow: 'hidden',
        }}
      >
        <DialogHeader
          style={{
            padding: '16px 16px 12px',
            borderBottom: '1px solid hsl(var(--border))',
          }}
        >
          <DialogTitle style={{ fontSize: 14 }}>Firmware config</DialogTitle>
          <DialogClose asChild>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Close"
              style={{ position: 'absolute', top: 8, right: 8, height: 28, padding: '0 8px', fontSize: 14 }}
            >
              ✕
            </Button>
          </DialogClose>
        </DialogHeader>

        {/* Filter + copy row */}
        <div
          style={{
            display: 'flex',
            gap: 8,
            padding: '10px 16px',
            alignItems: 'center',
            borderBottom: '1px solid hsl(var(--border))',
          }}
        >
          <Input
            placeholder="Filter (e.g. tapping_term)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ flex: 1, fontSize: 12, height: 30 }}
          />
          <Button variant="outline" size="sm" onClick={handleCopy} style={{ fontSize: 12, flexShrink: 0 }}>
            {copied ? 'Copied!' : 'Copy JSON'}
          </Button>
        </div>

        {/* Tree / raw fallback */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 16px 12px' }}>
          {parseError ? (
            <pre
              style={{
                fontSize: 11,
                fontFamily: 'JetBrains Mono, monospace',
                color: 'hsl(var(--muted-foreground))',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                marginTop: 8,
              }}
            >
              {state.config_json}
            </pre>
          ) : (
            <ConfigTree data={parsed} query={query} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
