import { api, encoded } from "./api.js";
import { renderChart } from "./charts.js";
import {
  busy,
  clear,
  confirmAction,
  element,
  errorContent,
  field,
  notify,
  notifyError,
  openDialog,
  option,
  pretty,
  problemList,
  replaced,
} from "./dom.js";
import { downloadFile, showExportDialog } from "./exports.js";
import { BUCKET_LABELS, formatCell, formatDateTime, SOURCE_LABELS } from "./format.js";
import { authorTag, differenceList } from "./history.js";
import { can, requiring } from "./permissions.js";
import { publishButton } from "./publication.js";
import { icon } from "./icons.js";
import { onChange } from "./live.js";
import { applyShell, applyTheme, setVariables, TEXT_SIZES, TITLE_SIZES, VALUE_SIZES, WEIGHTS } from "./theme.js";
import {
  computedField,
  DRAWN,
  documentProblems,
  groupKey,
  HEX_COLOR,
  identifierProblem,
  lengthProblem,
  markInvalid,
  parsedJson,
  requiredProblem,
  slugified,
  validated,
} from "./validation.js";
import { reportVersion, showVersionsDialog } from "./versions.js";

const STORAGE_KEY = "analytics.reports.last";

const CONTEXT_KEY = "analytics.reports.context.";

const TITLE_LIMIT = 200;

const RELOAD_DELAY = 180;

const LIVE_DELAY = 250;

const REPORT_ENTITIES = new Set(["report", "feed"]);

const DATA_ENTITIES = new Set(["measure", "dataset", "dataset_column", "dataset_load", "relationship", "rows", "feed"]);

const SEARCH_THRESHOLD = 8;

const PILL_VALUE_LIMIT = 3;

const RANGE_INPUTS = {
  number: "number",
  date: "date",
  datetime: "datetime-local",
};

const RANGE_LENGTHS = {
  date: 10,
  datetime: 16,
};

const COMBINING_MARKS = /[̀-ͯ]/g;

const INITIAL_CONTEXT = null;

const SORT_ARROWS = { ascending: "▲", descending: "▼" };

const ARIA_SORTS = { ascending: "ascending", descending: "descending" };

const VERSION_MARK = "@";

const PRINT_SLICER_VALUES = 3;

const PRINT_CHART = { renderer: "svg", animation: false };

const PLACEHOLDER = /\{\{\s*([^{}]+?)\s*\}\}/g;

const PENDING_VALUE = "…";

const JUSTIFY = { top: "flex-start", middle: "center", bottom: "flex-end" };

const STYLESHEET_ID = "report-stylesheet";

const state = {
  reports: [],
  report: null,
  version: null,
  development: null,
  pageName: null,
  frames: new Map(),
  loadSequence: 0,
  context: emptyContext(),
  contexts: new Map(),
  synced: new Map(),
  contextScope: null,
  reloadTimer: null,
  liveTimer: null,
  pending: { report: false, data: false },
  printView: null,
};

const nodes = {};

function rememberedReport() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function rememberReport(name) {
  try {
    localStorage.setItem(STORAGE_KEY, name);
    return true;
  } catch {
    return false;
  }
}

function forgetReport(name) {
  try {
    if (localStorage.getItem(STORAGE_KEY) === name) {
      localStorage.removeItem(STORAGE_KEY);
    }
    return true;
  } catch {
    return false;
  }
}

function reportNamed(name) {
  return state.reports.find((report) => report.name === name) || null;
}

function pageNamed(name) {
  if (!state.report) {
    return null;
  }
  return state.report.document.pages.find((page) => page.name === name) || null;
}

function errorView(message) {
  return element("div", { class: "field-error" }, message);
}

function duplicateProblem(name) {
  return reportNamed(name) ? `Já existe um relatório chamado "${name}".` : null;
}

async function refreshReports() {
  state.reports = await api.get("/reports");
}

function emptyContext() {
  return {
    selections: new Map(),
    drills: new Map(),
    filters: new Map(),
    sorts: new Map(),
    signatures: new Map(),
    initialized: new Set(),
  };
}

function contextScope() {
  return state.version ? `${VERSION_MARK}${state.version.name}` : state.report.name;
}

function remembering() {
  return state.report.document.remember_selections !== false;
}

function fieldSignature(reportField) {
  return JSON.stringify([
    reportField.visual,
    reportField.group_by || [],
    reportField.measures || [],
    Boolean(reportField.drill_down),
    reportField.slicer_mode || "list",
    reportField.selected || [],
  ]);
}

function pageField(page, name) {
  return page ? page.fields.find((item) => item.name === name) || null : null;
}

function currentField(name) {
  return pageField(pageNamed(state.pageName), name);
}

function touchField(name) {
  const reportField = currentField(name);
  if (reportField) {
    state.context.signatures.set(name, fieldSignature(reportField));
  }
  return reportField;
}

function pairs(value) {
  return Array.isArray(value) ? value.filter((pair) => Array.isArray(pair) && pair.length === 2) : [];
}

function serializedContext(context) {
  return {
    selections: [...context.selections],
    drills: [...context.drills],
    filters: [...context.filters].map(([name, entries]) => [name, [...entries]]),
    sorts: [...context.sorts],
    signatures: [...context.signatures],
    initialized: [...context.initialized],
  };
}

function restoredContext(saved) {
  const context = emptyContext();
  if (!saved || typeof saved !== "object") {
    return context;
  }
  context.selections = new Map(pairs(saved.selections));
  context.drills = new Map(pairs(saved.drills));
  context.filters = new Map(pairs(saved.filters).map(([name, entries]) => [name, new Map(pairs(entries))]));
  context.sorts = new Map(pairs(saved.sorts));
  context.signatures = new Map(pairs(saved.signatures));
  context.initialized = new Set(Array.isArray(saved.initialized) ? saved.initialized : []);
  return context;
}

function storedContexts(scope) {
  try {
    const saved = JSON.parse(localStorage.getItem(CONTEXT_KEY + scope) || "null");
    return saved && typeof saved === "object" ? saved : null;
  } catch {
    return null;
  }
}

function saveContexts() {
  if (!state.contextScope) {
    return false;
  }
  try {
    if (!remembering()) {
      localStorage.removeItem(CONTEXT_KEY + state.contextScope);
      return true;
    }
    const pages = Object.fromEntries([...state.contexts].map(([name, context]) => [name, serializedContext(context)]));
    localStorage.setItem(CONTEXT_KEY + state.contextScope, JSON.stringify({ pages, synced: [...state.synced] }));
    return true;
  } catch {
    return false;
  }
}

function loadContexts() {
  const scope = contextScope();
  if (scope === state.contextScope) {
    return;
  }
  state.contextScope = scope;
  state.contexts = new Map();
  state.synced = new Map();
  const saved = remembering() ? storedContexts(scope) : null;
  if (!saved) {
    return;
  }
  for (const [name, context] of Object.entries(saved.pages || {})) {
    state.contexts.set(name, restoredContext(context));
  }
  state.synced = new Map(pairs(saved.synced));
}

function forgetField(context, name) {
  context.selections.delete(name);
  context.drills.delete(name);
  context.filters.delete(name);
  context.sorts.delete(name);
  context.signatures.delete(name);
  context.initialized.delete(name);
}

function prunedContext(page, context) {
  const names = new Set([
    ...context.selections.keys(),
    ...context.drills.keys(),
    ...context.filters.keys(),
    ...context.sorts.keys(),
    ...context.signatures.keys(),
    ...context.initialized,
  ]);
  for (const name of names) {
    const reportField = pageField(page, name);
    if (!reportField || context.signatures.get(name) !== fieldSignature(reportField)) {
      forgetField(context, name);
    }
  }
  return context;
}

function defaultColumn(reportField) {
  const group = reportField.group_by[0];
  const key = groupKey(group);
  return { key, kind: "group", title: (reportField.labels || {})[key] || reportField.title || group.column, bucket: group.bucket || null };
}

function defaultSelection(reportField) {
  const group = reportField.group_by[0];
  const column = defaultColumn(reportField);
  const values = reportField.selected;
  if (reportField.slicer_mode === "range") {
    return rangeSelection(group, column, isMissing(values[0]) ? null : values[0], isMissing(values[1]) ? null : values[1]);
  }
  return valueSelection(group, column, values);
}

function slicersOf(page) {
  return page.fields.filter((reportField) => reportField.visual === "slicer");
}

function preselected(page) {
  return slicersOf(page).some((reportField) => (reportField.selected || []).length);
}

function appliedDefaults(page, context) {
  for (const reportField of slicersOf(page)) {
    if (context.initialized.has(reportField.name)) {
      continue;
    }
    context.initialized.add(reportField.name);
    context.signatures.set(reportField.name, fieldSignature(reportField));
    if (!(reportField.selected || []).length || context.selections.has(reportField.name)) {
      continue;
    }
    const selection = defaultSelection(reportField);
    context.selections.set(reportField.name, selection);
    if (reportField.sync_group && !state.synced.has(reportField.sync_group)) {
      state.synced.set(reportField.sync_group, selection);
    }
  }
  return context;
}

function syncedSlicers(page, context) {
  for (const reportField of slicersOf(page)) {
    if (!reportField.sync_group || !state.synced.has(reportField.sync_group)) {
      continue;
    }
    const selection = state.synced.get(reportField.sync_group);
    if (selection) {
      context.selections.set(reportField.name, selection);
    } else {
      context.selections.delete(reportField.name);
    }
    context.signatures.set(reportField.name, fieldSignature(reportField));
  }
  return context;
}

function enterPage(page) {
  loadContexts();
  const context = prunedContext(page, state.contexts.get(page.name) || emptyContext());
  state.context = syncedSlicers(page, appliedDefaults(page, context));
  state.contexts.set(page.name, state.context);
  saveContexts();
}

function syncSelection(reportField, selection) {
  if (reportField && reportField.visual === "slicer" && reportField.sync_group) {
    state.synced.set(reportField.sync_group, selection);
  }
}

function resetContext() {
  cancelReload();
  state.context = emptyContext();
  state.contexts = new Map();
  state.synced = new Map();
  state.contextScope = null;
}

function filterPayload(entry) {
  return entry.values ? { key: entry.key, values: entry.values } : { key: entry.key, minimum: entry.minimum, maximum: entry.maximum };
}

function contextPayload() {
  return {
    selections: [...state.context.selections].map(([source, selection]) => ({ source, conditions: selection.conditions })),
    drills: Object.fromEntries([...state.context.drills].map(([name, path]) => [name, path.map((step) => step.value)])),
    filters: Object.fromEntries([...state.context.filters].map(([name, entries]) => [name, [...entries.values()].map(filterPayload)])),
    sorts: Object.fromEntries(state.context.sorts),
  };
}

