<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { todoQueries } from '@/queries/todos'

// select: derive what this component needs. The cache keeps the full server response,
// other components using the same query are unaffected.
const { data: titles } = useQuery(() => ({
  ...todoQueries.list({ status: 'all', page: 1 }),
  select: (page) => page.items.map((todo) => todo.title),
}))
</script>

<template>
  <ul>
    <li v-for="title in titles" :key="title">{{ title }}</li>
  </ul>
</template>
