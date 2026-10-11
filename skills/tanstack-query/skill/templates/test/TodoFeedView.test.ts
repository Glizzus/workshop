import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/vue'
import { renderRoute } from './query-test-utils'

describe('TodoFeedView', () => {
  it('loads more pages until there are none left', async () => {
    const { user } = await renderRoute('/feed')
    expect(await screen.findByText('Buy milk')).toBeInTheDocument()
    expect(screen.queryByText('Write tests')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Load more' }))

    expect(await screen.findByText('Write tests')).toBeInTheDocument()
    expect(screen.getByText('Buy milk')).toBeInTheDocument() // earlier pages stay
    expect(await screen.findByText('No more todos.')).toBeInTheDocument()
  })
})
