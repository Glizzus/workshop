# Testing TanStack Query code in Vue

The official docs have no Vue testing page, so most examples you know are React (`renderHook`, `QueryClientProvider`, `@testing-library/react`). Use the Vue setup below instead.

## Contents
- Stack
- Setup
- Which helper
- Mocking the network
- Patterns
- Pitfalls
- MSW 2 vs 3

## Stack

| Tool | Job |
|---|---|
| Vitest + jsdom | test runner, reuses vite.config.ts |
| @testing-library/vue + user-event + jest-dom | render components, act like a user, assert what is on screen |
| @vue/test-utils | runs composables inside a real component (one helper uses it) |
| MSW | fake network: tests run your real `apiFetch`, including error handling |

```bash
npm i -D vitest jsdom msw @testing-library/vue @testing-library/user-event @testing-library/jest-dom @vue/test-utils
```

## Setup

Copy from templates/:

| File | What it does |
|---|---|
| `vite.config.ts` | the `test` block: jsdom, `setupFiles`, `include`. Merge into an existing vite.config.ts. |
| `test/setup.ts` | starts MSW, fails on unhandled requests, cleans up after each test |
| `test/mocks/handlers.ts` | the fake API. Handlers use `apiUrl()` from the API client, so URLs always match. |
| `test/mocks/db.ts` | in-memory data, reset after each test |
| `test/mocks/server.ts` | `setupServer(...handlers)` |
| `test/query-test-utils.ts` | `createTestQueryClient`, `renderRoute`, `renderWithQueryClient`, `withQueryClient` |
| `test/*.test.ts` | example tests for every pattern below |

Add `"test/**/*.ts"` to the `include` of the tsconfig that `vue-tsc` checks, so tests are type-checked too. In create-vue projects that is `tsconfig.vitest.json` (or `tsconfig.app.json`); the root tsconfig.json only lists references.

## Which helper

| Testing | Helper | Example |
|---|---|---|
| a view, through the router (route props, guards, links) | `await renderRoute('/todos/1')` | templates/test/TodoDetailView.test.ts |
| one component with props you pass | `renderWithQueryClient(Comp, { props })` | templates/test/TodoListView.test.ts (last test) |
| a query factory or mutation composable, no UI | `withQueryClient(() => useQuery(...))` | templates/test/todo-queries.test.ts |

Each call creates a new QueryClient with `retry: false`. Pass your own client as the last argument to seed or inspect the cache.

## Mocking the network

Mock the network, not the library:

```ts
// default handlers live in test/mocks/handlers.ts; override per test:
server.use(http.get(apiUrl('/todos'), () => HttpResponse.json({ message: 'boom' }, { status: 500 })))
```

