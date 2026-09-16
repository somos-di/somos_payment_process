async function initView_sync() {
  function escapeHtml(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function fmtDateTime(d) {
    if (!d) return '—';
    try { return new Date(d).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
    catch (error) { return String(d); }
  }
  var rowsEl = document.getElementById('sync-rows');
  var msgEl = document.getElementById('sync-msg');
  var allBtn = document.getElementById('sync-all');
  var masterEl = document.getElementById('auto-master');
  var saveBtn = document.getElementById('auto-save');

  var config;
  try { config = await window.API.get('/sync/config'); }
  catch (error) { rowsEl.innerHTML = '<tr><td colspan="7" class="view-error">' + escapeHtml(error.message) + '</td></tr>'; return; }
  var tables = config.tables || [];
  masterEl.checked = !!config.enabled;
  if (!tables.length) { rowsEl.innerHTML = '<tr><td colspan="7" class="empty">Catálogo vazio. Rode o uau_sync.sql.</td></tr>'; return; }

  function autoStatusHtml(t) {
    if (!t.last_sync_at_uat) return '—';
    var ok = t.last_status_uat === 'ok';
    return escapeHtml(fmtDateTime(t.last_sync_at_uat)) + ' <span class="badge ' + (ok ? 'ok' : 'red') + '">' + (ok ? 'OK' : 'Erro') + '</span>'
      + (ok && t.last_rows_uat != null ? ' ' + t.last_rows_uat + ' linhas' : '')
      + (!ok && t.last_error_uat ? ' <span title="' + escapeHtml(t.last_error_uat) + '">⚠</span>' : '');
  }

  rowsEl.innerHTML = tables.map(function (t) {
    return '<tr data-id="' + t.id_uat + '" data-table="' + escapeHtml(t.supabase_uau_table_uat) + '">'
      + '<td>' + escapeHtml(t.uau_table_uat) + '</td>'
      + '<td>' + escapeHtml(t.supabase_uau_table_uat) + '</td>'
      + '<td style="text-align:center"><input type="checkbox" class="auto-chk" ' + (t.auto_enabled_uat ? 'checked' : '') + ' style="width:16px;height:16px"></td>'
      + '<td style="text-align:center"><input type="number" class="auto-int" min="1" max="10080" step="1" value="' + (t.interval_minutes_uat || 60) + '" style="width:90px"></td>'
      + '<td class="auto-st">' + autoStatusHtml(t) + '</td>'
      + '<td class="st">-</td>'
      + '<td style="text-align:right"><button class="btn btn-light sync-one" data-id="' + t.id_uat + '">Sincronizar</button></td></tr>';
  }).join('');

  function setStatus(id, txt, cls) {
    var el = rowsEl.querySelector('tr[data-id="' + id + '"] .st');
    if (el) el.innerHTML = cls ? '<span class="badge ' + cls + '">' + escapeHtml(txt) + '</span>' : escapeHtml(txt);
  }
  async function syncOne(id, button) {
    if (button) button.disabled = true;
    setStatus(id, 'Sincronizando…');
    try { var d = await window.API.post('/sync/' + id); setStatus(id, 'OK · ' + d.rows + ' linhas', 'ok'); window.Store.clear(); }
    catch (error) { setStatus(id, error.message, 'red'); }
    finally { if (button) button.disabled = false; }
  }
  rowsEl.querySelectorAll('.sync-one').forEach(function (b) { b.addEventListener('click', function () { syncOne(b.getAttribute('data-id'), b); }); });

  allBtn.addEventListener('click', async function () {
    allBtn.disabled = true;
    msgEl.textContent = 'Sincronizando tudo… (insumos/composições são grandes, pode levar minutos)';
    tables.forEach(function (t) { setStatus(t.id_uat, 'Na fila…'); });
    try {
      var response = await window.API.post('/sync');
      (response || []).forEach(function (item) {
        var el = rowsEl.querySelector('tr[data-table="' + item.table + '"] .st');
        if (el) el.innerHTML = '<span class="badge ok">OK · ' + item.rows + ' linhas</span>';
      });
      msgEl.textContent = 'Sincronização concluída.'; window.Store.clear();
    } catch (error) { msgEl.textContent = 'Erro: ' + error.message; }
    finally { allBtn.disabled = false; }
  });

  saveBtn.addEventListener('click', async function () {
    saveBtn.disabled = true;
    var payload = tables.map(function (t) {
      var tr = rowsEl.querySelector('tr[data-id="' + t.id_uat + '"]');
      return { id: t.id_uat, auto_enabled: tr.querySelector('.auto-chk').checked, interval_minutes: Number(tr.querySelector('.auto-int').value) || 60 };
    });
    try {
      await window.API.post('/sync/config', { enabled: masterEl.checked });
      var updated = await window.API.post('/sync/config/tables', { tables: payload });
      tables = updated || tables;
      tables.forEach(function (t) { var cell = rowsEl.querySelector('tr[data-id="' + t.id_uat + '"] .auto-st'); if (cell) cell.innerHTML = autoStatusHtml(t); });
      msgEl.innerHTML = '<span class="badge ok">Automação salva</span>' + (masterEl.checked ? '' : ' — interruptor mestre desligado, nenhuma tabela roda sozinha.');
    } catch (error) { msgEl.textContent = 'Erro ao salvar automação: ' + error.message; }
    finally { saveBtn.disabled = false; }
  });
}
