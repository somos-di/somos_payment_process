import { api, encoded } from "./api.js";
import { busy, element, errorContent, field, notify, openDialog, option, replaced } from "./dom.js";
import { formatDateTime } from "./format.js";
import { can } from "./permissions.js";

const DEFAULT_BUCKET = "relatorios";

const DEFAULT_TABLE = "relatorios";

const DEFAULT_SCHEMA = "public";

function targetSummary(target) {
  if (!target) {
    return element("p", { class: "field-error" }, "O destino ainda não foi configurado. Configure antes de publicar.");
  }
  return element(
    "p",
    { class: "muted small" },
    `Envia para ${target.project_url}, bucket "${target.bucket}" e tabela "${target.table_schema}.${target.table}". Atualizado em ${formatDateTime(target.updated_at)}.`,
  );
}

async function targetPanel(container) {
  if (!can("manage_connections")) {
    replaced(container);
    return;
  }
  try {
    const target = await api.get("/publication-target");
    replaced(
      container,
      element("h4", {}, "Destino no site (Supabase)"),
      targetSummary(target),
      element("button", { type: "button", onclick: () => openTargetDialog(target, () => targetPanel(container)) }, target ? "Trocar destino" : "Configurar destino"),
    );
  } catch (error) {
    replaced(container, errorContent(error));
  }
}

export function openTargetDialog(current, onSaved = () => {}) {
  const controls = {
    url: element("input", { type: "text", placeholder: "https://seu-projeto.supabase.co", value: current ? current.project_url : "" }),
    key: element("input", { type: "text", class: "dataset-code secret-input", autocomplete: "off", spellcheck: "false" }),
    bucket: element("input", { type: "text", value: current ? current.bucket : DEFAULT_BUCKET }),
    table: element("input", { type: "text", value: current ? current.table : DEFAULT_TABLE }),
    schema: element("input", { type: "text", value: current ? current.table_schema : DEFAULT_SCHEMA }),
  };
  openDialog({
    title: "Destino da publicação",
    body: [
      element("p", { class: "muted small" }, "A chave fica criptografada no servidor e nunca mais é exibida, nem aqui nem pelo MCP. Use uma chave que só consiga gravar no bucket e na tabela de relatórios."),
      field("URL do projeto", controls.url),
      field("Chave do Supabase", controls.key, current ? "Para trocar o destino, informe a chave de novo." : null),
      element("div", { class: "grid-two" }, field("Bucket", controls.bucket), field("Tabela", controls.table)),
      field("Schema da tabela", controls.schema, "O schema precisa estar em Exposed schemas, nas configurações da API do Supabase."),
    ],
    onClose: () => {
      controls.key.value = "";
    },
    actions: [
      { label: "Cancelar", run: () => {} },
      {
        label: "Salvar destino",
        kind: "primary",
        run: async () => {
          await api.put("/publication-target", {
            project_url: controls.url.value.trim(),
            key: controls.key.value.trim(),
            bucket: controls.bucket.value.trim(),
            table: controls.table.value.trim(),
            table_schema: controls.schema.value.trim(),
          });
          notify("Destino da publicação salvo.", "success");
          onSaved();
        },
      },
    ],
  });
}

function sentSummary(sent) {
  const when = sent.created_at ? formatDateTime(sent.created_at) : "agora";
  return `${sent.development} publicado em ${when}: ${sent.states} combinações de data, ${(sent.size / 1e6).toFixed(1)} MB em ${sent.bucket}/${sent.path}.`;
}

function suggested(developments, title) {
  const lowered = title.toLowerCase();
  return developments.find((name) => lowered.includes(name.split(" - ")[0].trim().toLowerCase())) || developments[0];
}

export async function openPublishDialog(report) {
  const developments = await api.get("/publications/developments");
  const preferred = suggested(developments, report.document.title);
  const choice = element("select", {}, developments.map((name) => option(name, name, name === preferred)));
  const target = element("div", { class: "publication-target" });
  targetPanel(target);
  openDialog({
    title: "Publicar no site",
    body: [
      element("p", { class: "muted small" }, "Calcula o relatório só para o empreendimento escolhido e envia com a data de hoje. No site, só os filtros de data continuam interativos; o resto fica fixo. Leva cerca de um minuto."),
      developments.length ? field("Empreendimento", choice) : element("p", { class: "field-error" }, "Nenhum empreendimento encontrado na tabela de obras."),
      target,
    ],
    actions: [
      { label: "Cancelar", run: () => {} },
      {
        label: "Publicar",
        kind: "primary",
        run: async () => {
          const sent = await api.post(`/reports/${encoded(report.name)}/publications`, { development: choice.value });
          notify(sentSummary(sent), "success");
        },
      },
    ],
  });
}

export function publishButton(currentReport) {
  return element(
    "button",
    { type: "button", dataset: { requires: "edit_reports" }, onclick: (event) => busy(event.currentTarget, () => openPublishDialog(currentReport())) },
    "Publicar",
  );
}
