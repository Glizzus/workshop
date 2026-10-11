<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useInfiniteQuery } from '@tanstack/vue-query'
import { todoQueries } from '@/queries/todos'

const { data, hasNextPage, isFetchingNextPage, fetchNextPage } = useInfiniteQuery(() =>
  todoQueries.infinite('all'),
)
const todos = computed(() => data.value?.pages.flatMap((page) => page.items) ?? [])

// Load the next page when the sentinel scrolls into view
const sentinel = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | undefined
onMounted(() => {
  observer = new IntersectionObserver(([entry]) => {
    if (entry?.isIntersecting && hasNextPage.value && !isFetchingNextPage.value) void fetchNextPage()
  })
  if (sentinel.value) observer.observe(sentinel.value)
})
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <ul>
    <li v-for="todo in todos" :key="todo.id">{{ todo.title }}</li>
  </ul>
  <div ref="sentinel" />
  <p v-if="isFetchingNextPage">Loading more…</p>
</template>
