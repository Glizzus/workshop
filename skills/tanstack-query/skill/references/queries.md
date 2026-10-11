# Queries

## Contents
- Query factories and keys
- One QueryClient
- The API client
- Freshness: staleTime and gcTime
- When queries refetch
- Loading and error states
- Dependent queries
- Polling
- Transforming data with select
- Parallel queries
- Global error handling

## Query factories and keys

Put all query code for one resource in `src/queries/<resource>.ts` (copy templates/src/queries/todos.ts):

```ts
export const todoKeys = {
  all: ['todos'] as const,
  lists: () => [...todoKeys.all, 'list'] as const,
  list: (filters: TodoFilters) => [...todoKeys.lists(), filters] as const,
  details: () => [...todoKeys.all, 'detail'] as const,
  detail: (id: number) => [...todoKeys.details(), id] as const,
}

export const todoQueries = {
  list: (filters: TodoFilters) =>
    queryOptions({
      queryKey: todoKeys.list(filters),
      queryFn: ({ signal }) => getTodos(filters, signal),
    }),
  detail: (id: number) =>
    queryOptions({
      queryKey: todoKeys.detail(id),
      queryFn: ({ signal }) => getTodo(id, signal),
    }),
}
```

Rules:
- **Every value the `queryFn` uses goes in the `queryKey`.** The key is the cache address. Two different requests with the same key overwrite each other.
- **Keys are arrays, from general to specific.** Then one prefix invalidates a whole group: `todoKeys.lists()` matches every list, with any filters.
- **Factories take plain values** (numbers, strings, plain objects), never refs. Components add reactivity with a getter (vue-reactivity.md).
- **Read a key back from the factory** when calling `queryClient` methods. It is typed, so `setQueryData` and `getQueryData` know the data type:

```ts
queryClient.getQueryData(todoQueries.detail(5).queryKey) // Todo | undefined
```

- **Never use the same key for `useQuery` and `useInfiniteQuery`.** They store different shapes; give infinite queries their own key segment (`'infinite'`).
- The ESLint rule `prefer-query-options` flags keys and queryFns written inline in components. That's intended: use the factories.

## One QueryClient

The app has exactly one QueryClient. Create it once in `main.ts` and install it with `VueQueryPlugin` (templates/src/main.ts). Everything else gets it with `useQueryClient()`.

`new QueryClient()` inside a component or composable creates a separate, empty cache. Nothing is shared and nothing is invalidated across components.

Tests are the exception: a new QueryClient per test (testing.md).

## The API client

Every `queryFn` and `mutationFn` calls typed endpoint functions (templates/src/api/todos.ts). Those go through `apiFetch` (templates/src/api/client.ts). It does three things plain `fetch` does not:

1. **Throws on non-2xx.** `fetch()` only rejects on network failure. A 404 or 500 resolves normally. Without the throw, the error body is cached as data and `isError` stays false.
2. **Forwards `signal`.** TanStack Query aborts a request when it is no longer needed (component unmounted, key changed). Pass the `signal` from the queryFn context:

```ts
queryFn: ({ signal }) => getTodo(id, signal)
```

3. **Parses JSON once, in one place.** Auth headers also go there.

To show different messages per status:

```ts
import { ApiError } from '@/api/client'
const notFound = computed(() => error.value instanceof ApiError && error.value.status === 404)
```

## Freshness: staleTime and gcTime

| Option | Default | Meaning |
|---|---|---|
| `staleTime` | `0` | How long data counts as fresh. Fresh data is served from cache with no request. |
| `gcTime` | 5 minutes | How long data stays in memory after the last component using it unmounts. |
| `retry` | 3 (in the browser) | How often a failed query is retried, with growing delays. |

- The templates set a global `staleTime: 30_000` in main.ts. With the default 0, every mount and window focus triggers a refetch.
- Override per query in the factory:
  - **`staleTime: Infinity`**: data only changes when this app changes it. It is still refreshed by `invalidateQueries`.
  - **`staleTime: 'static'`**: data can never change (e.g. a past invoice). It ignores invalidation too.
- `gcTime` is about memory, not freshness. Changing `gcTime` does not stop refetches. Don't set it unless you have a memory reason.

## When queries refetch

A query refetches automatically only when its data is **stale**, and then only when one of these happens:

