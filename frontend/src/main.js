import { createSSRApp } from 'vue'
import App from './App.vue'

// H5：吞掉 uni 路由等返回的「裸 Object」拒绝，避免控制台 Uncaught (in promise) Object
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason
    if (reason instanceof Error) return
    if (reason && typeof reason === 'object') {
      event.preventDefault()
    }
  })
}

export function createApp() {
  const app = createSSRApp(App)
  return { app }
}
