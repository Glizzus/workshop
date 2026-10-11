<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { projectQueries, userQueries } from './queries'

const { data: me } = useQuery(userQueries.me())
// Re-evaluated whenever me changes; fetches once me.value?.teamId exists
const { data: projects, isLoading } = useQuery(() => projectQueries.byTeam(me.value?.teamId))
</script>

<template>
  <p v-if="isLoading">Loading projects…</p>
  <ul v-else-if="projects">
    <li v-for="p in projects" :key="p.id">{{ p.name }}</li>
  </ul>
</template>
