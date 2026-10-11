import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { screen, waitFor } from '@testing-library/vue'
import { delay, http, HttpResponse } from 'msw'
import { renderRoute } from './support/render'
import { server } from './support/setup'
import { db } from './support/db'

describe('t3 refactor projects', () => {
  it('shows team 1 by default', async () => {
    await renderRoute('/projects')
    expect(await screen.findByText('Apollo')).toBeInTheDocument()
  })
  it('switches teams with the buttons', async () => {
    const { user } = await renderRoute('/projects')
    await screen.findByText('Apollo')
    await user.click(screen.getByRole('button', { name: 'Team 2' }))
    expect(await screen.findByText('Mercury')).toBeInTheDocument()
    expect(screen.queryByText('Apollo')).not.toBeInTheDocument()
  })
  it('shows an error when loading fails', async () => {
    server.use(http.get('http://localhost:3000/api/teams/:id/projects', () => HttpResponse.json({ message: 'x' }, { status: 500 })))
    await renderRoute('/projects?team=1')
    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })
  it('Refresh reloads from the server', async () => {
    const { user } = await renderRoute('/projects?team=2')
    await screen.findByText('Mercury')
    const before = db.calls.filter((c) => c === 'GET /teams/2/projects').length
    db.projects['2'] = [{ id: 3, name: 'Mercury' }, { id: 4, name: 'Vostok' }]
    await user.click(screen.getByRole('button', { name: 'Refresh' }))
    expect(await screen.findByText('Vostok')).toBeInTheDocument()
    expect(db.calls.filter((c) => c === 'GET /teams/2/projects').length).toBeGreaterThan(before)
  })
  it('shows a team it already loaded at once when switching back (cached)', async () => {
    server.use(http.get('http://localhost:3000/api/teams/:id/projects', async ({ params }) => {
      await delay(200)
      return HttpResponse.json(db.projects[String(params.id)] ?? [])
    }))
    const { router } = await renderRoute('/projects?team=1')
    await screen.findByText('Apollo', {}, { timeout: 3000 })
    await router.push('/projects?team=2')
    await screen.findByText('Mercury', {}, { timeout: 3000 })
    await router.push('/projects?team=1')
    await nextTick()
    await nextTick()
    expect(screen.getByText('Apollo')).toBeInTheDocument() // from cache, before the 200ms response
    await waitFor(() => expect(screen.getByText('Apollo')).toBeInTheDocument())
  })
})
