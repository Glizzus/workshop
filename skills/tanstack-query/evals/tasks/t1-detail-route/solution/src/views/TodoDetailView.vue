<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { todoQueries } from '@/queries/todos'

const props = defineProps<{ id: number }>()
const { data: todo, error, isPending, isError } = useQuery(() => todoQueries.detail(props.id))
</script>

<template>
  <p v-if="isPending">Loading…</p>
  <p v-else-if="isError" role="alert">Could not load the todo: {{ error?.message }}</p>
  <article v-else-if="todo">
    <h1>{{ todo.title }}</h1>
    <p>Status: {{ todo.done ? 'Done' : 'Open' }}</p>
  </article>
</template>
