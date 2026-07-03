async function initView_sync() {
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  var rowsEl = document.getElementById('sync-rows');
  var msgEl = document.getElementById('sync-msg');
  var allBtn = document.getElementById('sync-all');

  var catalog;
  try { catalog = await window.Store.get('uau_tables'); }
  catch (e) { rowsEl.innerHTML = '<tr><td colspan="5" class="view-error">' + esc(e.message) + '</td></tr>'; return; }
  catalog = (catalog || []).filter(function (r) { return r.id_uat !== -999; });
  if (!catalog.length) { rowsEl.innerHTML = '<tr><td colspan="5" class="empty">Catálogo vazio. Rode o uau_sync.sql.</td></tr>'; return; }

  rowsEl.innerHTML = catalog.map(function (r) {
    return '<tr data-id="' + r.id_uat + '" data-table="' + esc(r.supabase_uau_table_uat) + '">'
      + '<td>' + esc(r.uau_table_uat) + '</td>'
      + '<td>' + esc(r.supabase_uau_table_uat) + '</td>'
      + '<td>' + esc(r.uau_table_id_uat) + '</td>'
      + '<td class="st">—</td>'
      + '<td style="text-align:right"><button class="btn btn-light sync-one" data-id="' + r.id_uat + '">Sincronizar</button></td></tr>';
  }).join('');

  function setStatus(selector, txt, cls) {
    var el = rowsEl.querySelector(selector + ' .st');
    if (el) el.innerHTML = cls ? '<span class="badge ' + cls + '">' + esc(txt) + '</span>' : esc(txt);
  }
  async function syncOne(id, btn) {
    if (btn) btn.disabled = true;
    setStatus('tr[data-id="' + id + '"]', 'Sincronizando…');
    try {
      var d = await window.API.post('/sync/' + id);
      setStatus('tr[data-id="' + id + '"]', 'OK · ' + d.rows + ' linhas', 'ok');
      window.Store.clear(); 
    } catch (e) {
      setStatus('tr[data-id="' + id + '"]', e.message, 'red');
    } finally { if (btn) btn.disabled = false; }
  }
  rowsEl.querySelectorAll('.sync-one').forEach(function (b) {
    b.addEventListener('click', function () { syncOne(b.getAttribute('data-id'), b); });
  });

  allBtn.addEventListener('click', async function () {
    allBtn.disabled = true;
    msgEl.textContent = 'Sincronizando tudo… (insumos/composições são grandes, pode levar minutos)';
    catalog.forEach(function (r) { setStatus('tr[data-id="' + r.id_uat + '"]', 'Na fila…'); });
    try {
      var res = await window.API.post('/sync');
      (res || []).forEach(function (x) {
        var selector = 'tr[data-table="' + x.table + '"]';
        setStatus(selector, 'OK · ' + x.rows + ' linhas', 'ok');
      });
      msgEl.textContent = 'Sincronização concluída.';
      window.Store.clear(); 
    } catch (e) {
      msgEl.textContent = 'Erro: ' + e.message;
    } finally { allBtn.disabled = false; }
  });
}
