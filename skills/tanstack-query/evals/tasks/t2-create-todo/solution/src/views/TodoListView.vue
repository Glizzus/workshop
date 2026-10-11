<script setup lang="ts">
import { ref } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { todoQueries, useCreateTodo } from '@/queries/todos'

const { data: todos, isPending, isError } = useQuery(todoQueries.list())
const { mutate: createTodo, isPending: isCreating, error: createError } = useCreateTodo()
const title = ref('')

function submit() {
  createTodo({ title: title.value }, { onSuccess: () => (title.value = '') })
}
</script>

<template>
  <h1>Todos</h1>
  <form @submit.prevent="submit">
    <input v-model="title" aria-label="New todo" required />
    <button type="submit" :disabled="isCreating">Add</button>
  </form>
  <p v-if="createError" role="alert">Could not add the todo: {{ createError.message }}</p>
  <p v-if="isPending">Loading…</p>
  <p v-else-if="isError" role="alert">Could not load todos.</p>
  <ul v-else>
    <li v-for="todo in todos" :key="todo.id">{{ todo.title }}</li>
  </ul>
</template>
