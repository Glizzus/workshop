import { apiFetch } from './client'

export interface Todo {
  id: number
  title: string
  done: boolean
}

export const getTodos = (signal?: AbortSignal) => apiFetch<Todo[]>('/todos', { signal })
export const getTodo = (id: number, signal?: AbortSignal) => apiFetch<Todo>(`/todos/${id}`, { signal })
