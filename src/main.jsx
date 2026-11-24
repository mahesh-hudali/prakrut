import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './design-system/tokens.css'
import './design-system/base.css'
import { lazy, Suspense } from 'react'
import App from './App.jsx'

// ?editor=next opens the new ProseMirror editor with the book library.
const WriterApp = lazy(() => import('./editor/WriterApp.jsx'))
const useNextEditor = new URLSearchParams(location.search).get('editor') === 'next'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {useNextEditor ? (
      <Suspense fallback={null}>
        <WriterApp />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
)
