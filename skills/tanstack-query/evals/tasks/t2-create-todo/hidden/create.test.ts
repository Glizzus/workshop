import { describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/vue'
import { http, HttpResponse } from 'msw/http'
import { renderRoute } from './support/render'
import { server } from './support/setup'

describe('t2 create todo', () => {
  it('adds a todo and shows it in the list', async () => {
    const { user } = await renderRoute('/todos')
    await screen.findByText('Buy milk')
    await user.type(screen.getByRole('textbox', { name: 'New todo' }), 'Call mom')
    await user.click(screen.getByRole('button', { name: 'Add' }))
    expect(await screen.findByText('Call mom')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'New todo' })).toHaveValue(''))
  })
  it('disables Add while saving', async () => {
    let release!: () => void
    const gate = new Promise<void>((r) => (release = r))
    server.use(http.post('http://localhost:3000/api/todos', async () => {
      await gate
      return HttpResponse.json({ id: 99, title: 'Slow', done: false }, { status: 201 })
    }))
    const { user } = await renderRoute('/todos')
    await screen.findByText('Buy milk')
    await user.type(screen.getByRole('textbox', { name: 'New todo' }), 'Slow')
    await user.click(screen.getByRole('button', { name: 'Add' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled())
    release()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add' })).toBeEnabled())
  })
  it('shows an error when saving fails', async () => {
    server.use(http.post('http://localhost:3000/api/todos', () => HttpResponse.json({ message: 'nope' }, { status: 500 })))
    const { user } = await renderRoute('/todos')
    await screen.findByText('Buy milk')
    await user.type(screen.getByRole('textbox', { name: 'New todo' }), 'Doomed')
    await user.click(screen.getByRole('button', { name: 'Add' }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })
})
