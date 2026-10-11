import { describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/vue'
import { http, HttpResponse } from 'msw/http'
import { renderRoute } from './support/render'
import { server } from './support/setup'

const errorText = /error|could not|couldn.t|failed|unable|went wrong/i

describe('t2 create todo (natural prompt)', () => {
  it('adds a todo and shows it in the list', async () => {
    const { user } = await renderRoute('/todos')
    await screen.findByText('Buy milk')
    await user.type(screen.getByRole('textbox', { name: 'New todo' }), 'Call mom')
    await user.click(screen.getByRole('button', { name: 'Add' }))
    expect(await screen.findByText('Call mom')).toBeInTheDocument()
  })
  it('tells the user when saving fails', async () => {
    server.use(http.post('http://localhost:3000/api/todos', () => HttpResponse.json({ message: 'nope' }, { status: 500 })))
    const { user } = await renderRoute('/todos')
    await screen.findByText('Buy milk')
    await user.type(screen.getByRole('textbox', { name: 'New todo' }), 'Doomed')
    await user.click(screen.getByRole('button', { name: 'Add' }))
    await waitFor(() => expect(document.body.textContent).toMatch(errorText), { timeout: 3000 })
    expect(screen.queryByText('Doomed', { selector: 'li' })).toBeNull()
  })
})
