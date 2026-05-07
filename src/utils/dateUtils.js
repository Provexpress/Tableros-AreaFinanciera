import dayjsLib from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat.js";
import { cleanText } from "./textUtils.js";

dayjsLib.extend(customParseFormat);

export const dayjs = dayjsLib;

const DEFAULT_FORMATS = [
  "YYYY-MM-DD",
  "YYYY-MM-DD HH:mm:ss",
  "DD/MM/YYYY",
  "D/M/YYYY",
  "MM/DD/YYYY",
  "M/D/YYYY",
  "DD-MM-YYYY",
  "YYYY/MM/DD",
];

const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 31);

function parseExcelSerialDate(value) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  const wholeDays = Math.floor(value);
  const fractionalDay = value - wholeDays;
  const leapYearAdjustment = wholeDays > 59 ? -1 : 0;
  const utcMillis =
    EXCEL_EPOCH_UTC +
    (wholeDays + leapYearAdjustment) * 24 * 60 * 60 * 1000 +
    Math.round(fractionalDay * 24 * 60 * 60 * 1000);

  const parsedDate = new Date(utcMillis);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

export function parseSpreadsheetDate(value, formats = DEFAULT_FORMATS) {
  if (value == null || value === "") {
    return null;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return dayjs(value);
  }

  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    const parsed = parseExcelSerialDate(value);
    if (!parsed) {
      return null;
    }

    return dayjs(parsed);
  }

  const text = cleanText(value);
  if (!text) {
    return null;
  }

  for (const format of formats) {
    const parsed = dayjs(text, format, true);
    if (parsed.isValid()) {
      return parsed;
    }
  }

  const fallback = dayjs(text);
  return fallback.isValid() ? fallback : null;
}
