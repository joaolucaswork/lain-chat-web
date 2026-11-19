import { Suspense, lazy, useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { TooltipProvider } from '@/components/ui/tooltip'
import { RouteFallback } from '@/components/RouteFallback'
import { AuthGate } from '@/components/AuthGate'
import { Layout } from '@/pages/Layout'
import { ChatPage } from '@/pages/ChatPage'
import { LandingPage, PrivacyPage, TermsPage } from '@/pages/Public'
import { MeContext, clearTenantName, getTenantName, useMe, useMeMode } from '@/hooks/useMe'

// WHY: ChatPage fica no bundle inicial (rota / é o chat); Memórias/Settings
// saem do inicial via lazy — reduz o carregamento sem tocar na experiência
// do chat. Named exports exigem o mapeamento .then(m => ({ default: ... })).
const MemoriesPage = lazy(() =>
  import('@/pages/MemoriesPage').then((m) => ({ default: m.MemoriesPage })),
)
const SettingsPage = lazy(() =>
  import('@/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })),
)
const TenantSettingsPage = lazy(() =>
  import('@/pages/TenantSettingsPage').then((m) => ({ default: m.TenantSettingsPage })),
)
const DocsInstallPage = lazy(() =>
  import('@/pages/DocsInstallPage').then((m) => ({ default: m.DocsInstallPage })),
)

function DemoGate({ children }: { children: React.ReactNode }) {
  const mode = useMe()
  const location = useLocation()
  const [, setTick] = useState(0)
  // Cookie sumiu (limpeza manual/expiração) mas o nome ficou: sem key não há
  // conta — e sem limpar, o browser sem cookie cairia no escopo owner no BFF.
  // Limpa e volta pro gate (o nome antigo segue reservado: 409 no re-signup).
  useEffect(() => {
    if (mode === 'demo' && getTenantName()) {
      clearTenantName()
      setTick((t) => t + 1)
    }
  }, [mode])
  if (mode === 'unknown') {
    // WHY: o fallback precisa combinar com a rota atual. Mostrar o
    // skeleton de memórias na home (/) causava um flash da página
    // de memórias durante o /api/me inicial — na home, blank neutro.
    if (location.pathname.startsWith('/memorias')) return <RouteFallback variant="memories" />
    if (location.pathname.startsWith('/settings')) return <RouteFallback variant="settings" />
    return <RouteFallback variant="blank" />
  }
  // owner (modo legado) nunca vê o gate; demo sem cookie vê; tenant entra direto.
  if (mode === 'demo' && !getTenantName()) {
    // Pós-login: reload integral em vez de tick — o cookie novo só vale
    // no próximo /api/me; sem isso o modo stale mostrava o gear pro tenant.
    return <AuthGate onDone={() => window.location.reload()} />
  }
  return <MeContext.Provider value={mode}>{children}</MeContext.Provider>
}

/** WHY landing no apex: no host raiz (lainmemo.dev) a rota / é a landing
    pública (home do OAuth); no subdomínio do app (chat.*) a / é o chat.
    O bundle é o mesmo nos dois hosts — só o hostname decide. */
const IS_APEX_HOST =
  typeof window !== 'undefined' && /^(www\.)?lainmemo\.dev$/i.test(window.location.hostname)

export default function App() {
  return (
    <TooltipProvider>
      <BrowserRouter>
        <Routes>
          {/* WHY públicas: fora do DemoGate/AuthGate — Google exige home,
              privacidade e termos acessíveis sem login (a home do app é
              murada). Import estático: páginas leves, sem lazy. */}
          <Route path="/bem-vindo" element={<LandingPage />} />
          <Route path="/privacidade" element={<PrivacyPage />} />
          <Route path="/termos" element={<TermsPage />} />
          {IS_APEX_HOST && <Route path="/" element={<LandingPage />} />}
          <Route
            path="/*"
            element={
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
                    <Route
                      path="/settings/conta"
                      element={
                        <Suspense fallback={<RouteFallback variant="settings" />}>
                          <TenantAccountGuard />
                        </Suspense>
                      }
                    />
                    <Route
                      path="/docs/instalacao"
                      element={
                        <Suspense fallback={<RouteFallback variant="blank" />}>
                          <DocsInstallPage />
                        </Suspense>
                      }
                    />
                  </Route>
                </Routes>
              </DemoGate>
            }
          />
        </Routes>
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

/** Conta do visitante: tema + nome. Owner usa o /settings completo. */
function TenantAccountGuard() {
  const mode = useMeMode()
  if (mode === 'tenant' || getTenantName()) return <TenantSettingsPage />
  return <Navigate to="/settings" replace />
}
