# Troubleshooting

Find the symptom, apply the fix, then run the checks again (SKILL.md "Workflow").

## Data and refetching

| Symptom | Likely cause | Fix |
|---|---|---|
| Changing an id/filter/prop doesn't load new data | frozen read: options built with `props.x` / `x.value` outside a getter | `useQuery(() => factory(props.x))`. vue-reactivity.md "Frozen reads" |
| `/items/1` → `/items/2` still shows item 1 | same component reused with a new prop; query frozen | same fix |
| Query never starts | `enabled` frozen to `false`, or a `skipToken` parameter never arrives | put `enabled` inside the getter; check the parameter |
| Spinner forever on a disabled query | `isPending` is true until the first fetch, and a disabled query never fetches | use `isLoading` for the spinner. queries.md "Loading and error states" |
| List doesn't show the new item after saving | no invalidation after the mutation | `onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.lists() })`. mutations.md |
| Invalidation does nothing | key prefix doesn't match (typo, different shape, a getter inside an imperative key) | build keys only from the key factory; pass plain values to `queryClient` methods |
| A refetch on every mount / tab switch | `staleTime` is 0 (the default) | global `staleTime` in main.ts, or per query. queries.md "Freshness: staleTime and gcTime" |
| Data never refreshes | `staleTime: 'static'`, or `Infinity` without invalidation | invalidate after changes; use `'static'` only for data that can never change |
| A 404/500 response shows up as data | `fetch()` doesn't throw on HTTP errors | use the API client. queries.md "The API client" |
| Old response overwrites new one (search, filters) | `watch` + `refetch()` or manual fetch | put the input in the key. vue-reactivity.md "Fetching something else" |
| Flicker to "Loading…" on every page change | no placeholder data | `placeholderData: keepPreviousData`. pagination-infinite.md |
| "Load more" fetches the same page twice | `fetchNextPage` not guarded | `if (hasNextPage.value && !isFetchingNextPage.value)` |
| Edited form fields reset by themselves | form bound to query data, or a watcher copying data into the form | copy once into a draft component. mutations.md "Editing forms" |
| Previous user's data visible after logout | cache not cleared | `queryClient.clear()` on logout |
| Checkbox stays ticked after a failed save | `:checked="todo.done"` never changed value, so Vue never resets the box the user clicked | optimistic update with rollback (the value changes, then changes back), as in `useToggleTodo` |
| A component sees different data than the rest | it created its own `new QueryClient()` | one client in main.ts; `useQueryClient()` |

## Errors and warnings

| Message | Cause | Fix |
|---|---|---|
| `vue-query hooks can only be used inside setup() function or functions that support injection context.` | `useQuery`/`useMutation`/`useQueryClient` called in a handler, timer, after `await`, or at import time | call it at the top of setup. vue-reactivity.md "Only in setup" |
| `No 'queryClient' found in Vue context, use 'VueQueryPlugin' to properly initialize the library.` | plugin not installed (app or test mount) | `app.use(VueQueryPlugin, { queryClient })`; in tests use the helpers |
| `vue-query composable like "useQuery()" should only be used inside a "setup()" function or a running effect scope.` (dev warning) | called outside setup/effect scope | same as above |
| TypeScript: `No overload matches this call` on `useQuery` / `useMutation` | a v4 option or signature (`cacheTime`, `onSuccess` on a query, positional args) | read the last line of the error; version-drift.md |
| TypeScript: `Type 'Ref<…>' is not assignable to type 'Booleanish'` in a template | a ref nested inside a kept result object (`mutation.isPending`) | destructure the result. vue-reactivity.md "Results are refs" |
| `Query data cannot be undefined` | `queryFn` returned `undefined` (forgot `return`, or an endpoint returns 204) | return a value (`null` is allowed); the ESLint rule `no-void-query-fn` catches it |
| Vue warn: `Set operation on key "…" failed: target is readonly` | writing to query data | copy it, or `setQueryData` with a new object. vue-reactivity.md "Query data is read-only" |

## Tests

See testing.md "Pitfalls". The common ones:
- error test times out → `retry: false`
- data leaks between tests → a new QueryClient per test
- "Unhandled Rejection" → await `mutateAsync`
- element not found → `findBy*` instead of `getBy*`

## Tools

- **Devtools.** `npm i -D @tanstack/vue-query-devtools`, then render `<VueQueryDevtools />` (from `@tanstack/vue-query-devtools`) in App.vue. It shows every query, its key, its status and its data. It's the fastest way to see a wrong key or a missing invalidation.