| Trigger | Option (default `true`) |
|---|---|
| a component using it mounts | `refetchOnMount` |
| the browser window regains focus | `refetchOnWindowFocus` |
| the network reconnects | `refetchOnReconnect` |
| the key changes | always (it's a different query) |
| `queryClient.invalidateQueries(...)` matches it | always, if a component is using it |

So "too many requests" is fixed with a higher `staleTime`, not by turning these off. "Not refreshed after saving" is fixed with invalidation (mutations.md).

Window-focus refetches are easy to notice in development (switching to devtools refocuses the window). That is normal.

## Loading and error states

| Flag | True when |
|---|---|
| `isPending` | there is no data yet: first load, or a disabled query that never ran |
| `isLoading` | the first fetch is running (`isPending && isFetching`) |
| `isFetching` | any fetch is running, including background refetches |
| `isError` | the last fetch failed (`error` holds the error) |
| `isSuccess` | the last fetch succeeded (after a failed refetch it is false, even though `data` still holds the old value) |
| `isPlaceholderData` | showing placeholder data (e.g. the previous page) |

- Use **`isPending`** for "nothing to show yet" on queries that always run.
- Use **`isLoading`** for spinners on queries that can be disabled. A disabled query stays `isPending` forever, but it is not `isLoading`.

Template order (templates/src/views/TodoListView.vue):

```vue
<p v-if="isPending">Loading…</p>
<p v-else-if="isError" role="alert">Could not load: {{ error?.message }}</p>
<template v-else-if="data">…</template>
```

`v-else-if="data"` (not `v-else`) lets TypeScript know `data` is defined inside.

When a background refetch fails, `data` keeps the old value and `isError` becomes true. If you'd rather keep showing that data with a small warning, check `data` before `isError`.

## Dependent queries

Data that needs other data first. Two ways, both inside the getter.

**`skipToken` in the factory**, when a required parameter may be missing. Type-safe, no `!` needed:

```ts
import { queryOptions, skipToken } from '@tanstack/vue-query'

export const projectQueries = {
  byTeam: (teamId: number | undefined) =>
    queryOptions({
      queryKey: ['projects', 'byTeam', teamId],
      queryFn: teamId === undefined ? skipToken : ({ signal }) => getProjects(teamId, signal),
    }),
}

// component
const { data: me } = useQuery(userQueries.me())
const { data: projects, isLoading } = useQuery(() => projectQueries.byTeam(me.value?.teamId))
```

**`enabled`**, for a yes/no condition (dialog open, feature flag):

```ts
const { data } = useQuery(() => ({ ...todoQueries.detail(props.id), enabled: isOpen.value }))
```

Notes:
- With `skipToken`, never call `refetch()`: the query fails with "Missing queryFn". If you need a manual refetch button, use `enabled`; `refetch()` still fetches when `enabled` is false.
- Use `isLoading` for the spinner (see the table above).
- Not: `watch(me, () => refetch())`, or `useQuery` inside a watcher.

## Polling

Use `refetchInterval`. A function can stop polling once a condition is met:

```ts
detail: (id: string) =>
  queryOptions({
    queryKey: ['jobs', id],
    queryFn: ({ signal }) => getJob(id, signal),
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status === 'done' || status === 'failed' ? false : 2000
    },
  }),
```

Polling stops on its own when the component unmounts. While the tab is hidden it pauses, unless you set `refetchIntervalInBackground: true`.

Not: `setInterval(() => refetch(), 2000)`. It keeps running after unmount, and it doesn't stop when the data says "done".

## Transforming data with select

`select` derives what one component needs. The cache keeps the full server response, so other components using the same query are unaffected:

```ts
const { data: titles } = useQuery(() => ({
  ...todoQueries.list({ status: 'all', page: 1 }),
  select: (page) => page.items.map((todo) => todo.title),
}))
```

- Use `select` (or a `computed` over `data`) for derived values.
- Do not transform inside `queryFn` when other components need the raw data.
- Do not store the result in another ref.

## Parallel queries

Several `useQuery` calls in one component already run in parallel.

For a list of queries whose length changes, use `useQueries`. In Vue it returns one ref:

```ts
const results = useQueries({
  queries: () => props.ids.map((id) => todoQueries.detail(id)),
  combine: (queries) => ({
    todos: queries.flatMap((q) => (q.data ? [q.data] : [])),
    isPending: queries.some((q) => q.isPending),
  }),
})
// template: results.isPending, results.todos   script: results.value.todos
```

## Global error handling

For toasts or logging, use one handler on the QueryCache instead of per-query callbacks (queries have no `onError` in v5):

```ts
import { QueryCache, QueryClient } from '@tanstack/vue-query'

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      // Only toast background refetch failures; first loads show their own error UI
      if (query.state.data !== undefined) showToast(`Could not refresh: ${error.message}`)
    },
  }),
})
```

Per-query messages can travel in `meta`: `queryOptions({ ..., meta: { errorMessage: 'Could not load todos' } })`, then read `query.meta?.errorMessage` in the handler.
