<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query'
import { todoQueries } from '@/queries/todos'

const props = defineProps<{ id: number; title: string }>()
const queryClient = useQueryClient() // in setup, never inside the handler

// Prefetch on hover/focus: the detail page usually opens with data already cached
function prefetch() {
  queryClient.query(todoQueries.detail(props.id)).catch(() => {})
}
</script>

<template>
  <RouterLink :to="{ name: 'todo', params: { id } }" @mouseenter="prefetch" @focus="prefetch">
    {{ title }}
  </RouterLink>
</template>
