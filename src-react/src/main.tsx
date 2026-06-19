import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { XapClientContext } from '@/queries/client-context'
import { instrumentClient } from '@/xap/instrument'
import { devtoolsSink } from '@/store/devtools'
import { selectClient } from '@/xap/runtime'
import App from './App'
import './styles/globals.css'

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <XapClientContext.Provider value={instrumentClient(selectClient(), devtoolsSink)}>
        <App />
      </XapClientContext.Provider>
    </QueryClientProvider>
  </StrictMode>,
)
