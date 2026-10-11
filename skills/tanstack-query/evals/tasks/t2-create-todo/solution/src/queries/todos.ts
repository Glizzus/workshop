import { queryOptions, useMutation, useQueryClient } from '@tanstack/vue-query'
import { createTodo, getTodos } from '@/api/todos'

export const todoKeys = {
  all: ['todos'] as const,
  list: () => [...todoKeys.all, 'list'] as const,
}

export const todoQueries = {
  list: () => queryOptions({ queryKey: todoKeys.list(), queryFn: ({ signal }) => getTodos(signal) }),
}

export function useCreateTodo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { title: string }) => createTodo(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: todoKeys.list() }),
  })
}
