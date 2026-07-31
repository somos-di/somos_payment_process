(function () {
  var S = window.Store, SB = window.SB;

  S.register('processes', function (kind) {
    return SB.select('v_processes', function (query) {
      if (kind) query = query.eq('kind_prc', Number(kind));
      return query.order('id_prc', { ascending: false });
    });
  });
  S.register('financeiro', function () {
    return SB.select('v_financeiro', function (query) { return query.order('due_date_prc', { ascending: true }); });
  });
  S.register('financeiro_integrados', function () {
    return SB.select('v_financeiro_integrados', function (query) { return query.order('id_prc', { ascending: false }); });
  });
  S.register('pending_approvals', function () { return SB.rpc('my_pending_approvals'); });
  S.register('my_approvals', function () { return SB.select('v_my_approvals', function (query) { return query.order('approved_at_app', { ascending: false }); }); });
  S.register('no_approver', function () { return SB.select('v_processes_no_approver'); });
  S.register('processes_admin', function () {
    return SB.select('v_processes_admin', function (query) { return query.order('id_prc', { ascending: false }); });
  });
  S.register('commissions', function () {
    return SB.select('v_commissions', function (query) { return query.order('id_com', { ascending: false }); });
  });
  S.register('comm_status', function () {
    return SB.select('comm_status_kind', function (query) { return query.order('id_csk'); });
  });
  S.register('comm_empreendimentos', function () {
    return SB.select('v_comm_empreendimentos', function (query) { return query.order('name_cem'); });
  });
  S.register('comm_history', function (uuid) {
    return SB.select('v_comm_history', function (query) { return query.eq('commission_chs', uuid).order('created_at_chs', { ascending: false }); });
  });

  S.register('installments', function (uuid) {
    return SB.select('installments', function (query) { return query.eq('process_ins', uuid).order('number_ins'); });
  });
  
  S.register('history', function (uuid) {
    return SB.select('v_process_history', function (query) { return query.eq('process_hst', uuid).order('created_at_hst', { ascending: false }).order('id_hst', { ascending: false }); });
  });
  S.register('approvers', function (uuid) { return SB.rpc('completed_approvals', { p_uuid: uuid }); });
  S.register('eligible_approvers', function (uuid) { return SB.rpc('eligible_approvers', { p_uuid: uuid }); });
  S.register('next_levels', function (uuid) { return SB.rpc('next_levels', { p_uuid: uuid }); });

  S.register('uau_tables', function () { return SB.select('uau_tables', function (query) { return query.order('id_uat'); }); });
  S.register('companies', function () { return SB.select('companies'); });
  S.register('cost_centers', function () { return SB.select('cost_centers'); });
  S.register('persons', function () { return SB.select('persons'); });
  S.register('process_kinds', function () { return SB.select('process_kinds', function (query) { return query.order('name_pkn'); }); });
  
  S.register('launchable_kinds', function () { return SB.rpc('my_launchable_kinds'); });
  S.register('document_kinds', function () { return SB.select('document_kinds', function (query) { return query.order('name_dck'); }); });

  
  S.register('empresas', function () { return SB.select('v_empresas', function (query) { return query.order('nome'); }); });
  S.register('obras', function (empresa) { return SB.select('v_obras', function (query) { return query.eq('empresa', empresa).order('nome'); }); });
  S.register('compositions_lk', function (key) {
    var parts = String(key).split('|'); 
    return SB.select('compositions', function (query) { return query.eq('empresa_cins', Number(parts[0])).ilike('obra_cins', parts[1]).limit(2000); });
  });
  S.register('fornecedores', function (term) {
    return SB.select('v_fornecedores', function (query) {
      if (term) query = query.or('nome.ilike.%' + term + '%,cpf_cnpj.ilike.%' + term + '%');
      return query.order('nome').limit(100);
    });
  });
})();
