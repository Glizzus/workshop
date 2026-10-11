// Runtime checks for code shown in the skill's reference files (src/examples/).
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { render, screen } from '@testing-library/vue'
import { useQuery, useQueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { http, HttpResponse } from 'msw/http'
import { apiUrl } from '@/api/client'
import { todoQueries } from '@/queries/todos'
import DependentQueries from '@/examples/DependentQueries.vue'
import ManyTodos from '@/examples/ManyTodos.vue'
import OptimisticAdd from '@/examples/OptimisticAdd.vue'
import TodoTitles from '@/examples/TodoTitles.vue'
import { jobQueries } from '@/examples/queries'
import { server } from '../mocks/server'
import { createTestQueryClient, renderWithQueryClient, withQueryClient } from '../query-test-utils'

afterEach(() => vi.useRealTimers())

describe('reference snippets', () => {
  it('useQueries + combine returns one ref', async () => {
    renderWithQueryClient(ManyTodos, { props: { ids: [1, 3] } })
    expect(await screen.findByText('Write tests')).toBeInTheDocument()
    expect(screen.getByText('Buy milk')).toBeInTheDocument()
  })

  it('skipToken dependent query waits for its input', async () => {
    const calls: string[] = []
    server.use(
      http.get(apiUrl('/me'), async () => {
        calls.push('me')
        await new Promise((resolve) => setTimeout(resolve, 50))
        return HttpResponse.json({ id: 1, name: 'A', teamId: 7 })
      }),
      http.get(apiUrl('/teams/:id/projects'), ({ params }) => {
        calls.push(`projects:${String(params.id)}`)
        return HttpResponse.json([{ id: 1, name: 'Apollo' }])
      }),
    )
    renderWithQueryClient(DependentQueries)
    expect(await screen.findByText('Apollo')).toBeInTheDocument()
    expect(calls).toEqual(['me', 'projects:7'])
  })

  it('select derives data without changing the cache', async () => {
    renderWithQueryClient(TodoTitles)
    expect(await screen.findByText('Walk the dog')).toBeInTheDocument()
  })

  it('optimistic update through the UI shows the pending row', async () => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => (release = resolve))
    server.use(
      http.post(apiUrl('/todos'), async () => {
        await gate
        return HttpResponse.json({ id: 9, title: 'Fresh', done: false }, { status: 201 })
      }),
    )
    const { user } = renderWithQueryClient(OptimisticAdd)
    await screen.findByText('Buy milk')
    await user.type(screen.getByRole('textbox', { name: 'New todo' }), 'Fresh')
    await user.click(screen.getByRole('button', { name: 'Add' }))
    expect(await screen.findByText('Fresh')).toHaveClass('pending')
    release()
    await expect.poll(() => screen.queryByText('Fresh')?.className ?? 'gone').not.toBe('pending')
  })

  it('refetchInterval polls until done, then stops', async () => {
    vi.useFakeTimers()
    const statuses = ['running', 'running', 'done']
    let calls = 0
    server.use(
      http.get(apiUrl('/jobs/:id'), () =>
        HttpResponse.json({ id: 'j1', status: statuses[Math.min(calls++, 2)] }),
      ),
    )
    const { result } = withQueryClient(() => useQuery(jobQueries.detail('j1')))
    await vi.waitFor(() => expect(result.data.value?.status).toBe('running'))
    await vi.advanceTimersByTimeAsync(2000)
    await vi.advanceTimersByTimeAsync(2000)
    await vi.waitFor(() => expect(result.data.value?.status).toBe('done'))
    await vi.advanceTimersByTimeAsync(10_000)
    expect(calls).toBe(3)
  })

  it('useQueryClient works in beforeResolve and async beforeEnter guards', async () => {
    const queryClient = createTestQueryClient()
    const spy = vi.spyOn(queryClient, 'query')
    const Page = defineComponent({ render: () => h('p', 'page') })
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: Page },
        {
          path: '/todos/:id',
          name: 'todo',
          component: Page,
          beforeEnter: async (to) => {
            const client = useQueryClient() // before the await
            try {
              await client.query(todoQueries.detail(Number(to.params.id)))
            } catch {
              return { path: '/' }
            }
          },
        },
      ],
    })
    router.beforeResolve((to) => {
      if (to.name === 'todo') {
        useQueryClient().query(todoQueries.detail(Number(to.params.id))).catch(() => {})
      }
    })
    render(defineComponent({ render: () => h(RouterView) }), {
      global: { plugins: [[VueQueryPlugin, { queryClient }], router] },
    })
    await router.isReady()
    await router.push('/todos/1')
    await router.push('/todos/2') // beforeEnter does not run again for a param change
    expect(router.currentRoute.value.fullPath).toBe('/todos/2')
    expect(spy.mock.calls.map(([options]) => (options as { queryKey: unknown }).queryKey)).toEqual([
      ['todos', 'detail', 1],
      ['todos', 'detail', 1],
      ['todos', 'detail', 2],
    ])
  })
})
