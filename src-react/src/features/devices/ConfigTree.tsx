import * as React from 'react'

/**
 * filterTree: returns the subtree whose key-path OR leaf value matches query
 * (case-insensitive). Prunes non-matching branches, keeps ancestors of matches.
 * query === '' → returns whole tree unchanged. Nothing matches → null.
 */
export function filterTree(node: unknown, query: string): unknown | null {
  if (query === '') return node

  const q = query.toLowerCase()

  if (node === null || node === undefined) {
    return null
  }

  if (typeof node === 'object' && !Array.isArray(node)) {
    const obj = node as Record<string, unknown>
    const result: Record<string, unknown> = {}
    for (const key of Object.keys(obj)) {
      // Key itself matches — keep the whole subtree
      if (key.toLowerCase().includes(q)) {
        result[key] = obj[key]
        continue
      }
      // Recurse into value
      const filtered = filterTree(obj[key], query)
      if (filtered !== null) {
        result[key] = filtered
      }
    }
    return Object.keys(result).length > 0 ? result : null
  }

  if (Array.isArray(node)) {
    // Treat arrays like objects with numeric keys, but preserve as array
    const result: unknown[] = []
    let anyMatch = false
    for (const item of node) {
      const filtered = filterTree(item, query)
      if (filtered !== null) {
        result.push(filtered)
        anyMatch = true
      } else {
        result.push(null)
      }
    }
    return anyMatch ? result : null
  }

  // Leaf: check if string representation matches
  const str = String(node).toLowerCase()
  return str.includes(q) ? node : null
}

// ---------- ConfigTree rendering ----------

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

interface TreeNodeProps {
  /** pre-filtered data to render (no additional filtering done here) */
  data: unknown
  nodeKey?: string
  depth?: number
  /** when true, node starts expanded and toggle is disabled */
  autoExpand?: boolean
}

/**
 * TreeNode renders already-filtered data. Filtering is done once at the top
 * level in ConfigTree; nodes receive the pre-pruned subtree.
 */
function TreeNode({ data, nodeKey, depth = 0, autoExpand = false }: TreeNodeProps) {
  const isObj = isObject(data)
  const isArr = Array.isArray(data)
  const isExpandable = isObj || isArr

  const [open, setOpen] = React.useState(depth === 0 || autoExpand)
  const isOpen = autoExpand ? true : open

  const indent = depth * 14

  if (isExpandable) {
    const entries = isArr
      ? (data as unknown[]).map((v, i) => [String(i), v] as [string, unknown])
      : Object.entries(data as Record<string, unknown>)

    return (
      <div>
        {nodeKey !== undefined && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              paddingLeft: indent,
              paddingTop: 2,
              paddingBottom: 2,
              cursor: autoExpand ? 'default' : 'pointer',
              fontSize: 12,
              lineHeight: '18px',
              color: 'hsl(var(--foreground))',
            }}
            onClick={() => !autoExpand && setOpen((v) => !v)}
          >
            <span
              style={{
                fontSize: 9,
                color: 'hsl(var(--muted-foreground))',
                display: 'inline-block',
                width: 10,
                textAlign: 'center',
                transition: 'transform .1s',
                transform: isOpen ? 'rotate(90deg)' : 'none',
              }}
            >
              ▶
            </span>
            <span style={{ fontWeight: 500, color: 'hsl(var(--primary))' }}>{nodeKey}</span>
            <span style={{ color: 'hsl(var(--muted-foreground))', fontSize: 10 }}>
              {isArr ? `[${(data as unknown[]).length}]` : '{…}'}
            </span>
          </div>
        )}
        {isOpen && (
          <div>
            {entries.map(([k, v]) => (
              <TreeNode
                key={k}
                nodeKey={k}
                data={v}
                depth={nodeKey !== undefined ? depth + 1 : depth}
                autoExpand={autoExpand}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  // Leaf
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        paddingLeft: indent,
        paddingTop: 1,
        paddingBottom: 1,
        fontSize: 12,
        lineHeight: '18px',
        gap: 4,
      }}
    >
      {nodeKey !== undefined && (
        <>
          <span style={{ color: 'hsl(var(--foreground))', fontWeight: 500 }}>{nodeKey}</span>
          <span style={{ color: 'hsl(var(--muted-foreground))' }}>:</span>
        </>
      )}
      <span
        style={{
          color:
            typeof data === 'boolean'
              ? 'hsl(var(--primary))'
              : typeof data === 'number'
                ? 'hsl(142 71% 35%)'
                : 'hsl(var(--muted-foreground))',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 11,
        }}
      >
        {JSON.stringify(data)}
      </span>
    </div>
  )
}

export function ConfigTree({ data, query }: { data: unknown; query: string }) {
  // Filter once at the root; TreeNode renders pre-filtered data as-is
  const filtered = query ? filterTree(data, query) : data
  if (filtered === null) {
    return (
      <div style={{ padding: '16px 0', textAlign: 'center', color: 'hsl(var(--muted-foreground))', fontSize: 12 }}>
        No matches for &ldquo;{query}&rdquo;
      </div>
    )
  }

  if (isObject(filtered) || Array.isArray(filtered)) {
    const entries = Array.isArray(filtered)
      ? (filtered as unknown[]).map((v, i) => [String(i), v] as [string, unknown])
      : Object.entries(filtered as Record<string, unknown>)
    return (
      <div style={{ paddingTop: 4, paddingBottom: 4 }}>
        {entries.map(([k, v]) => (
          <TreeNode key={k} nodeKey={k} data={v} depth={0} autoExpand={!!query} />
        ))}
      </div>
    )
  }

  // Scalar root
  return <TreeNode data={filtered} depth={0} />
}
