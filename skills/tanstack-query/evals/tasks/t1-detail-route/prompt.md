Add a todo detail page.

- Route: `/todos/:id` (add it to the exported `routes` array in src/router.ts).
- Data: `GET /api/todos/:id` returns `{ id: number, title: string, done: boolean }`. A missing todo returns 404.
- The page shows the todo's title in an `<h1>`, and the text `Status: Done` or `Status: Open`.
- While loading, show `Loading…`. If the request fails (for example a 404), show an error message in an element with `role="alert"`.
- On the list page (/todos), make each todo title a link to its detail page.
- Navigating directly from one todo's page to another (e.g. /todos/1 → /todos/2) must show the new todo.
