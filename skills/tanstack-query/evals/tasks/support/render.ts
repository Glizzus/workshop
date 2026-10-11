import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { render } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { routes } from '@/router'

export async function renderRoute(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const history = createMemoryHistory()
  history.replace(path)
  const router = createRouter({ history, routes })
  const Host = defineComponent({ render: () => h(RouterView) })
  const result = render(Host, { global: { plugins: [[VueQueryPlugin, { queryClient }], router] } })
  await router.isReady()
  return { ...result, router, queryClient, user: userEvent.setup() }
}
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
