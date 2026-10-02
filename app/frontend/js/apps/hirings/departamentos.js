async function initView_departamentos() {
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

  var rowsEl = document.getElementById('dep-rows');
  var msgEl = document.getElementById('dep-msg');
  var overlay = document.getElementById('dep-overlay');
  var modal = document.getElementById('dep-modal');

  var users = [];
  try { users = (await window.API.get('/hirings/users')) || []; }
  catch (e) { rowsEl.innerHTML = '<tr><td colspan="3" class="view-error">' + esc(e.message) + '</td></tr>'; return; }

  var departments = [];
  async function load() {
    rowsEl.innerHTML = '<tr><td colspan="3" class="empty">Carregando…</td></tr>';
    try { departments = (await window.API.get('/hirings/departments')) || []; }
    catch (e) { rowsEl.innerHTML = '<tr><td colspan="3" class="view-error">' + esc(e.message) + '</td></tr>'; return; }
    if (!departments.length) { rowsEl.innerHTML = '<tr><td colspan="3" class="empty">Nenhum departamento cadastrado.</td></tr>'; return; }
    rowsEl.innerHTML = departments.map(function (d) {
      var g = (d.gestores || []).map(function (x) { return esc(x.nome); }).join(', ') || '<span style="opacity:.5">— sem gestor —</span>';
      return '<tr><td>' + esc(d.name_dep) + '</td><td>' + g + '</td>'
        + '<td style="text-align:right"><button class="btn btn-light dep-edit" data-id="' + d.id_dep + '">Editar gestores</button></td></tr>';
    }).join('');
    rowsEl.querySelectorAll('.dep-edit').forEach(function (b) { b.addEventListener('click', function () { openEdit(Number(b.getAttribute('data-id'))); }); });
  }

  function closeModal() { overlay.style.display = 'none'; modal.innerHTML = ''; }
  function showModal(html) {
    overlay.style.cssText = 'display:flex;position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:1000;align-items:flex-start;justify-content:center;padding:40px 16px;overflow:auto';
    modal.style.cssText = 'background:var(--card,#1b1b1b);color:inherit;border-radius:14px;max-width:520px;width:100%;padding:22px;box-shadow:0 20px 60px rgba(0,0,0,.5)';
    modal.innerHTML = html;
  }
  overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(); });

  function openEdit(id) {
    var dep = departments.filter(function (d) { return d.id_dep === id; })[0];
    if (!dep) return;
    var current = {}; (dep.gestores || []).forEach(function (x) { current[x.id] = true; });
    var inputStyle = 'width:100%;padding:9px 11px;border-radius:9px;border:1px solid var(--border,#333);background:var(--bg,#121212);color:inherit;box-sizing:border-box';
    showModal(
      '<div class="section-title">Gestores · ' + esc(dep.name_dep) + '</div>'
      + '<input id="dep-search" placeholder="Buscar usuário…" style="' + inputStyle + ';margin-top:12px">'
      + '<div id="dep-users" style="max-height:320px;overflow:auto;margin-top:10px;border:1px solid var(--border,#2a2a2a);border-radius:10px;padding:6px"></div>'
      + '<div id="dep-emsg" style="color:#dc2626;font-size:13px;margin-top:10px"></div>'
      + '<div style="display:flex;justify-content:flex-end;gap:10px;margin-top:16px"><button class="btn btn-light" id="dep-cancel">Cancelar</button><button class="btn btn-primary" id="dep-save">Salvar</button></div>'
    );
    var listEl = document.getElementById('dep-users');
    function paint(filter) {
      var f = (filter || '').toLowerCase();
      listEl.innerHTML = users.filter(function (u) { return !f || (u.nome || '').toLowerCase().indexOf(f) >= 0 || (u.email || '').toLowerCase().indexOf(f) >= 0; })
        .map(function (u) {
          return '<label style="display:flex;align-items:center;gap:8px;padding:6px 6px;font-size:14px;cursor:pointer">'
            + '<input type="checkbox" class="dep-chk" value="' + u.id + '"' + (current[u.id] ? ' checked' : '') + ' style="width:16px;height:16px">'
            + '<span>' + esc(u.nome) + ' <span style="opacity:.5;font-size:12px">' + esc(u.email || '') + '</span></span></label>';
        }).join('') || '<div class="empty" style="padding:10px">Nenhum usuário.</div>';
      listEl.querySelectorAll('.dep-chk').forEach(function (c) { c.addEventListener('change', function () { current[c.value] = c.checked; }); });
    }
    paint('');
    document.getElementById('dep-search').addEventListener('input', function () { paint(this.value); });
    document.getElementById('dep-cancel').addEventListener('click', closeModal);
    document.getElementById('dep-save').addEventListener('click', async function () {
      var btn = this; btn.disabled = true;
      var selected = Object.keys(current).filter(function (k) { return current[k]; });
      try { await window.API.post('/departments/' + id + '/managers', { users: selected }); closeModal(); await load(); }
      catch (err) { document.getElementById('dep-emsg').textContent = err.message; btn.disabled = false; }
    });
  }

  await load();
}
