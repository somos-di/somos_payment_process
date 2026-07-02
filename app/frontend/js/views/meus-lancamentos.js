// Meus Lançamentos — processos criados pelo usuário (author = eu). View-only +
// CANCELAR (irreversível): só permitido enquanto status_step_prc ∈ (1,2)
// (Aguardando aprovação / Em correção). Cancelar zera o processo (status 0).
async function initView_meus_lancamentos() {
  var me = (window.Auth && window.Auth.getUser && window.Auth.getUser()) || null;
  var myId = me && me.id;

  await window.ProcessList.mount(document.getElementById('ml-host'), {
    emptyText: 'Você ainda não criou nenhum lançamento.',
    dateField: 'due_date_prc',
    load: function () {
      return window.SB.select('v_processes', function (q) {
        if (myId) q = q.eq('author_prc', myId);
        return q.order('id_prc', { ascending: false });
      });
    },
    actions: [
      {
        label: 'Cancelar', cls: 'btn-danger',
        confirm: 'Cancelar este lançamento? Esta ação é IRREVERSÍVEL.',
        // só aparece em Aguardando aprovação ou Em correção
        show: function (p) { return p.status_step_prc === window.CONFIG.STATUS.aguardando || p.status_step_prc === window.CONFIG.STATUS.correcao; },
        run: function (p) { return window.API.post('/processes/' + p.uuid_prc + '/cancel'); },
      },
    ],
  });
}
