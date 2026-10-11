import type { Todo } from '@/api/todos'

const seed: Todo[] = [
  { id: 1, title: 'Buy milk', done: false },
  { id: 2, title: 'Walk the dog', done: true },
]

export const db = { todos: structuredClone(seed) }

export function resetDb() {
  db.todos = structuredClone(seed)
}
