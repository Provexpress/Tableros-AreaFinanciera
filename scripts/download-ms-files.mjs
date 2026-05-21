import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvFile } from "./pbi-api-client.mjs";

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

const DEFAULT_ACUSE_PATTERN = "acuse";

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

async function graphJsonUrl(token, url) {
  return requestJson(url, {
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

async function downloadDriveItemById(token, driveId, itemId, displayName, outputPath) {
  const response = await fetch(`${GRAPH_BASE_URL}/drives/${driveId}/items/${itemId}/content`, {
    headers: { authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`No se pudo descargar ${displayName}. HTTP ${response.status}: ${text.slice(0, 500)}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, Buffer.from(arrayBuffer));
}

async function listDriveFolderItemsByUrl(token, url) {
  const items = [];

  while (url) {
    const page = await graphJsonUrl(token, url);
    for (const item of page.value || []) {
      if (item.name) {
        items.push(item);
      }
    }
    url = page["@odata.nextLink"] || "";
  }

  return items;
}

async function listDriveFolderItems(token, driveId, folderPath) {
  const encodedPath = encodeGraphPath(folderPath);
  const url = `${GRAPH_BASE_URL}/drives/${driveId}/root:/${encodedPath}:/children?$select=id,name,file,folder`;
  return listDriveFolderItemsByUrl(token, url);
}

async function listDriveFolderItemsById(token, driveId, itemId) {
  const url = `${GRAPH_BASE_URL}/drives/${driveId}/items/${itemId}/children?$select=id,name,file,folder`;
  return listDriveFolderItemsByUrl(token, url);
}

function isAcuseWorkbook(item, acusePattern) {
  const lowerName = String(item.name || "").toLowerCase();
  return (
    item.file &&
    lowerName.endsWith(".xlsx") &&
    !lowerName.startsWith("~$") &&
    lowerName.includes(acusePattern)
  );
}

async function findAcuseFilesRecursively(token, driveId, searchRootPath, acusePattern) {
  const maxDepth = Number(getEnv("MS_GRAPH_ACUSES_SEARCH_DEPTH", "5")) || 5;
  const rootItems = await listDriveFolderItems(token, driveId, searchRootPath);
  const queue = rootItems
    .filter((item) => item.folder)
    .map((item) => ({ item, depth: 1 }));
  const matches = rootItems.filter((item) => isAcuseWorkbook(item, acusePattern));

  while (queue.length) {
    const { item, depth } = queue.shift();
    if (depth > maxDepth) {
      continue;
    }

    const children = await listDriveFolderItemsById(token, driveId, item.id);
    for (const child of children) {
      if (isAcuseWorkbook(child, acusePattern)) {
        matches.push(child);
      }
      if (child.folder) {
        queue.push({ item: child, depth: depth + 1 });
      }
    }
  }

  return matches;
}

async function resolveAcuseFiles(token, driveId, folderPath) {
  const acusePattern = getEnv("MS_GRAPH_ACUSE_PATTERN", DEFAULT_ACUSE_PATTERN).toLowerCase();
  let discovered = [];

  try {
    discovered = await listDriveFolderItems(token, driveId, folderPath);
  } catch (error) {
    const searchRootPath = getEnv("MS_GRAPH_ACUSES_SEARCH_ROOT", "Facturación");
    console.log(`[ms-files] no se pudo abrir ${folderPath}; buscando acuses dentro de ${searchRootPath}`);
    discovered = await findAcuseFilesRecursively(token, driveId, searchRootPath, acusePattern);
  }

  const acuseFiles = discovered
    .filter((item) => isAcuseWorkbook(item, acusePattern))
    .sort((a, b) => a.name.localeCompare(b.name, "es", { numeric: true, sensitivity: "base" }));

  return acuseFiles;
}

async function main() {
  loadEnvFile(rootDir);
  const token = await requestToken();
  if (!token) {
    console.log("[ms-files] sin credenciales Microsoft Graph; no se descargan Excel. Usa archivos locales en Data/ si necesitas regenerar caches.");
    return;
  }

  const hostname = getEnv("MS_GRAPH_HOSTNAME", "provexpress.sharepoint.com");
  const sitePath = getEnv("MS_GRAPH_SITE_PATH", "/sites/ProvexpressIntranet/Adminyfinanciero");
  const driveName = getEnv("MS_GRAPH_DRIVE_NAME", "Documentos compartidos");
  const folderPath = getEnv("MS_GRAPH_FOLDER_PATH", "Facturación/Director de Facturación");
  const acusesFolderPath = getEnv("MS_GRAPH_ACUSES_FOLDER_PATH", folderPath);
  const requiredFiles = parseCsv(getEnv("MS_GRAPH_FILES", DEFAULT_FILES.join(",")));
  const optionalFiles = parseCsv(getEnv("MS_GRAPH_OPTIONAL_FILES", ""));
  const includeAcuses = getEnv("MS_GRAPH_DOWNLOAD_ACUSES", "false").toLowerCase() === "true";

  console.log(`[ms-files] resolviendo sitio ${hostname}${sitePath}`);
  const site = await getSite(token, hostname, sitePath);
  const drive = await getDrive(token, site.id, driveName);
  console.log(`[ms-files] biblioteca: ${drive.name}`);

  const acuseFiles = includeAcuses ? await resolveAcuseFiles(token, drive.id, acusesFolderPath) : [];
  if (includeAcuses) {
    if (acuseFiles.length) {
      console.log(`[ms-files] acuses detectados en ${acusesFolderPath}: ${acuseFiles.map((item) => item.name).join(", ")}`);
    } else {
      console.log(`[ms-files] acuses detectados: ninguno en ${acusesFolderPath}`);
    }
  }

  const fileJobs = [
    ...requiredFiles.map((name) => ({ name, itemId: "" })),
    ...acuseFiles.map((item) => ({ name: item.name, itemId: item.id || "" })),
    ...optionalFiles.map((name) => ({ name, itemId: "" })),
  ];
  const seenFiles = new Set();
  const uniqueFileJobs = fileJobs.filter((job) => {
    const key = job.name.toLowerCase();
    if (seenFiles.has(key)) {
      return false;
    }
    seenFiles.add(key);
    return true;
  });

  for (const file of uniqueFileJobs) {
    const driveItemPath = joinGraphPath(folderPath, file.name);
    const outputPath = path.join(dataDir, file.name);
    if (file.itemId) {
      await downloadDriveItemById(token, drive.id, file.itemId, file.name, outputPath);
    } else {
      await downloadDriveItem(token, drive.id, driveItemPath, outputPath);
    }
    console.log(`[ms-files] descargado: ${file.name}`);
  }
}

main().catch((error) => {
  console.error("[ms-files] error", error);
  process.exitCode = 1;
});
