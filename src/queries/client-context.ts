import { createContext, useContext } from 'react'
import type { XapClient } from '@/xap/client'

export const XapClientContext = createContext<XapClient | null>(null)

export const useXapClient = () => {
  const c = useContext(XapClientContext)
  if (!c) throw new Error('no XapClient')
  return c
}
