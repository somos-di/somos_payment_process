import { api } from "./api.js";
import { busy, element, notify, openDialog } from "./dom.js";

const REVOKE_DELAY = 1000;

function saveFile(file) {
  const address = URL.createObjectURL(file.blob);
  const anchor = element("a", { href: address, download: file.name, hidden: true });
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(address), REVOKE_DELAY);
}

export async function downloadFile(path) {
  const file = await api.file(path);
  saveFile(file);
  notify(`Arquivo "${file.name}" baixado.`, "success");
}

function exportChoice(name, text, label, run) {
  return element(
    "div",
    { class: "export-choice" },
    element("div", { class: "export-choice-text" }, element("strong", {}, name), element("p", { class: "muted small" }, text)),
    element("button", { type: "button", class: "primary", onclick: (event) => busy(event.currentTarget, run) }, label),
  );
}

export function showExportDialog({ title, scope, onWorkbook, onPrint }) {
  const dialogHandle = {};
  Object.assign(
    dialogHandle,
    openDialog({
      title: `Exportar · ${title}`,
      body: [
        element(
          "p",
          { class: "muted small" },
          `Exporta todas as páginas ${scope}, no estado inicial: cliques e seleções feitos nesta tela não entram.`,
        ),
        element(
          "div",
          { class: "export-choices" },
          exportChoice("Excel", "Uma aba por página. Gráficos saem como tabelas com os seus números.", "Baixar Excel", async () => {
            await onWorkbook();
            dialogHandle.close();
          }),
          exportChoice(
            "PDF",
            'As páginas como aparecem na tela, uma por folha A4 deitada. Na janela de impressão, escolha "Salvar como PDF".',
            "Gerar PDF",
            async () => {
              dialogHandle.close();
              await onPrint();
            },
          ),
        ),
      ],
      actions: [{ label: "Fechar", run: () => {} }],
    }),
  );
}
