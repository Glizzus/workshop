// Composable-level tests: queries and mutations without UI.
// Values are refs: assert on .value. Wait with vi.waitFor, never with fixed timeouts.
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { http, HttpResponse } from 'msw/http'
import { apiUrl } from '@/api/client'
import { todoQueries, useCreateTodo, useToggleTodo } from '@/queries/todos'
import { server } from './mocks/server'
import { withQueryClient } from './query-test-utils'

describe('todoQueries.list', () => {
  it('loads a page of todos', async () => {
    const { result } = withQueryClient(() => useQuery(todoQueries.list({ status: 'all', page: 1 })))

    expect(result.isPending.value).toBe(true)
    await vi.waitFor(() => expect(result.isSuccess.value).toBe(true))
    expect(result.data.value?.items.map((t) => t.title)).toEqual(['Buy milk', 'Walk the dog'])
    expect(result.data.value?.totalPages).toBe(2)
  })

  it('is in the error state when the server fails', async () => {
    server.use(
      http.get(apiUrl('/todos'), () => HttpResponse.json({ message: 'boom' }, { status: 500 })),
    )
    const { result } = withQueryClient(() => useQuery(todoQueries.list({ status: 'all', page: 1 })))

    await vi.waitFor(() => expect(result.isError.value).toBe(true))
    expect(result.error.value?.message).toBe('HTTP 500')
  })

  it('refetches when a reactive input changes', async () => {
    const page = ref(1)
    const { result } = withQueryClient(() =>
      useQuery(() => todoQueries.list({ status: 'all', page: page.value })),
    )
    await vi.waitFor(() => expect(result.data.value?.page).toBe(1))

    page.value = 2

    await vi.waitFor(() => expect(result.data.value?.page).toBe(2))
    expect(result.data.value?.items.map((t) => t.title)).toEqual(['Write tests'])
  })
})

describe('useCreateTodo', () => {
  it('refetches the lists after creating a todo', async () => {
    const { result } = withQueryClient(() => ({
      openTodos: useQuery(todoQueries.list({ status: 'open', page: 1 })),
      createTodo: useCreateTodo(),
    }))
    await vi.waitFor(() => expect(result.openTodos.data.value?.totalPages).toBe(1))

    await result.createTodo.mutateAsync({ title: 'Call mom' }) // always await mutateAsync

    await vi.waitFor(() => expect(result.openTodos.data.value?.totalPages).toBe(2))
  })
})

describe('useToggleTodo', () => {
  it('updates the cache at once and rolls back when the server fails', async () => {
    let releaseResponse!: () => void
    const responseGate = new Promise<void>((resolve) => (releaseResponse = resolve))
    server.use(
      http.patch(apiUrl('/todos/:id'), async () => {
        await responseGate // hold the response so we can see the optimistic state
        return HttpResponse.json({ message: 'nope' }, { status: 500 })
      }),
    )
    const { result } = withQueryClient(() => ({
      todo: useQuery(todoQueries.detail(1)),
      toggle: useToggleTodo(),
    }))
    await vi.waitFor(() => expect(result.todo.data.value?.done).toBe(false))

    result.toggle.mutate({ id: 1, done: true })
    await vi.waitFor(() => expect(result.todo.data.value?.done).toBe(true)) // optimistic

    releaseResponse()
    await vi.waitFor(() => expect(result.toggle.isError.value).toBe(true))
    await vi.waitFor(() => expect(result.todo.data.value?.done).toBe(false)) // rolled back
  })
})
