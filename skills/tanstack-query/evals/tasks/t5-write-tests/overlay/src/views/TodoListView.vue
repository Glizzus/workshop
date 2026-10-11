<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { todoQueries } from '@/queries/todos'

const { data: todos, isPending, isError } = useQuery(todoQueries.list())
</script>

<template>
  <h1>Todos</h1>
  <p v-if="isPending">Loading…</p>
  <p v-else-if="isError" role="alert">Could not load todos.</p>
  <ul v-else>
    <li v-for="todo in todos" :key="todo.id">
      <RouterLink :to="{ name: 'todo', params: { id: todo.id } }">{{ todo.title }}</RouterLink>
    </li>
  </ul>
</template>
