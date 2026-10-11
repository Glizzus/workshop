# Vue reactivity with TanStack Query

## Contents
- The one rule
- Frozen reads
- Props and route params
- Only in setup
- Fetching something else
- Results are refs
- Query data is read-only
- Older 5.x: refs and getters inside options

## The one rule

`useQuery` runs once, when the component is set up. It sees later changes only through a function it can call again. So when the options use anything reactive (props, refs, computed, route, a Pinia store), pass a getter:

```ts
// The getter re-runs whenever props.id changes → new queryKey → new fetch
const { data } = useQuery(() => todoQueries.detail(props.id))
```

Inside the getter, read values the normal way: `props.id`, `page.value`, `route.params.id`. Every option inside the getter follows changes: `queryKey`, `enabled`, `staleTime`, `select`, all of them.

The same works for `useInfiniteQuery(() => ...)` and `useQueries({ queries: () => [...] })`. It needs @tanstack/vue-query 5.92 or newer.

When the options use nothing reactive, the getter is optional: `useQuery(userQueries.me())`.

To add an option to a factory's options, spread them inside the getter:

```ts
useQuery(() => ({ ...todoQueries.detail(props.id), enabled: isOpen.value }))
```

## Frozen reads

A frozen read is a reactive value read once, at setup, outside any function. The query never sees later changes.

| Frozen (wrong) | Fixed |
|---|---|
| `useQuery(todoQueries.detail(props.id))` | `useQuery(() => todoQueries.detail(props.id))` |
| `useQuery(todoQueries.detail(id.value))` | `useQuery(() => todoQueries.detail(id.value))` |
| `useQuery({ queryKey: ['todo', props.id], queryFn })` | `useQuery(() => ({ queryKey: ['todo', props.id], queryFn }))` |
| `useQuery({ ...opts, enabled: !!user.value })` | `useQuery(() => ({ ...opts, enabled: !!user.value }))` |
| `useQuery(todoQueries.detail(Number(route.params.id)))` | `useQuery(() => todoQueries.detail(Number(route.params.id)))` |

Symptoms:
- The first value loads. Changing it does nothing: the old data stays on screen.
- A query that should start later never starts (`enabled` frozen to `false`).

The ESLint rule `exhaustive-deps` may say "dependencies are missing in your queryKey: x.value". In Vue, adding `x.value` to the key creates a frozen read. Put the key inside a getter instead (or put the ref `x` itself in the key).

## Props and route params

**Props.** Read `props.x` inside the getter. Vue 3.5 destructured props work the same way:

```ts
const { id } = defineProps<{ id: number }>()
useQuery(() => todoQueries.detail(id)) // inside the getter: reactive
```

**Route params.** Prefer turning them into props in the route record, so the view receives plain numbers (router-and-prefetching.md "Route params"). If you use `useRoute()`, read it inside the getter:

```ts
const route = useRoute()
useQuery(() => todoQueries.detail(Number(route.params.id)))
```

**A composable that wraps a query.** Accept `MaybeRefOrGetter` and unwrap it with `toValue` inside the getter. Callers can then pass a ref, a getter or a plain value:

```ts
import { toValue, type MaybeRefOrGetter } from 'vue'

export function useTodo(id: MaybeRefOrGetter<number>) {
  return useQuery(() => todoQueries.detail(toValue(id)))
}
// usage: useTodo(() => props.id) or useTodo(idRef) or useTodo(5)
```

Calling `useTodo(props.id)` freezes the value before `useTodo` even runs. Pass `() => props.id`.

## Only in setup

These must run at the top level of `<script setup>`, or at the top level of a `use...()` composable that is itself called from setup:

`useQuery`, `useInfiniteQuery`, `useQueries`, `useMutation`, `useQueryClient`, `useIsFetching`, `useIsMutating`, `useMutationState`, and your own `use...()` composables that call them.

They find the QueryClient with Vue's `inject()`, which only works during setup. Called later (in a click handler, a `setTimeout`, after an `await` in a plain async function, at import time) they throw:

```
vue-query hooks can only be used inside setup() function or functions that support injection context.
```

Need the client in an event handler? Get it in setup and use it in the handler:

```ts
const queryClient = useQueryClient() // setup
function refreshTodos() {
  return queryClient.invalidateQueries({ queryKey: todoKeys.lists() }) // handler
}
```

Need a mutation in a handler? Create it in setup, call `mutate` in the handler:

```ts
const { mutate: createTodo } = useCreateTodo() // setup
function submit() {
  createTodo({ title: title.value }) // handler
}
```

