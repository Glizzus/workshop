---
name: tanstack-query
description: Writes, fixes, reviews and tests Vue 3 code that loads or changes server data with TanStack Query (@tanstack/vue-query v5) in Vite + Vue Router + TypeScript apps. Use it whenever a Vue task fetches from an API, shows loading or error states, saves data and refreshes a list, paginates, polls, prefetches on navigation, or tests such code, including code that calls fetch in onMounted or watch, or keeps API responses in Pinia or refs. Vue only.
---

# TanStack Query for Vue

For `@tanstack/vue-query` 5.x (written against 5.104) with Vue 3.5+, Vue Router 4 or 5, TypeScript and `fetch`. Paths below are relative to the folder that contains this file.

## Step 1: check the version

```bash
node -p "require('./node_modules/@tanstack/vue-query/package.json').version"
```

If that command fails, look in package.json first: a dependency named `vue-query` (without `@tanstack/`) means the project is on v4.

| Installed | Do this |
|---|---|
| 5.102 or newer | Follow this skill as written. |
| 5.0 to 5.101 | Ask the user to upgrade within v5: `npm i @tanstack/vue-query@^5.102` (minor versions are not breaking). Some patterns here don't type-check on older 5.x. If they can't upgrade, read references/version-drift.md "Below 5.102" first. |
| 4.x, or the package `vue-query` | Stop. Tell the user the project is on v4 and needs a migration to v5 first. |
| neither installed | `npm i @tanstack/vue-query`, then set it up like templates/src/main.ts. |

## Core rules

1. **Server data lives in the query cache.** Read it with `useQuery`. Derive values with `computed` or `select`. Keep API responses out of `ref`s and Pinia. Symptom of copying: the copy stays old after a refetch.

2. **Define each query once, in `src/queries/<resource>.ts`,** as a factory that takes plain values and returns `queryOptions({ queryKey, queryFn })`. Components never write a `queryKey` or `queryFn` themselves. Copy templates/src/queries/todos.ts.

3. **When the options use anything reactive (props, refs, route), wrap them in a getter:**
   ```ts
   const { data } = useQuery(() => todoQueries.detail(props.id))
   ```
   Wrong: `useQuery(todoQueries.detail(props.id))`. Symptom: the id changes, the old item stays on screen.

4. **Call `useQuery`, `useMutation` and `useQueryClient` only at the top level of `<script setup>` or of a `use...()` composable.** To load something else, change a ref that the getter reads. Wrong: `useQuery` inside a click handler. Symptom: the error "vue-query hooks can only be used inside setup()". (Exception: `useQueryClient()` also works in Vue Router guards, as in templates/src/router.ts.)

5. **Results are refs. Destructure them.** `const { data, isPending } = useQuery(...)`. In `<script>` write `data.value`. In the template write `data`.

6. **Every `queryFn` and `mutationFn` calls the API client.** It throws on 4xx/5xx and forwards `signal`: `queryFn: ({ signal }) => getTodo(id, signal)`. Copy templates/src/api/. Wrong: plain `fetch()` in a `queryFn`. Symptom: a 404 response shows up as data.

7. **After a mutation succeeds, update the cache, and return the promise:**
   ```ts
   onSuccess: () => queryClient.invalidateQueries({ queryKey: todoKeys.lists() }),
   ```
   Symptom of forgetting: the list doesn't show the new item until a reload.

8. **In components, call `mutate()`.** React to the result with its `onSuccess` / `onError` options. Use `mutateAsync()` only inside `try/catch`.

9. **Use the built-in feature instead of building one:**

   | Need | Use |
   |---|---|
   | wait for other data first | `skipToken` in the factory, or `enabled` inside the getter |
   | poll | `refetchInterval` |
   | next page without flicker | `placeholderData: keepPreviousData` |
   | "load more", infinite scroll | `useInfiniteQuery` + `infiniteQueryOptions` |
   | refetch when an input changes | the input in the key (rule 3), not `watch` + `refetch()` |
   | instant feedback when saving | an optimistic update (references/mutations.md) |

