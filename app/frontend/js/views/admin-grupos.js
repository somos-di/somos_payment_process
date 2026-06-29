// Admin — Grupos & Usuários: atribui usuários do Supabase aos grupos (migrados do Mitra).
// Leituras via /data (groups, users_group) e /admin/users; escrita via /admin/users-group.
async function initView_admin_grupos() {
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  var SVG_SEARCH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>';
  var SVG_PEN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>';
  function toast(msg, ok) {
    var t = document.createElement('div'); t.textContent = msg;
    t.style.cssText = 'position:fixed;top:16px;right:16px;z-index:9999;padding:10px 14px;border-radius:8px;font-size:14px;box-shadow:var(--shadow-md);'
      + (ok ? 'background:var(--ok-weak);color:#166534' : 'background:var(--danger-weak);color:#9f1239');
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, 3500);
  }
  function confirmar(message) {
    return new Promise(function (resolve) {
      var o = document.createElement('div'); o.className = 'modal-overlay';
      o.innerHTML = '<div class="modal-box" style="width:440px"><div class="modal-title">Confirmação</div>'
        + '<div style="font-size:14px;color:var(--text-2);line-height:1.5">' + esc(message) + '</div>'
        + '<div class="modal-actions"><button class="btn btn-light" data-x>Cancelar</button>'
        + '<button class="btn btn-primary" data-ok>Confirmar</button></div></div>';
      function close(v) { o.remove(); resolve(v); }
      o.addEventListener('click', function (e) { if (e.target === o) close(false); });
      o.querySelector('[data-x]').addEventListener('click', function () { close(false); });
      o.querySelector('[data-ok]').addEventListener('click', function () { close(true); });
      document.body.appendChild(o); o.querySelector('[data-ok]').focus();
    });
  }

  var groups = [], users = [], members = {}; // members[group_usg] = Set(user_usg)
  var current = null;

  try {
    groups = await window.SB.select('groups', function (q) { return q.order('name_grp'); });
    users = await window.API.get('/admin/users');
    var ug = await window.SB.select('users_group');
    ug.forEach(function (r) { (members[r.group_usg] = members[r.group_usg] || new Set()).add(r.user_usg); });
  } catch (e) {
    window.viewError($('ag-groups'), e); return;
  }

  function count(gid) { return (members[gid] && members[gid].size) || 0; }

  function renderGroups() {
    var term = ($('ag-search').value || '').toLowerCase().trim();
    var list = groups.filter(function (g) { return !term || (g.name_grp || '').toLowerCase().indexOf(term) >= 0; });
    if (!list.length) { $('ag-groups').innerHTML = '<div class="empty">Nenhum grupo.</div>'; return; }
    $('ag-groups').innerHTML = list.map(function (g) {
      var cls = current && current.id_grp === g.id_grp ? 'ag-grp active' : 'ag-grp';
      return '<div class="' + cls + '" data-g="' + g.id_grp + '"><span class="ag-grp-name">' + esc(g.name_grp) + '</span><small>' + count(g.id_grp) + '</small></div>';
    }).join('');
    $('ag-groups').querySelectorAll('.ag-grp').forEach(function (el) {
      el.addEventListener('click', function () {
        current = groups.find(function (g) { return String(g.id_grp) === el.getAttribute('data-g'); });
        renderGroups(); renderDetail();
      });
    });
  }

  // toggle de membership (preserva foco da busca; só re-renderiza o necessário)
  async function onToggle(e) {
    var cb = e.target, uid = cb.getAttribute('data-u'), gid = current.id_grp, add = cb.checked;
    cb.disabled = true;
    try {
      await window.API.post('/admin/users-group' + (add ? '' : '/delete'), { user_usg: uid, group_usg: gid });
      if (!members[gid]) members[gid] = new Set();
      if (add) members[gid].add(uid); else members[gid].delete(uid);
      var b = $('ag-membadge'); if (b) b.textContent = members[gid].size + ' membro(s)';
      renderGroups(); // atualiza a contagem na lista de grupos (mantém o atual ativo)
      var only = $('ag-only'); if (only && only.checked && !add) renderUsers(); // some da lista "só membros"
      toast(add ? 'Adicionado ao grupo.' : 'Removido do grupo.', true);
    } catch (err) { cb.checked = !add; toast('Erro: ' + err.message); }
    finally { cb.disabled = false; }
  }

  function renderUsers() {
    if (!current) return;
    var box = $('ag-userlist'); if (!box) return;
    if (!users.length) { box.innerHTML = '<div class="empty">Nenhum usuário cadastrado ainda. Aparecem aqui após o 1º login.</div>'; return; }
    var set = members[current.id_grp] || new Set();
    var term = (($('ag-user-search') || {}).value || '').toLowerCase().trim();
    var only = $('ag-only') && $('ag-only').checked;
    var list = users.filter(function (u) {
      if (only && !set.has(u.id_usr)) return false;
      if (!term) return true;
      return ((u.name_usr || '') + ' ' + (u.email_usr || '')).toLowerCase().indexOf(term) >= 0;
    });
    box.innerHTML = list.length ? list.map(function (u) {
      var checked = set.has(u.id_usr) ? 'checked' : '';
      var uau = u.uau_user_usr || '';
      return '<div class="ag-user" data-u="' + esc(u.id_usr) + '">'
        + '<label class="ag-user-main"><input type="checkbox" data-u="' + esc(u.id_usr) + '" ' + checked + '>'
        + '<span><b>' + esc(u.name_usr || (u.email_usr || '').split('@')[0]) + '</b><br><span class="em">' + esc(u.email_usr) + '</span></span></label>'
        + '<div class="ag-uau-col"><span class="ag-uau-lbl">UAU:</span><b class="ag-uau-val' + (uau ? '' : ' empty') + '">' + esc(uau || '—') + '</b></div>'
        + '<div class="ag-uau">'
        + '<span class="ag-uau-view"><button type="button" class="ag-uau-pen btn-icon btn-light" title="Editar usuário UAU">' + SVG_PEN + '</button></span>'
        + '<span class="ag-uau-form" hidden><input class="ag-uau-input" placeholder="usuário UAU" value="' + esc(uau) + '">'
        + '<button type="button" class="ag-uau-save btn btn-primary">Salvar</button>'
        + '<button type="button" class="ag-uau-cancel btn btn-light">×</button></span>'
        + '</div></div>';
    }).join('') : '<div class="empty">Nenhum usuário encontrado.</div>';
    box.querySelectorAll('input[type=checkbox]').forEach(function (cb) { cb.addEventListener('change', onToggle); });
    box.querySelectorAll('.ag-user').forEach(wireUau);
  }

  // edição inline do usuário UAU (fora do <label> p/ não disparar o checkbox)
  function wireUau(row) {
    var uid = row.getAttribute('data-u');
    var view = row.querySelector('.ag-uau-view'), form = row.querySelector('.ag-uau-form');
    var input = row.querySelector('.ag-uau-input'), valEl = row.querySelector('.ag-uau-val');
    var user = users.find(function (u) { return u.id_usr === uid; });
    function show(editing) { view.hidden = editing; form.hidden = !editing; if (editing) { input.value = (user && user.uau_user_usr) || ''; input.focus(); } }
    row.querySelector('.ag-uau-pen').addEventListener('click', function () { show(true); });
    row.querySelector('.ag-uau-cancel').addEventListener('click', function () { show(false); });
    row.querySelector('.ag-uau-save').addEventListener('click', async function () {
      var val = (input.value || '').trim();
      var nome = (user && (user.name_usr || user.email_usr)) || 'usuário';
      if (!(await confirmar('Salvar usuário UAU "' + (val || '(vazio)') + '" para ' + nome + '?'))) return;
      var save = row.querySelector('.ag-uau-save'); save.disabled = true;
      try {
        await window.API.post('/admin/users/uau', { id_usr: uid, uau_user: val || null });
        if (user) user.uau_user_usr = val || null;
        valEl.textContent = val || '—';
        valEl.classList.toggle('empty', !val);
        show(false);
        toast('Usuário UAU salvo.', true);
      } catch (e) { toast('Erro: ' + e.message); }
      finally { save.disabled = false; }
    });
  }

  function renderDetail() {
    if (!current) { $('ag-detail').innerHTML = '<div class="empty">Selecione um grupo à esquerda para gerenciar os usuários.</div>'; return; }
    var set = members[current.id_grp] || new Set();
    $('ag-detail').innerHTML =
      '<div class="ag-detail-head">'
      + '<div><div class="section-title" style="font-size:16px">' + esc(current.name_grp) + '</div>'
      + '<div class="section-sub" style="margin:2px 0 0">' + esc(current.description_grp || '') + '</div></div>'
      + '<span class="badge blue" id="ag-membadge">' + set.size + ' membro(s)</span></div>'
      + '<div class="ag-detail-tools">'
      + '<div class="pl-search">' + SVG_SEARCH + '<input id="ag-user-search" placeholder="Buscar usuário por nome ou e-mail…"></div>'
      + '<label class="ag-only"><input type="checkbox" id="ag-only"> Só membros</label>'
      + '</div>'
      + '<div class="ag-userlist" id="ag-userlist"></div>';
    $('ag-user-search').addEventListener('input', renderUsers);
    $('ag-only').addEventListener('change', renderUsers);
    renderUsers();
  }

  $('ag-search').addEventListener('input', renderGroups);
  renderGroups();
}