function cancelReload() {
  clearTimeout(state.reloadTimer);
  state.reloadTimer = null;
}

function reloadPage() {
  state.reloadTimer = null;
  const page = pageNamed(state.pageName);
  if (page) {
    loadPage(page);
  }
}

function scheduleReload() {
  cancelReload();
  nodes.grid.classList.add("reloading");
  state.reloadTimer = setTimeout(reloadPage, RELOAD_DELAY);
}

function contextChanged() {
  saveContexts();
  renderPills();
  scheduleReload();
}

function clearContext() {
  const page = pageNamed(state.pageName);
  for (const reportField of slicersOf(page)) {
    syncSelection(reportField, null);
  }
  const initialized = state.context.initialized;
  state.context = emptyContext();
  state.context.initialized = initialized;
  for (const reportField of slicersOf(page)) {
    state.context.signatures.set(reportField.name, fieldSignature(reportField));
  }
  state.contexts.set(page.name, state.context);
  contextChanged();
}

function restoreDefaults() {
  const page = pageNamed(state.pageName);
  for (const reportField of slicersOf(page)) {
    if (reportField.sync_group) {
      state.synced.delete(reportField.sync_group);
    }
  }
  state.context = appliedDefaults(page, emptyContext());
  state.contexts.set(page.name, state.context);
  contextChanged();
}

function isMissing(value) {
  return value === null || value === undefined;
}

function valueKey(value) {
  return JSON.stringify(isMissing(value) ? null : value);
}

function containsValue(values, value) {
  const key = valueKey(value);
  return values.some((item) => valueKey(item) === key);
}

function withoutValue(values, value) {
  const key = valueKey(value);
  return values.filter((item) => valueKey(item) !== key);
}

function mergedValues(current, added) {
  return added.reduce((merged, value) => (containsValue(merged, value) ? merged : [...merged, value]), current);
}

function toggledValues(current, value, additive) {
  const present = containsValue(current, value);
  if (additive) {
    return present ? withoutValue(current, value) : [...current, value];
  }
  return present && current.length === 1 ? [] : [value];
}

function columnReference(group) {
  return { kind: "column", table: group.table, column: group.column, bucket: group.bucket || null };
}

function nullCondition(column) {
  return { kind: "comparison", column, operator: "is_null" };
}

function equalCondition(column, value) {
  return { kind: "comparison", column, operator: "equal", value };
}

function listCondition(column, values) {
  return { kind: "comparison", column, operator: "in", values };
}

function groupCondition(logic, conditions) {
  return { kind: "group", logic, conditions };
}

function cellCondition(column, value) {
  return isMissing(value) ? nullCondition(column) : equalCondition(column, value);
}

function valueConditions(column, values) {
  const present = values.filter((value) => !isMissing(value));
  if (!present.length) {
    return [nullCondition(column)];
  }
  if (present.length === values.length) {
    return [present.length === 1 ? equalCondition(column, present[0]) : listCondition(column, present)];
  }
  return [groupCondition("any", [listCondition(column, present), nullCondition(column)])];
}

function rowCondition(columns, row) {
  return groupCondition(
    "all",
    columns.map((column, index) => cellCondition(column, row[index])),
  );
}

function rowConditions(columns, rows) {
  if (rows.length === 1) {
    return [rowCondition(columns, rows[0])];
  }
  return [groupCondition("any", rows.map((row) => rowCondition(columns, row)))];
}

function rangeConditions(column, low, high) {
  if (!isMissing(low) && !isMissing(high)) {
    return [{ kind: "comparison", column, operator: "between", values: [low, high] }];
  }
  if (!isMissing(low)) {
    return [{ kind: "comparison", column, operator: "greater_or_equal", value: low }];
  }
  return [{ kind: "comparison", column, operator: "less_or_equal", value: high }];
}

function valueSelection(group, column, values) {
  return {
    mode: "values",
    values,
    columns: [column],
    conditions: values.length ? valueConditions(columnReference(group), values) : [],
  };
}

function rowSelection(groups, columns, rows) {
  return {
    mode: "rows",
    values: rows,
    columns,
    conditions: rows.length ? rowConditions(groups.map(columnReference), rows) : [],
  };
}

function rangeSelection(group, column, low, high) {
  const empty = isMissing(low) && isMissing(high);
  return {
    mode: "range",
    values: empty ? [] : [low, high],
    columns: [column],
    conditions: empty ? [] : rangeConditions(columnReference(group), low, high),
  };
}

function selectionOf(source) {
  return state.context.selections.get(source) || null;
}

function selectedValues(source, mode) {
  const selection = selectionOf(source);
  return selection && selection.mode === mode ? selection.values : [];
}

function storeSelection(source, selection) {
  const reportField = touchField(source);
  if (selection.values.length) {
    state.context.selections.set(source, selection);
  } else {
    state.context.selections.delete(source);
  }
  syncSelection(reportField, selection.values.length ? selection : null);
  contextChanged();
}

function removeSelection(source) {
  const reportField = touchField(source);
  state.context.selections.delete(source);
  syncSelection(reportField, null);
  contextChanged();
}

function describeSelection(reportField, result) {
  const selection = selectionOf(reportField.name);
  const column = result.columns && result.columns[0];
  if (!selection || !column || selection.columns[0] === column) {
    return;
  }
  selection.columns = [column];
  renderPills();
}

function columnFilters(name) {
  return state.context.filters.get(name) || new Map();
}

function storeColumnFilter(name, key, entry) {
  touchField(name);
  const entries = new Map(columnFilters(name));
  if (entry) {
    entries.set(key, entry);
  } else {
    entries.delete(key);
  }
  if (entries.size) {
    state.context.filters.set(name, entries);
  } else {
    state.context.filters.delete(name);
  }
  contextChanged();
}

function nextSort(reportField, result, column) {
  const current = state.context.sorts.get(reportField.name) || result.sort;
  const first = column.kind === "measure" ? "descending" : "ascending";
  const second = first === "descending" ? "ascending" : "descending";
  if (!current || current.by !== column.key) {
    return { by: column.key, direction: first };
  }
  if (state.context.sorts.has(reportField.name) && current.direction !== first) {
    return null;
  }
  return { by: column.key, direction: current.direction === first ? second : first };
}

function sortBy(reportField, result, column) {
  touchField(reportField.name);
  const sort = nextSort(reportField, result, column);
  if (sort) {
    state.context.sorts.set(reportField.name, sort);
  } else {
    state.context.sorts.delete(reportField.name);
  }
  contextChanged();
}

function drillPath(name) {
  return state.context.drills.get(name) || [];
}

function canDrill(reportField, result) {
  return Boolean(reportField.drill_down) && result.drill_level < result.drill_levels - 1;
}

function storeDrill(name, path) {
  touchField(name);
  if (path.length) {
    state.context.drills.set(name, path);
  } else {
    state.context.drills.delete(name);
  }
  state.context.selections.delete(name);
  contextChanged();
}

function drillInto(reportField, result, value) {
  if (!canDrill(reportField, result)) {
    return;
  }
  const step = { value: isMissing(value) ? null : value, column: result.columns[0] };
  storeDrill(reportField.name, [...drillPath(reportField.name).slice(0, result.drill_level), step]);
}

function drillTo(name, depth) {
  storeDrill(name, drillPath(name).slice(0, Math.max(0, depth)));
}

function fieldTitle(name) {
  const page = pageNamed(state.pageName);
  const found = page ? page.fields.find((reportField) => reportField.name === name) : null;
  return found ? found.title : "";
}

function sourceLabel(name) {
  const selection = selectionOf(name);
  const titles = selection ? selection.columns.map((column) => column.title).filter(Boolean) : [];
  return fieldTitle(name) || titles.join(" / ") || name;
}

function sourceList(names) {
  return names.map(sourceLabel).join(", ");
}

function listText(texts) {
  const shown = texts.slice(0, PILL_VALUE_LIMIT);
  const hidden = texts.length - shown.length;
  return hidden > 0 ? `${shown.join(", ")} e mais ${hidden}` : shown.join(", ");
}

function rowText(row, columns) {
  return row.map((value, index) => formatCell(value, columns[index])).join(" · ");
}

function rangeText(selection) {
  const [low, high] = selection.values.map((value) => (isMissing(value) ? null : formatCell(value, selection.columns[0])));
  if (low !== null && high !== null) {
    return `${low} – ${high}`;
  }
  return low !== null ? `≥ ${low}` : `≤ ${high}`;
}

const SELECTION_TEXTS = {
  values: (selection) => listText(selection.values.map((value) => formatCell(value, selection.columns[0]))),
  rows: (selection) => listText(selection.values.map((row) => rowText(row, selection.columns))),
  range: rangeText,
  custom: () => "filtro da visão",
};

function stepText(step) {
  return formatCell(step.value, step.column);
}

function pill(label, text, onRemove) {
  const description = `${label}: ${text}`;
  return element(
    "span",
    { class: "filter-pill", title: description },
    element("span", { class: "filter-pill-text" }, element("strong", {}, `${label}:`), ` ${text}`),
    element(
      "button",
      { type: "button", class: "filter-pill-remove", title: "Remover", "aria-label": `Remover ${description}`, onclick: onRemove },
      "×",
    ),
  );
}

function selectionPill(source, selection) {
  return pill(sourceLabel(source), SELECTION_TEXTS[selection.mode](selection), () => removeSelection(source));
}

function drillPill(name, path) {
  return pill(fieldTitle(name) || name, `${path.map(stepText).join(" › ")} ›`, () => drillTo(name, 0));
}

function columnFilterText(entry) {
  if (entry.values) {
    return listText(entry.values.map((value) => formatCell(value, entry.column)));
  }
  return rangeText({ values: [entry.minimum, entry.maximum], columns: [entry.column] });
}

function columnFilterPill(name, entry) {
  const label = `${fieldTitle(name) || name} › ${entry.column.title}`;
  return pill(label, columnFilterText(entry), () => storeColumnFilter(name, entry.key, null));
}

function clearButton() {
  return element("button", { type: "button", class: "link filter-clear", onclick: clearContext }, "Limpar filtros");
}

function restoreButton() {
  return element(
    "button",
    { type: "button", class: "link filter-clear", title: "Volta às seleções definidas no relatório", onclick: restoreDefaults },
    "Restaurar padrão",
  );
}

