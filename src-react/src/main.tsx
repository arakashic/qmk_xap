import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { XapClientContext } from '@/queries/client-context'
import { MockXapClient } from '@/xap/mock/client'
import App from './App'
import './styles/globals.css'

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <XapClientContext.Provider value={new MockXapClient()}>
        <App />
      </XapClientContext.Provider>
    </QueryClientProvider>
  </StrictMode>,
)
