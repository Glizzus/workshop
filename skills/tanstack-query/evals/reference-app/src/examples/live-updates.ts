// WebSocket/SSE: let the socket say WHAT changed, let queries fetch the data.
import { onBeforeUnmount } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import { todoKeys } from '@/queries/todos'

export function useTodoLiveUpdates(url: string) {
  const queryClient = useQueryClient()
  const socket = new WebSocket(url)
  socket.addEventListener('message', (event: MessageEvent<string>) => {
    const message = JSON.parse(event.data) as { entity: 'todo'; id: number }
    void queryClient.invalidateQueries({ queryKey: todoKeys.detail(message.id) })
    void queryClient.invalidateQueries({ queryKey: todoKeys.lists() })
  })
  onBeforeUnmount(() => socket.close())
}
