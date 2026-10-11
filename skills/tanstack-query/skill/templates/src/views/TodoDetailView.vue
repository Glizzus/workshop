<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useQuery } from '@tanstack/vue-query'
import type { TodoPatch } from '@/api/todos'
import TodoEditForm from '@/components/TodoEditForm.vue'
import { todoQueries, useDeleteTodo, useToggleTodo, useUpdateTodo } from '@/queries/todos'

// From the route (/todos/:id) via route props. Navigating /todos/1 → /todos/2 reuses this
// component with a new id; the getter below makes the query follow it.
const props = defineProps<{ id: number }>()
const router = useRouter()

const { data: todo, error, isPending, isError } = useQuery(() => todoQueries.detail(props.id))

const { mutate: toggleTodo, error: toggleError } = useToggleTodo()
const { mutate: updateTodo, isPending: isSaving, error: saveError } = useUpdateTodo()
const { mutate: deleteTodo, isPending: isDeleting } = useDeleteTodo()

const editing = ref(false)

function onToggle(done: boolean) {
  toggleTodo({ id: props.id, done })
}

function onSave(patch: TodoPatch) {
  updateTodo({ id: props.id, patch }, { onSuccess: () => (editing.value = false) })
}

function onDelete() {
  deleteTodo(props.id, { onSuccess: () => void router.push({ name: 'todos' }) })
}
</script>

<template>
  <p v-if="isPending">Loading…</p>
  <p v-else-if="isError" role="alert">Could not load the todo: {{ error?.message }}</p>
  <article v-else-if="todo">
    <h1>{{ todo.title }}</h1>
    <label>
      <input
        type="checkbox"
        :checked="todo.done"
        @change="onToggle(($event.target as HTMLInputElement).checked)"
      />
      Done
    </label>
    <p v-if="toggleError" role="alert">Could not update: {{ toggleError.message }}</p>

    <!-- :key re-creates the form for another todo, so its draft starts from that todo's data -->
    <TodoEditForm
      v-if="editing"
      :key="todo.id"
      :initial="todo"
      :saving="isSaving"
      @save="onSave"
      @cancel="editing = false"
    />
    <button v-else @click="editing = true">Edit</button>
    <p v-if="saveError" role="alert">Could not save: {{ saveError.message }}</p>

    <button :disabled="isDeleting" @click="onDelete">Delete</button>
  </article>
</template>
