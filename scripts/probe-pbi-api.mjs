import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildAuthHeaders,
  extractRows,
  getEnv,
  joinUrl,
  loadEnvFile,
  PBI_SERVICES,
  readJsonResponse,
} from "./pbi-api-client.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

function summarizePayload(payload) {
  const rows = extractRows(payload);
  const sample = rows[0] || payload?.data?.[0] || payload?.result?.[0] || payload?.resultado?.[0] || null;
  const responseValue = payload?.response;
  const parsedResponse =
    typeof responseValue === "string"
      ? (() => {
          try {
            return JSON.parse(responseValue);
          } catch {
            return responseValue;
          }
        })()
      : responseValue;
  return {
    rowCount: rows.length,
    errorCode: payload?.errorCode ?? payload?.codigoError ?? null,
    errorMessage: payload?.errorMessage ?? payload?.mensajeError ?? payload?.message ?? null,
    topLevelKeys: payload && typeof payload === "object" ? Object.keys(payload).slice(0, 20) : [],
    responseType: Array.isArray(responseValue) ? "array" : typeof responseValue,
    responseKeys:
      parsedResponse && typeof parsedResponse === "object" && !Array.isArray(parsedResponse)
        ? Object.keys(parsedResponse).slice(0, 20)
        : [],
    sampleKeys: sample && typeof sample === "object" ? Object.keys(sample).slice(0, 30) : [],
  };
}

async function requestToken(baseUrl) {
  const user = getEnv("PBI_API_USER");
  const password = getEnv("PBI_API_PASSWORD");
  const authMode = getEnv("PBI_API_AUTH_MODE", "body").toLowerCase();
  const userField = getEnv("PBI_API_USER_FIELD", "usuario");
  const passwordField = getEnv("PBI_API_PASSWORD_FIELD", "password");

  if (!user || !password) {
    throw new Error("Faltan PBI_API_USER y/o PBI_API_PASSWORD en .env.local.");
  }

  const url = joinUrl(baseUrl, "/api/getKey");
  const candidates = [];
  const seenCandidates = new Set();

  function addJsonCandidate(candidateUserField, candidatePasswordField) {
    const label = `json:${candidateUserField}/${candidatePasswordField}`;
    if (seenCandidates.has(label)) return;
    seenCandidates.add(label);
    candidates.push({
      label,
      options: {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ [candidateUserField]: user, [candidatePasswordField]: password }),
      },
    });
  }

  function addFormCandidate(candidateUserField, candidatePasswordField) {
    const label = `form:${candidateUserField}/${candidatePasswordField}`;
    if (seenCandidates.has(label)) return;
    seenCandidates.add(label);
    candidates.push({
      label,
      options: {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ [candidateUserField]: user, [candidatePasswordField]: password }).toString(),
      },
    });
  }

  addJsonCandidate(userField, passwordField);

  if (authMode === "auto") {
    const fieldPairs = [
      ["usuario", "password"],
      ["usuario", "clave"],
      ["user", "password"],
      ["username", "password"],
      ["login", "password"],
    ];

    for (const [candidateUserField, candidatePasswordField] of fieldPairs) {
      addJsonCandidate(candidateUserField, candidatePasswordField);
      addFormCandidate(candidateUserField, candidatePasswordField);
    }

    candidates.push({
      label: "basic",
      options: {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`,
        },
      },
    });
  } else if (authMode === "basic") {
    candidates.length = 0;
    candidates.push({
      label: "basic",
      options: {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`,
        },
      },
    });
  } else if (authMode === "form") {
    candidates.length = 0;
    seenCandidates.clear();
    addFormCandidate(userField, passwordField);
  } else {
    addJsonCandidate("username", "password");
    addJsonCandidate("user", "password");
    addJsonCandidate("login", "password");
  }

  const errors = [];
  for (const candidate of candidates) {
    const response = await fetch(url, candidate.options);
    const payload = await readJsonResponse(response);
    const token = response.ok
      ? payload?.token ||
        payload?.access_token ||
        payload?.key ||
        payload?.apiKey ||
        payload?.data?.token ||
        payload?.data?.access_token ||
        payload?.data?.key ||
        ""
      : "";
    if (token) {
      console.log(`[pbi] token OK con ${candidate.label}`);
      return token;
    }

    const detail =
      typeof payload === "string"
        ? payload.slice(0, 120)
        : Object.keys(payload || {}).slice(0, 8).join(", ");
    errors.push(`${candidate.label} => HTTP ${response.status}${detail ? ` (${detail})` : ""}`);
  }

  throw new Error(`No se pudo conseguir token. Intentos: ${errors.join(" | ")}`);
}

