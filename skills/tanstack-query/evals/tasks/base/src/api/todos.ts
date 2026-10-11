export interface Todo {
  id: number
  title: string
  done: boolean
}

export async function getTodos(): Promise<Todo[]> {
  const res = await fetch('/api/todos')
  return res.json()
}
