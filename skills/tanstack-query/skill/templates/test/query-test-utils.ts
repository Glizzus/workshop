// Test helpers. Pick ONE per test:
//   renderRoute('/todos/1')            → a view, rendered through the real router (route props, guards)
//   renderWithQueryClient(Comp, opts)   → one component with props you pass yourself
//   withQueryClient(() => useX())       → a composable or query with no UI
// Each call gets a NEW QueryClient, so no cached data leaks from one test into the next.
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { render, type RenderOptions } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { mount } from '@vue/test-utils'
import { defineComponent, h, type Component } from 'vue'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { routes } from '@/router'

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      // Default is 3 retries with exponential backoff: error tests would time out
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
}

function createTestRouter(initialPath = '/') {
  const history = createMemoryHistory()
  history.replace(initialPath) // the router's first navigation goes straight here
  return createRouter({ history, routes })
}

export async function renderRoute(path: string, queryClient = createTestQueryClient()) {
  const router = createTestRouter(path)
  const Host = defineComponent({ render: () => h(RouterView) })
  // VueQueryPlugin first: route guards call useQueryClient()
  const result = render(Host, {
    global: { plugins: [[VueQueryPlugin, { queryClient }], router] },
  })
  await router.isReady()
  return { ...result, router, queryClient, user: userEvent.setup() }
}

export function renderWithQueryClient<C extends Component>(
  component: C,
  options: RenderOptions<C> = {},
  queryClient = createTestQueryClient(),
) {
  const router = createTestRouter() // so RouterLink and useRouter() work
  const result = render(component, {
    ...options,
    global: {
      ...options.global,
      plugins: [...(options.global?.plugins ?? []), [VueQueryPlugin, { queryClient }], router],
    },
  })
  return { ...result, router, queryClient, user: userEvent.setup() }
}

export function withQueryClient<T>(composable: () => T, queryClient = createTestQueryClient()) {
  let result!: T
  // Composables need a component setup() (injection context) to find the QueryClient
  const Host = defineComponent({
    setup() {
      result = composable()
      return () => null
    },
  })
  const wrapper = mount(Host, { global: { plugins: [[VueQueryPlugin, { queryClient }]] } })
  return { result, queryClient, unmount: () => wrapper.unmount() }
}
