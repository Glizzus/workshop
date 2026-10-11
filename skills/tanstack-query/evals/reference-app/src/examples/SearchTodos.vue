<script setup lang="ts">
import { ref } from 'vue'
import { keepPreviousData, useQuery } from '@tanstack/vue-query'
import { searchQueries } from './queries'

// Fetch on submit: the query follows `submitted`; typing alone changes nothing
const input = ref('')
const submitted = ref('')
const { data: results, isFetching } = useQuery(() => ({
  ...searchQueries.todos(submitted.value),
  placeholderData: keepPreviousData,
}))
</script>

<template>
  <form @submit.prevent="submitted = input.trim()">
    <input v-model="input" aria-label="Search" />
    <button type="submit" :disabled="isFetching">Search</button>
  </form>
  <ul v-if="results">
    <li v-for="r in results" :key="r.id">{{ r.title }}</li>
  </ul>
</template>
