export const DEFAULT_DATA_CACHE_VERSION = 1;

export function createDataCacheEnvelope(payload) {
  return {
    cacheVersion: DEFAULT_DATA_CACHE_VERSION,
    generatedAt: new Date().toISOString(),
    payload,
  };
}

export function extractDataCachePayload(candidate, validator) {
  if (!candidate || candidate.cacheVersion !== DEFAULT_DATA_CACHE_VERSION) {
    return null;
  }

  if (typeof validator === "function" && !validator(candidate.payload)) {
    return null;
  }

  return candidate.payload ?? null;
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
