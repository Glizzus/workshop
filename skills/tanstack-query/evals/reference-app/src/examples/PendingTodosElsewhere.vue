<script setup lang="ts">
import { useMutationState } from '@tanstack/vue-query'
import type { NewTodo } from '@/api/todos'

// Another component can show the same pending items: filter mutations by mutationKey
const pendingTodos = useMutationState({
  filters: { mutationKey: ['todos', 'create'], status: 'pending' },
  select: (mutation) => mutation.state.variables as NewTodo,
})
</script>

<template>
  <p v-if="pendingTodos.length > 0">Saving {{ pendingTodos.length }} todo(s)…</p>
</template>
