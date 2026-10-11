import { createApp } from 'vue'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import App from './App.vue'
import { router } from './router'

// The app's ONE QueryClient. Create it here, once. Everything else gets it with useQueryClient()
// (components, composables, and router guards: they run inside the app's injection context).
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // How long fetched data counts as fresh. While fresh, mounting another component with the
      // same query, refocusing the window or reconnecting will NOT refetch. The library default is 0.
      staleTime: 30_000,
    },
  },
})

// Install VueQueryPlugin before the router so the first navigation's guards can use useQueryClient()
createApp(App).use(VueQueryPlugin, { queryClient }).use(router).mount('#app')
