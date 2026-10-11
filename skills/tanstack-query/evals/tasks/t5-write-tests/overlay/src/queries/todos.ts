import { queryOptions, useMutation, useQueryClient } from '@tanstack/vue-query'
import { getTodo, getTodos, updateTodo } from '@/api/todos'

export const todoKeys = {
  all: ['todos'] as const,
  list: () => [...todoKeys.all, 'list'] as const,
  detail: (id: number) => [...todoKeys.all, 'detail', id] as const,
}

export const todoQueries = {
  list: () => queryOptions({ queryKey: todoKeys.list(), queryFn: ({ signal }) => getTodos(signal) }),
  detail: (id: number) =>
    queryOptions({ queryKey: todoKeys.detail(id), queryFn: ({ signal }) => getTodo(id, signal) }),
}

export function useToggleTodo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, done }: { id: number; done: boolean }) => updateTodo(id, { done }),
    onSuccess: (updated) => queryClient.setQueryData(todoQueries.detail(updated.id).queryKey, updated),
  })
}
