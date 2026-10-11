<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { getTodos } from '@/api/todos'

const { data: todos, isPending, isError } = useQuery({ queryKey: ['todos'], queryFn: getTodos })
</script>

<template>
  <h1>Todos</h1>
  <p v-if="isPending">Loading…</p>
  <p v-else-if="isError" role="alert">Could not load todos.</p>
  <ul v-else>
    <li v-for="todo in todos" :key="todo.id">{{ todo.title }}</li>
  </ul>
</template>
