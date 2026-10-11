import { apiFetch } from './client'

export interface Job {
  id: string
  status: 'queued' | 'running' | 'done' | 'failed'
}

export const getJob = (id: string, signal?: AbortSignal) => apiFetch<Job>(`/jobs/${id}`, { signal })
