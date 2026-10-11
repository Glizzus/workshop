export interface Project {
  id: number
  name: string
}

export async function getProjects(team: string): Promise<Project[]> {
  const res = await fetch(`/api/teams/${team}/projects`)
  if (!res.ok) throw new Error(`Failed to load projects (${res.status})`)
  return res.json()
}
