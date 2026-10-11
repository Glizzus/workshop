import { createApp } from 'vue'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import App from './App.vue'
import { router } from './router'

const queryClient = new QueryClient()

createApp(App).use(VueQueryPlugin, { queryClient }).use(router).mount('#app')
