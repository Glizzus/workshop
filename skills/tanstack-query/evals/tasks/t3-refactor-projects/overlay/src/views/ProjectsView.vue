<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getProjects, type Project } from '@/api/projects'

const route = useRoute()
const router = useRouter()

const projects = ref<Project[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

async function load() {
  loading.value = true
  error.value = null
  try {
    projects.value = await getProjects(String(route.query.team ?? '1'))
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(() => route.query.team, load)

function selectTeam(team: string) {
  void router.push({ query: { team } })
}
</script>

<template>
  <h1>Projects</h1>
  <button @click="selectTeam('1')">Team 1</button>
  <button @click="selectTeam('2')">Team 2</button>
  <button @click="load">Refresh</button>
  <p v-if="loading">Loading…</p>
  <p v-else-if="error" role="alert">{{ error }}</p>
  <ul v-else>
    <li v-for="project in projects" :key="project.id">{{ project.name }}</li>
  </ul>
</template>
