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
        
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>',
        run: function (p) { window.location.hash = '#/editar-processo?uuid=' + p.uuid_prc; return Promise.resolve(); }
      },
    ],
  });
}
