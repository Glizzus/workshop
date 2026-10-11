<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { jobQueries } from '@/queries/jobs'

const props = defineProps<{ id: string }>()
const { data: job, isPending, isError, error } = useQuery(() => jobQueries.detail(props.id))
</script>

<template>
  <p v-if="isPending">Loading…</p>
  <p v-else-if="isError" role="alert">{{ error?.message }}</p>
  <p v-else-if="job">Status: {{ job.status }}</p>
</template>
