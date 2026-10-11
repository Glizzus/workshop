export interface Todo { id: number; title: string; done: boolean }
const seedTodos: Todo[] = [
  { id: 1, title: 'Buy milk', done: false },
  { id: 2, title: 'Walk the dog', done: true },
  { id: 3, title: 'Write tests', done: false },
]
const seedProjects: Record<string, { id: number; name: string }[]> = {
  '1': [{ id: 1, name: 'Apollo' }, { id: 2, name: 'Gemini' }],
  '2': [{ id: 3, name: 'Mercury' }],
}
export const db = {
  todos: structuredClone(seedTodos),
  nextId: 4,
  projects: structuredClone(seedProjects),
  jobStatuses: ['running'] as string[],
  jobCalls: 0,
  calls: [] as string[],
}
export function resetDb() {
  db.todos = structuredClone(seedTodos)
  db.nextId = 4
  db.projects = structuredClone(seedProjects)
  db.jobStatuses = ['running']
  db.jobCalls = 0
  db.calls = []
}
