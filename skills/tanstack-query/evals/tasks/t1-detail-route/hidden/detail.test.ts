import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/vue'
import { renderRoute } from './support/render'

describe('t1 detail route', () => {
  it('shows the todo from the URL', async () => {
    await renderRoute('/todos/2')
    expect(await screen.findByRole('heading', { name: 'Walk the dog' })).toBeInTheDocument()
    expect(screen.getByText(/Status: Done/)).toBeInTheDocument()
  })
  it('follows the route from one todo to another', async () => {
    const { router } = await renderRoute('/todos/1')
    expect(await screen.findByRole('heading', { name: 'Buy milk' })).toBeInTheDocument()
    await router.push('/todos/2')
    expect(await screen.findByRole('heading', { name: 'Walk the dog' })).toBeInTheDocument()
  })
  it('shows an error for a missing todo', async () => {
    await renderRoute('/todos/999')
    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })
  it('links from the list to the detail page', async () => {
    const { user } = await renderRoute('/todos')
    await user.click(await screen.findByRole('link', { name: 'Write tests' }))
    expect(await screen.findByRole('heading', { name: 'Write tests' })).toBeInTheDocument()
  })
})
