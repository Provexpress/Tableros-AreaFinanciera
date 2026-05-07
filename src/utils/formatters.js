export const MONTHS_SHORT = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
export const MONTHS_FULL = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

export const CATEGORY_COLORS = {
  "Tecnología": "#4f8ef7",
  Tecnologia: "#4f8ef7",
  PAC: "#34c88a",
  Gasto: "#f5a623",
  Servicios: "#a78bfa",
  "Pac/tec": "#8b5cf6",
  "No categorizado": "#f5a623",
  Otros: "#94a3b8",
};

export function formatCOP(value) {
  const amount = Number(value || 0);
  return `$${amount.toLocaleString("es-CO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

export function formatCOPCompact(value) {
  const amount = Number(value || 0);
  const absAmount = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";

  if (absAmount >= 1_000_000_000) {
    return `${sign}$${(absAmount / 1_000_000_000).toLocaleString("es-CO", {
      minimumFractionDigits: absAmount >= 10_000_000_000 ? 0 : 1,
      maximumFractionDigits: 1,
    })}MM`;
  }

  if (absAmount >= 1_000_000) {
    return `${sign}$${(absAmount / 1_000_000).toLocaleString("es-CO", {
      minimumFractionDigits: absAmount >= 100_000_000 ? 0 : 1,
      maximumFractionDigits: 1,
    })}M`;
  }

  if (absAmount >= 1_000) {
    return `${sign}$${(absAmount / 1_000).toLocaleString("es-CO", {
      minimumFractionDigits: absAmount >= 100_000 ? 0 : 1,
      maximumFractionDigits: 1,
    })}K`;
  }

  return formatCOP(amount);
}

export function formatCOPFull(value) {
  const amount = Number(value || 0);
  return `$${amount.toLocaleString("es-CO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

export function formatCOPWithFull(value) {
  return formatCOPFull(value);
}

export function formatPct(value, options = {}) {
  const { signed = true } = options;
  const numeric = Number(value || 0);
  const sign = signed && numeric >= 0 ? "+" : "";

  return `${sign}${numeric.toLocaleString("es-CO", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

function resolveMonthLabel(month, monthStyle = "short") {
  const index = Number(month) - 1;
  if (index < 0 || index >= MONTHS_SHORT.length) {
    return null;
  }

  return monthStyle === "full" ? MONTHS_FULL[index] : MONTHS_SHORT[index];
}

export function formatPeriod(period, options = {}) {
  const { monthStyle = "short" } = options;

  if (!period) {
    return "Sin periodo";
  }

  const text = String(period).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const [year, month, day] = text.split("-");
    const monthLabel = resolveMonthLabel(month, monthStyle);

    if (!monthLabel) {
      return text;
    }

    return `${Number(day)} ${monthLabel} ${year}`;
  }

  if (/^\d{4}-\d{2}$/.test(text)) {
    const [year, month] = text.split("-");
    const monthLabel = resolveMonthLabel(month, monthStyle);

    if (!monthLabel) {
      return text;
    }

    return `${monthLabel} ${year}`;
  }

  return text;
}

export function formatRangeLabel(start, end, options = {}) {
  if (!start && !end) {
    return "Todo el rango";
  }
  if (start && end && start === end) {
    return formatPeriod(start, options);
  }
  if (start && end) {
    return `${formatPeriod(start, options)} - ${formatPeriod(end, options)}`;
  }
  if (start) {
    return `Desde ${formatPeriod(start, options)}`;
  }
  return `Hasta ${formatPeriod(end, options)}`;
}

export function formatDate(date) {
  if (!date) {
    return "-";
  }

  const text = typeof date === "string" ? date.trim() : null;
  if (text && /^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const [year, month, day] = text.split("-");
    return `${day}/${month}/${year}`;
  }

  const asDate = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(asDate.getTime())) {
    return "-";
  }

  const day = String(asDate.getDate()).padStart(2, "0");
  const month = String(asDate.getMonth() + 1).padStart(2, "0");
  const year = asDate.getFullYear();

  return `${day}/${month}/${year}`;
}

export function formatInteger(value) {
  return Number(value || 0).toLocaleString("es-CO");
}

export function getCategoryColor(category) {
  return CATEGORY_COLORS[category] || CATEGORY_COLORS["No categorizado"];
}

export function getTrendTone(value) {
  const numeric = Number(value || 0);
  if (Math.abs(numeric) <= 5) {
    return "green";
  }
  if (Math.abs(numeric) <= 20) {
    return "amber";
  }
  return "red";
}

export function getCurrencyTick(value) {
  const amount = Number(value || 0);
  if (Math.abs(amount) >= 1_000_000_000) {
    return `$${(amount / 1_000_000_000).toLocaleString("es-CO", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })}MM`;
  }
  if (Math.abs(amount) >= 1_000_000) {
    return `$${(amount / 1_000_000).toLocaleString("es-CO", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })}M`;
  }
  if (Math.abs(amount) >= 1_000) {
    return `$${(amount / 1_000).toLocaleString("es-CO", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })}K`;
  }
  return `$${amount.toLocaleString("es-CO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}
