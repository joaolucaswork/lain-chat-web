import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Layout } from '@/pages/Layout'
import { ChatPage } from '@/pages/ChatPage'
import { MemoriesPage } from '@/pages/MemoriesPage'
import { SettingsPage } from '@/pages/SettingsPage'

export default function App() {
  return (
    <TooltipProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<ChatPage />} />
            <Route path="/memorias" element={<MemoriesPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  )
}
