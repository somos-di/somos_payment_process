// Admin — Grupos & Usuários: atribui usuários do Supabase aos grupos (migrados do Mitra).
// Leituras via /data (groups, users_group) e /admin/users; escrita via /admin/users-group.
async function initView_admin_grupos() {
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  var SVG_SEARCH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>';
  function toast(msg, ok) {
    var t = document.createElement('div'); t.textContent = msg;
    t.style.cssText = 'position:fixed;top:16px;right:16px;z-index:9999;padding:10px 14px;border-radius:8px;font-size:14px;box-shadow:var(--shadow-md);'
      + (ok ? 'background:var(--ok-weak);color:#166534' : 'background:var(--danger-weak);color:#9f1239');
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, 3500);
  }

  var groups = [], users = [], members = {}; // members[group_usg] = Set(user_usg)
  var current = null;

  try {
    groups = await window.SB.select('groups', function (q) { return q.order('name_grp'); });
    users = await window.API.get('/admin/users');
    var ug = await window.SB.select('users_group');
    ug.forEach(function (r) { (members[r.group_usg] = members[r.group_usg] || new Set()).add(r.user_usg); });
  } catch (e) {
    $('ag-groups').innerHTML = '<div class="view-error">' + esc(e.message) + '</div>'; return;
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
      return '<label class="ag-user"><input type="checkbox" data-u="' + esc(u.id_usr) + '" ' + checked + '>'
        + '<span><b>' + esc(u.name_usr || (u.email_usr || '').split('@')[0]) + '</b><br><span class="em">' + esc(u.email_usr) + '</span></span></label>';
    }).join('') : '<div class="empty">Nenhum usuário encontrado.</div>';
    box.querySelectorAll('input[type=checkbox]').forEach(function (cb) { cb.addEventListener('change', onToggle); });
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
