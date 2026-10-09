export const IDENTIFIER = /^[a-z_][a-z0-9_]{0,62}$/;

export const RESERVED_COLUMNS = new Set(["_row_id"]);

export const GRID_COLUMNS = 12;

export const VISUALS = ["card", "table", "bar", "column", "line", "area", "pie", "combo", "slicer", "text", "chart", "image", "details"];

export const CHARTS = new Set(["bar", "column", "line", "area", "pie", "combo"]);

export const DRAWN = new Set([...CHARTS, "chart"]);

export const ATTRIBUTE_VISUALS = new Set(["table", "details", "chart"]);

export function computedField(item) {
  if (item.visual === "image") {
    return false;
  }
  if (item.visual === "text") {
    return Boolean((item.measures || []).length || (item.group_by || []).length);
  }
  return true;
}

export const BUCKETS = ["year", "quarter", "month", "week", "day"];

export const SLICER_MODES = ["list", "dropdown", "range"];

export const STACK_MODES = ["none", "stacked", "percent"];

export const STACKABLE = new Set(["bar", "column", "area"]);

export const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

const MINIMUM_MEASURES = { combo: 2 };

const MAXIMUM_MEASURES = { pie: 1 };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const BRAZILIAN_DATE = /^(\d{2})\/(\d{2})\/(\d{4})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/;

const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/;

const TRUE_WORDS = new Set(["true", "1", "sim", "s", "yes", "y", "verdadeiro"]);

const FALSE_WORDS = new Set(["false", "0", "nao", "não", "n", "no", "falso"]);

export function slugified(text) {
  const plain = String(text || "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const named = plain || "campo";
  return (/^\d/.test(named) ? `c_${named}` : named).slice(0, 63).replace(/_+$/, "");
}

export function requiredProblem(value, label) {
  return String(value ?? "").trim() ? null : `Preencha: ${label}.`;
}

export function identifierProblem(value, label) {
  const text = String(value ?? "");
  if (!text) {
    return `${label} é obrigatório.`;
  }
  if (!IDENTIFIER.test(text)) {
    return `${label} deve ter só letras minúsculas, números e _ (sem acento, sem espaço, sem começar por número), até 63 caracteres.`;
  }
  if (RESERVED_COLUMNS.has(text)) {
    return `${label} "${text}" é reservado.`;
  }
  return null;
}

export function lengthProblem(value, label, maximum) {
  return String(value ?? "").length > maximum ? `${label} passa de ${maximum} caracteres.` : null;
}

export function positiveIntegerProblem(value, label) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? null : `${label} deve ser um inteiro maior que zero.`;
}

export function distinctProblem(values, label) {
  const seen = new Set();
  for (const value of values) {
    if (seen.has(value)) {
      return `${label} repetido: ${value}.`;
    }
    seen.add(value);
  }
  return null;
}

export function parsedJson(text) {
  try {
    return { value: JSON.parse(text), problem: null };
  } catch (error) {
    return { value: null, problem: `JSON inválido: ${error.message}` };
  }
}

