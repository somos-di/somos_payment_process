async function initView_sync() {
  function escapeHtml(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  var rowsEl = document.getElementById('sync-rows');
  var msgEl = document.getElementById('sync-msg');
  var allBtn = document.getElementById('sync-all');

  var catalog;
  try { catalog = await window.Store.get('uau_tables'); }
  catch (error) { rowsEl.innerHTML = '<tr><td colspan="5" class="view-error">' + escapeHtml(error.message) + '</td></tr>'; return; }
  catalog = (catalog || []).filter(function (item) { return item.id_uat !== -999; });
  if (!catalog.length) { rowsEl.innerHTML = '<tr><td colspan="5" class="empty">Catálogo vazio. Rode o uau_sync.sql.</td></tr>'; return; }

  rowsEl.innerHTML = catalog.map(function (catalogItem) {
    return '<tr data-id="' + catalogItem.id_uat + '" data-table="' + escapeHtml(catalogItem.supabase_uau_table_uat) + '">'
      + '<td>' + escapeHtml(catalogItem.uau_table_uat) + '</td>'
      + '<td>' + escapeHtml(catalogItem.supabase_uau_table_uat) + '</td>'
      + '<td>' + escapeHtml(catalogItem.uau_table_id_uat) + '</td>'
      + '<td class="st">-</td>'
      + '<td style="text-align:right"><button class="btn btn-light sync-one" data-id="' + catalogItem.id_uat + '">Sincronizar</button></td></tr>';
  }).join('');

  function setStatus(selector, txt, cssClass) {
    var element = rowsEl.querySelector(selector + ' .st');
    if (element) element.innerHTML = cssClass ? '<span class="badge ' + cssClass + '">' + escapeHtml(txt) + '</span>' : escapeHtml(txt);
  }
  async function syncOne(id, button) {
    if (button) button.disabled = true;
    setStatus('tr[data-id="' + id + '"]', 'Sincronizando…');
    try {
      var d = await window.API.post('/sync/' + id);
      setStatus('tr[data-id="' + id + '"]', 'OK · ' + d.rows + ' linhas', 'ok');
      window.Store.clear();
    } catch (error) {
      setStatus('tr[data-id="' + id + '"]', error.message, 'red');
    } finally { if (button) button.disabled = false; }
  }
  rowsEl.querySelectorAll('.sync-one').forEach(function (item) {
    item.addEventListener('click', function () { syncOne(item.getAttribute('data-id'), item); });
  });

  allBtn.addEventListener('click', async function () {
    allBtn.disabled = true;
    msgEl.textContent = 'Sincronizando tudo… (insumos/composições são grandes, pode levar minutos)';
    catalog.forEach(function (catalogItem) { setStatus('tr[data-id="' + catalogItem.id_uat + '"]', 'Na fila…'); });
    try {
      var response = await window.API.post('/sync');
      (response || []).forEach(function (item) {
        var selector = 'tr[data-table="' + item.table + '"]';
        setStatus(selector, 'OK · ' + item.rows + ' linhas', 'ok');
      });
      msgEl.textContent = 'Sincronização concluída.';
      window.Store.clear();
    } catch (error) {
      msgEl.textContent = 'Erro: ' + error.message;
    } finally { allBtn.disabled = false; }
  });
}
