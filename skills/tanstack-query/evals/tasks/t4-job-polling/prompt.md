Add a job status page.

- Route: `/jobs/:id` (add it to the exported `routes` array in src/router.ts).
- `GET /api/jobs/:id` returns `{ id: string, status: 'queued' | 'running' | 'done' | 'failed' }`.
- Show the text `Status: <status>`, for example `Status: running`.
- Refresh the status from the server every 1 second until it is `done` or `failed`, then stop refreshing.
- Stop refreshing when the user leaves the page.
