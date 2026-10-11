`src/views/ProjectsView.vue` loads its data by hand (`onMounted`, `watch`, and `loading` / `error` / `projects` refs). Refactor it to use TanStack Query (`@tanstack/vue-query` is installed and set up in `src/main.ts`).

Keep the same behavior and UI:
- The team comes from the URL query `?team=` (default `1`). The `Team 1` / `Team 2` buttons switch teams by changing the URL.
- The `Refresh` button reloads the current team's projects from the server.
- `Loading…` while loading; errors in an element with `role="alert"`; a list of project names.
- `GET /api/teams/:team/projects` returns `[{ id, name }]`.
