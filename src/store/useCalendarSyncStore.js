import { create } from "zustand";

const CALENDAR_KEYS = [
  "year",
  "month",
  "semester",
  "quarter",
  "periodRange",
  "dateRange",
  "selectedPeriods",
  "selectedDates",
];

function cloneList(value) {
  return Array.isArray(value) ? [...value] : [];
}

function cloneRange(value) {
  return Array.isArray(value) ? [value[0] || null, value[1] || null] : [null, null];
}

function sameList(left = [], right = []) {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

function sameRange(left = [], right = []) {
  return (left?.[0] || null) === (right?.[0] || null) && (left?.[1] || null) === (right?.[1] || null);
}

function sameCalendarFilters(current = null, next = null) {
  if (!current || !next) {
    return current === next;
  }

  return (
    current.year === next.year &&
    current.month === next.month &&
    current.semester === next.semester &&
    current.quarter === next.quarter &&
    sameRange(current.periodRange, next.periodRange) &&
    sameRange(current.dateRange, next.dateRange) &&
    sameList(current.selectedPeriods || [], next.selectedPeriods || []) &&
    sameList(current.selectedDates || [], next.selectedDates || [])
  );
}

export function hasCalendarFilterKeys(partial = {}) {
  return CALENDAR_KEYS.some((key) => Object.prototype.hasOwnProperty.call(partial, key));
}

export function pickCalendarFilters(filters = {}, { includeDates = true } = {}) {
  const picked = {
    year: filters.year ?? "ALL",
    month: filters.month ?? "ALL",
    semester: filters.semester ?? "ALL",
    quarter: filters.quarter ?? "ALL",
    periodRange: cloneRange(filters.periodRange),
    selectedPeriods: cloneList(filters.selectedPeriods),
  };

  if (includeDates) {
    picked.dateRange = cloneRange(filters.dateRange);
    picked.selectedDates = cloneList(filters.selectedDates);
  }

  return picked;
}

export function applySharedCalendarFilters(filters = {}, sharedFilters = null, { includeDates = true } = {}) {
  if (!sharedFilters) {
    return filters;
  }

  return {
    ...filters,
    ...pickCalendarFilters(sharedFilters, { includeDates }),
    ...(includeDates
      ? {}
      : {
          dateRange: filters.dateRange,
          selectedDates: filters.selectedDates,
        }),
  };
}

export const useCalendarSyncStore = create((set, get) => ({
  filters: null,
  source: null,
  revision: 0,
  setCalendarFilters: (filters, source = "unknown", options = {}) => {
    const nextFilters = pickCalendarFilters(filters, options);
    const current = get();
    if (current.source === source && sameCalendarFilters(current.filters, nextFilters)) {
      return;
    }

    set({
      filters: nextFilters,
      source,
      revision: current.revision + 1,
    });
  },
}));

export function getSharedCalendarFilters() {
  return useCalendarSyncStore.getState().filters;
}

export function saveSharedCalendarFilters(filters, source, options = {}) {
  useCalendarSyncStore.getState().setCalendarFilters(filters, source, options);
}
