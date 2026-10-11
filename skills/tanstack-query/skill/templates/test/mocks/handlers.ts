// MSW request handlers: a tiny fake API backed by db.ts.
// MSW 3 imports from 'msw/http'. MSW 2 imports the same names from 'msw'.
import { http, HttpResponse } from 'msw/http'
import { apiUrl } from '@/api/client'
import type { NewTodo, TodoPage, TodoPatch } from '@/api/todos'
import { db } from './db'

export const PAGE_SIZE = 2

export const handlers = [
  http.get(apiUrl('/todos'), ({ request }) => {
    const params = new URL(request.url).searchParams
    const status = params.get('status') ?? 'all'
    const page = Number(params.get('page') ?? '1')
    const matching = db.todos.filter(
      (t) => status === 'all' || (status === 'done' ? t.done : !t.done),
    )
    const totalPages = Math.max(1, Math.ceil(matching.length / PAGE_SIZE))
    const items = matching.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
    return HttpResponse.json<TodoPage>({ items, page, totalPages })
  }),

  http.get(apiUrl('/todos/:id'), ({ params }) => {
    const todo = db.todos.find((t) => t.id === Number(params.id))
    return todo ? HttpResponse.json(todo) : HttpResponse.json({ message: 'Not found' }, { status: 404 })
  }),

  http.post(apiUrl('/todos'), async ({ request }) => {
    const input = (await request.json()) as NewTodo
    const todo = { id: db.nextId++, title: input.title, done: false }
    db.todos.push(todo)
    return HttpResponse.json(todo, { status: 201 })
  }),

  http.patch(apiUrl('/todos/:id'), async ({ params, request }) => {
    const patch = (await request.json()) as TodoPatch
    const index = db.todos.findIndex((t) => t.id === Number(params.id))
    if (index === -1) return HttpResponse.json({ message: 'Not found' }, { status: 404 })
    db.todos[index] = { ...db.todos[index]!, ...patch }
    return HttpResponse.json(db.todos[index])
  }),

  http.delete(apiUrl('/todos/:id'), ({ params }) => {
    db.todos = db.todos.filter((t) => t.id !== Number(params.id))
    return new HttpResponse(null, { status: 204 })
  }),
]
