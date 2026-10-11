# Pagination and infinite lists

## Contents
- Paged lists (Previous / Next)
- Infinite lists (Load more, infinite scroll)
- Choosing between them

## Paged lists (Previous / Next)

Working example: templates/src/views/TodoListView.vue, plus `todoQueries.list` in templates/src/queries/todos.ts.

1. **The page number is part of the filters, and the filters live in the URL** (`?status=open&page=2`). The route turns them into a prop (router-and-prefetching.md "Filters in the URL").
2. **The page is in the key**, through the factory: `todoKeys.list({ status, page })`. Each page is cached separately, so going back a page is instant.
3. **`placeholderData: keepPreviousData`** keeps the current page on screen while the next one loads, instead of flashing "Loading…":

```ts
list: (filters: TodoFilters) =>
  queryOptions({
    queryKey: todoKeys.list(filters),
    queryFn: ({ signal }) => getTodos(filters, signal),
    placeholderData: keepPreviousData,
  }),
```

4. **Use `isPlaceholderData`** to dim the old page and disable "Next" until the real page has loaded:

```vue
<ul :class="{ stale: isPlaceholderData }">…</ul>
<button :disabled="isPlaceholderData || data.page >= data.totalPages" @click="setFilters({ page: filters.page + 1 })">
  Next
</button>
```

5. **Changing the page is a navigation:** `router.push({ query: { ...props.filters, page: n } })`. Don't call `refetch()`. The getter `useQuery(() => todoQueries.list(props.filters))` sees the new props and fetches.

Optional: prefetch the next page so "Next" is instant.

```ts
const queryClient = useQueryClient()
watch(data, (page) => {
  if (page && page.page < page.totalPages) {
    queryClient.query(todoQueries.list({ ...props.filters, page: page.page + 1 })).catch(() => {})
  }
})
```

(Before 5.102: `queryClient.prefetchQuery(...)`.)

## Infinite lists (Load more, infinite scroll)

Working example: templates/src/views/TodoFeedView.vue, plus `todoQueries.infinite`.

```ts
infinite: (status: TodoStatus) =>
  infiniteQueryOptions({
    queryKey: todoKeys.infinite(status), // its own key: never shared with the paged list
    queryFn: ({ pageParam, signal }) => getTodos({ status, page: pageParam }, signal),
    initialPageParam: 1, // required in v5
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined, // undefined = no more pages
  }),
```

```ts
const { data, hasNextPage, isFetchingNextPage, fetchNextPage } = useInfiniteQuery(() =>
  todoQueries.infinite(status.value),
)
const todos = computed(() => data.value?.pages.flatMap((page) => page.items) ?? [])

function loadMore() {
  if (hasNextPage.value && !isFetchingNextPage.value) void fetchNextPage()
}
```

- `data.value.pages` holds one entry per fetched page. Flatten it in a `computed`.
- Guard `fetchNextPage` with `hasNextPage && !isFetchingNextPage`, or fast scrolling requests the same page twice.
- Cursor APIs: return the cursor from `getNextPageParam` (e.g. `lastPage.nextCursor ?? undefined`) and send it as `pageParam`.
- When the infinite query refetches (invalidation, window focus), it refetches every loaded page in order. Long feeds can cap stored pages with `maxPages`. Then you also need `getPreviousPageParam`.
- Not: a `ref([])` that you `push` each new page into. That copy never refreshes, has no error state per page, and breaks on refetch.

Infinite scroll instead of a button: watch a sentinel element with `IntersectionObserver`:

```ts
const sentinel = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | undefined
onMounted(() => {
  observer = new IntersectionObserver(([entry]) => {
    if (entry?.isIntersecting && hasNextPage.value && !isFetchingNextPage.value) void fetchNextPage()
  })
  if (sentinel.value) observer.observe(sentinel.value)
})
onBeforeUnmount(() => observer?.disconnect())
// template: <div ref="sentinel" />
```

jsdom (tests) has no `IntersectionObserver`. Test the "Load more" button path, or stub the observer.

## Choosing between them

| Need | Use |
|---|---|
| numbered pages, shareable URL per page, "page 3 of 10" | paged list (`useQuery` + `keepPreviousData`) |
| feed, timeline, chat history, "load more" | `useInfiniteQuery` |
| both views of the same data | two factories with different keys (`list` and `infinite`); invalidate their shared prefix |
