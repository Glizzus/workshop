<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuery } from '@tanstack/vue-query'
import { projectQueries } from '@/queries/projects'

const route = useRoute()
const router = useRouter()
const team = computed(() => String(route.query.team ?? '1'))

const { data: projects, error, isPending, isError, refetch } = useQuery(() =>
  projectQueries.byTeam(team.value),
)

function selectTeam(next: string) {
  void router.push({ query: { team: next } })
}
</script>

<template>
  <h1>Projects</h1>
  <button @click="selectTeam('1')">Team 1</button>
  <button @click="selectTeam('2')">Team 2</button>
  <button @click="refetch()">Refresh</button>
  <p v-if="isPending">Loading…</p>
  <p v-else-if="isError" role="alert">{{ error?.message }}</p>
  <ul v-else>
    <li v-for="project in projects" :key="project.id">{{ project.name }}</li>
  </ul>
</template>
