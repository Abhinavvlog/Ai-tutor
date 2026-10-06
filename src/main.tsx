import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import { StartScreen } from './pages/StartScreen'
import { TutorScreen } from './pages/TutorScreen'
import { ProgressScreen } from './pages/ProgressScreen'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<StartScreen />} />
        <Route path="/learn/:conceptId" element={<TutorScreen />} />
        <Route path="/progress" element={<ProgressScreen />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
