<script setup lang="ts">
import { ref } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { todoQueries } from '@/queries/todos'

const props = defineProps<{ id: number }>()
const open = ref(false)
// enabled works too: spread the factory and add the condition, inside the getter
const { data, isLoading } = useQuery(() => ({ ...todoQueries.detail(props.id), enabled: open.value }))
</script>

<template>
  <button @click="open = !open">Details</button>
  <p v-if="isLoading">Loading…</p>
  <p v-else-if="open && data">{{ data.title }}</p>
</template>
