const LOCALE = "pt-BR";

const EMPTY = "—";

function digits(decimals, fallback) {
  const value = Number.isInteger(decimals) ? decimals : fallback;
  return { minimumFractionDigits: value, maximumFractionDigits: value };
}

const FORMATTERS = {
  currency: (value, decimals) =>
    new Intl.NumberFormat(LOCALE, { style: "currency", currency: "BRL", ...digits(decimals, 2) }).format(value),
  percent: (value, decimals) => new Intl.NumberFormat(LOCALE, { style: "percent", ...digits(decimals, 1) }).format(value),
  integer: (value) => new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 }).format(value),
  number: (value, decimals) =>
    new Intl.NumberFormat(LOCALE, Number.isInteger(decimals) ? digits(decimals, 2) : { maximumFractionDigits: 2 }).format(value),
};

export function formatDate(value) {
  if (typeof value !== "string" || value.length < 10) {
    return value ?? EMPTY;
  }
  return value.slice(0, 10).split("-").reverse().join("/");
}

const ZONED = /(Z|[+-]\d{2}:?\d{2})$/;

const LOCAL_MOMENT = new Intl.DateTimeFormat(LOCALE, {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDateTime(value) {
  if (typeof value !== "string" || !value.includes("T")) {
    return formatDate(value);
  }
  if (ZONED.test(value)) {
    const moment = new Date(value);
    return Number.isNaN(moment.getTime()) ? value : LOCAL_MOMENT.format(moment).replace(",", "");
  }
  const [day, time] = value.split("T");
  return `${formatDate(day)} ${time.slice(0, 5)}`;
}

export function formatPlain(value, dataType) {
  if (value === null || value === undefined || value === "") {
    return EMPTY;
  }
  if (dataType === "date") {
    return formatDate(value);
  }
  if (dataType === "datetime") {
    return formatDateTime(value);
  }
  if (dataType === "boolean") {
    return value ? "Sim" : "Não";
  }
  if (typeof value === "number") {
    return new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 6 }).format(value);
  }
  return String(value);
}

export function formatMeasure(value, format, decimals) {
  if (value === null || value === undefined) {
    return EMPTY;
  }
  if (typeof value !== "number") {
    return formatPlain(value, "text");
  }
  return (FORMATTERS[format] || FORMATTERS.number)(value, decimals);
}

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const BUCKET_FORMATTERS = {
  year: (year) => year,
  quarter: (year, month) => `T${Math.floor((Number(month) - 1) / 3) + 1}/${year}`,
  month: (year, month) => `${MONTHS[Number(month) - 1]}/${year}`,
  week: (year, month, day) => `sem. ${day}/${month}/${year}`,
  day: (year, month, day) => `${day}/${month}/${year}`,
};

export function formatBucket(value, bucket) {
  if (typeof value !== "string" || value.length < 10 || !BUCKET_FORMATTERS[bucket]) {
    return formatPlain(value, "date");
  }
  const [year, month, day] = value.slice(0, 10).split("-");
  return BUCKET_FORMATTERS[bucket](year, month, day);
}

const COMPACT_STEPS = [
  { size: 1e9, suffix: "Bi" },
  { size: 1e6, suffix: "Mi" },
  { size: 1e3, suffix: "Mil" },
];

const COMPACT_DECIMALS = 2;

export function formatShort(value, format, decimals) {
  if (typeof value !== "number" || format === "percent") {
    return formatMeasure(value, format, decimals);
  }
  const step = COMPACT_STEPS.find((item) => Math.abs(value) >= item.size);
  if (!step) {
    return formatMeasure(value, format, decimals);
  }
  const places = Number.isInteger(decimals) ? decimals : COMPACT_DECIMALS;
  const scaled = new Intl.NumberFormat(LOCALE, digits(places, COMPACT_DECIMALS)).format(value / step.size);
  return format === "currency" ? `R$ ${scaled} ${step.suffix}` : `${scaled} ${step.suffix}`;
}

export function formatCell(value, column) {
  if (column && column.kind === "group" && column.bucket && value !== null && value !== undefined) {
    return formatBucket(value, column.bucket);
  }
  if (!column || column.kind === "group") {
    return formatPlain(value, column ? column.data_type : undefined);
  }
  if (column.compact && value !== null && value !== undefined) {
    return formatShort(value, column.format, column.decimals);
  }
  return formatMeasure(value, column.format, column.decimals);
}

export function formatCompact(value) {
  if (value === null || value === undefined) {
    return EMPTY;
  }
  return new Intl.NumberFormat(LOCALE, { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export const FORMAT_LABELS = {
  number: "Número",
  integer: "Inteiro",
  currency: "Moeda (R$)",
  percent: "Percentual",
};

export const TYPE_LABELS = {
  number: "número",
  date: "data",
  datetime: "data e hora",
  text: "texto",
  boolean: "sim/não",
};

export const SOURCE_LABELS = {
  manual: "Manual",
  agent: "Agente",
  restore: "Restauração",
  mcp: "MCP",
  site: "Site",
};

export const BUCKET_LABELS = {
  year: "Ano",
  quarter: "Trimestre",
  month: "Mês",
  week: "Semana",
  day: "Dia",
};
