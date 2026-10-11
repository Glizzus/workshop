# What belongs in TanStack Query (and what doesn't)

TanStack Query manages **server state**: data that lives on a server, that you load asynchronously, and that can change without you knowing. Everything else goes elsewhere.

## Contents
- Where each kind of state goes
- Signs of underuse
- Signs of overuse
- WebSockets and server-sent events

## Where each kind of state goes

| State | Example | Put it in |
|---|---|---|
| data from your API | todos, current user, search results | `useQuery` (via a factory in `src/queries/`) |
| changes to server data | create, update, delete, upload | `useMutation` |
| what the URL should remember | filters, search term, page, sort, selected tab | route query/params → props (router-and-prefetching.md) |
| one component's UI | dialog open, hover, input text | `ref` in that component |
| UI shared across the app | theme, sidebar open, unsaved-changes flag | Pinia store or a provide/inject composable |
| a form being edited | draft title, unsaved fields | local `ref`, copied once from query data (mutations.md "Editing forms") |
| values computed from server data | totals, filtered/sorted views, labels | `computed` over `data`, or `select` |
| browser storage | saved preferences | `useStorage`-style composable or Pinia; not a query |
| synchronous values | constants, config, env | plain imports |

## Signs of underuse

Code that should use TanStack Query but doesn't. Replace it.

| You see | Replace with |
|---|---|
| `onMounted(async () => { items.value = await getItems() })` + `loading`/`error` refs | `const { data, isPending, error } = useQuery(itemQueries.list())` |
| a Pinia store with `items`, `loading`, `error` state and a `fetchItems` action | a query factory; components call `useQuery`. Keep Pinia for client state. |
| `watch(id, async () => { item.value = await getItem(id) })` | `useQuery(() => itemQueries.detail(id.value))` |
| `setInterval(() => load(), 5000)` | `refetchInterval: 5000` |
| `items.value.push(...nextPage)` for "load more" | `useInfiniteQuery` (pagination-infinite.md) |
| after saving: `await load()` to refresh the list | `onSuccess: () => queryClient.invalidateQueries({ queryKey: itemKeys.lists() })` |
| a cache `Map` or "already loaded?" flags | the query cache does this; tune `staleTime` |
| debounce/abort logic around fetch | key per input + `signal` in queryFn; old requests are cancelled or ignored |


When moving a component from manual fetching to `useQuery`, also delete the old `loading` / `error` / `items` refs. Keeping them "for compatibility" re-creates the copy problem.

## Signs of overuse

TanStack Query used for things that aren't server state. Undo it.

| You see | Use instead |
|---|---|
| `useQuery({ queryKey: ['sidebarOpen'], queryFn: () => false })` | a `ref` or Pinia |
| `queryClient.setQueryData(['form'], draft)` to share a form draft | a `ref` passed down, or Pinia |
| a query whose `queryFn` reads `localStorage` | a storage composable or Pinia |
| a query whose `queryFn` only computes from another query's data | `computed` or `select` on the original query |
| query data copied into Pinia "so other components can use it" | other components call `useQuery` with the same factory; the cache shares it, and only one request is made |
| `watch(data, d => store.items = d)` | read `data` directly. |
| `useMutation` for a GET | `useQuery`. Mutations are for writes. |
| `useQuery` for a POST that changes something | `useMutation`. A query may run again at any time (mount, focus, reconnect). |

A POST that only *reads* (a search API that happens to use POST) is a query: use `useQuery` with the search input in the key.

## WebSockets and server-sent events

Let the socket say *what* changed. Let queries fetch the data:

```ts
export function useTodoLiveUpdates(url: string) {
  const queryClient = useQueryClient()
  const socket = new WebSocket(url)
  socket.addEventListener('message', (event: MessageEvent<string>) => {
    const message = JSON.parse(event.data) as { entity: 'todo'; id: number }
    void queryClient.invalidateQueries({ queryKey: todoKeys.detail(message.id) })
    void queryClient.invalidateQueries({ queryKey: todoKeys.lists() })
  })
  onBeforeUnmount(() => socket.close())
}
```

- If messages carry the full new object, `setQueryData` it instead of invalidating. Use an immutable update (mutations.md).
- When the socket keeps data current, refetching on focus is wasted work. Set `staleTime: Infinity` on those queries; invalidation still works.
- Don't keep a separate reactive array that the socket appends to. Components would then have two sources of truth.
