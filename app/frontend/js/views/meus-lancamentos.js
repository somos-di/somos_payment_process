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
        prompt: 'Cancelar este lançamento? Esta ação é IRREVERSÍVEL.', 
        
        show: function (p) { return p.status_step_prc === window.CONFIG.STATUS.aguardando || p.status_step_prc === window.CONFIG.STATUS.correcao; },
        run: function (p, reason) {
          return window.API.post('/processes/' + p.uuid_prc + '/cancel', { reason: reason })
            .then(function (r) { window.invalidateFlowCaches(); return r; }); 
        },
      },
    ],
  });
}
