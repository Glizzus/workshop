import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/vue'
import { http, HttpResponse } from 'msw/http'
import { apiUrl } from '@/api/client'
import { todoQueries } from '@/queries/todos'
import { server } from './mocks/server'
import { createTestQueryClient, renderRoute } from './query-test-utils'

describe('TodoDetailView', () => {
  it('loads the todo from the route and follows route changes', async () => {
    const { router } = await renderRoute('/todos/1')
    expect(await screen.findByRole('heading', { name: 'Buy milk' })).toBeInTheDocument()

    await router.push('/todos/2') // same component, new id prop

    expect(await screen.findByRole('heading', { name: 'Walk the dog' })).toBeInTheDocument()
  })

  it('shows a 404 as an error', async () => {
    await renderRoute('/todos/999')

    expect(await screen.findByRole('alert')).toHaveTextContent('HTTP 404')
  })

  it('flips done at once and rolls back when saving fails', async () => {
    let releaseResponse!: () => void
    const responseGate = new Promise<void>((resolve) => (releaseResponse = resolve))
    server.use(
      http.patch(apiUrl('/todos/:id'), async () => {
        await responseGate
        return new HttpResponse(null, { status: 500 })
      }),
    )
    const { user } = await renderRoute('/todos/1')
    const checkbox = await screen.findByRole('checkbox', { name: 'Done' })
    expect(checkbox).not.toBeChecked()

    await user.click(checkbox)
    expect(checkbox).toBeChecked() // optimistic

    releaseResponse()
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not update: HTTP 500')
    expect(screen.getByRole('checkbox', { name: 'Done' })).not.toBeChecked() // rolled back
  })

  it('edits the title', async () => {
    const { user } = await renderRoute('/todos/1')
    await user.click(await screen.findByRole('button', { name: 'Edit' }))

    const input = screen.getByRole('textbox', { name: 'Title' })
    await user.clear(input)
    await user.type(input, 'Buy oat milk')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('heading', { name: 'Buy oat milk' })).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Title' })).not.toBeInTheDocument()
  })

  it('renders cached data without a request', async () => {
    const queryClient = createTestQueryClient()
    // Seed the cache. Pass the key from the same factory the app uses.
    queryClient.setQueryData(todoQueries.detail(7).queryKey, { id: 7, title: 'Seeded', done: false })
    // staleTime keeps it fresh, so no background refetch either
    queryClient.setQueryDefaults(todoQueries.detail(7).queryKey, { staleTime: Infinity })
    server.use(http.get(apiUrl('/todos/:id'), () => HttpResponse.error())) // any request would fail

    await renderRoute('/todos/7', queryClient)

    expect(await screen.findByRole('heading', { name: 'Seeded' })).toBeInTheDocument()
  })
})
