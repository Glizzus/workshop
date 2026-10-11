import { apiFetch } from './client'

export interface Todo {
  id: number
  title: string
  done: boolean
}

export const getTodos = (signal?: AbortSignal) => apiFetch<Todo[]>('/todos', { signal })
export const createTodo = (input: { title: string }) =>
  apiFetch<Todo>('/todos', { method: 'POST', body: input })
