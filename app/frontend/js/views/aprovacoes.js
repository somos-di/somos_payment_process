// Aprovações Pendentes — usa o mounter compartilhado (my_pending_approvals + ações).
async function initView_aprovacoes() {
  await window.mountPendingApprovals(document.getElementById('aprovar-host'));
}
