import { PublicClientApplication } from "@azure/msal-browser";

function readEnabled(value) {
  return ["1", "true", "yes", "on"].includes(String(value || "").trim().toLowerCase());
}

function parseEmailList(value) {
  return String(value || "")
    .split(/[,;\n]/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export function getAccountEmail(account) {
  const claims = account?.idTokenClaims || {};
  return normalizeEmail(
    claims.preferred_username ||
      claims.email ||
      claims.upn ||
      account?.username ||
      ""
  );
}

const clientId = import.meta.env.VITE_MS_CLIENT_ID || "";
const tenantId = import.meta.env.VITE_MS_TENANT_ID || "";
const explicitEnabled = import.meta.env.VITE_AUTH_ENABLED;
const enabled = explicitEnabled === undefined || explicitEnabled === ""
  ? Boolean(clientId && tenantId)
  : readEnabled(explicitEnabled);

export const authConfig = {
  enabled,
  clientId,
  tenantId,
  allowedEmails: parseEmailList(import.meta.env.VITE_AUTH_ALLOWED_EMAILS),
};

export const isAuthConfigured = Boolean(authConfig.clientId && authConfig.tenantId);

export const loginRequest = {
  scopes: ["User.Read"],
  prompt: "select_account",
};

export const msalInstance = isAuthConfigured
  ? new PublicClientApplication({
      auth: {
        clientId: authConfig.clientId,
        authority: `https://login.microsoftonline.com/${authConfig.tenantId}`,
        redirectUri: window.location.origin,
        postLogoutRedirectUri: window.location.origin,
        navigateToLoginRequestUrl: false,
      },
      cache: {
        cacheLocation: "sessionStorage",
        storeAuthStateInCookie: false,
      },
    })
  : null;

let initializePromise = null;
export async function initializeMsal() {
  if (!msalInstance) {
    throw new Error("Microsoft 365 no está configurado.");
  }

  if (!initializePromise) {
    initializePromise = msalInstance.initialize();
  }

  return initializePromise;
}

export async function handleMsalRedirect() {
  await initializeMsal();
  return msalInstance.handleRedirectPromise();
}

export function isEmailAllowed(email) {
  const normalizedEmail = normalizeEmail(email);
  return Boolean(normalizedEmail) && authConfig.allowedEmails.includes(normalizedEmail);
}
