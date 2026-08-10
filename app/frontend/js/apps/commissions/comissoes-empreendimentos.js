async function initView_comissoes_empreendimentos() {
  var selectElement = function (id) { return document.getElementById(id); };
  function escapeHtml(text) { return String(text == null ? '' : text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function toast(message, isSuccess) {
    var toastElement = document.createElement('div'); toastElement.textContent = message;
    toastElement.style.cssText = 'position:fixed;top:16px;right:16px;z-index:10000;padding:10px 14px;border-radius:8px;font-size:14px;box-shadow:var(--shadow-md);'
      + (isSuccess ? 'background:var(--ok-weak);color:#166534' : 'background:var(--danger-weak);color:#9f1239');
    document.body.appendChild(toastElement); setTimeout(function () { toastElement.remove(); }, 4000);
  }
  function fill(selector, rows, valueKey, textKey, placeholder) {
    selector.innerHTML = (placeholder ? '<option value="">' + placeholder + '</option>' : '') + (rows || []).map(function (item) {
      return '<option value="' + escapeHtml(item[valueKey]) + '">' + escapeHtml(item[textKey]) + '</option>';
    }).join('');
  }

  var currentUser = (window.Auth && window.Auth.getUser && window.Auth.getUser()) || {};
  selectElement('ce-author').textContent = 'Autor do cadastro: ' + (currentUser.name || currentUser.email || '-');

  var editingId = null;

  try { fill(selectElement('ce-empresa'), await window.Store.get('empresas'), 'codigo', 'nome', 'Selecione a empresa'); }
  catch (error) { toast('Falha ao carregar empresas: ' + error.message); }

  async function loadObras(empresa, keep) {
    var obraSelect = selectElement('ce-obra');
    if (!empresa) { obraSelect.innerHTML = '<option value="">Selecione a empresa primeiro</option>'; obraSelect.disabled = true; return; }
    obraSelect.disabled = false; obraSelect.innerHTML = '<option value="">Carregando…</option>';
    try { fill(obraSelect, await window.Store.get('obras', empresa), 'codigo', 'nome', 'Selecione a obra'); }
    catch (error) { obraSelect.innerHTML = '<option value="">Erro</option>'; }
    if (keep) obraSelect.value = keep;
  }
  selectElement('ce-empresa').addEventListener('change', function () { loadObras(this.value); });

  function resetForm() {
    editingId = null;
    selectElement('ce-nome').value = ''; selectElement('ce-empresa').value = ''; selectElement('ce-trilha').value = 'false'; selectElement('ce-ativo').value = 'true';
    selectElement('ce-obra').innerHTML = '<option value="">Selecione a empresa primeiro</option>'; selectElement('ce-obra').disabled = true;
    selectElement('ce-status').textContent = ''; selectElement('ce-save').textContent = 'Salvar';
  }
  selectElement('ce-reset').addEventListener('click', resetForm);

  selectElement('ce-save').addEventListener('click', async function () {
    var payload = {
      id: editingId,
      name: selectElement('ce-nome').value.trim(),
      company: selectElement('ce-empresa').value,
      building: selectElement('ce-obra').value,
      somos: selectElement('ce-trilha').value === 'true',
      active: selectElement('ce-ativo').value === 'true',
    };
    if (!payload.name) { toast('Informe o nome do empreendimento.'); return; }
    if (!payload.company) { toast('Selecione a empresa (SPE).'); return; }
    if (!payload.building) { toast('Selecione a obra.'); return; }
    var button = this; button.disabled = true; selectElement('ce-status').textContent = 'Salvando…';
    try {
      await window.API.post('/commissions/empreendimentos', payload);
      window.Store.invalidate('comm_empreendimentos');
      toast(editingId ? 'Empreendimento atualizado.' : 'Empreendimento cadastrado.', true);
      resetForm(); await reload();
    } catch (error) { selectElement('ce-status').textContent = ''; toast('Erro: ' + error.message); }
    finally { button.disabled = false; }
  });

  function edit(row) {
    editingId = row.id_cem;
    selectElement('ce-nome').value = row.name_cem || '';
    selectElement('ce-empresa').value = row.company_cem || '';
    selectElement('ce-trilha').value = row.somos_cem ? 'true' : 'false';
    selectElement('ce-ativo').value = row.active_cem ? 'true' : 'false';
    selectElement('ce-save').textContent = 'Salvar alteração';
    selectElement('ce-status').textContent = 'Editando #' + row.id_cem;
    loadObras(row.company_cem, row.building_cem);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function removeRow(row) {
    if (!confirm('Remover o empreendimento "' + (row.name_cem || '') + '"?')) return;
    try {
      await window.API.post('/commissions/empreendimentos/remove', { id: row.id_cem });
      window.Store.invalidate('comm_empreendimentos');
      toast('Removido.', true); if (editingId === row.id_cem) resetForm(); await reload();
    } catch (error) { toast('Erro: ' + error.message); }
  }

  var rows = [];
  function render() {
    var searchTerm = (selectElement('ce-search').value || '').toLowerCase().trim();
    var data = rows.filter(function (row) {
      return !searchTerm || [row.name_cem, row.empresa_nome, row.obra_nome, row.company_cem, row.building_cem].join(' ').toLowerCase().indexOf(searchTerm) >= 0;
    });
    if (!data.length) { selectElement('ce-list').innerHTML = '<div class="empty">Nenhum empreendimento cadastrado.</div>'; return; }
    var html = '<div class="table-scroll"><table><thead><tr><th>Empreendimento</th><th>Empresa</th><th>Obra</th><th>Trilha</th><th>Autor</th><th>Ativo</th><th></th></tr></thead><tbody>';
    data.forEach(function (entry, index) {
      html += '<tr data-i="' + index + '">'
        + '<td>' + escapeHtml(entry.name_cem) + '</td>'
        + '<td>' + escapeHtml(entry.empresa_nome) + ' <span style="color:var(--muted)">(' + escapeHtml(entry.company_cem) + ')</span></td>'
        + '<td>' + escapeHtml(entry.obra_nome) + ' <span style="color:var(--muted)">(' + escapeHtml(entry.building_cem) + ')</span></td>'
        + '<td><span class="badge ' + (entry.somos_cem ? 'ok' : 'blue') + '">' + escapeHtml(entry.trilha) + '</span></td>'
        + '<td>' + escapeHtml(entry.author_nome || '-') + '</td>'
        + '<td>' + (entry.active_cem ? 'Sim' : '<span style="color:var(--muted)">Não</span>') + '</td>'
        + '<td style="white-space:nowrap;text-align:right">'
        + '<button class="btn btn-light" data-edit="' + index + '" style="margin-left:6px">Editar</button>'
        + '<button class="btn btn-danger" data-rm="' + index + '" style="margin-left:6px">Remover</button></td></tr>';
    });
    html += '</tbody></table></div>';
    selectElement('ce-list').innerHTML = html;
    selectElement('ce-list').querySelectorAll('[data-edit]').forEach(function (item) { item.addEventListener('click', function () { edit(data[+item.getAttribute('data-edit')]); }); });
    selectElement('ce-list').querySelectorAll('[data-rm]').forEach(function (item) { item.addEventListener('click', function () { removeRow(data[+item.getAttribute('data-rm')]); }); });
  }
  async function reload() {
    selectElement('ce-list').innerHTML = '<div class="empty">Carregando…</div>';
    try { rows = await window.Store.get('comm_empreendimentos'); render(); }
    catch (error) { window.viewError(selectElement('ce-list'), error); }
  }
  selectElement('ce-search').addEventListener('input', render);

  resetForm();
  await reload();
}
