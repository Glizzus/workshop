// Pattern for @tanstack/vue-query older than 5.92 (no options getters): factories accept
// refs/getters, put them in the key, and read them with toValue() inside queryFn.
import { queryOptions } from '@tanstack/vue-query'
import { toValue, type MaybeRefOrGetter } from 'vue'
import { getTodo } from '@/api/todos'

export const legacyTodoQueries = {
  detail: (id: MaybeRefOrGetter<number>) =>
    queryOptions({
      queryKey: ['todos', 'detail', id],
      queryFn: ({ signal }) => getTodo(toValue(id), signal),
    }),
}
// In a component: useQuery(legacyTodoQueries.detail(() => props.id))
