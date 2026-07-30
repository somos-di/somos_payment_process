async function initView_meus_lancamentos() {
  var currentUser = (window.Auth && window.Auth.getUser && window.Auth.getUser()) || null;
  var myId = currentUser && currentUser.id;

  await window.ProcessList.mount(document.getElementById('ml-host'), {
    emptyText: 'Você ainda não criou nenhum lançamento.',
    dateField: 'due_date_prc',
    load: function () {
      return window.SB.select('v_processes', function (query) {
        if (myId) query = query.eq('author_prc', myId);
        return query.order('id_prc', { ascending: false });
      });
    },
    actions: [
      {
        label: 'Editar', cls: 'btn-primary',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>',
        show: function (p) { return p.status_step_prc === window.CONFIG.STATUS.aguardando; },
        run: function (p) { window.location.hash = '#/editar-processo?uuid=' + p.uuid_prc; return Promise.resolve(); },
      },
      {
        label: 'Cancelar', cls: 'btn-danger',
        prompt: 'Cancelar este lançamento? Esta ação é IRREVERSÍVEL.',
        effect: 'update',
        show: function (p) { return p.status_step_prc === window.CONFIG.STATUS.aguardando || p.status_step_prc === window.CONFIG.STATUS.correcao; },
        run: function (p, reason) {
          return window.API.post('/processes/' + p.uuid_prc + '/cancel', { reason: reason })
            .then(function (r) { window.invalidateFlowCaches(); return r; });
        },
      },
    ],
  });
}
