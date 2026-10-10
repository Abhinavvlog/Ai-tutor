import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { StartScreen } from './pages/StartScreen'
import { TutorScreen } from './pages/TutorScreen'
import { ProgressScreen } from './pages/ProgressScreen'

export default function Application() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<StartScreen />} />
        <Route path="/learn/:conceptId" element={<TutorScreen />} />
        <Route path="/progress" element={<ProgressScreen />} />
      </Routes>
    </BrowserRouter>
  )
}