function renderPills() {
  const pills = [
    ...[...state.context.selections].map(([source, selection]) => selectionPill(source, selection)),
    ...[...state.context.drills].map(([name, path]) => drillPill(name, path)),
    ...[...state.context.filters].flatMap(([name, entries]) => [...entries.values()].map((entry) => columnFilterPill(name, entry))),
  ];
  const page = pageNamed(state.pageName);
  const restorable = Boolean(page) && preselected(page);
  nodes.pills.hidden = !pills.length && !restorable;
  replaced(nodes.pills, pills, pills.length ? clearButton() : null, restorable ? restoreButton() : null);
}

function badgesOf(result, reportField) {
  if (!result) {
    return [];
  }
  const applied = result.applied || [];
  const ignored = result.ignored || [];
  return [
    applied.length && reportField.visual !== "card"
      ? element("span", { class: "badge accent field-badge", title: `Filtrado por: ${sourceList(applied)}` }, "filtrado")
      : null,
    ignored.length
      ? element("span", { class: "badge field-badge unrelated", title: `Não filtrado por: ${sourceList(ignored)}` }, "sem relação")
      : null,
  ];
}

function levelName(reportField, index) {
  const group = reportField.group_by[index];
  const label = (reportField.labels || {})[groupKey(group)];
  if (label) {
    return label;
  }
  return group.bucket ? `${group.column} (${BUCKET_LABELS[group.bucket] || group.bucket})` : group.column;
}

function drillCrumb(reportField, path, level, index) {
  const name = levelName(reportField, index);
  if (index < Math.min(level, path.length)) {
    return element(
      "button",
      { type: "button", class: "drill-crumb", title: `Voltar para ${name}`, onclick: () => drillTo(reportField.name, index) },
      `${name}: ${stepText(path[index])}`,
    );
  }
  return element("span", { class: index === level ? "drill-crumb current" : "drill-crumb upcoming" }, name);
}

function drillCrumbs(reportField, path, level) {
  return reportField.group_by.flatMap((group, index) => [
    index ? element("span", { class: "drill-separator", "aria-hidden": "true" }, "›") : null,
    drillCrumb(reportField, path, level, index),
  ]);
}

function drillButton(label, description, disabled, run) {
  return element(
    "button",
    { type: "button", class: "drill-action", title: description, "aria-label": description, disabled, onclick: run },
    label,
  );
}

function drillBar(reportField, result) {
  const path = drillPath(reportField.name);
  const level = result ? result.drill_level : path.length;
  const name = reportField.name;
  return [
    element(
      "nav",
      { class: "drill-crumbs", "aria-label": "Níveis de detalhe", title: "Clique numa categoria do gráfico para descer um nível." },
      drillCrumbs(reportField, path, level),
    ),
    element(
      "span",
      { class: "drill-actions" },
      drillButton("↑", "Subir um nível", level === 0, () => drillTo(name, level - 1)),
      drillButton("⤒", "Voltar ao topo", level === 0, () => drillTo(name, 0)),
    ),
  ];
}

function slicerTitle(frame, result) {
  const reportField = frame.reportField;
  if (reportField.title || reportField.visual !== "slicer" || !result || !result.columns || !result.columns.length) {
    return;
  }
  frame.title.textContent = result.columns[0].title;
  frame.title.title = result.columns[0].title;
}

function decorate(frame, result) {
  const drillable = Boolean(frame.reportField.drill_down);
  replaced(frame.badges, badgesOf(result, frame.reportField));
  frame.drill.hidden = !drillable;
  replaced(frame.drill, drillable ? drillBar(frame.reportField, result) : null);
  slicerTitle(frame, result);
}

function disposeFrame(frame) {
  if (typeof frame.dispose === "function") {
    frame.dispose();
  }
  frame.dispose = null;
}

function disposeCharts() {
  for (const frame of state.frames.values()) {
    disposeFrame(frame);
  }
}

function currentHash() {
  if (state.version) {
    const development = state.development ? `/${encodeURIComponent(state.development)}` : "";
    return `#reports/${VERSION_MARK}${state.version.name}${development}`;
  }
  return `#reports/${state.report.name}/${state.pageName}`;
}

function syncHash() {
  if (!nodes.container.classList.contains("active") || !state.report) {
    return;
  }
  const hash = currentHash();
  if (location.hash !== hash) {
    history.replaceState(null, "", hash);
  }
}

function attachLayout() {
  if (nodes.toolbar.parentNode !== nodes.container) {
    replaced(nodes.container, nodes.toolbar, nodes.heading, nodes.tabs, nodes.body);
  }
}

function renderEmpty() {
  disposeCharts();
  applyShell(null);
  resetContext();
  state.report = null;
  state.pageName = null;
  replaced(
    nodes.container,
    element(
      "div",
      { class: "panel empty report-empty" },
      element("h2", {}, "Nenhum relatório ainda"),
      element("p", {}, "Crie o primeiro relatório em branco ou peça ao seu Claude, pelo MCP, para montar um a partir das medidas."),
      element("button", { class: "primary", type: "button", onclick: openCreateDialog, dataset: { requires: "edit_reports" } }, "Novo relatório"),
    ),
  );
}

function renderFailure(error) {
  disposeCharts();
  replaced(
    nodes.container,
    element(
      "div",
      { class: "panel empty report-empty" },
      element("h2", {}, "Não foi possível carregar os relatórios"),
      errorContent(error),
      element("button", { type: "button", onclick: () => show(null) }, "Tentar novamente"),
    ),
  );
}

function renderSelect() {
  const selected = state.version ? state.version.report : state.report.name;
  replaced(
    nodes.select,
    state.reports.map((report) => option(report.name, report.document.title || report.name, report.name === selected)),
  );
  nodes.select.value = selected;
}

function developmentChooser(version) {
  const developments = version.developments || [];
  if (!developments.length || !version.development_column) {
    return null;
  }
  return element(
    "select",
    {
      class: "version-development",
      "aria-label": "Empreendimento",
      onchange: (event) => chooseDevelopment(event.currentTarget.value),
    },
    option("", "Todos os empreendimentos", !state.development),
    developments.map((item) => option(item, item, item === state.development)),
  );
}

function renderVersionHeading() {
  const version = state.version;
  replaced(
    nodes.heading,
    element(
      "div",
      { class: "version-banner" },
      element("span", { class: "badge accent" }, "Versão congelada"),
      element("strong", {}, version.title),
      developmentChooser(version),
      element("button", { type: "button", onclick: closeVersion }, "Voltar ao relatório"),
    ),
    element("h2", { class: "report-title" }, version.document.title),
    version.description ? element("p", { class: "muted report-description" }, version.description) : null,
    element(
      "div",
      { class: "muted small" },
      `${version.name} · revisão ${version.report_revision} de ${version.report} · salva em ${formatDateTime(version.created_at)}`,
    ),
  );
}

function renderHeading() {
  if (state.version) {
    renderVersionHeading();
    return;
  }
  const reportDocument = state.report.document;
  replaced(
    nodes.heading,
    element("h2", { class: "report-title" }, reportDocument.title),
    reportDocument.description ? element("p", { class: "muted report-description" }, reportDocument.description) : null,
    element("div", { class: "muted small" }, `${state.report.name} · revisão ${state.report.revision}`),
  );
}

function renderTabs() {
  replaced(
    nodes.tabs,
    state.report.document.pages.map((page) =>
      element(
        "button",
        { type: "button", class: page.name === state.pageName ? "active" : "", onclick: () => showPage(page.name) },
        page.title,
      ),
    ),
  );
}

function placeholderValues(result) {
  const row = result && result.rows && result.rows[0];
  if (!row) {
    return null;
  }
  return Object.fromEntries(result.columns.map((column, index) => [column.key, formatCell(row[index], column)]));
}

function filledText(text, result) {
  const values = placeholderValues(result);
  return String(text).replace(PLACEHOLDER, (match, key) => (values ? (values[key] ?? match) : PENDING_VALUE));
}

function textView(reportField, result = null) {
  return element("div", { class: "text-block" }, computedField(reportField) ? filledText(reportField.text, result) : reportField.text);
}

function imageView(reportField) {
  const image = reportField.image || {};
  return element("img", {
    class: "report-image",
    src: `/api/report-assets/${encoded(image.asset || "")}`,
    alt: image.alt || reportField.title || "",
    style: { objectFit: image.fit || "contain" },
  });
}

function detailsView(result) {
  if (!result.rows.length) {
    return element("div", { class: "empty" }, "Sem dados para exibir.");
  }
  return element(
    "div",
    { class: "details" },
    result.rows.map((row) =>
      element(
        "dl",
        { class: "details-block" },
        result.columns.map((column, index) => [
          element("dt", {}, column.title),
          element("dd", { class: numericClass(column) }, formatCell(row[index], column)),
        ]),
      ),
    ),
  );
}

function initialBody(reportField) {
  if (reportField.visual === "text") {
    return textView(reportField);
  }
  if (reportField.visual === "image") {
    return imageView(reportField);
  }
  return element("div", { class: "field-skeleton" });
}

function declared(node, declarations) {
  for (const [property, value] of Object.entries(declarations || {})) {
    node.style.setProperty(property, value);
  }
  return node;
}

function applyStylesheet(text) {
  let node = document.getElementById(STYLESHEET_ID);
  if (!node) {
    node = element("style", { id: STYLESHEET_ID });
    document.head.append(node);
  }
  node.textContent = text ? `.report-canvas {\n${text}\n}` : "";
}

function fieldStyle(reportField) {
  return reportField.style || {};
}

function frameClass(reportField) {
  const style = fieldStyle(reportField);
  const classes = ["field"];
  if (reportField.visual === "text") {
    classes.push("text");
    if (!reportField.title) {
      classes.push("untitled");
    }
  }
  if (style.frame === false) {
    classes.push("frameless");
  }
  if (style.header_background || style.header_text) {
    classes.push("headed");
  }
  if (style.stripe) {
    classes.push("striped");
  }
  if (style.vertical_align) {
    classes.push("aligned");
  }
  return classes.join(" ");
}

function frameVariables(reportField) {
  const style = fieldStyle(reportField);
  return {
    "--field-background": style.background,
    "--field-text": style.text,
    "--field-border": style.border,
    "--field-title": style.title_color,
    "--field-title-size": TITLE_SIZES[style.title_size],
    "--field-title-align": style.title_align,
    "--field-text-size": TEXT_SIZES[style.text_size],
    "--field-value-size": VALUE_SIZES[style.text_size],
    "--field-weight": WEIGHTS[style.text_weight],
    "--field-align": style.text_align,
    "--field-header-background": style.header_background,
    "--field-header-text": style.header_text,
    "--field-stripe": style.stripe,
    "--field-columns": Number.isInteger(style.columns) ? String(style.columns) : null,
    "--field-justify": JUSTIFY[style.vertical_align],
  };
}

