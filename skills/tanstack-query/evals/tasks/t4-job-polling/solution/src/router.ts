import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

// Add new routes to this exported array.
export const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/todos' },
  { path: '/todos', name: 'todos', component: () => import('./views/TodoListView.vue') },
  {
    path: '/jobs/:id',
    name: 'job',
    component: () => import('./views/JobView.vue'),
    props: (route) => ({ id: String(route.params.id) }),
  },
]

export const router = createRouter({ history: createWebHistory(), routes })
