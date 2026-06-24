// Processos sem Aprovador — cards de diagnóstico (igual ao Mitra V2).
// Lê v_no_approver (nomes resolvidos + o que falta por grupo candidato).
async function initView_sem_aprovador() {
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function money(v) { return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

  var rows;
  try { rows = await window.SB.select('v_no_approver'); }
  catch (e) { $('na-list').innerHTML = '<div class="view-error">' + esc(e.message) + '</div>'; $('na-count').textContent = 'erro'; return; }

  $('na-count').textContent = rows.length + ' processo(s) sem aprovador';
  if (!rows.length) { $('na-list').innerHTML = '<div class="empty">Nenhum processo sem aprovador. 🎉</div>'; return; }

  function diagSemRegra(p) {
    return '<div class="na-diag"><h4>Ainda não existe uma regra de aprovação. Crie uma com:</h4><pre>'
      + 'Empresa: ' + esc(p.empresa_nome) + '\n'
      + 'Obra: ' + esc(p.obra_nome) + '\n'
      + 'Composição / Insumo: ' + esc(p.composicao_nome || '(sem composição)') + '\n'
      + 'Faixa de valor que inclua ' + money(p.value_prc) + '\n'
      + 'Nível de aprovação: nº de aprovadores necessários\n'
      + 'Grupo aprovador: escolha o grupo</pre>'
      + '<div class="na-note">Depois, garanta que o grupo escolhido tenha permissão por empresa, por obra, por tipo de processo e pelo menos um usuário vinculado.</div></div>';
  }
  function miss(label, falta) { return falta ? '<span class="na-miss">falta ' + label + '</span>' : ''; }
  function diagComRegra(p) {
    var cand = p.candidatos || [];
    var groups = cand.map(function (g) {
      var faltas = miss('empresa', g.falta_empresa) + miss('obra', g.falta_obra) + miss('tipo', g.falta_tipo) + miss('usuário no grupo', g.falta_usuario);
      return '<div class="na-grp"><b>' + esc(g.grupo) + '</b> <span style="color:var(--muted)">(nível ' + esc(g.nivel) + ')</span><br>'
        + (faltas || '<span class="na-ok">tudo ok — recarregue</span>') + '</div>';
    }).join('');
    return '<div class="na-diag"><h4>Existe regra, mas o(s) grupo(s) não estão completos:</h4>' + groups
      + '<div class="na-note">Cadastre o que falta em <b>Grupos &amp; Usuários</b> (permissões por empresa/obra/tipo e vínculo de usuário).</div></div>';
  }

  $('na-list').innerHTML = rows.map(function (p) {
    return '<div class="na-card"><div class="na-top">'
      + '<div><div class="na-title">Processo #' + esc(p.id_prc) + '</div>'
      + '<div class="na-sub">' + esc(p.empresa_nome) + ' (' + esc(p.company_prc) + ') · ' + esc(p.obra_nome) + ' (' + esc(p.building_prc) + ') · '
      + esc(p.tipo_nome) + ' · ' + money(p.value_prc) + (p.is_urgent_prc ? ' · <span class="badge red">Urgente</span>' : '') + '</div></div>'
      + '<span class="badge red">● Sem aprovador</span></div>'
      + (p.tem_regra ? diagComRegra(p) : diagSemRegra(p))
      + '</div>';
  }).join('');
}
