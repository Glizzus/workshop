import { queryOptions } from '@tanstack/vue-query'
import { getJob } from '@/api/jobs'

export const jobQueries = {
  detail: (id: string) =>
    queryOptions({
      queryKey: ['jobs', id],
      queryFn: ({ signal }) => getJob(id, signal),
      refetchInterval: (query) => {
        const status = query.state.data?.status
        return status === 'done' || status === 'failed' ? false : 1000
      },
    }),
}
