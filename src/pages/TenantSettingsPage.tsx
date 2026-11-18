import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { List } from "@phosphor-icons/react";
import type { LayoutContext } from "./Layout";
import { useTheme, type ThemeMode } from "@/hooks/useTheme";
import { getTenantName, setTenantName, clearTenantName } from "@/hooks/useMe";
import { supabase } from "@/lib/supabase";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Conta do visitante (demo): perfil + aparência.
 * Nome editável (o agente usa na conversa); email só leitura (login).
 * Modelo e OpenRouter ficam de fora de propósito — o BFF trava o modelo
 * barato para tenants e a trava real é no server (effectiveModel).
 */
export function TenantSettingsPage() {
  const { openMobileNav } = useOutletContext<LayoutContext>();
  const { theme, setTheme } = useTheme();
  const [name, setName] = useState(() => getTenantName() ?? "");
  const [savedName, setSavedName] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  // Modal de confirmação do wipe: via única para login com senha e com Google —
  // digitar APAGAR libera o botão. Um caminho só, sem bifurcar por provedor.
  const WIPE_WORD = "APAGAR";
  const [wipeOpen, setWipeOpen] = useState(false);
  const [wipeConfirm, setWipeConfirm] = useState("");
  const [wipeBusy, setWipeBusy] = useState(false);
  const [wipeError, setWipeError] = useState("");
  const wipeReady = wipeConfirm.trim() === WIPE_WORD;

  useEffect(() => {
    let alive = true;
    fetch("/api/tenant/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || typeof d?.name !== "string") return;
        setName(d.name);
        setTenantName(d.name);
      })
      .catch(() => {});
    supabase()
      ?.auth.getSession()
      .then(({ data }) => {
        if (!alive) return;
        const mail = data.session?.user.email;
        if (mail) setEmail(mail);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const clean = name.trim();
    if (clean.length < 2) {
      setError("Informe um nome (mín. 2 letras).");
      return;
    }
    setBusy(true);
    setError("");
    setInfo("");
    try {
      const res = await fetch("/api/tenant/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: clean.slice(0, 40) }),
      });
      const data = (await res.json().catch(() => null)) as {
        name?: string;
        error?: string;
      } | null;
      if (!res.ok || typeof data?.name !== "string") {
        setError(data?.error ?? "Não foi possível salvar. Tente de novo.");
        return;
      }
      setTenantName(data.name);
      setSavedName(data.name);
      setInfo(`Pronto — vou te chamar de ${data.name}.`);
    } catch {
      setError("Sem conexão com o servidor. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  const row =
    "flex items-center justify-between gap-6 border-b border-border/50 px-6 py-4 last:border-b-0";
  const label = "text-[15px] text-foreground";
  const hint = "pt-0.5 text-sm text-muted-foreground/70";

  /**
   * Exclusão total da conta (LGPD): dados + registro do tenant + usuário no
   * Supabase Auth. O nome é liberado. Sem undo. O modal exige digitar APAGAR
   * (padrão GitHub/Vercel para ação destrutiva; via única para login com
   * senha e com Google).
   */
  function openWipe() {
    setWipeConfirm("");
    setWipeError("");
    setWipeOpen(true);
  }

  async function confirmWipe() {
    if (wipeBusy || !wipeReady) return;
    setWipeBusy(true);
    setWipeError("");
    try {
      const res = await fetch("/api/tenant/account", { method: "DELETE" });
      if (!res.ok) {
        setWipeError("Não foi possível apagar. Tente de novo.");
        setWipeBusy(false);
        return;
      }
    } catch {
      setWipeError("Sem conexão com o servidor. Tente de novo.");
      setWipeBusy(false);
      return;
    }
    try {
      await fetch("/api/tenant/logout", { method: "POST" });
    } catch {}
    try {
      await supabase()?.auth.signOut();
    } catch {}
    clearTenantName();
    try {
      sessionStorage.clear();
    } catch {}
    window.location.href = "/";
  }

  type SettingsTab = "configuracoes" | "dados";
  const [tab, setTab] = useState<SettingsTab>("configuracoes");
  const tabs: Array<{ id: SettingsTab; label: string }> = [
    { id: "configuracoes", label: "Configurações" },
    { id: "dados", label: "Dados" },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b border-border bg-card px-4 py-2">
        <button
          type="button"
          aria-label="Abrir menu"
          onClick={openMobileNav}
          className="flex size-8 items-center justify-center rounded-md hover:bg-accent md:hidden"
        >
          <List className="size-5" />
        </button>
        <h2 className="text-sm font-semibold">Sua conta</h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-4 py-6">
          <div className="flex flex-col gap-6 md:flex-row md:gap-12">
            <nav
              aria-label="Seções da conta"
              className="flex shrink-0 gap-1 overflow-x-auto md:w-52 md:flex-col"
            >
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  aria-current={tab === t.id ? "page" : undefined}
                  className={
                    tab === t.id
                      ? "whitespace-nowrap rounded-lg bg-accent px-3 py-2 text-left text-sm font-medium text-accent-foreground md:w-full"
                      : "whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm text-muted-foreground hover:bg-accent/60 hover:text-accent-foreground md:w-full"
                  }
                >
                  {t.label}
                </button>
              ))}
            </nav>

            <div className="min-w-0 flex-1">
              {tab === "configuracoes" && (
                <div className="space-y-8">
                  <div>
                    <h1 className="text-2xl font-bold">Preferências</h1>
                    <p className="pt-2 text-[15px] text-muted-foreground">
                      Gerencie seu perfil e a aparência do app.
                    </p>
                  </div>
                  <section>
                    <h2 className="pb-5 text-base font-medium">
                      Informações do perfil
                    </h2>
                    <form
                      onSubmit={(e) => void save(e)}
                      className="overflow-hidden rounded-xl border border-border/60 bg-card"
                    >
                      <div className={row}>
                        <div>
                          <p className="text-[13px] text-foreground">Nome</p>
                        </div>
                        <input
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Seu nome"
                          maxLength={40}
                          autoComplete="nickname"
                          className="w-64 rounded-lg border border-border/50 bg-background px-4 py-2 text-[13px] outline-none transition-shadow duration-200 focus-visible:ring-2 focus-visible:ring-foreground/20 focus-visible:ring-offset-2 focus-visible:ring-offset-card"
                        />
                      </div>
                      <div className={row}>
                        <div>
                          <p className="text-[13px] text-foreground">
                            E-mail principal
                          </p>
                          <p className={hint}>Usado para login</p>
                        </div>
                        <p className="w-64 truncate rounded-lg border border-border/50 bg-muted px-4 py-2 text-[13px] text-muted-foreground">
                          {email || "…"}
                        </p>
                      </div>
                      <div className="flex items-center justify-end gap-3 px-6 py-4">
                        {error && (
                          <p className="mr-auto text-sm text-destructive">
                            {error}
                          </p>
                        )}
                        {info && !error && (
                          <p className="mr-auto text-sm text-muted-foreground">
                            {info}
                          </p>
                        )}
                        <button
                          type="submit"
                          disabled={busy || name.trim() === (savedName ?? "")}
                          className="rounded-lg bg-foreground px-3 py-1 text-sm font-normal text-background disabled:opacity-40"
                        >
                          {busy ? "Salvando…" : "Salvar"}
                        </button>
                      </div>
                    </form>
                  </section>
                  <section>
                    <h2 className="pb-3 text-lg font-bold">Aparência</h2>
                    <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
                      <div className={row}>
                        <div>
                          <p className={label}>Tema</p>
                          <p className={hint}>
                            Como a interface aparece para você.
                          </p>
                        </div>
                        <Select
                          value={theme}
                          onValueChange={(v) => setTheme(v as ThemeMode)}
                        >
                          <SelectTrigger className="w-64">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="system">Sistema</SelectItem>
                            <SelectItem value="light">Claro</SelectItem>
                            <SelectItem value="dark">Escuro</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </section>
                </div>
              )}
              {tab === "dados" && (
                <div className="space-y-8">
                  <div>
                    <h1 className="text-2xl font-bold">Dados</h1>
                    <p className="pt-2 text-[15px] text-muted-foreground">
                      Exclua sua conta e todos os dados associados a ela.
                    </p>
                  </div>
                  <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
                    <div className={row}>
                      <div>
                        <p className={label}>Excluir minha conta</p>
                        <p className={`${hint} leading-relaxed`}>
                          Remove seus dados e exclui sua conta. Sem volta.
                        </p>
                      </div>
                      <div className="flex w-64 shrink-0 items-center justify-end">
                        <button
                          type="button"
                          onClick={openWipe}
                          className="rounded-lg border border-destructive/40 px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10"
                        >
                          Excluir conta
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <Dialog
        open={wipeOpen}
        onOpenChange={(open) => {
          if (wipeBusy) return;
          setWipeOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir minha conta</DialogTitle>
            <DialogDescription>
              Isso apaga suas memórias, grafo e conversas e exclui sua conta
              permanentemente. Não tem como desfazer.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void confirmWipe();
            }}
            className="space-y-4"
          >
            <p className="truncate rounded-lg border border-border/60 bg-muted px-4 py-2 text-[13px] text-muted-foreground">
              {email || "…"}
            </p>
            <div>
              <input
                value={wipeConfirm}
                onChange={(e) => setWipeConfirm(e.target.value)}
                placeholder={`Digite ${WIPE_WORD} para confirmar`}
                autoComplete="off"
                autoFocus
                disabled={wipeBusy}
                className="w-full rounded-lg border border-border/60 bg-background px-4 py-2 text-[13px] outline-none transition-shadow duration-200 focus-visible:ring-2 focus-visible:ring-foreground/20 disabled:opacity-40"
              />
              <p className="pt-1 text-xs text-muted-foreground">
                Digite {WIPE_WORD} em maiúsculas para liberar o botão.
              </p>
            </div>
            {wipeError && (
              <p className="text-sm text-destructive">{wipeError}</p>
            )}
            <DialogFooter>
              <button
                type="button"
                onClick={() => setWipeOpen(false)}
                disabled={wipeBusy}
                className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={wipeBusy || !wipeReady}
                className="rounded-lg bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-40"
              >
                {wipeBusy ? "Excluindo…" : "Excluir conta"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
