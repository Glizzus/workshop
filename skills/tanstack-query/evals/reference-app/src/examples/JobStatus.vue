<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { jobQueries } from './queries'

const props = defineProps<{ jobId: string }>()
const { data: job } = useQuery(() => jobQueries.detail(props.jobId))
</script>

<template>
  <p v-if="job">Job {{ job.id }}: {{ job.status }}</p>
</template>
