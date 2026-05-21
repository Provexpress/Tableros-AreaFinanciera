import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { BarChart3, CheckCircle2, LockKeyhole, LogIn, LogOut, ShieldAlert, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  authConfig,
  getAccountEmail,
  handleMsalRedirect,
  initializeMsal,
  isAuthConfigured,
  isEmailAllowed,
  loginRequest,
  msalInstance,
} from "@/auth/msalClient";

const AuthContext = createContext({
  enabled: false,
  account: null,
  userEmail: "",
  signIn: async () => {},
  signOut: async () => {},
});

function AuthScreen({ mode, userEmail, error, onSignIn, onSignOut }) {
  const isBlocked = mode === "blocked";
  const isConfigError = mode === "config";
  const isLoading = mode === "loading";

  const title = isLoading
    ? "Validando acceso"
    : isBlocked
      ? "Correo no autorizado"
      : isConfigError
        ? "Login sin configurar"
        : "Ingresar al tablero";

  const description = isLoading
    ? "Estamos revisando tu sesión de Microsoft 365."
    : isBlocked
      ? "Este usuario inició sesión correctamente, pero no está en la lista permitida para este tablero."
      : isConfigError
        ? "Faltan variables de Microsoft 365 o la lista de correos permitidos."
        : "Usa tu cuenta Microsoft 365 autorizada para ver la información financiera.";

  const statusLabel = isBlocked
    ? "Acceso restringido"
    : isConfigError
      ? "Configuración pendiente"
      : isLoading
        ? "Verificando identidad"
        : "Acceso corporativo";

  return (
    <main className="relative min-h-screen overflow-hidden bg-[var(--bg)] text-[var(--txt)]">
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(79,142,247,0.12),transparent_34%),linear-gradient(225deg,rgba(52,200,138,0.08),transparent_42%),linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[length:auto,auto,56px_56px,56px_56px]" />
      <div className="relative flex min-h-screen items-center justify-center px-4 py-8 sm:px-6">
        <section className="grid w-full max-w-[980px] overflow-hidden rounded-[14px] border border-white/10 bg-[color:rgb(var(--bg-rgb)_/_0.72)] shadow-[0_24px_80px_rgba(0,0,0,0.42)] backdrop-blur md:grid-cols-[1.05fr_0.95fr]">
          <div className="hidden min-h-[520px] flex-col justify-between border-r border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] p-8 md:flex">
            <div className="space-y-7">
              <div className="flex items-center gap-3">
                <img
                  src="/favicon.svg"
                  alt="PX"
                  className="h-12 w-12 rounded-[12px] shadow-[0_10px_28px_rgba(79,142,247,0.22)]"
                />
                <div>
                  <div className="text-sm font-medium text-[var(--txt)]">PROVEXPRESS SAS</div>
                  <div className="text-xs uppercase tracking-[0.24em] text-[var(--txt3)]">Área financiera</div>
                </div>
              </div>

              <div className="max-w-[430px] space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full border border-[var(--tec)]/25 bg-[color:rgb(79_142_247_/_0.10)] px-3 py-1 text-xs font-medium text-[var(--tec)]">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Tablero protegido
                </div>
                <h2 className="text-3xl font-medium leading-tight text-[var(--txt)]">
                  Control financiero con acceso seguro.
                </h2>
                <p className="text-sm leading-6 text-[var(--txt2)]">
                  Consulta compras, ventas, notas crédito y consolidado desde una sesión corporativa autorizada.
                </p>
              </div>
            </div>

            <div className="grid gap-3 text-sm text-[var(--txt2)]">
              <div className="flex items-center gap-3 rounded-[8px] border border-white/8 bg-black/10 px-3 py-3">
                <BarChart3 className="h-4 w-4 text-[var(--tec)]" />
                Indicadores listos para revisión directiva.
              </div>
              <div className="flex items-center gap-3 rounded-[8px] border border-white/8 bg-black/10 px-3 py-3">
                <LockKeyhole className="h-4 w-4 text-[var(--pac)]" />
                Acceso limitado a correos parametrizados.
              </div>
            </div>
          </div>

          <div className="flex min-h-[520px] items-center p-5 sm:p-8">
            <div className="w-full space-y-6">
              <div className="flex items-center justify-between gap-4 md:hidden">
                <div className="flex items-center gap-3">
                  <img src="/favicon.svg" alt="PX" className="h-10 w-10 rounded-[10px]" />
                  <div>
                    <div className="text-sm font-medium text-[var(--txt)]">PROVEXPRESS SAS</div>
                    <div className="text-xs text-[var(--txt3)]">Área financiera</div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-[var(--surface-2)] px-3 py-1 text-xs text-[var(--txt2)]">
                  {isBlocked || isConfigError ? (
                    <ShieldAlert className="h-3.5 w-3.5 text-[var(--warning)]" />
                  ) : isLoading ? (
                    <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--tec)]" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5 text-[var(--pac)]" />
                  )}
                  {statusLabel}
                </div>
                <h1 className="text-2xl font-medium leading-tight text-[var(--txt)]">{title}</h1>
                <p className="max-w-[420px] text-sm leading-6 text-[var(--txt2)]">{description}</p>
              </div>

              {userEmail ? (
                <div className="rounded-[8px] border border-white/8 bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--txt2)]">
                  Sesión actual: <span className="font-medium text-[var(--txt)]">{userEmail}</span>
                </div>
              ) : null}

              {error ? (
                <div className="rounded-[8px] border border-[#D85A30]/30 bg-[#D85A30]/10 px-3 py-2 text-sm leading-6 text-[#f3b19b]">
                  {error}
                </div>
              ) : null}

              <div className="flex flex-col gap-2 sm:flex-row">
                {!isBlocked ? (
                  <Button
                    type="button"
                    className="h-11 w-full border-[var(--tec)]/35 bg-[color:rgb(79_142_247_/_0.16)] text-[var(--txt)] hover:border-[var(--tec)]/55 hover:bg-[color:rgb(79_142_247_/_0.22)]"
                    onClick={onSignIn}
                    disabled={isLoading || isConfigError}
                  >
                    <LogIn className="h-4 w-4" />
                    {isLoading ? "Validando..." : "Continuar con Microsoft 365"}
                  </Button>
                ) : null}

                {isBlocked ? (
                  <>
                    <Button type="button" className="h-11 w-full" onClick={onSignIn}>
                      <LogIn className="h-4 w-4" />
                      Usar otra cuenta
                    </Button>
                    <Button type="button" className="h-11 w-full" variant="secondary" onClick={onSignOut}>
                      <LogOut className="h-4 w-4" />
                      Salir
                    </Button>
                  </>
                ) : null}
              </div>

              <p className="text-xs leading-5 text-[var(--txt3)]">
                El acceso se valida con Microsoft 365 y la lista de correos autorizados por la compañía.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export function AuthProvider({ children }) {
  const [account, setAccount] = useState(null);
  const [status, setStatus] = useState(authConfig.enabled ? "loading" : "ready");
  const [error, setError] = useState("");

  const userEmail = getAccountEmail(account);
  const allowed = !authConfig.enabled || isEmailAllowed(userEmail);
  const hasAllowedEmails = authConfig.allowedEmails.length > 0;
  const configReady = !authConfig.enabled || (isAuthConfigured && hasAllowedEmails);

  const signIn = useCallback(async () => {
    if (!msalInstance || !configReady) {
      setError("Revisa VITE_MS_CLIENT_ID, VITE_MS_TENANT_ID y VITE_AUTH_ALLOWED_EMAILS.");
      return;
    }

    try {
      setError("");
      setStatus("loading");
      await initializeMsal();
      await msalInstance.loginRedirect(loginRequest);
    } catch (authError) {
      setStatus(account ? "ready" : "login");
      setError(authError?.message || "No fue posible iniciar sesión.");
    }
  }, [account, configReady]);

  const signOut = useCallback(async () => {
    if (!msalInstance) {
      setAccount(null);
      return;
    }

    try {
      setError("");
      await initializeMsal();
      const activeAccount = msalInstance.getActiveAccount() || account;
      if (activeAccount) {
        await msalInstance.logoutRedirect({ account: activeAccount, postLogoutRedirectUri: window.location.origin });
      }
    } catch (authError) {
      setError(authError?.message || "No fue posible cerrar sesión.");
    } finally {
      msalInstance.setActiveAccount(null);
      setAccount(null);
      setStatus("login");
    }
  }, [account]);

  useEffect(() => {
    if (!authConfig.enabled) {
      return undefined;
    }

    let active = true;

    async function boot() {
      if (!configReady || !msalInstance) {
        if (active) {
          setStatus("config");
        }
        return;
      }

      try {
        setError("");
        const redirectResponse = await handleMsalRedirect();
        const nextAccount =
          redirectResponse?.account ||
          msalInstance.getActiveAccount() ||
          msalInstance.getAllAccounts()[0] ||
          null;

        if (nextAccount) {
          msalInstance.setActiveAccount(nextAccount);
        }

        if (active) {
          setAccount(nextAccount);
          setStatus(nextAccount ? "ready" : "login");
        }
      } catch (authError) {
        if (active) {
          const message = authError?.message || "No fue posible validar la sesión.";
          if (message.includes("no_token_request_cache_error") && window.location.hash) {
            window.history.replaceState(null, document.title, window.location.pathname + window.location.search);
          }
          setError(message);
          setStatus("login");
        }
      }
    }

    boot();

    return () => {
      active = false;
    };
  }, [configReady]);

  const value = useMemo(
    () => ({
      enabled: authConfig.enabled,
      account,
      userEmail,
      signIn,
      signOut,
    }),
    [account, signIn, signOut, userEmail]
  );

  if (!authConfig.enabled) {
    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
  }

  if (!configReady) {
    return (
      <AuthContext.Provider value={value}>
        <AuthScreen mode="config" error={error} onSignIn={signIn} />
      </AuthContext.Provider>
    );
  }

  if (status === "loading") {
    return (
      <AuthContext.Provider value={value}>
        <AuthScreen mode="loading" userEmail={userEmail} error={error} onSignIn={signIn} />
      </AuthContext.Provider>
    );
  }

  if (!account) {
    return (
      <AuthContext.Provider value={value}>
        <AuthScreen mode="login" error={error} onSignIn={signIn} />
      </AuthContext.Provider>
    );
  }

  if (!allowed) {
    return (
      <AuthContext.Provider value={value}>
        <AuthScreen mode="blocked" userEmail={userEmail} error={error} onSignIn={signIn} onSignOut={signOut} />
      </AuthContext.Provider>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
