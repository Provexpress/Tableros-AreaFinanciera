import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createDataCacheEnvelope } from "../src/utils/defaultDataCache.js";
import { parseComprasPbiRows } from "../src/utils/parseComprasPbi.js";
import { parseVentasPbiRows } from "../src/utils/parseVentasPbi.js";
import { extractRows, loadEnvFile, requestPbiService, requestPbiToken } from "./pbi-api-client.mjs";

const modulePath = fileURLToPath(import.meta.url);
const __dirname = path.dirname(modulePath);
const rootDir = path.resolve(__dirname, "..");
const cacheDir = path.join(rootDir, "Data", "_cache");
const COMPRAS_PBI_CACHE = path.join(cacheDir, "compras-pbi.json");
const VENTAS_PBI_CACHE = path.join(cacheDir, "ventas-pbi.json");

function normalizeIdentityPart(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "")
    .toUpperCase();
}

function getDocumentIdentity(row) {
  const documentNumber = row.folio || row.numeroDocumento || row.id;
  const owner = row.nit || row.proveedor || row.cliente;

  return [
    row.fechaIso,
    owner,
    row.prefijo,
    documentNumber,
  ]
    .map(normalizeIdentityPart)
    .join("|");
}

function isInPublishedRange(row, minYear) {
  const year = Number(row.anio || String(row.periodo || row.fechaIso || "").slice(0, 4));
  return Number.isFinite(year) && year >= minYear;
}

export function mergePbiCachePayload(existingPayload, batchPayload, { minYear = 2024 } = {}) {
  const existingRows = Array.isArray(existingPayload?.data)
    ? existingPayload.data.filter((row) => isInPublishedRange(row, minYear))
    : [];
  const batchRows = Array.isArray(batchPayload?.data)
    ? batchPayload.data.filter((row) => isInPublishedRange(row, minYear))
    : [];
  const byDocument = new Map();

  existingRows.forEach((row) => {
    byDocument.set(getDocumentIdentity(row), row);
  });

  let replacedDocuments = 0;
  batchRows.forEach((row) => {
    const identity = getDocumentIdentity(row);
    if (byDocument.has(identity)) {
      replacedDocuments += 1;
    }
    byDocument.set(identity, row);
  });

  const data = [...byDocument.values()].sort(
    (a, b) =>
      String(a.periodo || "").localeCompare(String(b.periodo || "")) ||
      String(a.proveedor || a.cliente || "").localeCompare(String(b.proveedor || b.cliente || "")) ||
      String(a.numeroDocumento || "").localeCompare(String(b.numeroDocumento || ""))
  );
  const range = {
    start: data[0]?.periodo || null,
    end: data[data.length - 1]?.periodo || null,
  };

  return {
    data,
    meta: {
      ...(existingPayload?.meta || {}),
      ...(batchPayload?.meta || {}),
      validRows: data.length,
      range,
      stats: {
        ...(existingPayload?.meta?.stats || {}),
        ...(batchPayload?.meta?.stats || {}),
        previousDocuments: existingRows.length,
        batchApiRows: Number(batchPayload?.meta?.stats?.apiRows || batchPayload?.meta?.totalRows || 0),
        batchDocuments: batchRows.length,
        replacedDocuments,
        mergedDocuments: data.length,
      },
      cachePolicy: {
        ...(existingPayload?.meta?.cachePolicy || {}),
        ...(batchPayload?.meta?.cachePolicy || {}),
        minYear,
        mode: "incremental-merge",
      },
    },
  };
}

async function readCacheFile(cachePath) {
  try {
    const envelope = JSON.parse(await fs.readFile(cachePath, "utf8"));
    if (envelope?.cacheVersion !== 1 || !Array.isArray(envelope?.payload?.data)) {
      return null;
    }
    return envelope.payload;
  } catch {
    return null;
  }
}

export function readLargestHistoricalCache(cachePath) {
  const relativeCachePath = path.relative(rootDir, cachePath).split(path.sep).join("/");

  try {
    const rawHistory = execFileSync(
      "git",
      ["log", "--all", "--format=", "--raw", "--no-abbrev", "--", relativeCachePath],
      { cwd: rootDir, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }
    );
    const objectIds = new Set();

    rawHistory.split(/\r?\n/).forEach((line) => {
      const match = line.match(/^:\d+ \d+ ([0-9a-f]{40}) ([0-9a-f]{40})/i);
      if (!match) return;
      [match[1], match[2]].forEach((objectId) => {
        if (!/^0+$/.test(objectId)) {
          objectIds.add(objectId);
        }
      });
    });

    if (!objectIds.size) {
      return null;
    }

    const objectInfo = execFileSync(
      "git",
      ["cat-file", "--batch-check=%(objectname) %(objecttype) %(objectsize)"],
      {
        cwd: rootDir,
        encoding: "utf8",
        input: `${[...objectIds].join("\n")}\n`,
        maxBuffer: 16 * 1024 * 1024,
      }
    );
    const candidates = objectInfo
      .split(/\r?\n/)
      .map((line) => {
        const [objectId, objectType, rawSize] = line.trim().split(/\s+/);
        return { objectId, objectType, size: Number(rawSize) };
      })
      .filter((item) => item.objectType === "blob" && Number.isFinite(item.size))
      .sort((a, b) => b.size - a.size);

    for (const candidate of candidates) {
      try {
        const content = execFileSync("git", ["cat-file", "blob", candidate.objectId], {
          cwd: rootDir,
          encoding: "utf8",
          maxBuffer: 512 * 1024 * 1024,
        });
        const envelope = JSON.parse(content);
        if (envelope?.cacheVersion === 1 && Array.isArray(envelope?.payload?.data) && envelope.payload.data.length) {
          return {
            payload: envelope.payload,
            objectId: candidate.objectId,
          };
        }
      } catch {
        // Try the next historical blob if this object is not a valid cache.
      }
    }
  } catch {
    return null;
  }

  return null;
}

