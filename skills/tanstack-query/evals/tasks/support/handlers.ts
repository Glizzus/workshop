import { http, HttpResponse } from 'msw/http'
import { db, type Todo } from './db'

const api = (path: string) => `http://localhost:3000/api${path}`

export const handlers = [
  http.get(api('/todos'), () => {
    db.calls.push('GET /todos')
    return HttpResponse.json(db.todos)
  }),
  http.get(api('/todos/:id'), ({ params }) => {
    db.calls.push(`GET /todos/${String(params.id)}`)
    const todo = db.todos.find((t) => t.id === Number(params.id))
    return todo ? HttpResponse.json(todo) : HttpResponse.json({ message: 'Not found' }, { status: 404 })
  }),
  http.post(api('/todos'), async ({ request }) => {
    db.calls.push('POST /todos')
    const body = (await request.json()) as { title: string }
    const todo = { id: db.nextId++, title: body.title, done: false }
    db.todos.push(todo)
    return HttpResponse.json(todo, { status: 201 })
  }),
  http.patch(api('/todos/:id'), async ({ params, request }) => {
    db.calls.push(`PATCH /todos/${String(params.id)}`)
    const patch = (await request.json()) as Partial<Todo>
    const i = db.todos.findIndex((t) => t.id === Number(params.id))
    if (i === -1) return HttpResponse.json({ message: 'Not found' }, { status: 404 })
    db.todos[i] = { ...db.todos[i]!, ...patch }
    return HttpResponse.json(db.todos[i])
  }),
  http.get(api('/teams/:id/projects'), ({ params }) => {
    db.calls.push(`GET /teams/${String(params.id)}/projects`)
    const projects = db.projects[String(params.id)]
    return projects ? HttpResponse.json(projects) : HttpResponse.json({ message: 'Not found' }, { status: 404 })
  }),
  http.get(api('/jobs/:id'), ({ params }) => {
    const status = db.jobStatuses[Math.min(db.jobCalls, db.jobStatuses.length - 1)]
    db.jobCalls++
    db.calls.push(`GET /jobs/${String(params.id)}`)
    return HttpResponse.json({ id: String(params.id), status })
  }),
]
