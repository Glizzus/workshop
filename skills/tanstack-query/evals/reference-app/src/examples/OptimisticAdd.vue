<script setup lang="ts">
import { ref } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { createTodo, type NewTodo } from '@/api/todos'
import { todoKeys, todoQueries } from '@/queries/todos'

const queryClient = useQueryClient()
const { data } = useQuery(() => todoQueries.list({ status: 'all', page: 1 }))

// Optimistic update through the UI: no cache writes, no rollback code.
// While the request runs, render `variables` as a pending row.
const { mutate, variables, isPending, isError } = useMutation({
  mutationKey: ['todos', 'create'],
  mutationFn: (input: NewTodo) => createTodo(input),
  onSettled: () => queryClient.invalidateQueries({ queryKey: todoKeys.lists() }),
})
const title = ref('')
</script>

<template>
  <form @submit.prevent="mutate({ title })">
    <input v-model="title" aria-label="New todo" />
    <button type="submit">Add</button>
  </form>
  <ul v-if="data">
    <li v-for="todo in data.items" :key="todo.id">{{ todo.title }}</li>
    <li v-if="isPending && variables" class="pending">{{ variables.title }}</li>
    <li v-if="isError && variables" class="failed">{{ variables.title }} (not saved)</li>
  </ul>
</template>
