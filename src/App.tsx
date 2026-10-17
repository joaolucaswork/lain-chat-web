import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Layout } from '@/pages/Layout'
import { ChatPage } from '@/pages/ChatPage'
import { MemoriesPage } from '@/pages/MemoriesPage'
import { AboutPage } from '@/pages/AboutPage'

export default function App() {
  return (
    <TooltipProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<ChatPage />} />
            <Route path="/memorias" element={<MemoriesPage />} />
            <Route path="/sobre" element={<AboutPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  )
}