function frameOf(reportField) {
  const { column, row, width, height } = reportField.position;
  const title = element("span", { class: "field-title", title: reportField.title }, reportField.title);
  const badges = element("span", { class: "field-badges" });
  const drill = element("div", { class: "field-drill", hidden: true });
  const note = element("div", { class: "field-notes" });
  const body = element("div", { class: "field-body" }, initialBody(reportField));
  const root = element(
    "div",
    {
      class: frameClass(reportField),
      dataset: { field: reportField.name },
      style: { gridColumn: `${column} / span ${width}`, gridRow: `${row} / span ${height}` },
    },
    element("div", { class: "field-header" }, title, badges, drill),
    body,
    note,
  );
  setVariables(root, frameVariables(reportField));
  const style = fieldStyle(reportField);
  declared(root, style.css);
  declared(title, style.title_css);
  declared(body, style.body_css);
  return { root, body, title, badges, drill, note, reportField, dispose: null, slicerSearch: "" };
}

function renderSkeleton(page) {
  disposeCharts();
  state.frames = new Map(page.fields.map((reportField) => [reportField.name, frameOf(reportField)]));
  const roots = [...state.frames.values()].map((frame) => frame.root);
  replaced(
    nodes.grid,
    roots.length ? roots : element("div", { class: "empty report-grid-empty" }, "Esta página ainda não tem campos. Peça ao seu Claude, pelo MCP, para montar alguns."),
  );
}

function numericClass(column) {
  return column.kind === "measure" || column.data_type === "number" ? "number" : null;
}

function totalText(value, column, index) {
  if (column.kind === "measure") {
    return formatCell(value, column);
  }
  return index === 0 ? "Total" : "";
}

function ruleColor(color) {
  return typeof color === "string" && HEX_COLOR.test(color) ? color : null;
}

function rowColor(result, index) {
  return ruleColor((result.colors || [])[index]);
}

function measureStyle(column, color) {
  return column.kind === "measure" && color ? { color } : null;
}

function seriesOf(reportField, column) {
  const styles = (reportField && reportField.series) || {};
  return styles[column.key] || {};
}

function cellColor(result, column, index) {
  const colors = (result.cell_colors || {})[column.key];
  return colors ? ruleColor(colors[index]) : null;
}

function valueColor(result, reportField, column, index) {
  return cellColor(result, column, index) || ruleColor(seriesOf(reportField, column).color) || rowColor(result, index);
}

function totalsColor(result, reportField, column) {
  const totals = (result.totals_cell_colors || {})[column.key];
  return ruleColor(totals) || ruleColor(seriesOf(reportField, column).color) || ruleColor(result.totals_color);
}

function columnPeaks(result) {
  return result.columns.map((column, index) =>
    column.kind === "measure" ? Math.max(0, ...result.rows.map((row) => Math.abs(Number(row[index]) || 0))) : 0,
  );
}

function dataBar(color, value, peak) {
  if (!color || typeof value !== "number" || peak <= 0) {
    return {};
  }
  const share = Math.min(100, (Math.abs(value) / peak) * 100).toFixed(1);
  return { backgroundImage: `linear-gradient(90deg, ${color} ${share}%, transparent ${share}%)` };
}

function signArrow(value) {
  if (typeof value !== "number" || value === 0) {
    return null;
  }
  const rising = value > 0;
  return element("span", { class: rising ? "cell-arrow rising" : "cell-arrow falling" }, icon(rising ? "arrow_up" : "arrow_down"));
}

function measureCell(result, reportField, column, value, rowIndex, peak) {
  const style = seriesOf(reportField, column);
  const color = valueColor(result, reportField, column, rowIndex);
  return element(
    "td",
    { class: "number", style: { ...(color ? { color } : {}), ...dataBar(style.data_bar, value, peak) } },
    style.arrows ? signArrow(value) : null,
    formatCell(value, column),
  );
}

function totalsRow(result, reportField) {
  return element(
    "tr",
    { class: "totals" },
    result.columns.map((column, index) =>
      element(
        "td",
        { class: numericClass(column), style: measureStyle(column, totalsColor(result, reportField, column)) },
        totalText(result.totals[index], column, index),
      ),
    ),
  );
}

function groupCount(result) {
  return result.columns.filter((column) => column.kind === "group").length;
}

function chartGroup(reportField, result) {
  return reportField.drill_down ? reportField.group_by[result.drill_level] || reportField.group_by[0] : reportField.group_by[0];
}

function tableGroups(reportField, result) {
  return reportField.drill_down ? [chartGroup(reportField, result)] : reportField.group_by;
}

function rowsSelectable(reportField, result) {
  const count = groupCount(result);
  return count > 0 && tableGroups(reportField, result).length === count;
}

function markSelectedRows(reportField) {
  const frame = state.frames.get(reportField.name);
  if (!frame) {
    return;
  }
  const keys = new Set(selectedValues(reportField.name, "rows").map(valueKey));
  for (const row of frame.body.querySelectorAll("tr.selectable")) {
    const selected = keys.has(row.dataset.key);
    row.classList.toggle("selected", selected);
    row.setAttribute("aria-selected", String(selected));
  }
}

function selectTableRow(reportField, result, groupValues, additive) {
  const rows = toggledValues(selectedValues(reportField.name, "rows"), groupValues, additive);
  const columns = result.columns.slice(0, groupCount(result));
  storeSelection(reportField.name, rowSelection(tableGroups(reportField, result), columns, rows));
  markSelectedRows(reportField);
}

function chooseOnKey(event, choose) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    choose(event);
  }
}

function tableCells(result, reportField, row, rowIndex, peaks) {
  return result.columns.map((column, index) =>
    column.kind === "measure"
      ? measureCell(result, reportField, column, row[index], rowIndex, peaks[index])
      : element("td", { class: numericClass(column) }, formatCell(row[index], column)),
  );
}

function selectableRow(reportField, result, row, selectedKeys, rowIndex, peaks) {
  const groupValues = row.slice(0, groupCount(result));
  const key = valueKey(groupValues);
  const selected = selectedKeys.has(key);
  const choose = (event) => selectTableRow(reportField, result, groupValues, event.ctrlKey || event.metaKey);
  return element(
    "tr",
    {
      class: selected ? "selectable selected" : "selectable",
      tabindex: "0",
      "aria-selected": String(selected),
      dataset: { key },
      onclick: choose,
      onkeydown: (event) => chooseOnKey(event, choose),
    },
    tableCells(result, reportField, row, rowIndex, peaks),
  );
}

function tableBody(result, reportField, interactive) {
  const peaks = columnPeaks(result);
  if (!reportField || !interactive || !rowsSelectable(reportField, result)) {
    return element("tbody", {}, result.rows.map((row, index) => element("tr", {}, tableCells(result, reportField, row, index, peaks))));
  }
  const selectedKeys = new Set(selectedValues(reportField.name, "rows").map(valueKey));
  return element(
    "tbody",
    { title: "Clique numa linha para filtrar a página. Ctrl+clique soma linhas." },
    result.rows.map((row, index) => selectableRow(reportField, result, row, selectedKeys, index, peaks)),
  );
}

function columnOption(value, column, checked) {
  const text = formatCell(value, column);
  const box = element("input", { type: "checkbox", checked });
  const root = element("label", { class: "slicer-option", title: text }, box, element("span", {}, text));
  return { root, box, value, text: searchable(text) };
}

function checkOptions(options, checked) {
  for (const item of options) {
    if (!item.root.hidden) {
      item.box.checked = checked;
    }
  }
}

function applyValueFilter(reportField, column, options) {
  const chosen = options.filter((item) => item.box.checked).map((item) => item.value);
  if (!chosen.length) {
    notify("Escolha ao menos um valor.", "error");
    return true;
  }
  const entry = chosen.length === options.length ? null : { key: column.key, values: chosen, column };
  storeColumnFilter(reportField.name, column.key, entry);
  return false;
}

function openValueFilter(reportField, result, column) {
  const values = (result.filter_values || {})[column.key] || [];
  const entry = columnFilters(reportField.name).get(column.key);
  const chosen = entry && entry.values ? entry.values : values;
  const options = values.map((value) => columnOption(value, column, containsValue(chosen, value)));
  const search = element("input", {
    type: "search",
    class: "slicer-search",
    placeholder: "Buscar…",
    "aria-label": "Buscar valores",
    oninput: (event) => filterOptions(options, event.currentTarget.value),
  });
  openDialog({
    title: `Filtrar ${column.title}`,
    body: element(
      "div",
      { class: "column-filter" },
      search,
      element(
        "div",
        { class: "slicer-actions" },
        element("button", { type: "button", class: "link", onclick: () => checkOptions(options, true) }, "Selecionar tudo"),
        element("button", { type: "button", class: "link", onclick: () => checkOptions(options, false) }, "Desmarcar"),
      ),
      element(
        "div",
        { class: "slicer-list column-filter-list", role: "group", "aria-label": column.title },
        options.length ? options.map((item) => item.root) : element("div", { class: "empty" }, "Sem valores para escolher."),
      ),
    ),
    actions: [
      { label: "Remover filtro", run: () => storeColumnFilter(reportField.name, column.key, null) },
      { label: "Aplicar", kind: "primary", run: () => applyValueFilter(reportField, column, options) },
    ],
  });
  search.focus();
}

function applyRangeFilter(reportField, column, inputs) {
  const bounds = orderedBounds(inputValue(inputs.low, "number"), inputValue(inputs.high, "number"));
  const empty = isMissing(bounds.low) && isMissing(bounds.high);
  const entry = empty ? null : { key: column.key, minimum: bounds.low, maximum: bounds.high, column };
  storeColumnFilter(reportField.name, column.key, entry);
}

