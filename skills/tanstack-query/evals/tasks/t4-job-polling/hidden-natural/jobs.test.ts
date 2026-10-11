import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/vue'
import { renderRoute, sleep } from './support/render'
import { db } from './support/db'

// Interval is unspecified in the natural prompt: allow up to 5 s between refreshes
describe('t4 job polling (natural prompt)', () => {
  it('keeps the status up to date until done, then stops', async () => {
    db.jobStatuses = ['running', 'done']
    await renderRoute('/jobs/j1')
    expect(await screen.findByText(/Status: running/)).toBeInTheDocument()
    expect(await screen.findByText(/Status: done/, {}, { timeout: 8000 })).toBeInTheDocument()
    const calls = db.jobCalls
    await sleep(6000)
    expect(db.jobCalls).toBe(calls)
  })
  it('stops after leaving the page', async () => {
    db.jobStatuses = ['running']
    const { router } = await renderRoute('/jobs/j2')
    expect(await screen.findByText(/Status: running/)).toBeInTheDocument()
    await router.push('/todos')
    await screen.findByRole('heading', { name: 'Todos' })
    const calls = db.jobCalls
    await sleep(6000)
    expect(db.jobCalls).toBe(calls)
  })
})
