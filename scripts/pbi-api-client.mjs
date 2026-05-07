import fs from "node:fs";
import path from "node:path";

export const PBI_SERVICES = {
  personal: "/consultas/api/consultaPersonalPBI",
  compras: "/consultas/api/consultaComprasDashboardPBI",
  ventas: "/consultas/api/consultaVentasDashboardPBI",
  clientesNuevos: "/consultas/api/consultaClientesNuevosDashboardPBI",
  clientesSectores: "/consultas/api/consultaClientesSectoresDashboardPBI",
};

export function loadEnvFile(rootDir, fileName = ".env.local") {
  const filePath = path.join(rootDir, fileName);
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex < 0) continue;
    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    if (!key || process.env[key]) continue;
    process.env[key] = rawValue.replace(/^["']|["']$/g, "");
  }
}

export function getEnv(name, fallback = "") {
  return process.env[name] || fallback;
}

export function joinUrl(baseUrl, endpoint) {
  return `${String(baseUrl || "").replace(/\/+$/, "")}/${String(endpoint || "").replace(/^\/+/, "")}`;
}

export function extractRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.result)) return payload.result;
  if (Array.isArray(payload?.resultado)) return payload.resultado;
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(payload?.payload?.data)) return payload.payload.data;
  if (Array.isArray(payload?.response)) return payload.response;
  if (Array.isArray(payload?.response?.data)) return payload.response.data;
  if (Array.isArray(payload?.response?.result)) return payload.response.result;
  if (Array.isArray(payload?.response?.resultado)) return payload.response.resultado;
  if (Array.isArray(payload?.response?.rows)) return payload.response.rows;
  if (typeof payload?.response === "string") {
    try {
      return extractRows(JSON.parse(payload.response));
    } catch {
      return [];
    }
  }
  return [];
}

function extractToken(candidate) {
  if (!candidate) return "";
  if (typeof candidate === "string") return candidate;
  return (
    candidate.token ||
    candidate.access_token ||
    candidate.key ||
    candidate.apiKey ||
    candidate.data?.token ||
    candidate.data?.access_token ||
    candidate.data?.key ||
    ""
  );
}

export async function readJsonResponse(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function requestPbiToken(baseUrl = getEnv("PBI_API_BASE_URL", "http://152.200.146.226:50010")) {
  const user = getEnv("PBI_API_USER");
  const password = getEnv("PBI_API_PASSWORD");
  const userField = getEnv("PBI_API_USER_FIELD", "username");
  const passwordField = getEnv("PBI_API_PASSWORD_FIELD", "password");

  if (!user || !password) {
    throw new Error("Faltan PBI_API_USER y/o PBI_API_PASSWORD en .env.local.");
  }

  const response = await fetch(joinUrl(baseUrl, "/api/getKey"), {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ [userField]: user, [passwordField]: password }),
  });
  const payload = await readJsonResponse(response);
  if (!response.ok) {
    throw new Error(`Token HTTP ${response.status}`);
  }

  const token = extractToken(payload);
  if (!token) {
    throw new Error(`No se pudo identificar el token. Llaves: ${Object.keys(payload || {}).join(", ")}`);
  }

  return token;
}

export function buildAuthHeaders(token) {
  const tokenHeader = getEnv("PBI_API_TOKEN_HEADER", "Authorization");
  if (tokenHeader.toLowerCase() === "x-api-key") {
    return { "x-api-key": token };
  }
  return { [tokenHeader]: `Bearer ${token}` };
}

export async function requestPbiService(serviceName, token, baseUrl = getEnv("PBI_API_BASE_URL", "http://152.200.146.226:50010")) {
  const endpoint = PBI_SERVICES[serviceName];
  if (!endpoint) {
    throw new Error(`Servicio desconocido: ${serviceName}`);
  }

  const response = await fetch(joinUrl(baseUrl, endpoint), {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...buildAuthHeaders(token),
    },
  });
  const payload = await readJsonResponse(response);
  if (!response.ok) {
    throw new Error(`${serviceName} HTTP ${response.status}`);
  }

  return payload;
}