10. **Write v5 names:** `isPending` (no data yet), `gcTime`, `placeholderData: keepPreviousData`, `throwOnError`, one options object per call. Queries have no `onSuccess` / `onError` / `onSettled`. If TypeScript rejects a Query option, it is almost always a v4 name: check references/version-drift.md. Never silence it with `as any` or `@ts-ignore`.

11. **Keep client state out of the query cache.** Filters and page numbers go in the URL. Form drafts go in a local `ref`. UI flags go in a `ref` or Pinia.

12. **Test against a fake network:** MSW, a new QueryClient per test, `retry: false`. Use the helpers in templates/test/. Never mock `useQuery` itself.

## Workflow

Copy this checklist into your notes and tick items off:

```
- [ ] 1. Version checked (Step 1)
- [ ] 2. Read the reference file(s) for this task (table below)
- [ ] 3. Looked for existing src/api and src/queries files; followed them, or copied templates/
- [ ] 4. Wrote the code
- [ ] 5. Type-check                              → fix every error
         (npm run type-check if package.json has it; else npx vue-tsc --build
          if tsconfig.json has "references"; else npx vue-tsc --noEmit)
- [ ] 6. npx eslint .                            → fix every error
- [ ] 7. npx vitest run                          → all tests pass
- [ ] 8. Steps 5 to 7 pass in one run, with no changes in between
```

If the project has no ESLint yet, set it up from templates/eslint.config.mjs. If it has no test setup yet, set it up from references/testing.md "Setup".

If the tools pick up files inside this skill's own folder (for example `.agents/skills/...` or `.claude/skills/...`), they are scanning the skill's templates. Don't edit the skill's files. Instead:
- ESLint: add the folder to `ignores` (the template config already ignores `.agents/**` and `.claude/**`).
- Vitest: set `test.include` to the project's test folders, as templates/vite.config.ts does. The default pattern also matches the skill's example tests.

## Which file to read

| If the task involves... | Read |
|---|---|
| any `useQuery` code in a component | references/vue-reactivity.md |
| new queries, keys, `staleTime`, loading/error UI, dependent queries, polling | references/queries.md |
| saving, deleting, refreshing after a save, optimistic UI, edit forms | references/mutations.md |
| pages, "load more", infinite scroll | references/pagination-infinite.md |
| route params, filters in the URL, prefetching, logout | references/router-and-prefetching.md |
| deciding whether something belongs in TanStack Query at all | references/when-not-to-use.md |
| writing or fixing tests | references/testing.md, then copy from templates/test/ |
| old code, an upgrade, or a TypeScript error on a Query option | references/version-drift.md |
| a bug ("doesn't refetch", "always loading", an error message) | references/troubleshooting.md |

## Templates

Copy and rename (Todo → your resource). Together they pass `vue-tsc`, ESLint with the TanStack plugin, and their own tests.

| File | What it shows |
|---|---|
| templates/src/api/client.ts | `fetch` wrapper: throws on non-2xx, forwards `signal`, parses JSON |
| templates/src/api/todos.ts | typed endpoint functions |
| templates/src/queries/todos.ts | key factory, query factories, mutation composables (invalidate, setQueryData, optimistic, delete) |
| templates/src/main.ts | one QueryClient, `VueQueryPlugin`, global `staleTime` |
| templates/src/router.ts | route params and URL filters as props, prefetch in a route guard |
| templates/src/views/TodoListView.vue | URL filters, pagination, create form |
| templates/src/views/TodoDetailView.vue | detail by route id, optimistic toggle, edit, delete |
| templates/src/views/TodoFeedView.vue | infinite list with "Load more" |
| templates/src/components/TodoEditForm.vue | edit form that copies server data once |
| templates/eslint.config.mjs | ESLint with `@tanstack/eslint-plugin-query` |
| templates/vite.config.ts | Vitest settings |
| templates/test/ | MSW fake API, test helpers, example tests for every pattern |

## If the answer isn't here

Read the official Vue docs page for the topic. The index is https://tanstack.com/query/latest/llms.txt; use the pages under `framework/vue`. Before copying an example:
- React examples need rules 3 and 5 to work in Vue.
- Some official Vue snippets are outdated (references/version-drift.md "Stale snippets in the official docs").
