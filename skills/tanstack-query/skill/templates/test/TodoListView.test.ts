// View tests: render through the router at a URL, then assert what the user sees.
// findBy* waits for async UI; getBy*/queryBy* do not (use them after something was found).
import { describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/vue'
import { http, HttpResponse } from 'msw/http'
import { apiUrl } from '@/api/client'
import TodoListView from '@/views/TodoListView.vue'
import { server } from './mocks/server'
import { renderRoute, renderWithQueryClient } from './query-test-utils'

describe('TodoListView', () => {
  it('shows the first page of todos', async () => {
    await renderRoute('/todos')

    expect(await screen.findByRole('link', { name: 'Buy milk' })).toBeInTheDocument()
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument()
  })

  it('reads the status filter from the URL', async () => {
    await renderRoute('/todos?status=done')

    expect(await screen.findByRole('link', { name: 'Walk the dog' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Buy milk' })).not.toBeInTheDocument()
  })

  it('goes to the next page', async () => {
    const { user, router } = await renderRoute('/todos')
    await screen.findByRole('link', { name: 'Buy milk' })

    await user.click(screen.getByRole('button', { name: 'Next' }))

    expect(await screen.findByRole('link', { name: 'Write tests' })).toBeInTheDocument()
    expect(router.currentRoute.value.query.page).toBe('2')
  })

  it('adds a todo and refreshes the list', async () => {
    const { user } = await renderRoute('/todos?status=open')
    expect(await screen.findByText('Page 1 of 1')).toBeInTheDocument()

    await user.type(screen.getByRole('textbox', { name: 'New todo' }), 'Call mom')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(await screen.findByText('Page 1 of 2')).toBeInTheDocument() // the list refetched
    // the field clears in the mutate() callback, a tick after the list re-renders
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'New todo' })).toHaveValue(''))
  })

  it('shows an error when loading fails', async () => {
    server.use(http.get(apiUrl('/todos'), () => new HttpResponse(null, { status: 500 })))
    await renderRoute('/todos')

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load todos: HTTP 500')
  })

  it('can also be rendered directly with props', async () => {
    renderWithQueryClient(TodoListView, { props: { filters: { status: 'done', page: 1 } } })

    expect(await screen.findByRole('link', { name: 'Walk the dog' })).toBeInTheDocument()
  })
})
