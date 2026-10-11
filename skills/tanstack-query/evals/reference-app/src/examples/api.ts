import { apiFetch } from '@/api/client'
export interface User { id: number; name: string; teamId: number }
export interface Project { id: number; name: string }
export interface Job { id: string; status: 'queued' | 'running' | 'done' | 'failed' }
export const getMe = (signal?: AbortSignal) => apiFetch<User>('/me', { signal })
export const getProjects = (teamId: number, signal?: AbortSignal) => apiFetch<Project[]>(`/teams/${teamId}/projects`, { signal })
export const getJob = (id: string, signal?: AbortSignal) => apiFetch<Job>(`/jobs/${id}`, { signal })
export const searchTodos = (term: string, signal?: AbortSignal) => apiFetch<{ id: number; title: string }[]>('/todos/search', { query: { q: term }, signal })