- **Assert what the user sees** (or the query's `data` / `error`), not which requests were made.
- **To test a write, assert the result:** the fake db changed, and the list shows the new item after invalidation.
- **Overrides with `server.use` last for one test.** `setup.ts` resets them and the db afterwards.
- **Don't `vi.mock('@tanstack/vue-query')`** or fake `useQuery`'s return value. Such tests pass while loading, error and caching are broken.
- **Mocking your own API module** (`vi.mock('@/api/todos')`) works, but skips `apiFetch`, so the 404/500 handling goes untested. Prefer MSW.

## Patterns

All of these are in templates/test/ and pass as written.

**Loading → data** (composable):

```ts
const { result } = withQueryClient(() => useQuery(todoQueries.list({ status: 'all', page: 1 })))
expect(result.isPending.value).toBe(true)
await vi.waitFor(() => expect(result.isSuccess.value).toBe(true))
expect(result.data.value?.items).toHaveLength(2)
```

**A view, through the router:**

```ts
await renderRoute('/todos?status=done')
expect(await screen.findByRole('link', { name: 'Walk the dog' })).toBeInTheDocument()
```

**Error state:**

```ts
server.use(http.get(apiUrl('/todos'), () => new HttpResponse(null, { status: 500 })))
await renderRoute('/todos')
expect(await screen.findByRole('alert')).toHaveTextContent('HTTP 500')
```

**The query follows its input** (catches frozen reads):

```ts
const { router } = await renderRoute('/todos/1')
await screen.findByRole('heading', { name: 'Buy milk' })
await router.push('/todos/2')
expect(await screen.findByRole('heading', { name: 'Walk the dog' })).toBeInTheDocument()
```

**Mutation + invalidation:**

```ts
const { user } = await renderRoute('/todos?status=open')
await screen.findByText('Page 1 of 1')
await user.type(screen.getByRole('textbox', { name: 'New todo' }), 'Call mom')
await user.click(screen.getByRole('button', { name: 'Add' }))
expect(await screen.findByText('Page 1 of 2')).toBeInTheDocument() // the list refetched
```

**Optimistic update + rollback.** Hold the response with a promise you release yourself:

```ts
let releaseResponse!: () => void
const responseGate = new Promise<void>((resolve) => (releaseResponse = resolve))
server.use(http.patch(apiUrl('/todos/:id'), async () => {
  await responseGate
  return new HttpResponse(null, { status: 500 })
}))
// ...click: assert the optimistic state; releaseResponse(); assert the rollback
```

**Seeded cache** (no request at all):

```ts
const queryClient = createTestQueryClient()
queryClient.setQueryData(todoQueries.detail(7).queryKey, { id: 7, title: 'Seeded', done: false })
queryClient.setQueryDefaults(todoQueries.detail(7).queryKey, { staleTime: Infinity })
await renderRoute('/todos/7', queryClient)
```

**Polling** (fake timers):

```ts
vi.useFakeTimers() // and vi.useRealTimers() in afterEach
const { result } = withQueryClient(() => useQuery(jobQueries.detail('j1')))
await vi.waitFor(() => expect(result.data.value?.status).toBe('running'))
await vi.advanceTimersByTimeAsync(2000) // one interval
```

Use `vi.waitFor` with fake timers; it advances them. Keep `findBy*` for real-timer tests.

**Infinite list:** click "Load more", then `findByText` an item from page 2 (templates/test/TodoFeedView.test.ts).

**Dependent query:** assert the second request happens only after the first data arrives. Record calls in the handler.

## Pitfalls

| Mistake | What happens | Fix |
|---|---|---|
| one QueryClient shared by all tests (module level) | cached data from one test answers the next one | a new client per test (the helpers do this). |
| QueryClient without `retry: false` | error tests time out: 3 retries with backoff | `createTestQueryClient()`. |
| `mutateAsync()` not awaited | "Unhandled Rejection", and the run fails even though tests pass | `await` it, or `await expect(...).rejects` |
| `getBy*` right after render | element not there yet: the data is async | `await findBy*` first, then `getBy*` |
| fixed sleeps (`setTimeout(…, 100)`) | slow and flaky | `findBy*` / `vi.waitFor` |
| asserting `isLoading` for "no data yet" | a disabled query is pending but not loading | `isPending` |
| React imports (`renderHook`, `QueryClientProvider`, `@testing-library/react`) | not Vue | helpers in query-test-utils.ts. |
| `logger:` in `new QueryClient` | v4 option, type error | delete it |
| composable called outside a component in a test | "vue-query hooks can only be used inside setup()" | `withQueryClient(() => useX())` |
| relative URLs in MSW handlers that don't match the client | "unhandled request" errors | build handler URLs with `apiUrl()` |
| `IntersectionObserver` in a component under test | jsdom doesn't have it | test the button path, or stub it |

## MSW 2 vs 3

MSW 3 was released on 28 September 2026. Check `msw` in package.json:

| | MSW 2 | MSW 3 |
|---|---|---|
| handler imports | `import { http, HttpResponse } from 'msw'` | `import { http, HttpResponse } from 'msw/http'` (`'msw'` still re-exports them) |
| fail on unhandled requests | `server.listen({ onUnhandledRequest: 'error' })` | `server.listen({ onUnhandledFrame: 'error' })` |
| Node | 18+ | 22.12+ (ESM only) |
| `setupServer` | `from 'msw/node'` | `from 'msw/node'` (unchanged) |

At runtime the wrong option name is **silently ignored**: unhandled requests then only warn, and tests may pass against the real network. TypeScript reports it only if test files are type-checked.

MSW 1 code (`rest.get`, `res(ctx.json(...))`) is gone in both. Rewrite it as `http.get(url, () => HttpResponse.json(...))`.