function openRangeFilter(reportField, column) {
  const entry = columnFilters(reportField.name).get(column.key) || {};
  const inputs = {};
  const apply = () => applyRangeFilter(reportField, column, inputs);
  const dialog = { close: null };
  const applyAndClose = () => {
    apply();
    dialog.close();
  };
  inputs.low = rangeInput("number", entry.minimum, "Mínimo", applyAndClose);
  inputs.high = rangeInput("number", entry.maximum, "Máximo", applyAndClose);
  dialog.close = openDialog({
    title: `Filtrar ${column.title}`,
    body: element(
      "div",
      { class: "column-filter" },
      element("p", { class: "muted small" }, "Mostra só as linhas com o valor nesse intervalo. O total acompanha as linhas."),
      element("div", { class: "slicer-bounds" }, field("De", inputs.low), field("Até", inputs.high)),
    ),
    actions: [
      { label: "Remover filtro", run: () => storeColumnFilter(reportField.name, column.key, null) },
      { label: "Aplicar", kind: "primary", run: apply },
    ],
  }).close;
  inputs.low.focus();
}

function openColumnFilter(reportField, result, column) {
  if (column.kind === "measure") {
    openRangeFilter(reportField, column);
    return;
  }
  openValueFilter(reportField, result, column);
}

function filterButton(reportField, result, column) {
  const active = columnFilters(reportField.name).has(column.key);
  return element(
    "button",
    {
      type: "button",
      class: active ? "th-filter active" : "th-filter",
      title: active ? "Filtro ativo nesta coluna" : "Filtrar coluna",
      "aria-label": `Filtrar ${column.title}`,
      onclick: (event) => {
        event.stopPropagation();
        openColumnFilter(reportField, result, column);
      },
    },
    "▾",
  );
}

function headerCell(result, reportField, column, interactive) {
  const table = interactive && reportField && reportField.visual === "table";
  const direction = result.sort && result.sort.by === column.key ? result.sort.direction : null;
  const arrow = direction ? element("span", { class: "sort-arrow", "aria-hidden": "true" }, SORT_ARROWS[direction]) : null;
  const filter = table && reportField.column_filters ? filterButton(reportField, result, column) : null;
  const properties = { class: numericClass(column), "aria-sort": ARIA_SORTS[direction] || null };
  if (!table || reportField.column_sort === false) {
    return element("th", properties, element("span", { class: "th-label" }, column.title), arrow, filter);
  }
  return element(
    "th",
    properties,
    element(
      "span",
      { class: "th-content" },
      element(
        "button",
        { type: "button", class: "th-sort", title: "Ordenar por esta coluna", onclick: () => sortBy(reportField, result, column) },
        element("span", { class: "th-label" }, column.title),
        arrow,
      ),
      filter,
    ),
  );
}

function tableView(result, reportField, frame, interactive = true) {
  const columns = result.columns;
  const filtered = interactive && reportField && state.context.filters.has(reportField.name);
  if (!result.rows.length && !filtered) {
    return element("div", { class: "empty" }, "Sem linhas para exibir.");
  }
  return element(
    "table",
    { class: "data" },
    element("thead", {}, element("tr", {}, columns.map((column) => headerCell(result, reportField, column, interactive)))),
    tableBody(result, reportField, interactive),
    result.totals ? element("tfoot", {}, totalsRow(result, reportField)) : null,
  );
}

function cardClass(reportField) {
  const style = fieldStyle(reportField);
  const classes = ["cards", `labels-${style.label_position || "below"}`];
  if (Number.isInteger(style.columns)) {
    classes.push("gridded");
  }
  return classes.join(" ");
}

function cardItem(result, reportField, column, value) {
  const style = seriesOf(reportField, column);
  const color = valueColor(result, reportField, column, 0);
  const size = VALUE_SIZES[style.size];
  const label = column.title && column.title !== reportField.title ? element("div", { class: "card-label" }, column.title) : null;
  return element(
    "div",
    { class: "report-card" },
    label,
    element(
      "div",
      { class: "card-value", style: { ...(color ? { color } : {}), ...(size ? { fontSize: size } : {}) } },
      style.icon ? icon(style.icon) : null,
      element("span", { class: "card-number" }, formatCell(value, column)),
    ),
  );
}

function cardView(result, reportField) {
  const row = result.rows[0] || [];
  return element(
    "div",
    { class: cardClass(reportField) },
    result.columns.map((column, index) => (column.kind === "measure" ? cardItem(result, reportField, column, row[index]) : null)),
  );
}

function slicerValues(result) {
  return result.rows.map((row) => row[0]);
}

function searchable(text) {
  return String(text).normalize("NFKD").replace(COMBINING_MARKS, "").toLowerCase();
}

function toggleSlicerValue(reportField, column, value) {
  const values = toggledValues(selectedValues(reportField.name, "values"), value, true);
  storeSelection(reportField.name, valueSelection(reportField.group_by[0], column, values));
}

function slicerOption(reportField, column, value, checked) {
  const text = formatCell(value, column);
  const box = element("input", {
    type: "checkbox",
    checked,
    dataset: { key: valueKey(value) },
    onchange: () => toggleSlicerValue(reportField, column, value),
  });
  const root = element("label", { class: "slicer-option", title: text }, box, element("span", {}, text));
  return { root, box, value, text: searchable(text) };
}

function filterOptions(options, query) {
  const wanted = searchable(query.trim());
  for (const item of options) {
    item.root.hidden = Boolean(wanted) && !item.text.includes(wanted);
  }
}

function visibleValues(options) {
  return options.filter((item) => !item.root.hidden).map((item) => item.value);
}

function syncOptions(options, values) {
  for (const item of options) {
    item.box.checked = containsValue(values, item.value);
  }
}

function selectVisible(reportField, column, options) {
  const values = mergedValues(selectedValues(reportField.name, "values"), visibleValues(options));
  storeSelection(reportField.name, valueSelection(reportField.group_by[0], column, values));
  syncOptions(options, values);
}

function clearSlicer(reportField, options) {
  removeSelection(reportField.name);
  syncOptions(options, []);
}

function slicerSearch(frame, options) {
  const input = element("input", {
    type: "search",
    class: "slicer-search",
    placeholder: "Buscar…",
    "aria-label": "Buscar valores",
    value: frame.slicerSearch,
    oninput: (event) => {
      frame.slicerSearch = event.currentTarget.value;
      filterOptions(options, frame.slicerSearch);
    },
  });
  filterOptions(options, frame.slicerSearch);
  return input;
}

function slicerActions(reportField, column, options) {
  return element(
    "div",
    { class: "slicer-actions" },
    element("button", { type: "button", class: "link", onclick: () => selectVisible(reportField, column, options) }, "Selecionar tudo"),
    element("button", { type: "button", class: "link", onclick: () => clearSlicer(reportField, options) }, "Limpar"),
  );
}

function listSlicer(result, reportField, frame) {
  const column = result.columns[0];
  const chosen = selectedValues(reportField.name, "values");
  const options = slicerValues(result).map((value) => slicerOption(reportField, column, value, containsValue(chosen, value)));
  const searching = options.length > SEARCH_THRESHOLD;
  if (!searching) {
    frame.slicerSearch = "";
  }
  return element(
    "div",
    { class: "slicer slicer-checklist" },
    searching ? slicerSearch(frame, options) : null,
    slicerActions(reportField, column, options),
    element(
      "div",
      { class: "slicer-list", role: "group", "aria-label": column.title },
      options.length ? options.map((item) => item.root) : element("div", { class: "empty" }, "Sem valores para escolher."),
    ),
  );
}

function dropdownChoices(result, chosen) {
  const values = slicerValues(result);
  return [...chosen.filter((value) => !containsValue(values, value)), ...values];
}

function chooseDropdownValue(reportField, column, choices, choice) {
  const values = choice === "" ? [] : [choices[Number(choice)]];
  storeSelection(reportField.name, valueSelection(reportField.group_by[0], column, values));
}

function dropdownSlicer(result, reportField) {
  const column = result.columns[0];
  const chosen = selectedValues(reportField.name, "values");
  const choices = dropdownChoices(result, chosen);
  const current = chosen.length ? valueKey(chosen[0]) : null;
  return element(
    "div",
    { class: "slicer slicer-dropdown" },
    element(
      "select",
      {
        "aria-label": column.title,
        onchange: (event) => chooseDropdownValue(reportField, column, choices, event.currentTarget.value),
      },
      option("", "Todos", current === null),
      choices.map((value, index) => option(String(index), formatCell(value, column), valueKey(value) === current)),
    ),
  );
}

function rangeKind(column) {
  if (column.bucket) {
    return "date";
  }
  return RANGE_INPUTS[column.data_type] ? column.data_type : null;
}

function inputText(value, kind) {
  if (isMissing(value)) {
    return "";
  }
  const text = String(value).replace(" ", "T");
  return RANGE_LENGTHS[kind] ? text.slice(0, RANGE_LENGTHS[kind]) : text;
}

