import { apiFetch } from './client'

export interface Todo {
  id: number
  title: string
  done: boolean
}

export const getTodos = (signal?: AbortSignal) => apiFetch<Todo[]>('/todos', { signal })
export const getTodo = (id: number, signal?: AbortSignal) => apiFetch<Todo>(`/todos/${id}`, { signal })
export const updateTodo = (id: number, patch: Partial<Pick<Todo, 'title' | 'done'>>) =>
  apiFetch<Todo>(`/todos/${id}`, { method: 'PATCH', body: patch })
