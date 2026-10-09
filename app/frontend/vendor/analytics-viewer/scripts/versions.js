import { api, encoded } from "./api.js";
import { busy, element, errorContent, field, notify, openDialog, option, problemList, replaced } from "./dom.js";
import { formatDateTime, formatPlain } from "./format.js";
import { authorTag, differenceList } from "./history.js";
import { identifierProblem, lengthProblem, requiredProblem, slugified, validated } from "./validation.js";

const TITLE_LIMIT = 200;

const DESCRIPTION_LIMIT = 4000;

export function reportVersions(reportName) {
  return api.get(`/report-versions?report=${encoded(reportName)}`);
}

export function reportVersion(name) {
  return api.get(`/report-versions/${encoded(name)}`);
}

function columnKey(column) {
  return `${column.table}.${column.column}`;
}

function slicerColumns(reportDocument) {
  const found = new Map();
  for (const page of reportDocument.pages) {
    for (const item of page.fields) {
      if (item.visual !== "slicer") {
        continue;
      }
      for (const group of item.group_by || []) {
        const key = columnKey(group);
        if (!found.has(key)) {
          found.set(key, { table: group.table, column: group.column, label: item.title ? `${item.title} (${key})` : key });
        }
      }
    }
  }
  return [...found.values()];
}