function inputValue(input, kind) {
  const text = input.value.trim();
  if (!text) {
    return null;
  }
  if (kind !== "number") {
    return text;
  }
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

function valueBounds(values) {
  const present = values.filter((value) => !isMissing(value));
  if (!present.length) {
    return { low: null, high: null };
  }
  return present.reduce(
    (bounds, value) => ({ low: value < bounds.low ? value : bounds.low, high: value > bounds.high ? value : bounds.high }),
    { low: present[0], high: present[0] },
  );
}

function orderedBounds(low, high) {
  if (!isMissing(low) && !isMissing(high) && low > high) {
    return { low: high, high: low };
  }
  return { low, high };
}

function applyRange(reportField, column, kind, inputs) {
  const bounds = orderedBounds(inputValue(inputs.low, kind), inputValue(inputs.high, kind));
  storeSelection(reportField.name, rangeSelection(reportField.group_by[0], column, bounds.low, bounds.high));
}

function rangeInput(kind, value, label, apply) {
  return element("input", {
    type: RANGE_INPUTS[kind],
    step: kind === "number" ? "any" : null,
    value: inputText(value, kind),
    "aria-label": label,
    onkeydown: (event) => {
      if (event.key === "Enter") {
        apply();
      }
    },
  });
}

function rangeSlicer(result, reportField) {
  const column = result.columns[0];
  const kind = rangeKind(column);
  const chosen = selectedValues(reportField.name, "range");
  const bounds = chosen.length ? { low: chosen[0], high: chosen[1] } : valueBounds(slicerValues(result));
  const inputs = {};
  const apply = () => applyRange(reportField, column, kind, inputs);
  inputs.low = rangeInput(kind, bounds.low, "Mínimo", apply);
  inputs.high = rangeInput(kind, bounds.high, "Máximo", apply);
  return element(
    "div",
    { class: "slicer slicer-range" },
    element("div", { class: "slicer-bounds" }, field("De", inputs.low), field("Até", inputs.high)),
    element(
      "div",
      { class: "slicer-actions" },
      element("button", { type: "button", class: "primary", onclick: apply }, "Aplicar"),
      element("button", { type: "button", onclick: () => removeSelection(reportField.name) }, "Limpar"),
    ),
  );
}

const SLICERS = {
  list: listSlicer,
  dropdown: dropdownSlicer,
  range: rangeSlicer,
};

function slicerMode(reportField, column) {
  if (reportField.slicer_mode === "range" && !rangeKind(column)) {
    return "list";
  }
  return SLICERS[reportField.slicer_mode] ? reportField.slicer_mode : "list";
}

function slicerView(result, reportField, frame) {
  const column = result.columns[0];
  if (!column || !reportField.group_by.length) {
    return errorView("O slicer precisa de uma coluna em group_by.");
  }
  describeSelection(reportField, result);
  return SLICERS[slicerMode(reportField, column)](result, reportField, frame);
}

const VIEWS = {
  card: cardView,
  table: tableView,
  slicer: slicerView,
  details: detailsView,
  text: (result, reportField) => textView(reportField, result),
};

function chartInteraction(reportField, result) {
  const interaction = {
    selectedValues: selectedValues(reportField.name, "values"),
    onSelect: ({ value, additive }) => selectChartValue(reportField, result, value, Boolean(additive)),
  };
  if (canDrill(reportField, result)) {
    interaction.onDrill = ({ value }) => drillInto(reportField, result, value);
  }
  return interaction;
}

function selectChartValue(reportField, result, value, additive) {
  const raw = isMissing(value) ? null : value;
  const values = toggledValues(selectedValues(reportField.name, "values"), raw, additive);
  storeSelection(reportField.name, valueSelection(chartGroup(reportField, result), result.columns[0], values));
}

function focusedKey(frame) {
  const active = document.activeElement;
  if (!active || !frame.body.contains(active) || !active.dataset) {
    return null;
  }
  return active.dataset.key || null;
}

function viewState(frame) {
  const list = frame.body.querySelector(".slicer-list");
  return {
    top: frame.body.scrollTop,
    left: frame.body.scrollLeft,
    listTop: list ? list.scrollTop : 0,
    key: focusedKey(frame),
  };
}

function restoreViewState(frame, view) {
  frame.body.scrollTop = view.top;
  frame.body.scrollLeft = view.left;
  const list = frame.body.querySelector(".slicer-list");
  if (list) {
    list.scrollTop = view.listTop;
  }
  if (view.key === null) {
    return;
  }
  const target = [...frame.body.querySelectorAll("[data-key]")].find((node) => node.dataset.key === view.key);
  if (target) {
    target.focus({ preventScroll: true });
  }
}

function truncatedText(reportField) {
  return reportField.visual === "slicer"
    ? "Lista truncada: só os primeiros valores aparecem."
    : "Resultado truncado: só as primeiras linhas aparecem. Filtre mais ou ajuste o limite.";
}

function renderVisual(frame, result) {
  const reportField = frame.reportField;
  clear(frame.body);
  if (DRAWN.has(reportField.visual)) {
    frame.body.classList.add("chart-body");
    frame.dispose = renderChart(frame.body, reportField, result, chartInteraction(reportField, result));
    return;
  }
  frame.body.append((VIEWS[reportField.visual] || tableView)(result, reportField, frame));
}

function resetFrame(frame) {
  disposeFrame(frame);
  frame.body.classList.remove("chart-body");
  clear(frame.note);
}

function fillFrame(frame, result) {
  const view = viewState(frame);
  resetFrame(frame);
  decorate(frame, result);
  if (!result) {
    replaced(frame.body, errorView("O servidor não devolveu este campo."));
    return;
  }
  if (result.error) {
    replaced(frame.body, errorView(result.error));
    return;
  }
  renderVisual(frame, result);
  if (result.truncated) {
    frame.note.append(element("div", { class: "field-note" }, truncatedText(frame.reportField)));
  }
  restoreViewState(frame, view);
}

function fillFrames(result) {
  const results = new Map((result.fields || []).map((item) => [item.name, item]));
  for (const frame of state.frames.values()) {
    if (computedField(frame.reportField)) {
      fillFrame(frame, results.get(frame.reportField.name));
    }
  }
}

function failFrames(error) {
  for (const frame of state.frames.values()) {
    if (computedField(frame.reportField)) {
      resetFrame(frame);
      replaced(frame.body, errorContent(error));
    }
  }
}

function runPage(pageName, context) {
  if (state.version) {
    return api.post(`/report-versions/${encoded(state.version.name)}/pages/${encoded(pageName)}/run`, {
      development: state.development,
      context,
    });
  }
  if (context === null) {
    return api.get(`/reports/${encoded(state.report.name)}/pages/${encoded(pageName)}`);
  }
  return api.post(`/reports/${encoded(state.report.name)}/pages/${encoded(pageName)}/run`, context);
}

async function loadPage(page) {
  state.loadSequence += 1;
  const sequence = state.loadSequence;
  try {
    const result = await runPage(page.name, contextPayload());
    if (sequence === state.loadSequence) {
      fillFrames(result);
    }
  } catch (error) {
    if (sequence === state.loadSequence) {
      failFrames(error);
    }
  } finally {
    if (sequence === state.loadSequence && !state.reloadTimer) {
      nodes.grid.classList.remove("reloading");
    }
  }
}

async function showPage(pageName) {
  const page = pageNamed(pageName) || state.report.document.pages[0];
  state.pageName = page.name;
  cancelReload();
  enterPage(page);
  syncHash();
  renderTabs();
  renderSkeleton(page);
  renderPills();
  await loadPage(page);
}

function openReport(name, pageName = null) {
  state.version = null;
  state.development = null;
  state.report = reportNamed(name);
  rememberReport(name);
  attachLayout();
  applyTheme(nodes.canvas, state.report.document.theme || null);
  applyShell(state.report.document.theme || null);
  applyStylesheet(state.report.document.stylesheet);
  renderSelect();
  renderHeading();
  return showPage(pageName);
}

async function reopen(name, pageName = null) {
  await refreshReports();
  if (!state.reports.length) {
    renderEmpty();
    return;
  }
  const target = reportNamed(name) ? name : state.reports[0].name;
  openReport(target, target === name ? pageName : null);
}

function switchReport(name) {
  openReport(name);
}

function servedDevelopment(version, development) {
  if (!development) {
    return null;
  }
  if ((version.developments || []).includes(development) && version.development_column) {
    return development;
  }
  notify(`A versão "${version.title}" não atende o empreendimento "${development}".`, "error");
  return null;
}

async function openVersion(name, development = null) {
  const version = await reportVersion(name);
  state.version = version;
  state.development = servedDevelopment(version, development);
  state.report = { name: version.name, document: version.document, revision: version.report_revision };
  resetContext();
  attachLayout();
  applyTheme(nodes.canvas, version.document.theme || null);
  applyShell(version.document.theme || null);
  applyStylesheet(version.document.stylesheet);
  renderSelect();
  renderHeading();
  await showPage(null);
}

function closeVersion() {
  const reportName = state.version ? state.version.report : null;
  resetContext();
  return reopen(reportName);
}

function chooseDevelopment(development) {
  state.development = development || null;
  return showPage(state.pageName);
}

function readOnlyVersion() {
  if (!state.version) {
    return false;
  }
  notify("Versões não mudam. Para editar, crie um branch a partir dela em Versões.", "info");
  return true;
}

async function openVersionsDialog() {
  if (!state.report) {
    return;
  }
  const report = reportNamed(state.version ? state.version.report : state.report.name);
  if (!report) {
    notify("O relatório desta versão não existe mais; as versões dele continuam salvas.", "info");
    return;
  }
  await showVersionsDialog(report, {
    onOpen: (name) => openVersion(name),
    onBranch: (name) => reopen(name),
  });
}

function workbookPath() {
  if (!state.version) {
    return `/reports/${encoded(state.report.name)}/export.xlsx`;
  }
  const query = state.development ? `?development=${encoded(state.development)}` : "";
  return `/report-versions/${encoded(state.version.name)}/export.xlsx${query}`;
}

function exportScope() {
  if (!state.version) {
    return `do relatório "${state.report.document.title}"`;
  }
  const developments = state.development ? `para ${state.development}` : "com todos os empreendimentos";
  return `da versão "${state.version.title}" ${developments}`;
}

function slicerText(value, column) {
  return typeof value === "number" && !column.bucket ? String(value) : formatCell(value, column);
}

function printedSlicer(result, reportField) {
  const column = result.columns[0];
  if (!column) {
    return null;
  }
  const values = slicerValues(result);
  if (slicerMode(reportField, column) === "range") {
    const bounds = valueBounds(values);
    return element("div", { class: "print-slicer" }, `De ${slicerText(bounds.low, column)} até ${slicerText(bounds.high, column)}`);
  }
  const text =
    values.length > PRINT_SLICER_VALUES
      ? `Todos (${values.length})`
      : values.map((value) => slicerText(value, column)).join(", ") || "Sem valores.";
  return element("div", { class: "print-slicer" }, text);
}

const PRINTED_VIEWS = {
  card: cardView,
  slicer: printedSlicer,
  details: detailsView,
  text: (result, reportField) => textView(reportField, result),
};

function printedVisual(frame, result) {
  const reportField = frame.reportField;
  if (DRAWN.has(reportField.visual)) {
    frame.body.classList.add("chart-body");
    frame.dispose = renderChart(frame.body, reportField, result, PRINT_CHART);
    return;
  }
  const view = PRINTED_VIEWS[reportField.visual];
  frame.body.append(view ? view(result, reportField) : tableView(result, reportField, frame, false));
}

function fillPrintedFrame(frame, result) {
  if (!computedField(frame.reportField)) {
    return;
  }
  slicerTitle(frame, result);
  clear(frame.body);
  if (!result) {
    frame.body.append(errorView("O servidor não devolveu este campo."));
    return;
  }
  if (result.error) {
    frame.body.append(errorView(result.error));
    return;
  }
  printedVisual(frame, result);
  if (result.truncated) {
    frame.note.append(element("div", { class: "field-note" }, truncatedText(frame.reportField)));
  }
}

function printedFrame(reportField) {
  const frame = frameOf(reportField);
  const { column, row, width, height } = reportField.position;
  frame.root.style.setProperty("grid-column", `${column} / span ${width}`, "important");
  frame.root.style.setProperty("grid-row", `${row} / span ${height}`, "important");
  return frame;
}

function printTheme() {
  const theme = state.report.document.theme || {};
  return { ...theme, mode: theme.mode || "light" };
}

function printHeading(moment) {
  const origin = state.version
    ? `Versão "${state.version.title}" · ${state.development || "Todos os empreendimentos"}`
    : `${state.report.name} · revisão ${state.report.revision}`;
  return element(
    "div",
    { class: "print-heading" },
    element("strong", {}, state.report.document.title),
    element("span", {}, `${origin} · gerado em ${moment}`),
  );
}

function printedPage(page, result, moment) {
  const frames = page.fields.map(printedFrame);
  const canvas = element(
    "div",
    { class: "report-canvas print-canvas" },
    element(
      "div",
      { class: "report-grid" },
      frames.map((frame) => frame.root),
    ),
  );
  applyTheme(canvas, printTheme());
  const root = element(
    "section",
    { class: "print-page" },
    element("header", { class: "print-header" }, printHeading(moment), element("h1", {}, page.title)),
    canvas,
  );
  return { root, frames, result };
}

function removePrintView() {
  if (!state.printView) {
    return;
  }
  for (const frame of state.printView.frames) {
    disposeFrame(frame);
  }
  state.printView.root.remove();
  state.printView = null;
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

async function buildPrintView() {
  const pages = [];
  for (const page of state.report.document.pages) {
    pages.push({ page, result: await runPage(page.name, INITIAL_CONTEXT) });
  }
  removePrintView();
  const moment = formatDateTime(new Date().toISOString());
  const sheets = pages.map(({ page, result }) => printedPage(page, result, moment));
  const root = element(
    "div",
    { class: "print-view" },
    sheets.map((sheet) => sheet.root),
  );
  document.body.append(root);
  state.printView = { root, frames: sheets.flatMap((sheet) => sheet.frames) };
  for (const sheet of sheets) {
    const results = new Map((sheet.result.fields || []).map((item) => [item.name, item]));
    for (const frame of sheet.frames) {
      fillPrintedFrame(frame, results.get(frame.reportField.name));
    }
  }
  await document.fonts.ready;
  await nextFrame();
  await nextFrame();
}

async function printReport() {
  notify("Montando o PDF com todas as páginas…", "info");
  await buildPrintView();
  window.addEventListener("afterprint", removePrintView, { once: true });
  window.print();
}

function openExportDialog() {
  if (!state.report) {
    return;
  }
  showExportDialog({
    title: state.version ? state.version.title : state.report.document.title,
    scope: exportScope(),
    onWorkbook: () => downloadFile(workbookPath()),
    onPrint: printReport,
  });
}

function blankDocument(title) {
  return {
    title,
    description: "",
    filters: [],
    pages: [
      {
        name: "pagina_1",
        title: "Página 1",
        filters: [],
        fields: [
          {
            name: "titulo",
            title: "",
            visual: "text",
            position: { column: 1, row: 1, width: 12, height: 1 },
            text: title,
          },
        ],
      },
    ],
  };
}

function creationProblems(controls) {
  const title = controls.titleInput.value.trim();
  const name = controls.nameInput.value.trim();
  const problems = validated([
    [controls.titleInput, requiredProblem(title, "Título") || lengthProblem(title, "Título", TITLE_LIMIT)],
    [controls.nameInput, identifierProblem(name, "Nome") || duplicateProblem(name)],
  ]);
  if (problems.length) {
    return problems;
  }
  return documentProblems(blankDocument(title));
}

async function createReport(controls) {
  const problems = creationProblems(controls);
  replaced(controls.problems, problemList(problems));
  if (problems.length) {
    return true;
  }
  const name = controls.nameInput.value.trim();
  try {
    await api.post("/reports", { name, document: blankDocument(controls.titleInput.value.trim()) });
    await reopen(name);
    notify("Relatório criado.", "success");
    return false;
  } catch (error) {
    replaced(controls.problems, errorContent(error));
    return true;
  }
}

function openCreateDialog() {
  const titleInput = element("input", { type: "text", placeholder: "Ex.: Carteira de recebíveis" });
  const nameInput = element("input", { type: "text", placeholder: "carteira_de_recebiveis" });
  const problems = element("div", {});
  let nameEdited = false;
  titleInput.addEventListener("input", () => {
    if (!nameEdited) {
      nameInput.value = titleInput.value.trim() ? slugified(titleInput.value) : "";
    }
  });
  nameInput.addEventListener("input", () => {
    nameEdited = nameInput.value !== "";
  });
  const controls = { titleInput, nameInput, problems };
  openDialog({
    title: "Novo relatório",
    body: [
      field("Título", titleInput),
      field("Nome", nameInput, "Identificador: letras minúsculas, números e _. Sugerido a partir do título."),
      element("p", { class: "muted small" }, "O relatório começa em branco. Páginas e campos são montados pelo seu Claude, pelo MCP."),
      problems,
    ],
    actions: [
      { label: "Cancelar", run: () => {} },
      { label: "Criar", kind: "primary", run: () => createReport(controls) },
    ],
  });
  titleInput.focus();
}

async function saveDocument(reportName, editor, problems) {
  const parsed = parsedJson(editor.value);
  const found = parsed.problem ? [parsed.problem] : documentProblems(parsed.value);
  validated([[editor, found[0] || null]]);
  replaced(problems, problemList(found));
  if (found.length) {
    return true;
  }
  try {
    await api.put(`/reports/${encoded(reportName)}`, parsed.value);
    await reopen(reportName, state.pageName);
    notify("Relatório salvo.", "success");
    return false;
  } catch (error) {
    markInvalid(editor, error.message);
    replaced(problems, errorContent(error));
    return true;
  }
}

function openEditDialog() {
  if (!state.report || readOnlyVersion()) {
    return;
  }
  const reportName = state.report.name;
  const editor = element("textarea", { class: "code report-json", rows: 26, spellcheck: "false", value: pretty(state.report.document) });
  const problems = element("div", {});
  openDialog({
    title: `Editar JSON · ${state.report.document.title}`,
    wide: true,
    body: [editor, problems],
    actions: [
      { label: "Cancelar", run: () => {} },
      { label: "Salvar", kind: "primary", run: () => saveDocument(reportName, editor, problems) },
    ],
  });
}

async function restoreRevision(reportName, revisionNumber, problems, dialogHandle) {
  try {
    await api.post(`/reports/${encoded(reportName)}/revisions/${revisionNumber}/restore`);
    dialogHandle.close();
    await reopen(reportName, state.pageName);
    notify(`Revisão ${revisionNumber} restaurada.`, "success");
  } catch (error) {
    replaced(problems, errorContent(error));
  }
}

async function toggleChanges(report, revision, holder) {
  if (!holder.hidden) {
    holder.hidden = true;
    return;
  }
  if (!holder.childNodes.length) {
    const changes = await api.get(`/reports/${encoded(report.name)}/revisions/${revision.revision}/changes`);
    replaced(holder, differenceList(changes.differences, changes.truncated));
  }
  holder.hidden = false;
}

function revisionView(report, revision, problems, dialogHandle) {
  const changes = element("div", { class: "revision-changes", hidden: true });
  const changesButton = element(
    "button",
    { type: "button", class: "link", onclick: (event) => busy(event.currentTarget, () => toggleChanges(report, revision, changes)) },
    "Ver mudanças",
  );
  const current = revision.revision === report.revision;
  const action = current
    ? element("span", { class: "badge success revision-current" }, "Atual")
    : element(
        "button",
        {
          type: "button",
          dataset: { requires: "edit_reports" },
          onclick: (event) => busy(event.currentTarget, () => restoreRevision(report.name, revision.revision, problems, dialogHandle)),
        },
        "Restaurar",
      );
  return element(
    "div",
    { class: "revision" },
    element(
      "div",
      { class: "revision-head" },
      element("strong", {}, `Revisão ${revision.revision}`),
      element("span", { class: revision.source === "agent" ? "badge accent" : "badge" }, SOURCE_LABELS[revision.source] || revision.source),
      authorTag(revision),
      element("span", { class: "muted small" }, formatDateTime(revision.created_at)),
      changesButton,
      action,
    ),
    revision.instruction ? element("div", { class: "small revision-text" }, element("strong", {}, "Instrução: "), revision.instruction) : null,
    revision.explanation ? element("div", { class: "small muted revision-text" }, revision.explanation) : null,
    changes,
  );
}

function groupColumn(reportField, group) {
  const key = groupKey(group);
  return { key, kind: "group", title: (reportField.labels || {})[key] || group.column, bucket: group.bucket || null };
}

function filterColumn(reportField, key) {
  const group = (reportField.group_by || []).find((item) => groupKey(item) === key);
  if (group) {
    return groupColumn(reportField, group);
  }
  return { key, kind: "measure", title: (reportField.labels || {})[key] || key };
}

function rowValues(group) {
  return group.conditions.map((item) => (item.operator === "is_null" ? null : item.value));
}

function listedValues(condition) {
  return condition.operator === "in" ? condition.values : [condition.value];
}

const COMPARISON_VALUES = {
  equal: (condition) => ({ mode: "values", values: [condition.value] }),
  in: (condition) => ({ mode: "values", values: condition.values }),
  is_null: () => ({ mode: "values", values: [null] }),
  between: (condition) => ({ mode: "range", values: condition.values }),
  greater_or_equal: (condition) => ({ mode: "range", values: [condition.value, null] }),
  less_or_equal: (condition) => ({ mode: "range", values: [null, condition.value] }),
};

function groupedValues(condition) {
  const parts = condition.conditions || [];
  if (condition.logic === "all") {
    return { mode: "rows", values: [rowValues(condition)] };
  }
  const listed = parts.find((item) => item.kind === "comparison" && (item.operator === "in" || item.operator === "equal"));
  const missing = parts.find((item) => item.kind === "comparison" && item.operator === "is_null");
  if (parts.length === 2 && listed && missing) {
    return { mode: "values", values: [...listedValues(listed), null] };
  }
  if (parts.every((item) => item.kind === "group" && item.logic === "all")) {
    return { mode: "rows", values: parts.map(rowValues) };
  }
  return null;
}

function conditionValues(condition) {
  if (condition.kind === "comparison") {
    const read = COMPARISON_VALUES[condition.operator];
    return read ? read(condition) : null;
  }
  return condition.kind === "group" ? groupedValues(condition) : null;
}

function restoredSelection(reportField, conditions) {
  const columns = (reportField.group_by || []).map((group) => groupColumn(reportField, group));
  const parsed = conditions.length === 1 ? conditionValues(conditions[0]) : null;
  if (!parsed) {
    return { mode: "custom", values: ["…"], columns: columns.slice(0, 1), conditions };
  }
  return { ...parsed, columns: parsed.mode === "rows" ? columns : columns.slice(0, 1), conditions };
}

function viewContext(page, payload) {
  const context = emptyContext();
  const touch = (reportField) => context.signatures.set(reportField.name, fieldSignature(reportField));
  for (const reportField of slicersOf(page)) {
    context.initialized.add(reportField.name);
    touch(reportField);
  }
  for (const selection of payload.selections || []) {
    const reportField = pageField(page, selection.source);
    if (reportField) {
      context.selections.set(selection.source, restoredSelection(reportField, selection.conditions));
      touch(reportField);
    }
  }
  for (const [name, values] of Object.entries(payload.drills || {})) {
    const reportField = pageField(page, name);
    if (reportField) {
      context.drills.set(
        name,
        values.map((value, index) => ({ value, column: groupColumn(reportField, reportField.group_by[index] || reportField.group_by[0]) })),
      );
      touch(reportField);
    }
  }
  for (const [name, entries] of Object.entries(payload.filters || {})) {
    const reportField = pageField(page, name);
    if (reportField) {
      context.filters.set(name, new Map(entries.map((entry) => [entry.key, { ...entry, column: filterColumn(reportField, entry.key) }])));
      touch(reportField);
    }
  }
  for (const [name, sort] of Object.entries(payload.sorts || {})) {
    const reportField = pageField(page, name);
    if (reportField) {
      context.sorts.set(name, sort);
      touch(reportField);
    }
  }
  return context;
}

function applyView(view) {
  const page = pageNamed(view.page);
  if (!page) {
    notify(`A página da visão "${view.title}" não existe mais.`, "error");
    return Promise.resolve();
  }
  loadContexts();
  const context = viewContext(page, view.context || {});
  for (const reportField of slicersOf(page)) {
    if (reportField.sync_group) {
      state.synced.set(reportField.sync_group, context.selections.get(reportField.name) || null);
    }
  }
  state.contexts.set(page.name, context);
  saveContexts();
  return showPage(page.name);
}

async function saveView(report, title) {
  const text = title.trim();
  if (!text) {
    notify("Dê um nome para a visão.", "error");
    return true;
  }
  const view = { name: slugified(text), title: text, page: state.pageName, context: contextPayload() };
  await api.put(`/reports/${encoded(report.name)}/views`, view);
  notify(`Visão "${text}" salva para todos.`, "success");
  await reopen(report.name, state.pageName);
  return false;
}

async function removeView(report, view, close) {
  const confirmed = await confirmAction(`Excluir a visão "${view.title}"?`, "Excluir");
  if (!confirmed) {
    return;
  }
  await api.remove(`/reports/${encoded(report.name)}/views/${encoded(view.name)}`);
  close();
  notify("Visão excluída.", "success");
  await reopen(report.name, state.pageName);
}

function pageTitle(name) {
  const page = pageNamed(name);
  return page ? page.title : name;
}

function viewRow(report, view, dialog) {
  return element(
    "div",
    { class: "revision" },
    element(
      "div",
      { class: "revision-head" },
      element("strong", {}, view.title),
      element("span", { class: "muted small" }, `página ${pageTitle(view.page)}`),
      element(
        "button",
        {
          type: "button",
          onclick: (event) =>
            busy(event.currentTarget, async () => {
              dialog.close();
              await applyView(view);
            }),
        },
        "Aplicar",
      ),
      state.version
        ? null
        : element(
            "button",
            { type: "button", class: "danger", dataset: { requires: "edit_reports" }, onclick: (event) => busy(event.currentTarget, () => removeView(report, view, dialog.close)) },
            "Excluir",
          ),
    ),
  );
}

function openViewsDialog() {
  if (!state.report) {
    return;
  }
  const report = state.report;
  const views = report.document.views || [];
  const title = element("input", { type: "text", maxlength: TITLE_LIMIT, placeholder: "Ex.: Sul, ano corrente" });
  const dialog = { close: () => {} };
  const editable = !state.version && can("edit_reports");
  dialog.close = openDialog({
    title: `Visões · ${report.document.title}`,
    body: [
      element(
        "p",
        { class: "muted small" },
        "Uma visão guarda as escolhas de uma página (slicers, cliques, níveis, filtros e ordem das tabelas) com um nome. Ela fica no relatório e aparece para todos.",
      ),
      views.length ? views.map((view) => viewRow(report, view, dialog)) : element("div", { class: "empty" }, "Nenhuma visão salva."),
      editable ? field("Salvar a tela atual como", title, `Página ${pageTitle(state.pageName)}. Um nome que já existe é substituído.`) : null,
    ],
    actions: editable
      ? [
          { label: "Fechar", run: () => {} },
          { label: "Salvar visão", kind: "primary", run: () => saveView(report, title.value) },
        ]
      : [{ label: "Fechar", run: () => {} }],
  }).close;
}

async function openHistoryDialog() {
  if (!state.report || readOnlyVersion()) {
    return;
  }
  const report = state.report;
  const revisions = await api.get(`/reports/${encoded(report.name)}/revisions`);
  const ordered = [...revisions].sort((first, second) => second.revision - first.revision);
  const problems = element("div", {});
  const dialogHandle = {};
  Object.assign(
    dialogHandle,
    openDialog({
      title: `Histórico · ${report.document.title}`,
      body: [
        problems,
        ordered.length
          ? ordered.map((revision) => revisionView(report, revision, problems, dialogHandle))
          : element("div", { class: "empty" }, "Sem revisões."),
      ],
      actions: [{ label: "Fechar", run: () => {} }],
    }),
  );
}

async function deleteReport() {
  if (!state.report || readOnlyVersion()) {
    return;
  }
  const report = state.report;
  const confirmed = await confirmAction(
    `Excluir o relatório "${report.document.title}"? Esta ação não pode ser desfeita.`,
    "Excluir",
  );
  if (!confirmed) {
    return;
  }
  await api.remove(`/reports/${encoded(report.name)}`);
  forgetReport(report.name);
  notify("Relatório excluído.", "success");
  await reopen(null);
}

function toolbarButton(label, work, kind) {
  return element(
    "button",
    { type: "button", class: kind || "", onclick: (event) => busy(event.currentTarget, work) },
    label,
  );
}

function buildLayout(container) {
  nodes.container = container;
  nodes.select = element("select", {
    class: "report-select",
    "aria-label": "Relatório",
    onchange: (event) => switchReport(event.currentTarget.value),
  });
  nodes.toolbar = element(
    "div",
    { class: "report-toolbar" },
    nodes.select,
    element("button", { class: "primary", type: "button", onclick: openCreateDialog, dataset: { requires: "edit_reports" } }, "Novo relatório"),
    requiring("edit_reports", toolbarButton("Editar JSON", openEditDialog)),
    toolbarButton("Histórico", openHistoryDialog),
    toolbarButton("Versões", openVersionsDialog),
    toolbarButton("Visões", openViewsDialog),
    toolbarButton("Exportar", openExportDialog),
    publishButton(() => state.report),
    requiring("edit_reports", toolbarButton("Excluir", deleteReport, "danger")),
  );
  nodes.heading = element("div", { class: "report-heading" });
  nodes.tabs = element("nav", { class: "page-tabs" });
  nodes.pills = element("div", { class: "filter-pills", role: "region", "aria-label": "Filtros ativos", hidden: true });
  nodes.grid = element("div", { class: "report-grid" });
  nodes.canvas = element("div", { class: "report-canvas" }, nodes.pills, nodes.grid);
  nodes.body = element("div", { class: "report-body" }, nodes.canvas);
}

function visible() {
  return nodes.container.classList.contains("active");
}

async function followReports() {
  const previous = state.report;
  try {
    await refreshReports();
  } catch (error) {
    notifyError(error);
    return false;
  }
  if (!state.reports.length) {
    renderEmpty();
    return true;
  }
  if (state.version) {
    renderSelect();
    return false;
  }
  const current = previous ? reportNamed(previous.name) : null;
  if (!current) {
    await openReport(state.reports[0].name);
    return true;
  }
  if (current.revision !== previous.revision) {
    await openReport(current.name, state.pageName);
    return true;
  }
  state.report = current;
  renderSelect();
  return false;
}

async function applyLiveChanges() {
  state.liveTimer = null;
  const { report, data } = state.pending;
  state.pending = { report: false, data: false };
  if (!visible()) {
    return;
  }
  if (report && (await followReports())) {
    return;
  }
  if (data && state.report && pageNamed(state.pageName)) {
    scheduleReload();
  }
}

function liveChange(event) {
  state.pending = {
    report: state.pending.report || REPORT_ENTITIES.has(event.entity),
    data: state.pending.data || DATA_ENTITIES.has(event.entity),
  };
  clearTimeout(state.liveTimer);
  state.liveTimer = setTimeout(applyLiveChanges, LIVE_DELAY);
}

function requestedTarget(argument) {
  const [reportName, pageName] = String(argument || "").split("/");
  return { reportName: reportName || null, pageName: pageName || null };
}

function requestedVersion(argument) {
  const text = String(argument || "");
  if (!text.startsWith(VERSION_MARK)) {
    return null;
  }
  const [name, ...rest] = text.slice(VERSION_MARK.length).split("/");
  return { name, development: rest.join("/") || null };
}

function keptVersion(argument) {
  if (argument || !state.version) {
    return null;
  }
  return { name: state.version.name, development: state.development };
}

async function showVersion(requested) {
  try {
    await openVersion(requested.name, requested.development);
    return true;
  } catch (error) {
    notify(`A versão "${requested.name}" não abriu: ${error.message}`, "error");
    return false;
  }
}

async function show(argument) {
  try {
    await refreshReports();
  } catch (error) {
    notifyError(error);
    renderFailure(error);
    return;
  }
  if (!state.reports.length) {
    renderEmpty();
    return;
  }
  const version = requestedVersion(argument) || keptVersion(argument);
  if (version && (await showVersion(version))) {
    return;
  }
  const requested = version ? requestedTarget(null) : requestedTarget(argument);
  if (requested.reportName && !reportNamed(requested.reportName)) {
    notify(`O relatório "${requested.reportName}" não existe.`, "error");
  }
  const previous = state.report ? state.report.name : null;
  const name = [requested.reportName, previous, rememberedReport(), state.reports[0].name].find(
    (candidate) => candidate && reportNamed(candidate),
  );
  const pageName = requested.pageName || (name === previous ? state.pageName : null);
  await openReport(name, pageName);
}

export function mount(container) {
  buildLayout(container);
  onChange(liveChange);
  return { show };
}
