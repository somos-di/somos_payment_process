async function initView_sem_aprovador() {
  var selectElement = function (id) { return document.getElementById(id); };
  function escapeHtml(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function money(value) { return (Number(value) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

  var rows;
  try { rows = await window.SB.select('v_no_approver'); }
  catch (error) { window.viewError(selectElement('na-list'), error); selectElement('na-count').textContent = 'erro'; return; }

  selectElement('na-count').textContent = rows.length + ' processo(s) sem aprovador';
  if (!rows.length) { selectElement('na-list').innerHTML = '<div class="empty">Nenhum processo sem aprovador. </div>'; return; }

  function renderNoRuleDiagnosis(p) {
    return '<div class="na-diag"><h4>Ainda não existe uma regra de aprovação. Crie uma com:</h4><pre>'
      + 'Empresa: ' + escapeHtml(p.empresa_nome) + '\n'
      + 'Obra: ' + escapeHtml(p.obra_nome) + '\n'
      + 'Composição / Insumo: ' + escapeHtml(p.composicao_nome || '(sem composição)') + '\n'
      + 'Faixa de valor que inclua ' + money(p.value_prc) + '\n'
      + 'Nível de aprovação: nº de aprovadores necessários\n'
      + 'Grupo aprovador: escolha o grupo</pre>'
      + '<div class="na-note">Depois, garanta que o grupo escolhido tenha permissão por empresa, por obra, por tipo de processo e pelo menos um usuário vinculado.</div></div>';
  }
  function missingTag(label, isMissing) { return isMissing ? '<span class="na-miss">falta ' + label + '</span>' : ''; }
  function renderRuleDiagnosis(p) {
    var candidates = p.candidatos || [];
    var groups = candidates.map(function (candidate) {
      var missingTags = missingTag('empresa', candidate.falta_empresa) + missingTag('obra', candidate.falta_obra) + missingTag('tipo', candidate.falta_tipo) + missingTag('usuário no grupo', candidate.falta_usuario);
      return '<div class="na-grp"><b>' + escapeHtml(candidate.grupo) + '</b> <span style="color:var(--muted)">(nível ' + escapeHtml(candidate.nivel) + ')</span><br>'
        + (missingTags || '<span class="na-ok">tudo ok — recarregue</span>') + '</div>';
    }).join('');
    return '<div class="na-diag"><h4>Existe regra, mas o(s) grupo(s) não estão completos:</h4>' + groups
      + '<div class="na-note">Cadastre o que falta em <b>Grupos &amp; Usuários</b> (permissões por empresa/obra/tipo e vínculo de usuário).</div></div>';
  }

  selectElement('na-list').innerHTML = rows.map(function (row) {
    return '<div class="na-card"><div class="na-top">'
      + '<div><div class="na-title">Processo #' + escapeHtml(row.id_prc) + '</div>'
      + '<div class="na-sub">' + escapeHtml(row.empresa_nome) + ' (' + escapeHtml(row.company_prc) + ') · ' + escapeHtml(row.obra_nome) + ' (' + escapeHtml(row.building_prc) + ') · '
      + escapeHtml(row.tipo_nome) + ' · ' + money(row.value_prc) + (row.is_urgent_prc ? ' · <span class="badge red">Urgente</span>' : '') + '</div></div>'
      + '<span class="badge red">● Sem aprovador</span></div>'
      + (row.tem_regra ? renderRuleDiagnosis(row) : renderNoRuleDiagnosis(row))
      + '</div>';
  }).join('');
}
