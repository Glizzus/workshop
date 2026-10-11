// All TanStack Query code for one resource: keys, query options, mutations.
// Components never write a queryKey or queryFn themselves; they use what this file exports.
//
// Factories take PLAIN values (numbers, strings, objects), never refs.
// Components make them reactive by wrapping the call in a getter:
//   useQuery(() => todoQueries.detail(props.id))
import {
  infiniteQueryOptions,
  keepPreviousData,
  queryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/vue-query'
import {
  createTodo,
  deleteTodo,
  getTodo,
  getTodos,
  updateTodo,
  type NewTodo,
  type TodoFilters,
  type TodoPatch,
  type TodoStatus,
} from '@/api/todos'

// Every todo key starts with todoKeys.all, so a key can be invalidated by any prefix:
//   todoKeys.all     → everything about todos
//   todoKeys.lists() → every list and infinite list, any filters
export const todoKeys = {
  all: ['todos'] as const,
  lists: () => [...todoKeys.all, 'list'] as const,
  list: (filters: TodoFilters) => [...todoKeys.lists(), filters] as const,
  infinite: (status: TodoStatus) => [...todoKeys.lists(), 'infinite', status] as const,
  details: () => [...todoKeys.all, 'detail'] as const,
  detail: (id: number) => [...todoKeys.details(), id] as const,
}

export const todoQueries = {
  list: (filters: TodoFilters) =>
    queryOptions({
      queryKey: todoKeys.list(filters),
      queryFn: ({ signal }) => getTodos(filters, signal),
      // While the next page/filter loads, keep showing the previous result (isPlaceholderData = true)
      placeholderData: keepPreviousData,
    }),

  detail: (id: number) =>
    queryOptions({
      queryKey: todoKeys.detail(id),
      queryFn: ({ signal }) => getTodo(id, signal),
    }),

  infinite: (status: TodoStatus) =>
    infiniteQueryOptions({
      queryKey: todoKeys.infinite(status),
      queryFn: ({ pageParam, signal }) => getTodos({ status, page: pageParam }, signal),
      initialPageParam: 1,
      // Return undefined (or null) when there are no more pages: hasNextPage becomes false
      getNextPageParam: (lastPage) =>
        lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined,
    }),
}

// Mutations are composables because they need useQueryClient().
// Call them at the top level of <script setup>, never inside an event handler.

export function useCreateTodo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: NewTodo) => createTodo(input),
    // Return the promise: the mutation stays pending until the lists have refetched,
    // so the UI never shows "saved" next to a list that doesn't contain the item yet.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: todoKeys.lists() }),
  })
}

export function useUpdateTodo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: TodoPatch }) => updateTodo(id, patch),
    onSuccess: (updated) => {
      // The server returned the new todo: put it straight into the detail cache (no refetch needed)
      queryClient.setQueryData(todoQueries.detail(updated.id).queryKey, updated)
      // Lists may contain it too: mark them stale and refetch the ones on screen
      return queryClient.invalidateQueries({ queryKey: todoKeys.lists() })
    },
  })
}

// Optimistic update through the cache: the checkbox flips instantly and flips back if the request fails.
export function useToggleTodo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, done }: { id: number; done: boolean }) => updateTodo(id, { done }),
    onMutate: async ({ id, done }) => {
      const { queryKey } = todoQueries.detail(id)
      await queryClient.cancelQueries({ queryKey }) // an in-flight refetch must not overwrite the optimistic value
      const previous = queryClient.getQueryData(queryKey) // snapshot for rollback
      queryClient.setQueryData(queryKey, (old) => (old ? { ...old, done } : old)) // new object, never mutate `old`
      return { previous } // the 3rd argument of onError, the 4th of onSettled
    },
    onError: (_error, { id }, snapshot) => {
      if (snapshot?.previous) {
        queryClient.setQueryData(todoQueries.detail(id).queryKey, snapshot.previous)
      }
    },
    // Success or failure: resync this todo and the lists with the server
    onSettled: (_data, _error, { id }) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: todoKeys.detail(id) }),
        queryClient.invalidateQueries({ queryKey: todoKeys.lists() }),
      ]),
  })
}

export function useDeleteTodo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteTodo(id),
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: todoKeys.detail(id) }) // it no longer exists
      return queryClient.invalidateQueries({ queryKey: todoKeys.lists() })
    },
  })
}
