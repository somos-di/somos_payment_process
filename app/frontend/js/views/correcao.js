// Correções — processos devolvidos (status 2) do autor. Ação "Corrigir" abre o editor.
async function initView_correcao() {
  await window.ProcessList.mount(document.getElementById('cor-host'), {
    emptyText: 'Você não tem processos em correção.',
    load: function () {
      return window.SB.select('v_processes', function (q) {
        return q.eq('status_step_prc', window.CONFIG.STATUS.correcao).order('id_prc', { ascending: false });
      });
    },
    actions: [
      {
        label: 'Corrigir', cls: 'btn-primary',
        run: function (p) { window.location.hash = '#/editar-processo?uuid=' + p.uuid_prc; return Promise.resolve(); }
      },
    ],
  });
}
