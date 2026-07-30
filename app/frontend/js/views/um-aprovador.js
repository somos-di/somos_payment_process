async function initView_um_aprovador() {
  var selectElement = function (id) { return document.getElementById(id); };
  function escapeHtml(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function money(value) { return (Number(value) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

  var rows;
  try { rows = await window.SB.select('v_single_approver'); }
  catch (error) { window.viewError(selectElement('ua-list'), error); selectElement('ua-count').textContent = 'erro'; return; }

  selectElement('ua-count').textContent = rows.length + ' processo(s) com 1 aprovador';
  if (!rows.length) {
    selectElement('ua-list').innerHTML = '<div class="empty">Nenhum processo com apenas 1 aprovador. 👍</div>';
    return;
  }

  function renderGroups(p) {
    var groups = (p.grupos || []).map(function (item) {
      return '<div class="ua-grp"><b>' + escapeHtml(item.grupo) + '</b> <span style="color:var(--muted)">(nível ' + escapeHtml(item.nivel) + ')</span></div>';
    }).join('');
    return '<div class="ua-diag">'
      + '<h4>Só 1 pessoa pode aprovar (nível exigido: ' + escapeHtml(p.nivel_exigido) + ').</h4>'
      + '<div>Grupo(s) elegível(is):</div>' + groups
      + '<div class="ua-note">Adicione mais usuários ao(s) grupo(s) elegível(is) do nível correspondente ao valor '
      + '(<b>' + money(p.value_prc) + '</b>), em <b>Grupos &amp; Usuários</b>, para haver pelo menos 2 aprovadores distintos.</div></div>';
  }

  selectElement('ua-list').innerHTML = rows.map(function (row) {
    return '<div class="ua-card"><div class="ua-top">'
      + '<div><div class="ua-title">Processo #' + escapeHtml(row.id_prc) + '</div>'
      + '<div class="ua-sub">' + escapeHtml(row.empresa_nome) + ' (' + escapeHtml(row.company_prc) + ') · ' + escapeHtml(row.obra_nome) + ' (' + escapeHtml(row.building_prc) + ') · '
      + escapeHtml(row.tipo_nome) + ' · ' + money(row.value_prc) + (row.is_urgent_prc ? ' · <span class="badge red">Urgente</span>' : '') + '</div></div>'
      + '<span class="badge red">● 1 aprovador</span></div>'
      + renderGroups(row)
      + '</div>';
  }).join('');
}
