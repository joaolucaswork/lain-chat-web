import { Suspense, lazy, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { TooltipProvider } from '@/components/ui/tooltip'
import { RouteFallback } from '@/components/RouteFallback'
import { TenantGate } from '@/components/TenantGate'
import { Layout } from '@/pages/Layout'
import { ChatPage } from '@/pages/ChatPage'
import { MeContext, getTenantName, useMe, useMeMode } from '@/hooks/useMe'

// WHY: ChatPage fica no bundle inicial (rota / é o chat); Memórias/Settings
// saem do inicial via lazy — reduz o carregamento sem tocar na experiência
// do chat. Named exports exigem o mapeamento .then(m => ({ default: ... })).
const MemoriesPage = lazy(() =>
  import('@/pages/MemoriesPage').then((m) => ({ default: m.MemoriesPage })),
)
const SettingsPage = lazy(() =>
  import('@/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })),
)

function DemoGate({ children }: { children: React.ReactNode }) {
  const mode = useMe()
  const [, setTick] = useState(0)
  if (mode === 'unknown') return <RouteFallback variant="memories" />
  // owner (modo legado) nunca vê o gate; demo sem cookie vê; tenant entra direto.
  if (mode === 'demo' && !getTenantName()) {
    return <TenantGate onDone={() => setTick((t) => t + 1)} />
  }
  return <MeContext.Provider value={mode}>{children}</MeContext.Provider>
}

export default function App() {
  return (
    <TooltipProvider>
      <BrowserRouter>
        <DemoGate>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<ChatPage />} />
              <Route
                path="/memorias"
                element={
                  <Suspense fallback={<RouteFallback variant="memories" />}>
                    <MemoriesPage />
                  </Suspense>
                }
              />
              <Route
                path="/settings"
                element={
                  <Suspense fallback={<RouteFallback variant="settings" />}>
                    <TenantSettingsGuard />
                  </Suspense>
                }
              />
            </Route>
          </Routes>
        </DemoGate>
      </BrowserRouter>
    </TooltipProvider>
  )
}

/** T7: visitante não tem Settings — cai no chat (a trava real é no server). */
function TenantSettingsGuard() {
  const mode = useMeMode()
  if (mode === 'tenant' || getTenantName()) return <Navigate to="/" replace />
  return <SettingsPage />
}
