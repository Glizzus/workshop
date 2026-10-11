import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/vue'
import { renderRoute, sleep } from './support/render'
import { db } from './support/db'

describe('t4 job polling', () => {
  it('polls until done, then stops', async () => {
    db.jobStatuses = ['queued', 'running', 'done']
    await renderRoute('/jobs/j1')
    expect(await screen.findByText(/Status: queued/)).toBeInTheDocument()
    expect(await screen.findByText(/Status: done/, {}, { timeout: 6000 })).toBeInTheDocument()
    const calls = db.jobCalls
    await sleep(2500)
    expect(db.jobCalls).toBe(calls)
  })
  it('stops polling after leaving the page', async () => {
    db.jobStatuses = ['running']
    const { router } = await renderRoute('/jobs/j2')
    expect(await screen.findByText(/Status: running/)).toBeInTheDocument()
    await router.push('/todos')
    await screen.findByRole('heading', { name: 'Todos' })
    const calls = db.jobCalls
    await sleep(2500)
    expect(db.jobCalls).toBe(calls)
  })
})
