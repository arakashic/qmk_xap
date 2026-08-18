import type { ReactNode } from 'react'
import type { KeyCode } from '@/xap/types'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'

interface KeyTooltipProps {
  code: KeyCode
  children: ReactNode
}

/** Wraps a picker cap so hovering or focusing it explains the keycode. */
export function KeyTooltip({ code, children }: KeyTooltipProps) {
  const detail = code.description ?? code.label

  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>
        {/* Brighter than the inherited rail foreground so the keycode name
            leads and the description reads as secondary. */}
        <div style={{ fontFamily: '"JetBrains Mono", monospace', fontWeight: 500, fontSize: 11, color: '#fff' }}>
          {code.key}
        </div>
        {detail && detail !== code.key && (
          <div style={{ fontSize: 11, opacity: 0.8 }}>{detail}</div>
        )}
      </TooltipContent>
    </Tooltip>
  )
}
