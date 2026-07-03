// ============================================================================
// data.js — registra no Store COMO buscar cada entidade (queries/RPC supabase).
// Carrega depois de supabase-client.js e store.js.
// ============================================================================
(function () {
  var S = window.Store, SB = window.SB;

  // lê de v_processes (nomes resolvidos dos espelhos UAU); a RLS (security_invoker) vale.
  S.register('processes', function (kind) {
    return SB.select('v_processes', function (q) {
      if (kind) q = q.eq('kind_prc', Number(kind));
      return q.order('id_prc', { ascending: false });
    });
  });
  S.register('financeiro', function () {
    return SB.select('v_financeiro', function (q) { return q.order('due_date_prc', { ascending: true }); });
  });
  S.register('pending_approvals', function () { return SB.rpc('my_pending_approvals'); });
  S.register('my_approvals', function () { return SB.select('v_my_approvals', function (q) { return q.order('approved_at_app', { ascending: false }); }); });
  S.register('no_approver', function () { return SB.select('v_processes_no_approver'); });

  S.register('installments', function (uuid) {
    return SB.select('installments', function (q) { return q.eq('process_ins', uuid).order('number_ins'); });
  });
  // histórico enriquecido (resolve quem fez); mais recente primeiro p/ a timeline.
  S.register('history', function (uuid) {
    return SB.select('v_process_history', function (q) { return q.eq('process_hst', uuid).order('created_at_hst', { ascending: false }); });
  });
  S.register('approvers', function (uuid) { return SB.rpc('completed_approvals', { p_uuid: uuid }); });
  S.register('eligible_approvers', function (uuid) { return SB.rpc('eligible_approvers', { p_uuid: uuid }); });
  S.register('next_levels', function (uuid) { return SB.rpc('next_levels', { p_uuid: uuid }); });

  S.register('uau_tables', function () { return SB.select('uau_tables', function (q) { return q.order('id_uat'); }); });
  S.register('companies', function () { return SB.select('companies'); });
  S.register('cost_centers', function () { return SB.select('cost_centers'); });
  S.register('persons', function () { return SB.select('persons'); });
  S.register('process_kinds', function () { return SB.select('process_kinds', function (q) { return q.order('name_pkn'); }); });
  // tipos que o usuário logado pode LANÇAR (grupo lançador restringe; padrão = todos)
  S.register('launchable_kinds', function () { return SB.rpc('my_launchable_kinds'); });
  S.register('document_kinds', function () { return SB.select('document_kinds', function (q) { return q.order('name_dck'); }); });
  // status_kind não é registrado aqui: o catálogo de status vem normalizado do backend
  // (GET /catalog/status -> CONFIG.STEPS + CONFIG.STATUS no boot).

  // tabelas de ESCOLHA (cascatas) — cacheadas até ação destrutiva (ex.: sync UAU).
  S.register('empresas', function () { return SB.select('v_empresas', function (q) { return q.order('nome'); }); });
  S.register('obras', function (empresa) { return SB.select('v_obras', function (q) { return q.eq('empresa', empresa).order('nome'); }); });
  S.register('compositions_lk', function (key) {
    var a = String(key).split('|'); // "empresa|obra"
    return SB.select('compositions', function (q) { return q.eq('empresa_cins', Number(a[0])).ilike('obra_cins', a[1]).limit(2000); });
  });
  S.register('fornecedores', function (term) {
    return SB.select('v_fornecedores', function (q) {
      if (term) q = q.or('nome.ilike.%' + term + '%,cpf_cnpj.ilike.%' + term + '%');
      return q.order('nome').limit(100);
    });
  });

  S.register('dashboard', async function () {
    var all = await SB.select('processes', function (q) { return q.eq('active_prc', true); });
    var S = window.CONFIG.STATUS;
    var pend = all.filter(function (p) { return p.status_step_prc === S.aguardando; }).length;
    var aguard = all.filter(function (p) { return p.status_step_prc === S.aguardando && p.approving_status_prc === 1; }).length;
    return { total: all.length, pendentes: pend, aguardando: aguard, rows: all };
  });
})();
