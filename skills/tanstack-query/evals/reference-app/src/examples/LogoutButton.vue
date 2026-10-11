<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query'
import { useRouter } from 'vue-router'
import { apiFetch } from '@/api/client'

const queryClient = useQueryClient()
const router = useRouter()

async function logout() {
  await apiFetch('/logout', { method: 'POST' })
  queryClient.clear() // drop every cached query: the next user must not see this user's data
  await router.push('/login')
}
</script>

<template><button @click="logout">Log out</button></template>
