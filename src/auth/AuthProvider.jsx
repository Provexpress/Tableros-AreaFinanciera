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
        : "Ingresar a Provex Finance";

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
    <main
      className="relative min-h-screen overflow-hidden bg-[#f5f7fd] text-[#1a2b6b]"
      style={{ fontFamily: '"Futura PT", "Futura Std", Futura, "Twentieth Century", "DM Sans", sans-serif' }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(106,63,160,0.13),transparent_28%),radial-gradient(circle_at_82%_18%,rgba(42,191,223,0.16),transparent_30%),linear-gradient(180deg,#eef3ff_0%,#f4f7ff_42%,#f5f7fd_100%)]" />
      <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#1a2b6b,#1565c0,#6a3fa0,#2abfdf)]" />
      <div className="relative flex min-h-screen items-center justify-center px-4 py-8 sm:px-6">
        <section className="grid w-full max-w-[980px] overflow-hidden rounded-[16px] border border-[rgba(26,43,107,0.12)] bg-[rgba(255,255,255,0.96)] shadow-[0_24px_54px_rgba(26,43,107,0.12)] backdrop-blur md:grid-cols-[1.05fr_0.95fr]">
          <div className="hidden min-h-[520px] flex-col justify-between border-r border-[rgba(26,43,107,0.10)] bg-[linear-gradient(180deg,rgba(250,252,255,0.98),rgba(245,248,255,0.96))] p-8 md:flex">
            <div className="space-y-7">
              <div className="flex items-center gap-3">
                <img
                  src="/assets/provexpress-logo.webp"
                  alt="Provexpress"
                  className="h-12 w-auto max-w-[210px] object-contain"
                />
              </div>

              <div className="max-w-[430px] space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(21,101,192,0.16)] bg-[rgba(21,101,192,0.08)] px-3 py-1 text-xs font-bold text-[#1565c0]">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Provex Finance
                </div>
                <h2 className="text-3xl font-bold leading-tight text-[#1a2b6b]">
                  Control financiero con acceso seguro.
                </h2>
                <p className="text-sm leading-6 text-[#677592]">
                  Consulta compras, ventas, notas crédito y consolidado desde una sesión corporativa autorizada.
                </p>
              </div>
            </div>

            <div className="grid gap-3 text-sm text-[#677592]">
              <div className="flex items-center gap-3 rounded-[10px] border border-[rgba(26,43,107,0.10)] bg-white/80 px-3 py-3 shadow-[0_10px_26px_rgba(26,43,107,0.06)]">
                <BarChart3 className="h-4 w-4 text-[#1565c0]" />
                Indicadores listos para revisión directiva.
              </div>
              <div className="flex items-center gap-3 rounded-[10px] border border-[rgba(26,43,107,0.10)] bg-white/80 px-3 py-3 shadow-[0_10px_26px_rgba(26,43,107,0.06)]">
                <LockKeyhole className="h-4 w-4 text-[#6a3fa0]" />
                Acceso limitado a correos parametrizados.
              </div>
            </div>
          </div>

          <div className="flex min-h-[520px] items-center p-5 sm:p-8">
            <div className="w-full space-y-6">
              <div className="flex items-center justify-between gap-4 md:hidden">
                <div className="flex items-center gap-3">
                  <img src="/assets/provexpress-logo.webp" alt="Provexpress" className="h-10 w-auto max-w-[190px] object-contain" />
                  <div>
                    <div className="text-xs font-bold uppercase text-[#6a3fa0]">Provex Finance</div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(26,43,107,0.10)] bg-[#eef3ff] px-3 py-1 text-xs font-bold text-[#677592]">
                  {isBlocked || isConfigError ? (
                    <ShieldAlert className="h-3.5 w-3.5 text-[#d97706]" />
                  ) : isLoading ? (
                    <span className="h-2 w-2 animate-pulse rounded-full bg-[#1565c0]" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#16a34a]" />
                  )}
                  {statusLabel}
                </div>
                <h1 className="text-2xl font-bold leading-tight text-[#1a2b6b]">{title}</h1>
                <p className="max-w-[420px] text-sm leading-6 text-[#677592]">{description}</p>
              </div>

              {userEmail ? (
                <div className="rounded-[10px] border border-[rgba(26,43,107,0.10)] bg-[#f4f7ff] px-3 py-2 text-sm text-[#677592]">
                  Sesión actual: <span className="font-bold text-[#1a2b6b]">{userEmail}</span>
                </div>
              ) : null}

              {error ? (
                <div className="rounded-[10px] border border-[#c62828]/20 bg-[#fdebea] px-3 py-2 text-sm leading-6 text-[#9f1f1f]">
                  {error}
                </div>
              ) : null}

              <div className="flex flex-col gap-2 sm:flex-row">
                {!isBlocked ? (
                  <Button
                    type="button"
                    className="h-11 w-full rounded-[10px] border-[#6a3fa0] bg-[linear-gradient(135deg,#1a2b6b_0%,#1565c0_48%,#6a3fa0_100%)] font-bold text-white shadow-[0_14px_26px_rgba(26,43,107,0.16)] hover:border-[#6a3fa0] hover:brightness-105"
                    onClick={onSignIn}
                    disabled={isLoading || isConfigError}
                  >
                    <LogIn className="h-4 w-4" />
                    {isLoading ? "Validando..." : "Continuar con Microsoft 365"}
                  </Button>
                ) : null}

                {isBlocked ? (
                  <>
                    <Button type="button" className="h-11 w-full rounded-[10px] border-[#6a3fa0] bg-[#6a3fa0] font-bold text-white hover:bg-[#5f3198]" onClick={onSignIn}>
                      <LogIn className="h-4 w-4" />
                      Usar otra cuenta
                    </Button>
                    <Button type="button" className="h-11 w-full rounded-[10px] border-[rgba(26,43,107,0.12)] bg-white font-bold text-[#1a2b6b] hover:bg-[#eef3ff]" variant="secondary" onClick={onSignOut}>
                      <LogOut className="h-4 w-4" />
                      Salir
                    </Button>
                  </>
                ) : null}
              </div>

              <p className="text-xs leading-5 text-[#677592]">
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