async function readCacheBase(cachePath) {
  const current = await readCacheFile(cachePath);
  const minDocuments = Number(process.env.PBI_CACHE_RECOVERY_MIN_DOCUMENTS || 1000);
  const recoveryCompleted = current?.meta?.cachePolicy?.historyRecoveryCompleted === true;
  const shouldRecover =
    !recoveryCompleted ||
    !current?.data?.length ||
    (Number.isFinite(minDocuments) && current.data.length < minDocuments);

  if (!shouldRecover) {
    return { payload: current, recovered: false, objectId: null };
  }

  const historical = readLargestHistoricalCache(cachePath);
  if (historical?.payload?.data?.length > (current?.data?.length || 0)) {
    return {
      payload: historical.payload,
      recovered: true,
      objectId: historical.objectId,
    };
  }

  return { payload: current, recovered: false, objectId: null };
}

async function writeCacheFile(cachePath, payload) {
  await fs.mkdir(path.dirname(cachePath), { recursive: true });
  await fs.writeFile(cachePath, JSON.stringify(createDataCacheEnvelope(payload)));
}

async function buildServiceCache({ token, serviceName, cachePath, parser }) {
  const minYear = Number(process.env.PBI_CACHE_MIN_YEAR || 2024);
  const payload = await requestPbiService(serviceName, token);
  const rows = extractRows(payload);
  const cacheBase = await readCacheBase(cachePath);
  const existing = cacheBase.payload;

  if (cacheBase.recovered) {
    console.warn(
      `[pbi-cache] ${serviceName}: se recuperaron ${existing.data.length} documentos del historial Git (${cacheBase.objectId.slice(0, 8)})`
    );
  }

  if (!rows.length) {
    if (existing?.data?.length) {
      if (cacheBase.recovered) {
        const restored = mergePbiCachePayload(null, existing, { minYear });
        restored.meta.cachePolicy.historyRecoveryCompleted = true;
        restored.meta.cachePolicy.recoveredFromGitHistory = true;
        restored.meta.stats.recoveredHistoricalDocuments = restored.data.length;
        await writeCacheFile(cachePath, restored);
      }
      console.warn(
        `[pbi-cache] ${serviceName}: la API respondio sin filas; se conserva la cache existente (${existing.data.length} documentos)`
      );
      return;
    }
    throw new Error(`${serviceName}: la API respondio sin filas y no existe una cache valida para conservar.`);
  }

  const batch = parser(rows, undefined, { minYear });
  if (!batch.data.length) {
    if (existing?.data?.length) {
      console.warn(
        `[pbi-cache] ${serviceName}: el lote no produjo documentos validos; se conserva la cache existente (${existing.data.length} documentos)`
      );
      return;
    }
    throw new Error(`${serviceName}: el lote no produjo documentos validos y no existe una cache valida para conservar.`);
  }

  const merged = mergePbiCachePayload(existing, batch, { minYear });
  merged.meta.cachePolicy.historyRecoveryCompleted = true;
  if (cacheBase.recovered) {
    merged.meta.cachePolicy.recoveredFromGitHistory = true;
    merged.meta.stats.recoveredHistoricalDocuments = existing.data.length;
  }
  await writeCacheFile(cachePath, merged);
  console.log(
    `[pbi-cache] ${serviceName}: cache fusionada (${rows.length} lineas API => ${batch.data.length} documentos del lote; ${merged.data.length} documentos acumulados, desde ${minYear})`
  );
}

async function buildPbiCaches() {
  loadEnvFile(rootDir);
  const token = await requestPbiToken();
  await buildServiceCache({
    token,
    serviceName: "compras",
    cachePath: COMPRAS_PBI_CACHE,
    parser: parseComprasPbiRows,
  });
  await buildServiceCache({
    token,
    serviceName: "ventas",
    cachePath: VENTAS_PBI_CACHE,
    parser: parseVentasPbiRows,
  });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === modulePath;

if (isMain) {
  buildPbiCaches().catch((error) => {
    console.error("[pbi-cache] error", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
