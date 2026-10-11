// Global error handling: one place for toasts/logging instead of onError on every query.
import { QueryCache, QueryClient } from '@tanstack/vue-query'

declare function showToast(message: string): void

export function createAppQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        // Only toast for background refetch failures; first loads show their own error UI
        if (query.state.data !== undefined) showToast(`Could not refresh: ${error.message}`)
      },
    }),
    defaultOptions: { queries: { staleTime: 30_000 } },
  })
}
