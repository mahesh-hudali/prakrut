import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import './design-system/tokens.css'
import './design-system/base.css'
import WriterApp from './editor/WriterApp.jsx'

// The previous page-based editor stays reachable at ?editor=classic while the
// new editor settles in; it is loaded only when asked for.
const ClassicApp = lazy(() => import('./App.jsx'))
const classic = new URLSearchParams(location.search).get('editor') === 'classic'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {classic ? (
      <Suspense fallback={null}>
        <ClassicApp />
      </Suspense>
    ) : (
      <WriterApp />
    )}
  </StrictMode>,
)
