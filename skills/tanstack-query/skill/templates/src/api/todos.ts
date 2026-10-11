// Typed endpoint functions. One file per resource. Rename Todo to your entity.
// These know nothing about TanStack Query: they take plain values and return promises.
import { apiFetch } from './client'

export interface Todo {
  id: number
  title: string
  done: boolean
}

export type TodoStatus = 'all' | 'open' | 'done'

export interface TodoFilters {
  status: TodoStatus
  page: number
}

export interface TodoPage {
  items: Todo[]
  page: number
  totalPages: number
}

export interface NewTodo {
  title: string
}

export type TodoPatch = Partial<Pick<Todo, 'title' | 'done'>>

export const getTodos = (filters: TodoFilters, signal?: AbortSignal) =>
  apiFetch<TodoPage>('/todos', { query: { status: filters.status, page: filters.page }, signal })

export const getTodo = (id: number, signal?: AbortSignal) =>
  apiFetch<Todo>(`/todos/${id}`, { signal })

export const createTodo = (input: NewTodo) =>
  apiFetch<Todo>('/todos', { method: 'POST', body: input })

export const updateTodo = (id: number, patch: TodoPatch) =>
  apiFetch<Todo>(`/todos/${id}`, { method: 'PATCH', body: patch })

export const deleteTodo = (id: number) =>
  apiFetch<undefined>(`/todos/${id}`, { method: 'DELETE' })
