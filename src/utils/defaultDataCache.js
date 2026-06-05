export const DEFAULT_DATA_CACHE_VERSION = 1;

export function createDataCacheEnvelope(payload) {
  return {
    cacheVersion: DEFAULT_DATA_CACHE_VERSION,
    generatedAt: new Date().toISOString(),
    payload,
  };
}

export function getLatestDataCacheGeneratedAt(...values) {
  const latestTimestamp = values.reduce((latest, value) => {
    const timestamp = Date.parse(value || "");
    if (!Number.isFinite(timestamp)) {
      return latest;
    }

    return latest === null || timestamp > latest ? timestamp : latest;
  }, null);

  return latestTimestamp === null ? null : new Date(latestTimestamp).toISOString();
}

function attachDataCacheMetadata(payload, generatedAt) {
  if (!generatedAt || !payload || typeof payload !== "object" || Array.isArray(payload)) {
    return payload;
  }

  return {
    ...payload,
    meta: {
      ...(payload.meta || {}),
      cacheGeneratedAt: generatedAt,
    },
  };
}

export function extractDataCachePayload(candidate, validator) {
  if (!candidate || candidate.cacheVersion !== DEFAULT_DATA_CACHE_VERSION) {
    return null;
  }

  if (typeof validator === "function" && !validator(candidate.payload)) {
    return null;
  }

  return attachDataCacheMetadata(candidate.payload ?? null, candidate.generatedAt);
}

export async function readDataCacheFromURL(url, validator) {
  try {
    const response = await fetch(url, { cache: "default" });
    if (!response.ok) {
      return null;
    }

    const candidate = await response.json();
    return extractDataCachePayload(candidate, validator);
  } catch {
    return null;
  }
}
