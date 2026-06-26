export function unwrap<T>(r: { status: 'ok'; data: T } | { status: 'error'; error: unknown }): T {
  if (r.status === 'ok') return r.data
  const e = r.error
  if (typeof e === 'string') throw new Error(e)
  throw new Error(String(e))
}
