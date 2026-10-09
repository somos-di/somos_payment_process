export const REFRESHED = "refreshed";

export const EXPIRED = "expired";

export const UNREACHABLE = "unreachable";

const SOURCE = new URLSearchParams(location.search).get("snapshot") || "snapshot.json";

const REPORT = /^\/reports\/([^/]+)$/;

const PAGE = /^\/reports\/([^/]+)\/pages\/([^/]+)$/;

const RUN = /^\/reports\/([^/]+)\/pages\/([^/]+)\/run$/;

const MISSING_STATE =
  "Esta combinação não foi calculada na publicação. Use uma seleção por vez ou limpe as seleções para voltar.";

export class ApiError extends Error {
  constructor(message, status, problems = []) {
    super(message);
    this.status = status;
    this.problems = problems;
  }
}

let loading = null;

export function loadSnapshot() {
  if (!loading) {
    loading = fetch(SOURCE).then(async (response) => {
      if (!response.ok) {
        throw new ApiError("Não encontrei os dados desta publicação.", response.status);
      }
      return response.json();
    });
  }
  return loading;
}

function canonical(value) {
  if (Array.isArray(value)) {
    return `[${value.map(canonical).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value === undefined ? null : value);
}

function bySource(left, right) {
  if (left.source === right.source) {
    return 0;
  }
  return left.source < right.source ? -1 : 1;
}

export function stateKey(context) {
  return canonical({
    selections: [...(context.selections || [])].sort(bySource),
  });
}

const EMPTY = stateKey({});

function onlyInteractive(context, interactive) {
  return { selections: (context.selections || []).filter((item) => interactive.includes(item.source)) };
}

function unavailable() {
  return new ApiError("Esta função não existe na versão publicada.", 404);
}

function publishedReport(snapshot) {
  return { ...snapshot.report, document: { ...snapshot.report.document, remember_selections: false } };
}

function pageOf(snapshot, name) {
  const page = snapshot.pages[name];
  if (!page) {
    throw new ApiError(`A página "${name}" não está nesta publicação.`, 404);
  }
  return page;
}

async function read(path) {
  const snapshot = await loadSnapshot();
  const route = path.split("?")[0];
  if (route === "/reports") {
    return [publishedReport(snapshot)];
  }
  if (route === "/report-versions") {
    return [];
  }
  if (REPORT.test(route)) {
    return publishedReport(snapshot);
  }
  const page = PAGE.exec(route);
  if (page) {
    return pageOf(snapshot, decodeURIComponent(page[2])).initial;
  }
  throw unavailable();
}

async function run(path, body) {
  const snapshot = await loadSnapshot();
  const match = RUN.exec(path.split("?")[0]);
  if (!match) {
    throw unavailable();
  }
  const page = pageOf(snapshot, decodeURIComponent(match[2]));
  const key = stateKey(onlyInteractive(body || {}, page.interactive || []));
  if (key === EMPTY) {
    return page.initial;
  }
  const identifiers = page.states[key];
  if (!identifiers) {
    return { ...page.initial, fields: page.initial.fields.map(missingState) };
  }
  return { ...page.initial, fields: identifiers.map((identifier) => page.results[identifier]) };
}

function missingState(field) {
  if (field.visual === "slicer") {
    return field;
  }
  return { ...field, rows: [], totals: null, error: MISSING_STATE };
}

async function refused() {
  throw unavailable();
}

export async function request(method, path, body) {
  if (method === "GET") {
    return read(path);
  }
  if (method === "POST") {
    return run(path, body);
  }
  return refused();
}

export async function fileRequest() {
  return refused();
}

export const api = {
  get: (path) => read(path),
  post: (path, body = {}) => run(path, body),
  put: refused,
  patch: refused,
  remove: refused,
  file: refused,
};

export function encoded(value) {
  return encodeURIComponent(value);
}

export function signIn() {}

export function refreshSession() {
  return Promise.resolve(REFRESHED);
}

export async function signOut() {}
