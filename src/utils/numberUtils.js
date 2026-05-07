import { cleanText } from "./textUtils.js";

export function parseFlexibleNumber(value, fallback = null) {
  if (value == null || value === "") {
    return fallback;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  let text = cleanText(value).replace(/\$/g, "").replace(/\s/g, "");
  if (!text) {
    return fallback;
  }

  if (text.includes(",") && text.includes(".")) {
    if (text.lastIndexOf(",") > text.lastIndexOf(".")) {
      text = text.replace(/\./g, "").replace(",", ".");
    } else {
      text = text.replace(/,/g, "");
    }
  } else if (text.includes(",")) {
    const parts = text.split(",");
    if (parts.length === 2 && parts[1].length <= 2) {
      text = `${parts[0].replace(/\./g, "")}.${parts[1]}`;
    } else {
      text = text.replace(/,/g, "");
    }
  } else if (text.includes(".")) {
    const parts = text.split(".");
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
      text = text.replace(/\./g, "");
    }
  }

  const numeric = Number(text);
  return Number.isFinite(numeric) ? numeric : fallback;
}
