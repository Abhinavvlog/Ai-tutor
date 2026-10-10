import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { Application } from './components/ApplicationLoader'
import { ConfigurationRequired } from './pages/ConfigurationRequired'
import { getSupabaseConfigurationError } from './lib/supabaseConfig'

const configurationError = getSupabaseConfigurationError()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {configurationError ? (
      <ConfigurationRequired message={configurationError} />
    ) : (
      <Suspense fallback={<main className="min-h-screen p-8">Loading MyGuru...</main>}>
        <Application />
      </Suspense>
    )}
  </StrictMode>,
)
