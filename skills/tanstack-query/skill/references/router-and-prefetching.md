# Vue Router and prefetching

Works the same with Vue Router 4 and 5 (v5 changed nothing in the classic `createRouter` API). The experimental data loaders in `vue-router/experimental` are built for Pinia Colada. Don't mix them with TanStack Query.

## Contents
- Route params
- Filters in the URL
- Prefetching in route guards
- Prefetch on hover
- Logout

## Route params

Turn params into typed props in the route record (templates/src/router.ts):

```ts
{
  path: '/todos/:id(\\d+)',
  name: 'todo',
  component: () => import('./views/TodoDetailView.vue'),
  props: (route) => ({ id: Number(route.params.id) }),
}
```

```ts
// TodoDetailView.vue
const props = defineProps<{ id: number }>()
const { data: todo } = useQuery(() => todoQueries.detail(props.id))
```

- `/todos/1` → `/todos/2` reuses the same component instance with a new `id` prop. The getter makes the query follow it. Without the getter, the page keeps showing todo 1 (vue-reactivity.md "Frozen reads").
- Route params are strings. Convert them once, in `props`.
- The view gets plain props, so tests can render it directly with props.

## Filters in the URL

Search terms, filters, sorting and page numbers belong in the URL query, not in the query cache and not in Pinia. Then:
- links can be shared
- Back works
- reload keeps the state
- the query key follows the URL by itself

```ts
// router.ts: URL query → typed props
props: (route) => ({ filters: todoFiltersFromQuery(route.query) }),
```

```ts
// view: read from props, change by navigating
const props = defineProps<{ filters: TodoFilters }>()
const { data } = useQuery(() => todoQueries.list(props.filters))

function setFilters(patch: Partial<TodoFilters>) {
  void router.push({ query: { ...props.filters, ...patch } })
}
```

Reset `page` to 1 when another filter changes: `setFilters({ status, page: 1 })`.

## Prefetching in route guards

Start loading while the view's code is still downloading. Non-blocking: navigation continues at once, and the view's `useQuery` picks up the in-flight request.

```ts
{
  path: '/todos/:id(\\d+)',
  // ...
  beforeEnter: (to) => {
    useQueryClient() // works in guards: they run in the app's injection context
      .query(todoQueries.detail(Number(to.params.id)))
      .catch(() => {}) // a failed prefetch is fine: the view shows the error
  },
}
```

- **Call `useQueryClient()` at the start of the guard, before any `await`.**
- **Don't import a QueryClient singleton into router.ts.** Tests render with their own client; the guard would fill a different cache. `useQueryClient()` always gets the client of the running app.
- **`beforeEnter` runs only when entering the route**, not on `/todos/1` → `/todos/2`. To prefetch on every navigation, use a global guard:

```ts
router.beforeResolve((to) => {
  if (to.name === 'todo') {
    useQueryClient().query(todoQueries.detail(Number(to.params.id))).catch(() => {})
  }
})
```

**Blocking** (wait for data before showing the page; redirect if it fails):

```ts
beforeEnter: async (to) => {
  const queryClient = useQueryClient() // before the await
  try {
    await queryClient.query(todoQueries.detail(Number(to.params.id)))
  } catch {
    return { name: 'todos' }
  }
},
```

Blocking makes navigation feel slower. Use it only when the page is useless without the data.

Before 5.102: `queryClient.prefetchQuery(...)` (non-blocking, never throws) and `await queryClient.fetchQuery(...)` (blocking).

## Prefetch on hover

```ts
const queryClient = useQueryClient() // setup

function prefetch() {
  queryClient.query(todoQueries.detail(props.id)).catch(() => {})
}
```

```vue
<RouterLink :to="{ name: 'todo', params: { id } }" @mouseenter="prefetch" @focus="prefetch">
  {{ title }}
</RouterLink>
```

With a `staleTime` above 0 (the templates use 30s), hovering twice does not fetch twice.

Don't use `usePrefetchQuery` / `usePrefetchInfiniteQuery` with these factories: on 5.104 they fail to type-check with options from `queryOptions`. The guard and hover patterns above cover prefetching.

## Logout

Clear the cache, so the next user never sees the previous user's data:

```ts
const queryClient = useQueryClient() // setup

async function logout() {
  await apiFetch('/logout', { method: 'POST' })
  queryClient.clear()
  await router.push('/login')
}
```
