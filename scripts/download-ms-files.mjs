import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const dataDir = path.join(rootDir, "Data");

const GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0";
const GRAPH_SCOPE = "https://graph.microsoft.com/.default";

const DEFAULT_FILES = [
  "Control Facturas.xlsx",
  "NOTAS CREDITO 2026.xlsx",
  "reporte semanal de facturacion.xlsx",
];

const DEFAULT_ACUSE_FILES = [
  "1.ACUSES ENERO 2026.xlsx",
  "2.ACUSES FEBRERO 2026.xlsx",
  "3.ACUSE MARZO 2026.xlsx",
];

function getEnv(name, fallback = "") {
  const value = process.env[name];
  return value === undefined || value === "" ? fallback : value;
}

function parseCsv(value) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinGraphPath(...parts) {
  return parts
    .map((part) => String(part || "").replace(/^\/+|\/+$/g, ""))
    .filter(Boolean)
    .join("/");
}

function encodeGraphPath(itemPath) {
  return itemPath
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} en ${url}: ${text.slice(0, 500)}`);
  }

  return text ? JSON.parse(text) : {};
}

async function requestToken() {
  const tenantId = getEnv("MS_TENANT_ID");
  const clientId = getEnv("MS_CLIENT_ID");
  const clientSecret = getEnv("MS_CLIENT_SECRET");

  if (!tenantId || !clientId || !clientSecret) {
    return "";
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
    scope: GRAPH_SCOPE,
  });

  const tokenResponse = await requestJson(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    }
  );

  return tokenResponse.access_token || "";
}

async function graphJson(token, pathAndQuery) {
  return requestJson(`${GRAPH_BASE_URL}${pathAndQuery}`, {
    headers: { authorization: `Bearer ${token}` },
  });
}

async function getSite(token, hostname, sitePath) {
  const normalizedSitePath = sitePath.startsWith("/") ? sitePath : `/${sitePath}`;
  return graphJson(token, `/sites/${hostname}:${normalizedSitePath}`);
}

async function getDrive(token, siteId, driveName) {
  const drives = await graphJson(token, `/sites/${siteId}/drives`);
  const candidates = drives.value || [];
  const selected =
    candidates.find((drive) => drive.name === driveName) ||
    candidates.find((drive) => drive.name.toLowerCase() === driveName.toLowerCase()) ||
    candidates[0];

  if (!selected) {
    throw new Error(`No se encontraron bibliotecas en el sitio ${siteId}.`);
  }

  return selected;
}

async function downloadDriveItem(token, driveId, driveItemPath, outputPath) {
  const encodedPath = encodeGraphPath(driveItemPath);
  const response = await fetch(`${GRAPH_BASE_URL}/drives/${driveId}/root:/${encodedPath}:/content`, {
    headers: { authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`No se pudo descargar ${driveItemPath}. HTTP ${response.status}: ${text.slice(0, 500)}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, Buffer.from(arrayBuffer));
}

async function main() {
  const token = await requestToken();
  if (!token) {
    console.log("[ms-files] sin credenciales Microsoft Graph; se usan los archivos locales de Data/");
    return;
  }

  const hostname = getEnv("MS_GRAPH_HOSTNAME", "provexpress.sharepoint.com");
  const sitePath = getEnv("MS_GRAPH_SITE_PATH", "/sites/ProvexpressIntranet/Adminyfinanciero");
  const driveName = getEnv("MS_GRAPH_DRIVE_NAME", "Documentos compartidos");
  const folderPath = getEnv("MS_GRAPH_FOLDER_PATH", "Facturación/Director de Facturación");
  const requiredFiles = parseCsv(getEnv("MS_GRAPH_FILES", DEFAULT_FILES.join(",")));
  const optionalFiles = parseCsv(getEnv("MS_GRAPH_OPTIONAL_FILES", ""));
  const includeAcuses = getEnv("MS_GRAPH_DOWNLOAD_ACUSES", "false").toLowerCase() === "true";
  const files = includeAcuses ? [...requiredFiles, ...DEFAULT_ACUSE_FILES, ...optionalFiles] : [...requiredFiles, ...optionalFiles];

  console.log(`[ms-files] resolviendo sitio ${hostname}${sitePath}`);
  const site = await getSite(token, hostname, sitePath);
  const drive = await getDrive(token, site.id, driveName);
  console.log(`[ms-files] biblioteca: ${drive.name}`);

  for (const fileName of files) {
    const driveItemPath = joinGraphPath(folderPath, fileName);
    const outputPath = path.join(dataDir, fileName);
    await downloadDriveItem(token, drive.id, driveItemPath, outputPath);
    console.log(`[ms-files] descargado: ${fileName}`);
  }
}

main().catch((error) => {
  console.error("[ms-files] error", error);
  process.exitCode = 1;
});
