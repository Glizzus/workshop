# Mutations (create, update, delete)

## Contents
- Writing a mutation
- After a mutation: update the cache
- mutate vs mutateAsync
- Optimistic updates
- Editing forms
- Updating the cache by hand

## Writing a mutation

Mutations live next to the queries, in `src/queries/<resource>.ts`, as composables. They need `useQueryClient()`, so they are composables, not plain factories:

```ts
export function useCreateTodo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: NewTodo) => createTodo(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: todoKeys.lists() }),
  })
}
```

In the component, call the composable once in setup and destructure it:

```ts
const { mutate: createTodo, isPending: isCreating, error: createError } = useCreateTodo()
function submit() {
  createTodo({ title: title.value }, { onSuccess: () => (title.value = '') })
}
```

- `mutate` takes ONE argument: the variables. Pass several values as an object: `mutate({ id, patch })`.
- `isPending` disables the button. `error` shows what went wrong. `reset()` clears the error.
- Mutations never retry by default. That's right for non-idempotent requests like POST.
- Loading data never uses `useMutation`. Writes (POST/PUT/PATCH/DELETE) never use `useQuery`.

## After a mutation: update the cache

The server changed, so cached data is now old. Pick one:

| Situation | Do this |
|---|---|
| default; or the change affects lists, counts, sorting | `invalidateQueries` on the affected keys |
| the server returns the full updated object | `setQueryData` with it for the detail, plus `invalidateQueries` for the lists |
| the item no longer exists (delete) | `removeQueries` for the detail, `invalidateQueries` for the lists |

```ts
onSuccess: (updated) => {
  queryClient.setQueryData(todoQueries.detail(updated.id).queryKey, updated)
  return queryClient.invalidateQueries({ queryKey: todoKeys.lists() })
},
```

Rules:
- **Return (or await) the promise from `invalidateQueries`.** The mutation then stays pending until the fresh data has arrived. The button stays disabled and the list never briefly shows old data next to a "saved" message.
- **Invalidate by prefix.** `todoKeys.lists()` matches every list and every filter. Invalidation only refetches queries a component is currently using. The others are marked stale and refetch when they are next used.
- **Don't call `queryClient.invalidateQueries()` with no filter** as a habit. It refetches every query on screen.
- **Put cache updates in `useMutation`'s callbacks**, not in the component. They must run even if the user navigates away before the request finishes.

## mutate vs mutateAsync

| | `mutate(vars, { onSuccess, onError })` | `mutateAsync(vars)` |
|---|---|---|
| returns | nothing | a promise |
| on failure | sets `error`, calls `onError`, never throws | the promise REJECTS |
| use for | components (the normal case) | when you must `await` it, inside `try/catch` |

```ts
const { mutateAsync: saveTodo, error: saveError } = useUpdateTodo() // setup

async function saveAndLeave() {
  try {
    await saveTodo({ id: props.id, patch })
    await router.push('/todos')
  } catch {
    // saveError is already set; the template shows it
  }
}
```

`mutateAsync()` without `await` and `catch` turns every failed save into an unhandled rejection.

There are two places for callbacks:
- **In `useMutation({ onSuccess })`:** always runs. Put cache updates here.
- **In `mutate(vars, { onSuccess })`:** runs only if the component is still mounted. Put UI reactions here: clear the input, close a dialog, navigate.

## Optimistic updates

Show the result before the server confirms it. There are two ways.

### Through the UI (simplest; good for adding items)

Render the mutation's `variables` while it is pending. No cache writes, no rollback code:

```ts
const queryClient = useQueryClient()
const { mutate, variables, isPending, isError } = useMutation({
  mutationKey: ['todos', 'create'],
  mutationFn: (input: NewTodo) => createTodo(input),
  onSettled: () => queryClient.invalidateQueries({ queryKey: todoKeys.lists() }),
})
```

```vue
<li v-for="todo in data.items" :key="todo.id">{{ todo.title }}</li>
<li v-if="isPending && variables" class="pending">{{ variables.title }}</li>
<li v-if="isError && variables" class="failed">{{ variables.title }} (not saved)</li>
```

Another component can show the same pending items, by `mutationKey`:

```ts
const pendingTodos = useMutationState({
  filters: { mutationKey: ['todos', 'create'], status: 'pending' },
  select: (mutation) => mutation.state.variables as NewTodo,
})
```

### Through the cache (for changes visible in several places)

Write the new value into the cache, keep a snapshot, and restore it on error. This is `useToggleTodo` in templates/src/queries/todos.ts:

```ts
onMutate: async ({ id, done }) => {
  const { queryKey } = todoQueries.detail(id)
  await queryClient.cancelQueries({ queryKey }) // a refetch in flight must not overwrite us
  const previous = queryClient.getQueryData(queryKey) // snapshot
  queryClient.setQueryData(queryKey, (old) => (old ? { ...old, done } : old)) // new object
  return { previous } // the 3rd argument of onError, the 4th of onSettled
},
onError: (_error, { id }, snapshot) => {
  if (snapshot?.previous) queryClient.setQueryData(todoQueries.detail(id).queryKey, snapshot.previous)
},
onSettled: (_data, _error, { id }) =>
  Promise.all([
    queryClient.invalidateQueries({ queryKey: todoKeys.detail(id) }),
    queryClient.invalidateQueries({ queryKey: todoKeys.lists() }),
  ]),
```

All four steps matter:
- **cancel** in-flight refetches
- take a **snapshot**
- write a **new object**
- **restore** on error and **invalidate** when settled

## Editing forms

Query data is read-only, and background refetches replace it. So a form edits a local draft, copied once:

```vue
<!-- parent: TodoDetailView.vue -->
<TodoEditForm v-if="editing" :key="todo.id" :initial="todo" :saving="isSaving" @save="onSave" />
```

```ts
// TodoEditForm.vue
const props = defineProps<{ initial: Todo; saving: boolean }>()
const draftTitle = ref(props.initial.title) // copied once, when the form is created
```

- `:key="todo.id"` re-creates the form for a different todo, so its draft starts fresh.
- Not `v-model="data.title"`: query data is read-only.
- Not `watch(data, d => form.value = {...d})`: every background refetch overwrites what the user is typing.
- Save with a mutation. On success, update the cache (above) and close the form.

## Updating the cache by hand

`queryClient.setQueryData(key, valueOrUpdater)` writes into the cache. Every component using that key re-renders.

- **Take the key from the factory** (`todoQueries.detail(id).queryKey`). It's typed and always matches.
- **Pass plain values in the key**, not refs or getters.
- **Return new objects and arrays:**

```ts
// update one item inside a cached list page
queryClient.setQueryData(todoQueries.list(filters).queryKey, (old) =>
  old ? { ...old, items: old.items.map((t) => (t.id === updated.id ? updated : t)) } : old,
)
```

- **Never mutate the updater's argument** (`old.items.push(x); return old`).
- **`setQueryData` on a key no component uses** creates an entry. It is garbage-collected after `gcTime`.
- **Prefer invalidation** unless you have the exact server data. A hand-built guess can drift from what the server stores.
