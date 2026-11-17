import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Layout } from '@/pages/Layout'
import { ChatPage } from '@/pages/ChatPage'

// WHY: ChatPage fica no bundle inicial (rota / é o chat); Memórias/Settings
// saem do inicial via lazy — reduz o carregamento sem tocar na experiência
// do chat. Named exports exigem o mapeamento .then(m => ({ default: ... })).
const MemoriesPage = lazy(() =>
  import('@/pages/MemoriesPage').then((m) => ({ default: m.MemoriesPage })),
)
const SettingsPage = lazy(() =>
  import('@/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })),
)

export default function App() {
  return (
    <TooltipProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<ChatPage />} />
            <Route
              path="/memorias"
              element={
                <Suspense fallback={null}>
                  <MemoriesPage />
                </Suspense>
              }
            />
            <Route
              path="/settings"
              element={
                <Suspense fallback={null}>
                  <SettingsPage />
                </Suspense>
              }
            />
          </Route>
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  )
}
