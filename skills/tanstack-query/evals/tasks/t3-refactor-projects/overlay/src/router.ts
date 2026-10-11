import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

// Add new routes to this exported array.
export const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/todos' },
  { path: '/todos', name: 'todos', component: () => import('./views/TodoListView.vue') },
  { path: '/projects', name: 'projects', component: () => import('./views/ProjectsView.vue') },
]

export const router = createRouter({ history: createWebHistory(), routes })
