import { useQueryClient } from '@tanstack/vue-query'
import {
  createRouter,
  createWebHistory,
  type LocationQuery,
  type RouteRecordRaw,
} from 'vue-router'
import type { TodoFilters, TodoStatus } from '@/api/todos'
import { todoQueries } from '@/queries/todos'

const statuses: TodoStatus[] = ['all', 'open', 'done']

// URL query (?status=open&page=2) → typed filters. Filters live in the URL, not in the query cache.
export function todoFiltersFromQuery(query: LocationQuery): TodoFilters {
  const status = statuses.find((s) => s === query.status) ?? 'all'
  const page = Math.max(1, Number(query.page) || 1)
  return { status, page }
}

export const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/todos' },
  {
    path: '/todos',
    name: 'todos',
    component: () => import('./views/TodoListView.vue'),
    // Route → props: the view receives plain, typed values and stays easy to test
    props: (route) => ({ filters: todoFiltersFromQuery(route.query) }),
  },
  {
    path: '/todos/:id(\\d+)',
    name: 'todo',
    component: () => import('./views/TodoDetailView.vue'),
    props: (route) => ({ id: Number(route.params.id) }),
    // Prefetch: start the request while the view's code is still downloading.
    // Not awaited, so navigation is not blocked; the view's useQuery reuses the in-flight request.
    // Guards run inside the app's injection context, so useQueryClient() works here.
    beforeEnter: (to) => {
      useQueryClient()
        .query(todoQueries.detail(Number(to.params.id)))
        .catch(() => {}) // a failed prefetch is fine: the view shows the error and retries
    },
  },
  { path: '/feed', name: 'feed', component: () => import('./views/TodoFeedView.vue') },
]

export const router = createRouter({ history: createWebHistory(), routes })
