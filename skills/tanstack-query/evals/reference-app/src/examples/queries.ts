import { queryOptions, skipToken } from '@tanstack/vue-query'
import { getJob, getMe, getProjects, searchTodos } from './api'

export const userQueries = {
  me: () => queryOptions({ queryKey: ['users', 'me'], queryFn: ({ signal }) => getMe(signal) }),
}

export const projectQueries = {
  // teamId may be missing (dependent query): skipToken = "don't fetch yet", and stays type-safe
  byTeam: (teamId: number | undefined) =>
    queryOptions({
      queryKey: ['projects', 'byTeam', teamId],
      queryFn: teamId === undefined ? skipToken : ({ signal }) => getProjects(teamId, signal),
    }),
}

export const jobQueries = {
  detail: (id: string) =>
    queryOptions({
      queryKey: ['jobs', id],
      queryFn: ({ signal }) => getJob(id, signal),
      // Poll every 2s until the job finishes; returning false stops polling
      refetchInterval: (query) => {
        const status = query.state.data?.status
        return status === 'done' || status === 'failed' ? false : 2000
      },
    }),
}

export const searchQueries = {
  todos: (term: string) =>
    queryOptions({
      queryKey: ['todos', 'search', term],
      queryFn: ({ signal }) => searchTodos(term, signal),
      enabled: term.length >= 2, // no request for empty or 1-letter terms
      staleTime: 60_000,
    }),
}