Exception: `useQueryClient()` also works inside Vue Router guards (`beforeEnter`, `router.beforeEach`). Guards run inside the app's injection context. Call it before any `await` in the guard.

Related error: `No 'queryClient' found in Vue context, use 'VueQueryPlugin' to properly initialize the library.` VueQueryPlugin is not installed: in the app (see templates/src/main.ts), or on the test mount (use the helpers in templates/test/query-test-utils.ts).

## Fetching something else

To load different data, change reactive state that the getter reads. The query sees a new key and fetches. Results for the old key stay cached, so going back is instant.

```ts
// Search when the form is submitted, not on every keystroke
const input = ref('')
const submitted = ref('')
const { data: results } = useQuery(() => searchQueries.todos(submitted.value))
// <form @submit.prevent="submitted = input.trim()">
```

| Instead of | Write |
|---|---|
| `watch(term, () => refetch())` | `useQuery(() => searchQueries.todos(term.value))` |
| `refetch({ id: 2 })` (refetch takes no arguments) | change the ref the getter reads |
| `useQuery(...)` inside the submit handler | `useQuery` once in setup; the handler sets a ref |

Why not watch + refetch: no cache per search term, and a slow old response can arrive after a fast new one and overwrite it. With the term in the key, each response goes to its own key.

`refetch()` is for "load the same thing again", such as a Retry button.

## Results are refs

`useQuery` returns an object of refs. Destructure it in setup:

```ts
const { data, error, isPending } = useQuery(() => todoQueries.list(props.filters))
```

| Where | How to read it |
|---|---|
| `<template>` | `data`, `isPending` (Vue unwraps top-level refs) |
| `<script>` | `data.value`, `isPending.value` |
| `computed` / `watch` | `computed(() => data.value?.items.length ?? 0)`, `watch(data, ...)` |

Wrong in `<script>`, and what happens:

| Wrong | Right | Why |
|---|---|---|
| `data.items` | `data.value?.items` | `data` is the ref object, so `.items` is undefined |
| `if (isPending)` | `if (isPending.value)` | a ref object is always truthy |
| `error && error.message` | `error.value?.message` | same |

**Keep results destructured.** If you keep the whole result (`const todos = useQuery(...)`), the template does not unwrap refs nested inside it:
- `:disabled="todos.isFetching"` is ALWAYS disabled, because the binding gets the ref object, which is truthy. `vue-tsc` reports a type error here.
- `{{ todos.data }}` still displays, because text interpolation unwraps refs. This mismatch hides the bug.

The same applies to mutation results: `const { mutate, isPending } = useCreateTodo()`.

`useQueries(...)`, `useIsFetching()`, `useIsMutating()` and `useMutationState()` return ONE ref: use `results.value` in script.

Big data sets: `shallow: true` makes `data` shallowly reactive, which is faster for large lists you never mutate.

## Query data is read-only

`data.value` is deeply read-only. Vue warns and ignores every write:
- `data.value.title = 'x'`
- `data.value.items.push(x)`
- `<input v-model="data.title">`

To edit server data:
- **In a form:** copy it into a local draft once and save with a mutation (mutations.md "Editing forms").
- **In the cache, on purpose** (optimistic updates, mutation responses): use `queryClient.setQueryData` and return a NEW object:

```ts
queryClient.setQueryData(todoQueries.detail(id).queryKey, (old) => (old ? { ...old, done } : old))
```

Mutating `old` in place (`old.done = done; return old`) is a bug: Vue and TanStack Query compare by reference and may not see the change.

## Older 5.x: refs and getters inside options

Before 5.92, `useQuery(() => ...)` does not exist. The official docs show the older pattern, which still works today:
- factories accept refs or getters
- they put them in the key as-is
- they read them with `toValue` inside `queryFn`

```ts
import { queryOptions } from '@tanstack/vue-query'
import { toValue, type MaybeRefOrGetter } from 'vue'

export const legacyTodoQueries = {
  detail: (id: MaybeRefOrGetter<number>) =>
    queryOptions({
      queryKey: ['todos', 'detail', id], // ref/getter inside the key: Vue Query unwraps it
      queryFn: ({ signal }) => getTodo(toValue(id), signal),
    }),
}
// In a component: useQuery(legacyTodoQueries.detail(() => props.id))
```

Rules for this pattern:
- Only `queryKey` entries and `enabled` may be getters. Other options must be refs or computeds to stay reactive.
- When you call `queryClient` methods yourself (`setQueryData`, `getQueryData`), pass plain values in the key. Those methods do not call getters.
- On 5.92 or newer, prefer the getter pattern from "The one rule".
