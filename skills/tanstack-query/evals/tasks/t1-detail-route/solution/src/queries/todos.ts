import { queryOptions } from '@tanstack/vue-query'
import { getTodo, getTodos } from '@/api/todos'

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
