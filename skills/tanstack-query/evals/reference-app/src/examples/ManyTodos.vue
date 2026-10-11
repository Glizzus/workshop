<script setup lang="ts">
import { useQueries } from '@tanstack/vue-query'
import { todoQueries } from '@/queries/todos'

const props = defineProps<{ ids: number[] }>()
// useQueries returns ONE ref: results.value is the combined value
const results = useQueries({
  queries: () => props.ids.map((id) => todoQueries.detail(id)),
  combine: (queries) => ({
    todos: queries.flatMap((q) => (q.data ? [q.data] : [])),
    isPending: queries.some((q) => q.isPending),
  }),
})
</script>

<template>
  <p v-if="results.isPending">Loading…</p>
  <ul v-else>
    <li v-for="todo in results.todos" :key="todo.id">{{ todo.title }}</li>
  </ul>
</template>
