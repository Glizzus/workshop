// In-memory fake backend data. Handlers read and write it; setup.ts resets it after every test.
import type { Todo } from '@/api/todos'

const seed: Todo[] = [
  { id: 1, title: 'Buy milk', done: false },
  { id: 2, title: 'Walk the dog', done: true },
  { id: 3, title: 'Write tests', done: false },
]

export const db = {
  todos: structuredClone(seed),
  nextId: seed.length + 1,
}

export function resetDb() {
  db.todos = structuredClone(seed)
  db.nextId = seed.length + 1
}
