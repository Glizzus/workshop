<script setup lang="ts">
import { computed, ref } from 'vue'
import { useInfiniteQuery } from '@tanstack/vue-query'
import type { TodoStatus } from '@/api/todos'
import { todoQueries } from '@/queries/todos'

// Infinite list ("load more"). Changing status starts a separate infinite query (new key).
const status = ref<TodoStatus>('all')

const { data, error, isPending, isError, hasNextPage, isFetchingNextPage, fetchNextPage } =
  useInfiniteQuery(() => todoQueries.infinite(status.value))

// data.pages is one entry per fetched page; flatten it for rendering
const todos = computed(() => data.value?.pages.flatMap((page) => page.items) ?? [])

function loadMore() {
  if (hasNextPage.value && !isFetchingNextPage.value) void fetchNextPage()
}
</script>

<template>
  <section>
    <h1>Feed</h1>
    <label>
      Status
      <select v-model="status">
        <option value="all">All</option>
        <option value="open">Open</option>
        <option value="done">Done</option>
      </select>
    </label>

    <p v-if="isPending">Loading…</p>
    <p v-else-if="isError" role="alert">Could not load the feed: {{ error?.message }}</p>
    <template v-else>
      <ul>
        <li v-for="todo in todos" :key="todo.id">{{ todo.title }}</li>
      </ul>
      <button v-if="hasNextPage" :disabled="isFetchingNextPage" @click="loadMore">
        {{ isFetchingNextPage ? 'Loading more…' : 'Load more' }}
      </button>
      <p v-else>No more todos.</p>
    </template>
  </section>
</template>
