<script setup lang="ts">
import { ref } from 'vue'
import type { Todo, TodoPatch } from '@/api/todos'

// Editing server data: copy it ONCE into a local draft. Query data is read-only, and a
// background refetch must never overwrite what the user is typing. The parent passes
// :key="todo.id" so a different todo gets a fresh form and a fresh draft.
const props = defineProps<{ initial: Todo; saving: boolean }>()
const emit = defineEmits<{ save: [patch: TodoPatch]; cancel: [] }>()

const draftTitle = ref(props.initial.title)

function submit() {
  emit('save', { title: draftTitle.value })
}
</script>

<template>
  <form @submit.prevent="submit">
    <input v-model="draftTitle" aria-label="Title" required />
    <button type="submit" :disabled="saving">Save</button>
    <button type="button" @click="emit('cancel')">Cancel</button>
  </form>
</template>
