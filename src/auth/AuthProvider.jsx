import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { LogIn, LogOut, ShieldCheck, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-4 py-8 text-[var(--txt)]">
      <Card className="w-full max-w-[460px]">
        <CardContent className="space-y-5 pt-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] border border-white/10 bg-[var(--surface-2)] text-[var(--tec)]">
              {isBlocked || isConfigError ? (
                <ShieldAlert className="h-5 w-5" />
              ) : (
                <ShieldCheck className="h-5 w-5" />
              )}
            </div>
            <div className="min-w-0 space-y-1">
              <h1 className="text-lg font-medium text-[var(--txt)]">{title}</h1>
              <p className="text-sm leading-6 text-[var(--txt2)]">{description}</p>
            </div>
          </div>

          {userEmail ? (
            <div className="rounded-[8px] border border-white/8 bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--txt2)]">
              Sesión actual: <span className="font-medium text-[var(--txt)]">{userEmail}</span>
            </div>
          ) : null}

          {error ? (
            <div className="rounded-[8px] border border-[#D85A30]/30 bg-[#D85A30]/10 px-3 py-2 text-sm text-[#f3b19b]">
              {error}
            </div>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row">
            {!isBlocked ? (
              <Button type="button" className="w-full" onClick={onSignIn} disabled={isLoading || isConfigError}>
                <LogIn className="h-4 w-4" />
                Iniciar sesión
              </Button>
            ) : null}

            {isBlocked ? (
              <>
                <Button type="button" className="w-full" onClick={onSignIn}>
                  <LogIn className="h-4 w-4" />
                  Usar otra cuenta
                </Button>
                <Button type="button" className="w-full" variant="secondary" onClick={onSignOut}>
                  <LogOut className="h-4 w-4" />
                  Salir
                </Button>
              </>
            ) : null}
          </div>
        </CardContent>
      </Card>
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