async function requestService(baseUrl, token, serviceName) {
  const endpoint = PBI_SERVICES[serviceName];
  if (!endpoint) {
    throw new Error(`Servicio desconocido: ${serviceName}`);
  }

  const url = joinUrl(baseUrl, endpoint);
  const authHeaders = buildAuthHeaders(token);
  const parametro = getEnv("PBI_API_PARAMETRO", "{}");
  const parametroJson = (() => {
    try {
      return JSON.parse(parametro);
    } catch {
      return parametro;
    }
  })();
  const variants = [
    {
      label: "GET",
      url,
      options: { method: "GET", headers: { Accept: "application/json", ...authHeaders } },
    },
    {
      label: "GET?parametro",
      url: `${url}?parametro=${encodeURIComponent(parametro)}`,
      options: { method: "GET", headers: { Accept: "application/json", ...authHeaders } },
    },
    {
      label: "GET/parametro",
      url: `${url}/${encodeURIComponent(parametro)}`,
      options: { method: "GET", headers: { Accept: "application/json", ...authHeaders } },
    },
    {
      label: "GET?parametros",
      url: `${url}?parametros=${encodeURIComponent(parametro)}`,
      options: { method: "GET", headers: { Accept: "application/json", ...authHeaders } },
    },
    {
      label: "POST json parametro:string",
      url,
      options: {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ parametro }),
      },
    },
    {
      label: "POST json parametro:object",
      url,
      options: {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ parametro: parametroJson }),
      },
    },
    {
      label: "POST form parametro",
      url,
      options: {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded", ...authHeaders },
        body: new URLSearchParams({ parametro }).toString(),
      },
    },
  ];

  const attempts = [];
  for (const variant of variants) {
    const response = await fetch(variant.url, variant.options);
    const payload = await readJsonResponse(response);
    const rows = response.ok ? extractRows(payload) : [];
    const hasApiError = Boolean(payload?.errorCode || payload?.errorMessage);

    attempts.push({
      label: variant.label,
      status: response.status,
      rowCount: rows.length,
      errorCode: payload?.errorCode,
      errorMessage: payload?.errorMessage,
    });

    if (response.ok && !hasApiError) {
      console.log(`[pbi] ${serviceName}: consulta OK con ${variant.label}`);
      return payload;
    }

    if (response.ok && rows.length) {
      console.log(`[pbi] ${serviceName}: consulta con filas usando ${variant.label}`);
      return payload;
    }
  }

  console.log(
    `[pbi] ${serviceName}: intentos consulta = ${attempts
      .map((item) => `${item.label} HTTP ${item.status}${item.errorCode ? ` API ${item.errorCode}` : ""}`)
      .join(" | ")}`
  );

  return {
    errorCode: attempts[0]?.errorCode || "NO_VALID_RESPONSE",
    errorMessage: attempts.find((item) => item.errorMessage)?.errorMessage || "No hubo respuesta valida del servicio.",
    response: attempts,
  };
}

async function main() {
  loadEnvFile(rootDir);

  const baseUrl = getEnv("PBI_API_BASE_URL", "http://152.200.146.226:50010");
  const requestedService = process.argv.find((arg) => arg.startsWith("--service="))?.split("=")[1];
  const serviceNames = requestedService ? [requestedService] : Object.keys(PBI_SERVICES);

  console.log("[pbi] solicitando token...");
  const token = await requestToken(baseUrl);
  console.log("[pbi] token recibido");

  for (const serviceName of serviceNames) {
    const payload = await requestService(baseUrl, token, serviceName);
    const summary = summarizePayload(payload);
    console.log(`[pbi] ${serviceName}: ${summary.rowCount} filas`);
    if (summary.errorCode || summary.errorMessage) {
      console.log(`[pbi] ${serviceName}: error API = ${summary.errorCode || "-"} ${summary.errorMessage || ""}`.trim());
    }
    console.log(`[pbi] ${serviceName}: llaves respuesta = ${summary.topLevelKeys.join(", ") || "-"}`);
    console.log(
      `[pbi] ${serviceName}: response = ${summary.responseType || "-"}${
        summary.responseKeys.length ? ` (${summary.responseKeys.join(", ")})` : ""
      }`
    );
    console.log(`[pbi] ${serviceName}: llaves muestra = ${summary.sampleKeys.join(", ") || "-"}`);
  }
}

main().catch((error) => {
  console.error("[pbi] error:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