function developmentList(text) {
  return [
    ...new Set(
      String(text || "")
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

function versionProblems(controls, versions) {
  const title = controls.titleInput.value.trim();
  const name = controls.nameInput.value.trim();
  const taken = versions.some((version) => version.name === name) ? `Já existe uma versão chamada "${name}".` : null;
  return validated([
    [controls.titleInput, requiredProblem(title, "Título") || lengthProblem(title, "Título", TITLE_LIMIT)],
    [controls.nameInput, identifierProblem(name, "Nome") || taken],
    [controls.descriptionInput, lengthProblem(controls.descriptionInput.value, "Descrição", DESCRIPTION_LIMIT)],
  ]);
}

function versionPayload(report, controls, columns) {
  const column = columns.find((item) => columnKey(item) === controls.columnSelect.value);
  return {
    report: report.name,
    name: controls.nameInput.value.trim(),
    title: controls.titleInput.value.trim(),
    description: controls.descriptionInput.value.trim(),
    developments: developmentList(controls.developmentsInput.value),
    development_column: column ? { kind: "column", table: column.table, column: column.column } : null,
    parent: controls.parentSelect.value || null,
  };
}

function versionForm(report, versions, onSaved) {
  const columns = slicerColumns(report.document);
  const titleInput = element("input", { type: "text", placeholder: "Ex.: Vendas para Y e Z" });
  const nameInput = element("input", { type: "text", placeholder: "vendas_y_z" });
  const descriptionInput = element("textarea", {
    rows: 3,
    placeholder: "Ex.: Investidor conta como venda líquida.",
  });
  const developmentsInput = element("textarea", { rows: 3, placeholder: "Um empreendimento por linha" });
  const columnSelect = element(
    "select",
    {},
    option("", "Nenhuma"),
    columns.map((column) => option(columnKey(column), column.label)),
  );
  const parentSelect = element(
    "select",
    {},
    option("", "Nenhuma"),
    versions.map((version) => option(version.name, `${version.title} (${version.name})`)),
  );
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
  const controls = { titleInput, nameInput, descriptionInput, developmentsInput, columnSelect, parentSelect };

  async function save() {
    const found = versionProblems(controls, versions);
    replaced(problems, problemList(found));
    if (found.length) {
      return;
    }
    try {
      const saved = await api.post("/report-versions", versionPayload(report, controls, columns));
      notify(`Versão "${saved.title}" salva.`, "success");
      await onSaved();
    } catch (error) {
      replaced(problems, errorContent(error));
    }
  }

  return element(
    "section",
    { class: "version-form", dataset: { requires: "edit_reports" } },
    element("h3", {}, "Salvar esta versão"),
    element(
      "p",
      { class: "muted small" },
      "Congela o relatório e todas as medidas que ele usa. Mudanças posteriores no relatório ou nas medidas não alteram a versão.",
    ),
    field("Título", titleInput),
    field("Nome", nameInput, "Identificador: letras minúsculas, números e _. Sugerido a partir do título."),
    field("Descrição", descriptionInput),
    field("Empreendimentos", developmentsInput, "Os empreendimentos que esta versão atende, um por linha."),
    field("Coluna do empreendimento", columnSelect, "Usada para calcular a versão de um empreendimento só."),
    field("Versão de origem", parentSelect, "Preencha quando esta versão veio de um branch."),
    problems,
    element("button", { class: "primary", type: "button", onclick: (event) => busy(event.currentTarget, save) }, "Salvar versão"),
  );
}

function branchDialog(version, onBranch) {
  const nameInput = element("input", { type: "text", value: slugified(`${version.name}_branch`) });
  const problems = element("div", {});

  async function create() {
    const name = nameInput.value.trim();
    const found = validated([[nameInput, identifierProblem(name, "Nome do relatório")]]);
    replaced(problems, problemList(found));
    if (found.length) {
      return true;
    }
    try {
      await api.post(`/report-versions/${encoded(version.name)}/branch`, { report: name });
      notify(`Branch "${name}" criado a partir de "${version.title}".`, "success");
      await onBranch(name);
      return false;
    } catch (error) {
      replaced(problems, errorContent(error));
      return true;
    }
  }

  openDialog({
    title: `Criar branch · ${version.title}`,
    body: [
      element(
        "p",
        { class: "muted small" },
        "Cria um relatório editável idêntico à versão. As medidas vão junto, como medidas do próprio relatório: mudar o branch não altera as medidas globais, o relatório de origem nem a versão.",
      ),
      field("Nome do novo relatório", nameInput),
      problems,
    ],
    actions: [
      { label: "Cancelar", run: () => {} },
      { label: "Criar branch", kind: "primary", run: create },
    ],
  });
  nameInput.focus();
}

function versionItem(version, actions) {
  const developments = version.developments || [];
  return element(
    "div",
    { class: "version-item" },
    element(
      "div",
      { class: "version-item-head" },
      element("strong", {}, version.title),
      element("span", { class: "muted small" }, version.name),
      element("span", { class: "muted small" }, formatDateTime(version.created_at)),
      authorTag(version),
      element(
        "span",
        { class: "version-item-actions" },
        element("button", { type: "button", onclick: () => actions.open(version) }, "Abrir"),
        element("button", { type: "button", dataset: { requires: "edit_reports" }, onclick: () => actions.branch(version) }, "Criar branch"),
        element("button", { type: "button", onclick: () => actions.compare(version) }, "Comparar"),
      ),
    ),
    version.description ? element("div", { class: "small version-item-text" }, version.description) : null,
    element(
      "div",
      { class: "version-item-badges" },
      developments.map((item) => element("span", { class: "badge" }, item)),
      element("span", { class: "badge accent" }, `${version.measure_count} medidas congeladas`),
      element("span", { class: "muted small" }, `revisão ${version.report_revision} de ${version.report}`),
      version.parent ? element("span", { class: "muted small" }, `origem: ${version.parent}`) : null,
    ),
  );
}

function comparedText(value) {
  if (value === null || value === undefined) {
    return "—";
  }
  return typeof value === "number" ? formatPlain(value) : String(value);
}

function comparedRow(item) {
  const sign = item.difference > 0 ? "positive" : item.difference < 0 ? "negative" : "";
  return element(
    "tr",
    { class: item.equal ? "compared-equal" : "compared-different" },
    element("td", {}, item.label),
    element("td", {}, item.measure),
    element("td", { class: "number" }, comparedText(item.left)),
    element("td", { class: "number" }, comparedText(item.right)),
    element("td", { class: `number ${sign}` }, item.difference === null || item.difference === undefined ? "" : comparedText(item.difference)),
  );
}

function comparedField(comparison, compared, showEqual) {
  const items = showEqual ? compared.items : compared.items.filter((item) => !item.equal);
  const different = compared.items.filter((item) => !item.equal).length;
  return element(
    "section",
    { class: "compared-field" },
    element(
      "h4",
      {},
      `${compared.page_title} · ${compared.title || compared.field}`,
      element("span", { class: different ? "badge danger" : "badge success" }, different ? `${different} diferença(s)` : "igual"),
    ),
    items.length
      ? element(
          "table",
          { class: "data" },
          element(
            "thead",
            {},
            element(
              "tr",
              {},
              element("th", {}, "Linha"),
              element("th", {}, "Medida"),
              element("th", { class: "number" }, comparison.left_title),
              element("th", { class: "number" }, comparison.right_title),
              element("th", { class: "number" }, "Diferença"),
            ),
          ),
          element("tbody", {}, items.map(comparedRow)),
        )
      : null,
    compared.truncated ? element("div", { class: "muted small" }, "Mostrando as primeiras linhas.") : null,
  );
}

function comparisonView(comparison, showEqual) {
  return [
    element("h4", {}, "Mudanças no relatório e nas medidas"),
    differenceList(comparison.differences),
    element("h4", {}, "Números"),
    comparison.fields.length
      ? comparison.fields.map((compared) => comparedField(comparison, compared, showEqual))
      : element("div", { class: "empty" }, "Nenhum campo em comum para comparar."),
  ];
}

function compareDialog(version, versions) {
  const other = element(
    "select",
    { "aria-label": "Comparar com" },
    option("", "Relatório atual", true),
    versions.filter((item) => item.name !== version.name).map((item) => option(item.name, `${item.title} (${item.name})`)),
  );
  const development = element(
    "select",
    { "aria-label": "Empreendimento" },
    option("", "Todos os empreendimentos", true),
    (version.developments || []).map((item) => option(item, item)),
  );
  const showEqual = element("input", { type: "checkbox" });
  const result = element("div", { class: "comparison" });
  let current = null;
  const render = () => {
    if (current) {
      replaced(result, comparisonView(current, showEqual.checked));
    }
  };
  showEqual.addEventListener("change", render);
  const run = async () => {
    const query = new URLSearchParams();
    if (other.value) {
      query.set("other", other.value);
    }
    if (development.value) {
      query.set("development", development.value);
    }
    replaced(result, element("span", { class: "working" }, "Comparando…"));
    try {
      current = await api.get(`/report-versions/${encoded(version.name)}/compare?${query}`);
      render();
    } catch (error) {
      replaced(result, errorContent(error));
    }
    return true;
  };
  openDialog({
    title: `Comparar ${version.title}`,
    wide: true,
    body: [
      element(
        "div",
        { class: "compare-controls" },
        field("Comparar com", other),
        field("Empreendimento", development),
        element("label", { class: "compare-equal" }, showEqual, " Mostrar também o que é igual"),
      ),
      result,
    ],
    actions: [
      { label: "Fechar", run: () => {} },
      { label: "Comparar", kind: "primary", run },
    ],
  });
  run();
}

export async function showVersionsDialog(report, { onOpen, onBranch }) {
  const body = element("div", { class: "versions-dialog" });
  const dialogHandle = {};

  async function render() {
    const versions = await reportVersions(report.name);
    const actions = {
      open: async (version) => {
        dialogHandle.close();
        await onOpen(version.name);
      },
      compare: (version) => compareDialog(version, versions),
      branch: (version) => branchDialog(version, async (name) => {
        dialogHandle.close();
        await onBranch(name);
      }),
    };
    replaced(
      body,
      element(
        "section",
        { class: "version-list" },
        element("h3", {}, "Versões salvas"),
        versions.length
          ? versions.map((version) => versionItem(version, actions))
          : element("div", { class: "empty" }, "Nenhuma versão salva deste relatório."),
      ),
      versionForm(report, versions, render),
    );
  }

  await render();
  Object.assign(
    dialogHandle,
    openDialog({
      title: `Versões · ${report.document.title}`,
      wide: true,
      body: [body],
      actions: [{ label: "Fechar", run: () => {} }],
    }),
  );
}
