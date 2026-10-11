Set up automated tests for this project and write tests for the todo detail page (route `/todos/:id`, `src/views/TodoDetailView.vue`).

Cover at least:
1. It shows the todo for the id in the URL: the title in an `<h1>` and `Status: Open` / `Status: Done`.
2. It shows an error (`role="alert"`) when the todo can't be loaded (the server answers 404).
3. Clicking the `Done` checkbox marks the todo done (`Status: Done`). The server endpoint is `PATCH /api/todos/:id` with `{ "done": boolean }` and returns the updated todo.
4. Navigating from `/todos/1` to `/todos/2` shows todo 2.

`GET /api/todos/:id` returns `{ id, title, done }`.

Tests must not call a real server. `npx vitest run` must pass. Vitest, jsdom, MSW 3, @testing-library/vue, @testing-library/user-event, @testing-library/jest-dom and @vue/test-utils are installed, but nothing is configured yet. Do not change files in `src/`.
