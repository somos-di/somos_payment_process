const PROPERTIES = new Set(["value", "checked", "selected", "disabled", "textContent", "htmlFor", "readOnly", "multiple"]);

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

function appended(node, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) {
      continue;
    }
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

function assigned(node, properties, svg) {
  for (const [key, value] of Object.entries(properties || {})) {
    if (value === null || value === undefined || value === false) {
      continue;
    }
    if (key === "class") {
      node.setAttribute("class", value);
    } else if (key === "dataset") {
      Object.assign(node.dataset, value);
    } else if (key === "style" && typeof value === "object") {
      Object.assign(node.style, value);
    } else if (key.startsWith("on") && typeof value === "function") {
      node.addEventListener(key.slice(2), value);
    } else if (!svg && PROPERTIES.has(key)) {
      node[key] = value;
    } else {
      node.setAttribute(key, value === true ? "" : String(value));
    }
  }
  return node;
}

export function element(tag, properties = {}, ...children) {
  return appended(assigned(document.createElement(tag), properties, false), children);
}

export function svgElement(tag, properties = {}, ...children) {
  return appended(assigned(document.createElementNS(SVG_NAMESPACE, tag), properties, true), children);
}

export function clear(node) {
  while (node.firstChild) {
    node.firstChild.remove();
  }
  return node;
}

export function replaced(node, ...children) {
  return appended(clear(node), children);
}

export function notify(message, kind = "info") {
  const container = document.getElementById("toasts");
  const toast = element("div", { class: `toast ${kind}` }, message);
  container.append(toast);
  setTimeout(() => toast.remove(), kind === "error" ? 9000 : 4000);
}

export function notifyError(error) {
  const problems = error && Array.isArray(error.problems) ? error.problems : [];
  const message = error && error.message ? error.message : String(error);
  notify(problems.length ? `${message}\n• ${problems.join("\n• ")}` : message, "error");
}

export function problemList(problems) {
  if (!problems || !problems.length) {
    return null;
  }
  return element("ul", { class: "problems" }, problems.map((problem) => element("li", {}, problem)));
}

export function errorContent(error) {
  const message = error && error.message ? error.message : String(error);
  const problems = error && Array.isArray(error.problems) ? error.problems : [];
  return element("div", { class: "field-error" }, element("div", {}, message), problemList(problems));
}

export function openDialog({ title, body, actions = [], wide = false, onClose }) {
  const dialog = element("dialog", { style: wide ? { width: "min(1100px, calc(100vw - 32px))" } : null });
  const close = () => {
    dialog.close();
    dialog.remove();
    if (onClose) {
      onClose();
    }
  };
  const footer = element("div", { class: "dialog-footer" });
  for (const action of actions) {
    footer.append(
      element(
        "button",
        {
          class: action.kind || "",
          type: "button",
          onclick: async (event) => {
            const button = event.currentTarget;
            const keepOpen = await busy(button, () => action.run({ close, dialog }));
            if (keepOpen !== true && action.closes !== false) {
              close();
            }
          },
        },
        action.label,
      ),
    );
  }
  dialog.append(
    element(
      "div",
      { class: "dialog-header" },
      element("h3", {}, title),
      element("button", { class: "link", type: "button", onclick: close, "aria-label": "Fechar" }, "✕"),
    ),
    element("div", { class: "dialog-body" }, body),
    actions.length ? footer : null,
  );
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    close();
  });
  document.body.append(dialog);
  dialog.showModal();
  return { dialog, close };
}

export function confirmAction(message, label = "Confirmar") {
  return new Promise((resolve) => {
    let answered = false;
    openDialog({
      title: "Confirmação",
      body: element("p", {}, message),
      onClose: () => {
        if (!answered) {
          resolve(false);
        }
      },
      actions: [
        { label: "Cancelar", run: () => {} },
        {
          label,
          kind: "primary",
          run: () => {
            answered = true;
            resolve(true);
          },
        },
      ],
    });
  });
}

export async function busy(button, work) {
  const label = button.textContent;
  button.disabled = true;
  try {
    return await work();
  } catch (error) {
    notifyError(error);
    return true;
  } finally {
    button.disabled = false;
    button.textContent = label;
  }
}

export function field(label, control, hint) {
  return element("label", {}, element("span", {}, label), control, hint ? element("small", { class: "muted small" }, hint) : null);
}

export function option(value, label, selected = false) {
  return element("option", { value, selected }, label);
}

export function pretty(value) {
  return JSON.stringify(value, null, 2);
}
