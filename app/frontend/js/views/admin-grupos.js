async function initView_admin_grupos() {
  var selectElement = function (id) { return document.getElementById(id); };
  function escapeHtml(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  var SVG_SEARCH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>';
  var SVG_PEN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>';
  function toast(message, isSuccess) {
    var t = document.createElement('div'); t.textContent = message;
    t.style.cssText = 'position:fixed;top:16px;right:16px;z-index:9999;padding:10px 14px;border-radius:8px;font-size:14px;box-shadow:var(--shadow-md);'
      + (isSuccess ? 'background:var(--ok-weak);color:#166534' : 'background:var(--danger-weak);color:#9f1239');
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, 3500);
  }
  function confirmDialog(message) {
    return new Promise(function (resolve) {
      var o = document.createElement('div'); o.className = 'modal-overlay';
      o.innerHTML = '<div class="modal-box" style="width:440px"><div class="modal-title">Confirmação</div>'
        + '<div style="font-size:14px;color:var(--text-2);line-height:1.5">' + escapeHtml(message) + '</div>'
        + '<div class="modal-actions"><button class="btn btn-light" data-x>Cancelar</button>'
        + '<button class="btn btn-primary" data-ok>Confirmar</button></div></div>';
      function close(value) { o.remove(); resolve(value); }
      o.addEventListener('click', function (event) { if (event.target === o) close(false); });
      o.querySelector('[data-x]').addEventListener('click', function () { close(false); });
      o.querySelector('[data-ok]').addEventListener('click', function () { close(true); });
      document.body.appendChild(o); o.querySelector('[data-ok]').focus();
    });
  }

  var groups = [], users = [];
  var userGroups = {};
  var currentUser = null;

  try {
    groups = await window.SB.select('groups', function (query) { return query.order('name_grp'); });
    users = await window.API.get('/admin/users');
    var memberships = await window.SB.select('users_group');
    memberships.forEach(function (membership) { (userGroups[membership.user_usg] = userGroups[membership.user_usg] || new Set()).add(membership.group_usg); });
  } catch (error) {
    window.viewError(selectElement('ag-users'), error); return;
  }

  function groupCountOf(userId) { return (userGroups[userId] && userGroups[userId].size) || 0; }

  function renderUserList() {
    var term = (selectElement('ag-search').value || '').toLowerCase().trim();
    var list = users.filter(function (user) {
      return !term || ((user.name_usr || '') + ' ' + (user.email_usr || '')).toLowerCase().indexOf(term) >= 0;
    });
    if (!list.length) { selectElement('ag-users').innerHTML = '<div class="empty">Nenhum usuário encontrado.</div>'; return; }
    selectElement('ag-users').innerHTML = list.map(function (listItem) {
      var cssClass = currentUser && currentUser.id_usr === listItem.id_usr ? 'ag-item active' : 'ag-item';
      return '<div class="' + cssClass + '" data-u="' + escapeHtml(listItem.id_usr) + '">'
        + '<span class="ag-id"><b>' + escapeHtml(listItem.name_usr || (listItem.email_usr || '').split('@')[0]) + '</b>'
        + '<span>' + escapeHtml(listItem.email_usr) + '</span></span>'
        + '<small>' + groupCountOf(listItem.id_usr) + ' grupo(s)</small></div>';
    }).join('');
    selectElement('ag-users').querySelectorAll('.ag-item').forEach(function (item) {
      item.addEventListener('click', function () {
        currentUser = users.find(function (user) { return user.id_usr === item.getAttribute('data-u'); });
        renderUserList(); renderUserDetail();
      });
    });
  }

  function groupTags(g) {
    var tags = '';
    if (g.restrict_launch_kinds_grp) tags += '<span class="badge violet">Lançador</span>';
    if (g.is_urgent_approver_grp) tags += '<span class="badge warn">Urgência</span>';
    return tags ? '<span class="gtags">' + tags + '</span>' : '';
  }

  function renderGroupList() {
    if (!currentUser) return;
    var box = selectElement('ag-grouplist'); if (!box) return;
    var set = userGroups[currentUser.id_usr] || new Set();
    var term = ((selectElement('ag-group-search') || {}).value || '').toLowerCase().trim();
    var only = selectElement('ag-only') && selectElement('ag-only').checked;
    var list = groups.filter(function (group) {
      if (only && !set.has(group.id_grp)) return false;
      return !term || (group.name_grp || '').toLowerCase().indexOf(term) >= 0;
    });
    box.innerHTML = list.length ? list.map(function (listItem) {
      var checked = set.has(listItem.id_grp) ? 'checked' : '';
      return '<label class="ag-group-row"><input type="checkbox" data-g="' + listItem.id_grp + '" ' + checked + '>'
        + '<span><span class="gname">' + escapeHtml(listItem.name_grp) + '</span>'
        + (listItem.description_grp ? '<span class="gdesc"> - ' + escapeHtml(listItem.description_grp) + '</span>' : '') + '</span>'
        + groupTags(listItem) + '</label>';
    }).join('') : '<div class="empty">Nenhum grupo encontrado.</div>';
    box.querySelectorAll('input[type=checkbox]').forEach(function (checkbox) { checkbox.addEventListener('change', onToggleGroup); });
  }

  async function onToggleGroup(event) {
    var checkbox = event.target, groupId = Number(checkbox.getAttribute('data-g')), isAdding = checkbox.checked;
    var userId = currentUser.id_usr;
    checkbox.disabled = true;
    try {
      await window.API.post('/admin/users-group' + (isAdding ? '' : '/delete'), { user_usg: userId, group_usg: groupId });
      if (!userGroups[userId]) userGroups[userId] = new Set();
      if (isAdding) userGroups[userId].add(groupId); else userGroups[userId].delete(groupId);
      var membershipBadge = selectElement('ag-membadge'); if (membershipBadge) membershipBadge.textContent = userGroups[userId].size + ' grupo(s)';
      renderUserList();
      var only = selectElement('ag-only'); if (only && only.checked && !isAdding) renderGroupList();
      toast(isAdding ? 'Adicionado ao grupo.' : 'Removido do grupo.', true);
    } catch (error) { checkbox.checked = !isAdding; toast('Erro: ' + error.message); }
    finally { checkbox.disabled = false; }
  }

  function wireUauEditor(host) {
    var view = host.querySelector('.ag-uau-view'), form = host.querySelector('.ag-uau-form');
    var input = host.querySelector('.ag-uau-input'), valEl = host.querySelector('.ag-uau-val');
    function show(editing) {
      view.hidden = editing; form.hidden = !editing;
      if (editing) { input.value = currentUser.uau_user_usr || ''; input.focus(); }
    }
    host.querySelector('.ag-uau-pen').addEventListener('click', function () { show(true); });
    host.querySelector('.ag-uau-cancel').addEventListener('click', function () { show(false); });
    host.querySelector('.ag-uau-save').addEventListener('click', async function () {
      var value = (input.value || '').trim();
      var label = currentUser.name_usr || currentUser.email_usr || 'usuário';
      if (!(await confirmDialog('Salvar usuário UAU "' + (value || '(vazio)') + '" para ' + label + '?'))) return;
      var save = host.querySelector('.ag-uau-save'); save.disabled = true;
      try {
        await window.API.post('/admin/users/uau', { id_usr: currentUser.id_usr, uau_user: value || null });
        currentUser.uau_user_usr = value || null;
        valEl.textContent = value || '-';
        valEl.classList.toggle('empty', !value);
        show(false);
        toast('Usuário UAU salvo.', true);
      } catch (error) { toast('Erro: ' + error.message); }
      finally { save.disabled = false; }
    });
  }

  function renderUserDetail() {
    if (!currentUser) { selectElement('ag-detail').innerHTML = '<div class="empty">Selecione um usuário à esquerda para gerenciar os grupos dele.</div>'; return; }
    var set = userGroups[currentUser.id_usr] || new Set();
    var uauUser = currentUser.uau_user_usr || '';
    selectElement('ag-detail').innerHTML =
      '<div class="ag-detail-head">'
      + '<div><div class="section-title" style="font-size:16px">' + escapeHtml(currentUser.name_usr || (currentUser.email_usr || '').split('@')[0]) + '</div>'
      + '<div class="section-sub" style="margin:2px 0 6px">' + escapeHtml(currentUser.email_usr || '') + '</div>'
      + '<div class="ag-uau"><span class="ag-uau-lbl">UAU:</span>'
      + '<span class="ag-uau-view"><b class="ag-uau-val' + (uauUser ? '' : ' empty') + '">' + escapeHtml(uauUser || '-') + '</b>'
      + '<button type="button" class="ag-uau-pen btn-icon btn btn-light" title="Editar usuário UAU">' + SVG_PEN + '</button></span>'
      + '<span class="ag-uau-form" hidden><input class="ag-uau-input" placeholder="usuário UAU">'
      + '<button type="button" class="ag-uau-save btn btn-primary">Salvar</button>'
      + '<button type="button" class="ag-uau-cancel btn btn-light">×</button></span></div></div>'
      + '<span class="badge blue" id="ag-membadge">' + set.size + ' grupo(s)</span></div>'
      + '<div class="ag-detail-tools">'
      + '<div class="pl-search">' + SVG_SEARCH + '<input id="ag-group-search" placeholder="Buscar grupo…"></div>'
      + '<label class="ag-only"><input type="checkbox" id="ag-only"> Só os grupos dele</label>'
      + '</div>'
      + '<div class="ag-grouplist" id="ag-grouplist"></div>';
    wireUauEditor(selectElement('ag-detail'));
    selectElement('ag-group-search').addEventListener('input', renderGroupList);
    selectElement('ag-only').addEventListener('change', renderGroupList);
    renderGroupList();
  }

  function openNewGroupModal() {
    var o = document.createElement('div'); o.className = 'modal-overlay';
    o.innerHTML = '<div class="modal-box" style="width:480px"><div class="modal-title">Novo grupo</div>'
      + '<div class="field" style="margin-bottom:12px"><label>Nome</label><input data-name maxlength="80" placeholder="Ex.: Lançadores Obra X"></div>'
      + '<div class="field" style="margin-bottom:12px"><label>Descrição (opcional)</label><input data-desc maxlength="200"></div>'
      + '<label style="display:flex;align-items:center;gap:8px;font-size:13.5px;color:var(--text-2);cursor:pointer">'
      + '<input type="checkbox" data-restrict style="width:16px;height:16px;accent-color:var(--accent)">'
      + 'Grupo <b>lançador</b>: membros só veem/lançam os tipos concedidos ao grupo (tela Permissões)</label>'
      + '<div class="modal-actions"><button class="btn btn-light" data-x>Cancelar</button>'
      + '<button class="btn btn-primary" data-ok disabled>Criar grupo</button></div></div>';
    var nameEl = o.querySelector('[data-name]'), isSuccess = o.querySelector('[data-ok]');
    nameEl.addEventListener('input', function () { isSuccess.disabled = nameEl.value.trim().length < 2; });
    function close() { o.remove(); }
    o.addEventListener('click', function (event) { if (event.target === o) close(); });
    o.querySelector('[data-x]').addEventListener('click', close);
    isSuccess.addEventListener('click', async function () {
      isSuccess.disabled = true;
      try {
        var created = await window.API.post('/admin/groups', {
          name: nameEl.value.trim(),
          description: (o.querySelector('[data-desc]').value || '').trim() || undefined,
          restrictLaunch: o.querySelector('[data-restrict]').checked,
        });
        groups.push(created);
        groups.sort(function (group, index) { return String(group.name_grp).localeCompare(index.name_grp); });
        window.Store.invalidate('groups');
        if (currentUser) renderGroupList();
        toast('Grupo "' + created.name_grp + '" criado. Agora conceda as permissões (Empresa/Obra/Tipo).', true);
        close();
      } catch (error) { isSuccess.disabled = false; toast('Erro: ' + error.message); }
    });
    document.body.appendChild(o); nameEl.focus();
  }
  selectElement('ag-new-group').addEventListener('click', openNewGroupModal);

  selectElement('ag-search').addEventListener('input', renderUserList);
  renderUserList();
}
