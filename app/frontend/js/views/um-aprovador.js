// Admin: processos com apenas 1 pessoa elegível a aprovar (deveria ser >= 2).
// Lê v_single_approver (diagnóstico global; rota gated a admin no router).
async function initView_um_aprovador() {
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function money(v) { return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

  var rows;
  try { rows = await window.SB.select('v_single_approver'); }
  catch (e) { window.viewError($('ua-list'), e); $('ua-count').textContent = 'erro'; return; }

  $('ua-count').textContent = rows.length + ' processo(s) com 1 aprovador';
  if (!rows.length) {
    $('ua-list').innerHTML = '<div class="empty">Nenhum processo com apenas 1 aprovador. 👍</div>';
    return;
  }

  function renderGroups(p) {
    var groups = (p.grupos || []).map(function (g) {
      return '<div class="ua-grp"><b>' + esc(g.grupo) + '</b> <span style="color:var(--muted)">(nível ' + esc(g.nivel) + ')</span></div>';
    }).join('');
    return '<div class="ua-diag">'
      + '<h4>Só 1 pessoa pode aprovar (nível exigido: ' + esc(p.nivel_exigido) + ').</h4>'
      + '<div>Grupo(s) elegível(is):</div>' + groups
      + '<div class="ua-note">Adicione mais usuários ao(s) grupo(s) elegível(is) do nível correspondente ao valor '
      + '(<b>' + money(p.value_prc) + '</b>), em <b>Grupos &amp; Usuários</b>, para haver pelo menos 2 aprovadores distintos.</div></div>';
  }

  $('ua-list').innerHTML = rows.map(function (p) {
    return '<div class="ua-card"><div class="ua-top">'
      + '<div><div class="ua-title">Processo #' + esc(p.id_prc) + '</div>'
      + '<div class="ua-sub">' + esc(p.empresa_nome) + ' (' + esc(p.company_prc) + ') · ' + esc(p.obra_nome) + ' (' + esc(p.building_prc) + ') · '
      + esc(p.tipo_nome) + ' · ' + money(p.value_prc) + (p.is_urgent_prc ? ' · <span class="badge red">Urgente</span>' : '') + '</div></div>'
      + '<span class="badge red">● 1 aprovador</span></div>'
      + renderGroups(p)
      + '</div>';
  }).join('');
}