export function numberFrom(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  let text = String(value).trim().replace(/\s/g, "");
  if (text.includes(",")) {
    text = text.replace(/\./g, "").replace(",", ".");
  }
  if (!/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(text)) {
    return null;
  }
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

function validCalendar(year, month, day) {
  const moment = new Date(Date.UTC(year, month - 1, day));
  return moment.getUTCFullYear() === year && moment.getUTCMonth() === month - 1 && moment.getUTCDate() === day;
}

export function isoDateFrom(value) {
  const text = String(value).trim();
  const brazilian = BRAZILIAN_DATE.exec(text);
  if (brazilian) {
    const [, day, month, year] = brazilian;
    return validCalendar(Number(year), Number(month), Number(day)) ? `${year}-${month}-${day}` : null;
  }
  const isoDay = text.slice(0, 10);
  if (!(ISO_DATE.test(text) || ISO_DATETIME.test(text))) {
    return null;
  }
  const [year, month, day] = isoDay.split("-").map(Number);
  return validCalendar(year, month, day) ? isoDay : null;
}

export function isoDateTimeFrom(value) {
  const text = String(value).trim();
  const brazilian = BRAZILIAN_DATE.exec(text);
  if (brazilian) {
    const [, day, month, year, hour = "00", minute = "00", second = "00"] = brazilian;
    return validCalendar(Number(year), Number(month), Number(day)) ? `${year}-${month}-${day}T${hour}:${minute}:${second}` : null;
  }
  if (ISO_DATE.test(text)) {
    return isoDateFrom(text) ? `${text}T00:00:00` : null;
  }
  return ISO_DATETIME.test(text) && isoDateFrom(text) ? text.replace(" ", "T") : null;
}

export function booleanFrom(value) {
  if (typeof value === "boolean") {
    return value;
  }
  const word = String(value).trim().toLowerCase();
  if (TRUE_WORDS.has(word)) {
    return true;
  }
  if (FALSE_WORDS.has(word)) {
    return false;
  }
  return null;
}

const CONVERTERS = {
  number: numberFrom,
  date: isoDateFrom,
  datetime: isoDateTimeFrom,
  boolean: booleanFrom,
  text: (value) => String(value),
};

const TYPE_HINTS = {
  number: "número (ex.: 1234,56)",
  date: "data (dd/mm/aaaa ou aaaa-mm-dd)",
  datetime: "data e hora (dd/mm/aaaa hh:mm)",
  boolean: "sim/não",
  text: "texto",
};

export function typedValue(value, dataType) {
  if (value === null || value === undefined || (typeof value === "string" && !value.trim() && dataType !== "text")) {
    return { value: null, problem: null };
  }
  const converted = (CONVERTERS[dataType] || CONVERTERS.text)(value);
  if (converted === null) {
    return { value: null, problem: `"${value}" não é ${TYPE_HINTS[dataType] || dataType}.` };
  }
  return { value: converted, problem: null };
}

export function positionProblem(position, label) {
  if (!position || typeof position !== "object") {
    return `${label}: posição ausente.`;
  }
  const { column, row, width, height } = position;
  const integers = [column, row, width, height].every((value) => Number.isInteger(value) && value >= 1);
  if (!integers) {
    return `${label}: column, row, width e height devem ser inteiros a partir de 1.`;
  }
  if (column + width - 1 > GRID_COLUMNS) {
    return `${label}: passa das ${GRID_COLUMNS} colunas do grid (column + width - 1 = ${column + width - 1}).`;
  }
  return null;
}

export function overlapProblems(fields, pageLabel) {
  const problems = [];
  const occupied = new Map();
  for (const item of fields || []) {
    const position = item.position;
    if (positionProblem(position, item.name)) {
      continue;
    }
    for (let row = position.row; row < position.row + position.height; row += 1) {
      for (let column = position.column; column < position.column + position.width; column += 1) {
        const key = `${row}:${column}`;
        if (occupied.has(key) && occupied.get(key) !== item.name) {
          problems.push(`${pageLabel}: ${item.name} sobrepõe ${occupied.get(key)} na linha ${row}, coluna ${column}.`);
          return problems;
        }
        occupied.set(key, item.name);
      }
    }
  }
  return problems;
}

export function fieldProblems(item, pageLabel) {
  const label = `${pageLabel}, campo ${item.name || "?"}`;
  const problems = [];
  const name = identifierProblem(item.name, `${label}: name`);
  if (name) {
    problems.push(name);
  }
  if (!VISUALS.includes(item.visual)) {
    problems.push(`${label}: visual deve ser ${VISUALS.join(", ")}.`);
  }
  const position = positionProblem(item.position, label);
  if (position) {
    problems.push(position);
  }
  const measures = item.measures || [];
  const groups = item.group_by || [];
  for (const group of groups) {
    if (group.bucket && !BUCKETS.includes(group.bucket)) {
      problems.push(`${label}: bucket deve ser ${BUCKETS.join(", ")}.`);
    }
  }
  problems.push(...stackProblems(item, label), ...ruleProblems(item, label), ...interactionProblems(item, label));
  if (item.visual === "text") {
    if (!String(item.text || "").trim()) {
      problems.push(`${label}: text precisa de "text".`);
    }
    return problems;
  }
  if (item.visual === "image") {
    if (!item.image || !item.image.asset || measures.length || groups.length) {
      problems.push(`${label}: image leva só "image" ({"asset": ...}), sem medidas nem agrupamento.`);
    }
    return problems;
  }
  if (item.visual === "chart" && !item.chart_options) {
    problems.push(`${label}: chart precisa de chart_options.`);
  }
  if (item.visual === "slicer") {
    if (measures.length || groups.length !== 1) {
      problems.push(`${label}: slicer leva exatamente uma coluna em group_by e nenhuma medida.`);
    }
    if (item.slicer_mode && !SLICER_MODES.includes(item.slicer_mode)) {
      problems.push(`${label}: slicer_mode deve ser ${SLICER_MODES.join(", ")}.`);
    }
    return [...problems, ...labelProblems(item, label)];
  }
  const minimum = ATTRIBUTE_VISUALS.has(item.visual) && groups.length ? 0 : MINIMUM_MEASURES[item.visual] || 1;
  if (measures.length < minimum) {
    problems.push(`${label}: ${item.visual} precisa de ao menos ${minimum} medida(s).`);
  }
  if (MAXIMUM_MEASURES[item.visual] && measures.length > MAXIMUM_MEASURES[item.visual]) {
    problems.push(`${label}: ${item.visual} aceita no máximo ${MAXIMUM_MEASURES[item.visual]} medida.`);
  }
  if (item.visual === "card" && groups.length) {
    problems.push(`${label}: card não agrupa.`);
  }
  if (item.drill_down && (!CHARTS.has(item.visual) || groups.length < 2)) {
    problems.push(`${label}: drill_down vale para gráficos com dois ou mais níveis em group_by.`);
  }
  if (CHARTS.has(item.visual) && !item.drill_down && groups.length !== 1) {
    problems.push(`${label}: ${item.visual} agrupa por exatamente uma coluna (ou use drill_down).`);
  }
  if (item.sort && item.sort.by && !sortableKeys(item).has(item.sort.by)) {
    problems.push(`${label}: sort.by "${item.sort.by}" não é medida nem coluna agrupada.`);
  }
  return [...problems, ...labelProblems(item, label)];
}

export function groupKey(group) {
  const base = `${group.table}.${group.column}`;
  return group.bucket ? `${base}:${group.bucket}` : base;
}

export function sortableKeys(item) {
  return new Set([...(item.measures || []), ...(item.group_by || []).map(groupKey)]);
}

function stackProblems(item, label) {
  if (item.stack === undefined) {
    return [];
  }
  if (!STACK_MODES.includes(item.stack)) {
    return [`${label}: stack deve ser ${STACK_MODES.join(", ")}.`];
  }
  if (item.stack !== "none" && !STACKABLE.has(item.visual) && !(item.visual === "combo" && item.stack === "stacked")) {
    return [`${label}: stack vale para bar, column e area; em combo, só "stacked".`];
  }
  return [];
}

function interactionProblems(item, label) {
  const problems = [];
  if ((item.sync_group || (item.selected || []).length) && item.visual !== "slicer") {
    problems.push(`${label}: sync_group e selected valem só para slicer.`);
  }
  if (item.column_filters && item.visual !== "table") {
    problems.push(`${label}: column_filters vale só para table.`);
  }
  const measures = new Set(item.measures || []);
  const unknown = (item.measure_filters || []).map((entry) => entry.measure).filter((name) => !measures.has(name));
  if (unknown.length) {
    problems.push(`${label}: measure_filters usa medidas do campo; desconhecidas: ${unknown.join(", ")}.`);
  }
  return problems;
}

function affectsProblems(fields, pageLabel) {
  const names = new Set(fields.map((item) => item.name));
  return fields.flatMap((item) => {
    const unknown = (item.affects || []).filter((name) => !names.has(name));
    return unknown.length ? [`${pageLabel}: ${item.name}.affects cita campos que não estão na página: ${unknown.join(", ")}.`] : [];
  });
}

function colorProblem(value, label) {
  if (value === undefined) {
    return null;
  }
  return typeof value === "string" && HEX_COLOR.test(value) ? null : `${label} deve ser uma cor no formato #RRGGBB.`;
}

function ruleProblems(item, label) {
  const format = item.format && typeof item.format === "object" ? item.format : {};
  const rule = format.rule;
  if (rule === undefined || rule === null) {
    return [];
  }
  if (typeof rule !== "object" || Array.isArray(rule)) {
    return [`${label}: format.rule deve ser um objeto com measure, positive e negative.`];
  }
  return [
    identifierProblem(rule.measure, `${label}: format.rule.measure`),
    colorProblem(rule.positive, `${label}: format.rule.positive`),
    colorProblem(rule.negative, `${label}: format.rule.negative`),
  ].filter(Boolean);
}

function labelProblems(item, label) {
  const keys = sortableKeys(item);
  const unknown = Object.keys(item.labels || {}).filter((key) => !keys.has(key));
  return unknown.length ? [`${label}: labels só renomeia medidas ou colunas do campo; desconhecidas: ${unknown.join(", ")}.`] : [];
}

export function documentProblems(document) {
  if (!document || typeof document !== "object") {
    return ["O documento precisa ser um objeto JSON."];
  }
  const problems = [];
  if (!String(document.title || "").trim()) {
    problems.push("title é obrigatório.");
  }
  const pages = Array.isArray(document.pages) ? document.pages : [];
  if (!pages.length) {
    problems.push("O relatório precisa de ao menos uma página.");
  }
  const pageNames = distinctProblem(pages.map((page) => page.name), "Nome de página");
  if (pageNames) {
    problems.push(pageNames);
  }
  for (const page of pages) {
    const pageLabel = `Página ${page.name || "?"}`;
    const name = identifierProblem(page.name, `${pageLabel}: name`);
    if (name) {
      problems.push(name);
    }
    if (!String(page.title || "").trim()) {
      problems.push(`${pageLabel}: title é obrigatório.`);
    }
    const fields = Array.isArray(page.fields) ? page.fields : [];
    const fieldNames = distinctProblem(fields.map((item) => item.name), `${pageLabel}: nome de campo`);
    if (fieldNames) {
      problems.push(fieldNames);
    }
    for (const item of fields) {
      problems.push(...fieldProblems(item, pageLabel));
    }
    problems.push(...overlapProblems(fields, pageLabel), ...affectsProblems(fields, pageLabel));
  }
  return problems;
}

export function markInvalid(control, problem) {
  if (!control) {
    return;
  }
  control.setAttribute("aria-invalid", problem ? "true" : "false");
  control.title = problem || "";
}

export function validated(checks) {
  const problems = [];
  for (const [control, problem] of checks) {
    markInvalid(control, problem);
    if (problem) {
      problems.push(problem);
    }
  }
  return problems;
}
