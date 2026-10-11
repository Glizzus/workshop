import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/vue'
import { renderRoute } from './query-test-utils'

describe('TodoDetailView', () => {
  it('shows the todo for the id in the URL', async () => {
    await renderRoute('/todos/1')
    expect(await screen.findByRole('heading', { name: 'Buy milk' })).toBeInTheDocument()
    expect(screen.getByText('Status: Open')).toBeInTheDocument()
  })

  it('shows an error when the todo cannot be loaded', async () => {
    await renderRoute('/todos/999')
    expect(await screen.findByRole('alert')).toHaveTextContent('HTTP 404')
  })

  it('marks the todo done', async () => {
    const { user } = await renderRoute('/todos/1')
    await user.click(await screen.findByRole('checkbox', { name: 'Done' }))
    expect(await screen.findByText('Status: Done')).toBeInTheDocument()
  })

  it('shows the new todo after navigating to another id', async () => {
    const { router } = await renderRoute('/todos/1')
    await screen.findByRole('heading', { name: 'Buy milk' })
    await router.push('/todos/2')
    expect(await screen.findByRole('heading', { name: 'Walk the dog' })).toBeInTheDocument()
  })
})
