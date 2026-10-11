import { queryOptions } from '@tanstack/vue-query'
import { getProjects } from '@/api/projects'

export const projectQueries = {
  byTeam: (team: string) =>
    queryOptions({ queryKey: ['projects', 'byTeam', team], queryFn: () => getProjects(team) }),
}
