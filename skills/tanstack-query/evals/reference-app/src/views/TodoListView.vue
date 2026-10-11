<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useQuery } from '@tanstack/vue-query'
import type { TodoFilters, TodoStatus } from '@/api/todos'
import { todoQueries, useCreateTodo } from '@/queries/todos'

// Filters come from the URL via route props (see router.ts)
const props = defineProps<{ filters: TodoFilters }>()
const router = useRouter()

// The getter `() => ...` makes the query follow props.filters: new filters → new key → fetch.
// Destructure the result: each value is a ref ( .value in script, auto-unwrapped in the template).
const { data, error, isPending, isError, isFetching, isPlaceholderData } = useQuery(() =>
  todoQueries.list(props.filters),
)

// Changing filters is a navigation; the query reacts to the new props on its own.
function setFilters(patch: Partial<TodoFilters>) {
  void router.push({ query: { ...props.filters, ...patch } })
}

function onStatusChange(event: Event) {
  setFilters({ status: (event.target as HTMLSelectElement).value as TodoStatus, page: 1 })
}

// Mutation composables are called here, at the top level, never inside submit()
const { mutate: createTodo, isPending: isCreating, error: createError } = useCreateTodo()
const title = ref('')

function submit() {
  createTodo({ title: title.value }, { onSuccess: () => (title.value = '') })
}
</script>

<template>
  <section>
    <h1>Todos</h1>

    <label>
      Status
      <select :value="filters.status" @change="onStatusChange">
        <option value="all">All</option>
        <option value="open">Open</option>
        <option value="done">Done</option>
      </select>
    </label>

    <form @submit.prevent="submit">
      <input v-model="title" aria-label="New todo" required />
      <button type="submit" :disabled="isCreating">Add</button>
    </form>
    <p v-if="createError" role="alert">Could not add the todo: {{ createError.message }}</p>

    <p v-if="isPending">Loading…</p>
    <p v-else-if="isError" role="alert">Could not load todos: {{ error?.message }}</p>
    <template v-else-if="data">
      <p v-if="data.items.length === 0">Nothing here.</p>
      <ul :aria-busy="isFetching" :class="{ stale: isPlaceholderData }">
        <li v-for="todo in data.items" :key="todo.id">
          <RouterLink :to="{ name: 'todo', params: { id: todo.id } }">{{ todo.title }}</RouterLink>
          <span v-if="todo.done"> (done)</span>
        </li>
      </ul>
      <nav aria-label="Pagination">
        <button :disabled="filters.page <= 1" @click="setFilters({ page: filters.page - 1 })">
          Previous
        </button>
        <span>Page {{ data.page }} of {{ data.totalPages }}</span>
        <!-- While placeholder data is shown we don't know the real page count yet -->
        <button
          :disabled="isPlaceholderData || data.page >= data.totalPages"
          @click="setFilters({ page: filters.page + 1 })"
        >
          Next
        </button>
      </nav>
    </template>
  </section>
</template>

<style scoped>
.stale {
  opacity: 0.5;
}
</style>
