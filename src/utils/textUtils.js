export function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function cleanText(value) {
  if (value == null) {
    return "";
  }

  const text = String(value).replace(/\s+/g, " ").trim();
  if (!text) {
    return "";
  }

  const normalized = normalizeText(text);
  if (normalized === "nan" || normalized === "null" || normalized === "undefined") {
    return "";
  }

  return text;
}
