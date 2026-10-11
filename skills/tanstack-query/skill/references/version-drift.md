# Version drift: v4 code, v5 changes, stale snippets

Your training data mixes TanStack Query v3, v4 and v5. This skill targets v5 (written against 5.104). Use this file whenever you are unsure an API name is current, or TypeScript rejects a Query option.

## Contents
- Check the version
- v4 to v5 renames
- Changes inside v5
- Stale snippets in the official docs
- Below 5.102

## Check the version

```bash
node -p "require('./node_modules/@tanstack/vue-query/package.json').version"
```

- 4.x, or the package is `vue-query` (no `@tanstack/`): this is v4. Tell the user. Migrating is a separate task.
- 5.x: use this file to translate any old names you see in existing code.

## v4 to v5 renames

If you are about to write the left column, write the right column.

| v4 or older | v5 |
|---|---|
| `import { useQuery } from 'vue-query'` | `import { useQuery } from '@tanstack/vue-query'` |
| `useQuery(['todos'], fetchTodos, options)` | `useQuery({ queryKey: ['todos'], queryFn: fetchTodos, ...options })` |
| `useMutation(createTodo, options)` | `useMutation({ mutationFn: createTodo, ...options })` |
| `queryClient.invalidateQueries(['todos'])` | `queryClient.invalidateQueries({ queryKey: ['todos'] })` (same for `refetchQueries`, `cancelQueries`, `removeQueries`, `resetQueries`) |
| `cacheTime` | `gcTime` |
| `status === 'loading'`, `isLoading` meaning "no data yet" | `status === 'pending'`, `isPending` |
| `isInitialLoading` | `isLoading` (now means `isPending && isFetching`) |
| `keepPreviousData: true` | `placeholderData: keepPreviousData` (import `keepPreviousData`) |
| `isPreviousData` | `isPlaceholderData` |
| `useErrorBoundary` | `throwOnError` |
| `onSuccess` / `onError` / `onSettled` on `useQuery` | removed. Derive from `data`/`error` (`computed`, `select`); global errors: `new QueryCache({ onError })` (queries.md). Mutations still have them. |
| `new QueryClient({ logger })` | removed |
| `useInfiniteQuery` without `initialPageParam` | `initialPageParam` is required |
| `fetchNextPage({ pageParam })` | removed: the next param comes from `getNextPageParam` |
| `refetchPage` | removed: limit pages with `maxPages` |
| `isDataEqual` | `structuralSharing: (oldData, newData) => ...` |
| `hashQueryKey` | `hashKey` |
| `query.remove()` | `queryClient.removeQueries({ queryKey })` |
| `getQueryData(key, filters)` | `getQueryData(key)` |
| `context` option (custom React context) | pass the client as 2nd argument: `useQuery(options, queryClient)` |
| `isIdle` on a query result | none. Use `isPending` (no data) or `fetchStatus === 'idle'` (not fetching). Mutations still have `isIdle`. |
| `useQueries([...])` returning a reactive array | `useQueries({ queries })` returns a Ref |
| test setup `new QueryClient({ logger: { error: () => {} } })` | delete `logger`; keep `defaultOptions: { queries: { retry: false } }` |

TypeScript catches most of these, but reports them as a long "No overload matches this call" error. Read the last line of that error: it names the unknown property. Do not silence the error with `as any` or `@ts-ignore`.

## Changes inside v5

Features newer than many examples you've seen. Check the installed version before using them.

| Since | Feature |
|---|---|
| 5.91 | `useQuery(() => options)`: the whole options object as a getter |
| 5.92 | getters for `useQueries`, `useMutation`, `useIsFetching`, `useMutationState` (`useQueries` with `queryOptions` type-checks from 5.98) |
| 5.98 | `usePrefetchQuery`, `usePrefetchInfiniteQuery` |
| 5.99 | `mutationOptions` |
| 5.100.11 | refs/getters inside `queryOptions({ queryKey })` type-check correctly again |
| 5.102 | `queryClient.query(options)` and `queryClient.infiniteQuery(options)`; spreading factory options inside a getter (`useQuery(() => ({ ...factory(x), enabled }))`) type-checks |

From 5.102, these are deprecated (they still work):

| Deprecated | Replacement |
|---|---|
| `fetchQuery(options)` | `query(options)` |
| `prefetchQuery(options)` | `query(options).catch(() => {})` |
| `ensureQueryData(options)` | `query({ ...options, staleTime: 'static' })` |
| `fetchInfiniteQuery` / `prefetchInfiniteQuery` / `ensureInfiniteQueryData` | `infiniteQuery(...)` with the same patterns |

`query()` returns cached data when it is fresh (by the `staleTime` you pass), otherwise it fetches. It throws on errors and does not retry unless you set `retry`.

Also in v5, and often missing from examples:
- `skipToken`
- `staleTime: 'static'`
- `useMutationState`
- `queryOptions` / `infiniteQueryOptions`
- `placeholderData: keepPreviousData`

## Stale snippets in the official docs

Some official Vue snippets are outdated. Fix these when you copy from the docs:

| Docs page | Snippet | Problem | Use |
|---|---|---|---|
| Vue guide "Dependent Queries" | `const { isIdle, data } = useQuery(...)` | queries have no `isIdle` in v5 | `isLoading` / `fetchStatus` |
| `useQuery` source examples | `queryKey: ['post', props.postId]` with `enabled: () => props.postId != null` | the key is frozen at setup; when `postId` arrives, the data is cached under the `undefined` key | `useQuery(() => ({ queryKey: ['post', props.postId], ... }))` |
| Vue guide "Dependent Queries" (useQueries) | "returns an array" | in Vue, `useQueries` returns a Ref | `results.value` in script |

React examples (most blog posts, most of the docs) need two changes for Vue:
- wrap options that use props/refs in a getter (vue-reactivity.md)
- read results with `.value` in script

## Below 5.102

First ask the user to upgrade within v5: `npm i @tanstack/vue-query@^5.102`. Minor versions are not breaking. If they can't:
- **Reactive options:** use the factory pattern in vue-reactivity.md "Older 5.x: refs and getters inside options". Getters such as `useQuery(() => ...)` exist from 5.91, but spreading factory options inside them fails to type-check before 5.102.
- **Imperative fetching:** use `prefetchQuery` / `fetchQuery` / `ensureQueryData` where this skill shows `query()`:
  - `queryClient.query(opts).catch(() => {})` → `queryClient.prefetchQuery(opts)` (never throws)
  - `await queryClient.query(opts)` → `await queryClient.fetchQuery(opts)`
