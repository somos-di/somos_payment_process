import { element, errorContent, replaced } from "../dom.js";
import { formatDateTime } from "../format.js";
import { mount } from "../reports.js";
import { loadSnapshot } from "./api.js";

const BLOCKED_EVENTS = ["click", "dblclick", "mousedown", "pointerdown", "change", "input", "keydown", "contextmenu"];

const FROZEN = "published-frozen";

function interactiveFields(snapshot) {
  return new Set(Object.values(snapshot.pages).flatMap((page) => page.interactive || []));
}

function frozenField(target, live) {
  const field = target instanceof Element ? target.closest(".report-grid [data-field]") : null;
  return field !== null && !live.has(field.dataset.field);
}

function markFields(live) {
  for (const field of document.querySelectorAll(".report-grid [data-field]")) {
    field.classList.toggle(FROZEN, !live.has(field.dataset.field));
  }
}

function freeze(live) {
  for (const type of BLOCKED_EVENTS) {
    document.addEventListener(
      type,
      (event) => {
        if (!frozenField(event.target, live)) {
          return;
        }
        event.stopPropagation();
        event.preventDefault();
      },
      { capture: true },
    );
  }
  new MutationObserver(() => markFields(live)).observe(document.body, { childList: true, subtree: true });
}

async function start() {
  document.body.classList.toggle("embedded", window.self !== window.top);
  const container = document.getElementById("view-reports");
  try {
    const snapshot = await loadSnapshot();
    document.title = snapshot.report.document.title;
    replaced(document.getElementById("published-at"), `Dados de ${formatDateTime(snapshot.published_at)}`);
    freeze(interactiveFields(snapshot));
    await mount(container).show(snapshot.report.name);
  } catch (error) {
    replaced(container, element("div", { class: "panel" }, errorContent(error)));
  }
}

start();
