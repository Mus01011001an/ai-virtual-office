import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/plus-jakarta-sans'
import './index.css'
import App from './App'
import { ErrorBoundary } from './hud/ErrorBoundary'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)

if (import.meta.env.DEV) {
  void Promise.all([import('./state/runtime'), import('./state/store')]).then(([r, s]) => {
    ;(window as unknown as Record<string, unknown>).__avo = { runtime: r.runtime, store: s.useOffice }
  })
}
