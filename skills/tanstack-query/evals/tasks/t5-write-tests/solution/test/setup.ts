import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/vue'
import { enableAutoUnmount } from '@vue/test-utils'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { resetDb } from './mocks/db'
import { server } from './mocks/server'

// Any request without a handler fails the test instead of hitting the network.
// MSW 3: onUnhandledFrame. MSW 2: onUnhandledRequest. The wrong name is SILENTLY ignored.
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))

afterEach(() => {
  cleanup() // unmount everything rendered with @testing-library/vue
  server.resetHandlers() // drop per-test overrides added with server.use(...)
  resetDb() // fresh fake data for the next test
})

enableAutoUnmount(afterEach) // unmount @vue/test-utils mounts (stops their query observers)

afterAll(() => server.close())
