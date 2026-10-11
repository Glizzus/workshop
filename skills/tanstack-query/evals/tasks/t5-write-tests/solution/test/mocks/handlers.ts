import { http, HttpResponse } from 'msw/http'
import { apiUrl } from '@/api/client'
import type { Todo } from '@/api/todos'
import { db } from './db'

export const handlers = [
  http.get(apiUrl('/todos'), () => HttpResponse.json(db.todos)),
  http.get(apiUrl('/todos/:id'), ({ params }) => {
    const todo = db.todos.find((t) => t.id === Number(params.id))
    return todo ? HttpResponse.json(todo) : HttpResponse.json({ message: 'Not found' }, { status: 404 })
  }),
  http.patch(apiUrl('/todos/:id'), async ({ params, request }) => {
    const patch = (await request.json()) as Partial<Todo>
    const index = db.todos.findIndex((t) => t.id === Number(params.id))
    if (index === -1) return HttpResponse.json({ message: 'Not found' }, { status: 404 })
    db.todos[index] = { ...db.todos[index]!, ...patch }
    return HttpResponse.json(db.todos[index])
  }),
]
