// Admin: cadastro de EMPREENDIMENTOS de comissão (obra dentro da SPE) + trilha (quem valida).
// Campos: nome, empresa (SPE, busca), obra (busca por empresa), trilha (SOMOS/PARTINI), author.
// author é gravado no servidor (auth.uid()); aqui só exibimos o usuário logado.
async function initView_comissoes_empreendimentos() {
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function toast(msg, ok) {
    var t = document.createElement('div'); t.textContent = msg;
    t.style.cssText = 'position:fixed;top:16px;right:16px;z-index:10000;padding:10px 14px;border-radius:8px;font-size:14px;box-shadow:var(--shadow-md);'
      + (ok ? 'background:var(--ok-weak);color:#166534' : 'background:var(--danger-weak);color:#9f1239');
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, 4000);
  }
  function fill(sel, rows, vk, tk, ph) {
    sel.innerHTML = (ph ? '<option value="">' + ph + '</option>' : '') + (rows || []).map(function (r) {
      return '<option value="' + esc(r[vk]) + '">' + esc(r[tk]) + '</option>';
    }).join('');
  }

  var me = (window.Auth && window.Auth.getUser && window.Auth.getUser()) || {};
  $('ce-author').textContent = 'Autor do cadastro: ' + (me.name || me.email || '—');

  var editingId = null;

  try { fill($('ce-empresa'), await window.Store.get('empresas'), 'codigo', 'nome', 'Selecione a empresa'); }
  catch (e) { toast('Falha ao carregar empresas: ' + e.message); }

  async function loadObras(empresa, keep) {
    var o = $('ce-obra');
    if (!empresa) { o.innerHTML = '<option value="">Selecione a empresa primeiro</option>'; o.disabled = true; return; }
    o.disabled = false; o.innerHTML = '<option value="">Carregando…</option>';
    try { fill(o, await window.Store.get('obras', empresa), 'codigo', 'nome', 'Selecione a obra'); }
    catch (e) { o.innerHTML = '<option value="">Erro</option>'; }
    if (keep) o.value = keep;
  }
  $('ce-empresa').addEventListener('change', function () { loadObras(this.value); });

  function resetForm() {
    editingId = null;
    $('ce-nome').value = ''; $('ce-empresa').value = ''; $('ce-trilha').value = 'false'; $('ce-ativo').value = 'true';
    $('ce-obra').innerHTML = '<option value="">Selecione a empresa primeiro</option>'; $('ce-obra').disabled = true;
    $('ce-status').textContent = ''; $('ce-save').textContent = 'Salvar';
  }
  $('ce-reset').addEventListener('click', resetForm);

  $('ce-save').addEventListener('click', async function () {
    var payload = {
      id: editingId,
      name: $('ce-nome').value.trim(),
      company: $('ce-empresa').value,
      building: $('ce-obra').value,
      somos: $('ce-trilha').value === 'true',
      active: $('ce-ativo').value === 'true',
    };
    if (!payload.name) { toast('Informe o nome do empreendimento.'); return; }
    if (!payload.company) { toast('Selecione a empresa (SPE).'); return; }
    if (!payload.building) { toast('Selecione a obra.'); return; }
    var btn = this; btn.disabled = true; $('ce-status').textContent = 'Salvando…';
    try {
      await window.API.post('/commissions/empreendimentos', payload);
      window.Store.invalidate('comm_empreendimentos');
      toast(editingId ? 'Empreendimento atualizado.' : 'Empreendimento cadastrado.', true);
      resetForm(); await reload();
    } catch (e) { $('ce-status').textContent = ''; toast('Erro: ' + e.message); }
    finally { btn.disabled = false; }
  });

  function edit(row) {
    editingId = row.id_cem;
    $('ce-nome').value = row.name_cem || '';
    $('ce-empresa').value = row.company_cem || '';
    $('ce-trilha').value = row.somos_cem ? 'true' : 'false';
    $('ce-ativo').value = row.active_cem ? 'true' : 'false';
    $('ce-save').textContent = 'Salvar alteração';
    $('ce-status').textContent = 'Editando #' + row.id_cem;
    loadObras(row.company_cem, row.building_cem);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function removeRow(row) {
    if (!confirm('Remover o empreendimento "' + (row.name_cem || '') + '"?')) return;
    try {
      await window.API.post('/commissions/empreendimentos/remove', { id: row.id_cem });
      window.Store.invalidate('comm_empreendimentos');
      toast('Removido.', true); if (editingId === row.id_cem) resetForm(); await reload();
    } catch (e) { toast('Erro: ' + e.message); }
  }

  var rows = [];
  function render() {
    var t = ($('ce-search').value || '').toLowerCase().trim();
    var data = rows.filter(function (r) {
      return !t || [r.name_cem, r.empresa_nome, r.obra_nome, r.company_cem, r.building_cem].join(' ').toLowerCase().indexOf(t) >= 0;
    });
    if (!data.length) { $('ce-list').innerHTML = '<div class="empty">Nenhum empreendimento cadastrado.</div>'; return; }
    var html = '<div class="table-scroll"><table><thead><tr><th>Empreendimento</th><th>Empresa</th><th>Obra</th><th>Trilha</th><th>Autor</th><th>Ativo</th><th></th></tr></thead><tbody>';
    data.forEach(function (r, i) {
      html += '<tr data-i="' + i + '">'
        + '<td>' + esc(r.name_cem) + '</td>'
        + '<td>' + esc(r.empresa_nome) + ' <span style="color:var(--muted)">(' + esc(r.company_cem) + ')</span></td>'
        + '<td>' + esc(r.obra_nome) + ' <span style="color:var(--muted)">(' + esc(r.building_cem) + ')</span></td>'
        + '<td><span class="badge ' + (r.somos_cem ? 'ok' : 'blue') + '">' + esc(r.trilha) + '</span></td>'
        + '<td>' + esc(r.author_nome || '—') + '</td>'
        + '<td>' + (r.active_cem ? 'Sim' : '<span style="color:var(--muted)">Não</span>') + '</td>'
        + '<td style="white-space:nowrap;text-align:right">'
        + '<button class="btn btn-light" data-edit="' + i + '" style="margin-left:6px">Editar</button>'
        + '<button class="btn btn-danger" data-rm="' + i + '" style="margin-left:6px">Remover</button></td></tr>';
    });
    html += '</tbody></table></div>';
    $('ce-list').innerHTML = html;
    $('ce-list').querySelectorAll('[data-edit]').forEach(function (b) { b.addEventListener('click', function () { edit(data[+b.getAttribute('data-edit')]); }); });
    $('ce-list').querySelectorAll('[data-rm]').forEach(function (b) { b.addEventListener('click', function () { removeRow(data[+b.getAttribute('data-rm')]); }); });
  }
  async function reload() {
    $('ce-list').innerHTML = '<div class="empty">Carregando…</div>';
    try { rows = await window.Store.get('comm_empreendimentos'); render(); }
    catch (e) { window.viewError($('ce-list'), e); }
  }
  $('ce-search').addEventListener('input', render);

  resetForm();
  await reload();
}
