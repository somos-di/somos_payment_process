import { element } from "./dom.js";

const KIND_LABELS = {
  added: "incluído",
  removed: "removido",
  changed: "alterado",
};

const VALUE_LIMIT = 160;

function valueText(value) {
  if (value === null || value === undefined) {
    return "—";
  }
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > VALUE_LIMIT ? `${text.slice(0, VALUE_LIMIT)}…` : text;
}

function differenceItem(difference) {
  return element(
    "li",
    { class: `difference ${difference.kind}` },
    element("span", { class: "badge difference-kind" }, KIND_LABELS[difference.kind] || difference.kind),
    element("code", { class: "difference-path" }, difference.path || "(documento)"),
    difference.kind === "added" ? null : element("span", { class: "difference-before", title: "Antes" }, valueText(difference.before)),
    difference.kind === "changed" ? element("span", { class: "difference-arrow", "aria-hidden": "true" }, "→") : null,
    difference.kind === "removed" ? null : element("span", { class: "difference-after", title: "Depois" }, valueText(difference.after)),
  );
}

export function differenceList(differences, truncated = false) {
  if (!differences.length) {
    return element("div", { class: "muted small" }, "Nada mudou.");
  }
  return element(
    "div",
    { class: "difference-block" },
    element("ul", { class: "differences" }, differences.map(differenceItem)),
    truncated ? element("div", { class: "muted small" }, "Lista cortada: há mais mudanças nesta revisão.") : null,
  );
}

export function authorTag(item) {
  if (!item.author_name) {
    return null;
  }
  return element("span", { class: "muted small", title: item.author_id || "" }, `por ${item.author_name}`);
}
