// Admin — Permissões por Empresa/Obra/Tipo: concede visibilidade a um grupo
// (company_rules + building_permission + process_kind_rules). Não torna aprovador.
async function initView_permissoes() {
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function toast(msg, ok) {
    var t = document.createElement('div'); t.textContent = msg;
    t.style.cssText = 'position:fixed;top:16px;right:16px;z-index:9999;padding:10px 14px;border-radius:8px;font-size:14px;box-shadow:var(--shadow-md);'
      + (ok ? 'background:var(--ok-weak);color:#166534' : 'background:var(--danger-weak);color:#9f1239');
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, 3500);
  }

  var groups = [], empresas = [], kinds = [];
  var empNome = {}, kindNome = {};
  var obrasByEmp = {};     // codigo empresa -> [obras]
  var obraNome = {};       // 'emp/obra' -> nome

  try {
    groups = await window.SB.select('groups', function (q) { return q.order('name_grp'); });
    empresas = await window.SB.select('v_empresas', function (q) { return q.order('nome'); });
    kinds = await window.SB.select('process_kinds', function (q) { return q.order('name_pkn'); });
  } catch (e) { $('pm-list').innerHTML = '<div class="view-error">' + esc(e.message) + '</div>'; return; }

  empresas.forEach(function (e) { empNome[String(e.codigo)] = e.nome; });
  kinds.forEach(function (k) { kindNome[k.id_pkn] = k.name_pkn; });

  $('pm-group').innerHTML = '<option value="">Selecione…</option>' +
    groups.map(function (g) { return '<option value="' + g.id_grp + '">' + esc(g.name_grp) + '</option>'; }).join('');
  $('pm-empresa').innerHTML = '<option value="">Selecione…</option>' +
    empresas.map(function (e) { return '<option value="' + esc(e.codigo) + '">' + esc(e.nome) + ' (' + esc(e.codigo) + ')</option>'; }).join('');
  $('pm-tipos').innerHTML = kinds.map(function (k) {
    return '<label class="pm-check"><input type="checkbox" class="pm-tipo" value="' + k.id_pkn + '"> ' + esc(k.name_pkn) + '</label>';
  }).join('');

  async function obrasOf(emp) {
    if (obrasByEmp[emp]) return obrasByEmp[emp];
    var rows = await window.SB.select('v_obras', function (q) { return q.eq('empresa', emp).order('nome'); });
    obrasByEmp[emp] = rows;
    rows.forEach(function (o) { obraNome[emp + '/' + o.codigo] = o.nome; });
    return rows;
  }

  async function renderObras() {
    var emp = $('pm-empresa').value;
    var box = $('pm-obras');
    if (!emp) { box.innerHTML = '<div class="empty" style="padding:4px">Selecione uma empresa.</div>'; return; }
    box.innerHTML = '<div class="empty" style="padding:4px">Carregando…</div>';
    var rows = await obrasOf(emp);
    box.innerHTML = rows.length ? rows.map(function (o) {
      return '<label class="pm-check"><input type="checkbox" class="pm-obra-ck" value="' + esc(o.codigo) + '"> ' + esc(o.nome) + ' (' + esc(o.codigo) + ')</label>';
    }).join('') : '<div class="empty" style="padding:4px">Nenhuma obra para esta empresa.</div>';
  }

  function checked(cls) { return Array.prototype.slice.call(document.querySelectorAll('.' + cls + ':checked')).map(function (c) { return c.value; }); }
  function setAll(cls, on) { document.querySelectorAll('.' + cls).forEach(function (c) { c.checked = on; }); }

  // helpers
  $('pm-empresa').addEventListener('change', renderObras);
  $('pm-obras-all').addEventListener('click', function () { setAll('pm-obra-ck', true); });
  $('pm-obras-none').addEventListener('click', function () { setAll('pm-obra-ck', false); });
  $('pm-tipos-all').addEventListener('click', function () { setAll('pm-tipo', true); });
  $('pm-tipos-none').addEventListener('click', function () { setAll('pm-tipo', false); });
  $('pm-tipos-nopj').addEventListener('click', function () {
    document.querySelectorAll('.pm-tipo').forEach(function (c) { c.checked = (c.value !== '3'); }); // 3 = Processo PJ
  });

  async function loadList() {
    var g = $('pm-group').value, host = $('pm-list');
    if (!g) { host.innerHTML = '<div class="empty">Selecione um grupo.</div>'; return; }
    host.innerHTML = '<div class="empty">Carregando…</div>';
    var rules;
    try { rules = await window.SB.select('process_kind_rules', function (q) { return q.eq('group_pkr', Number(g)); }); }
    catch (e) { host.innerHTML = '<div class="view-error">' + esc(e.message) + '</div>'; return; }
    if (!rules.length) { host.innerHTML = '<div class="empty">Este grupo ainda não tem permissões.</div>'; return; }
    // garante nomes de obra das empresas presentes
    var emps = {}; rules.forEach(function (r) { emps[String(r.company_pkr)] = 1; });
    await Promise.all(Object.keys(emps).map(function (e) { return obrasOf(e); }));
    // agrupa empresa -> obra -> [kinds]
    var tree = {};
    rules.forEach(function (r) {
      var c = String(r.company_pkr), b = String(r.building_pkr);
      (tree[c] = tree[c] || {});
      (tree[c][b] = tree[c][b] || []).push(r.kind_pkr);
    });
    host.innerHTML = Object.keys(tree).sort().map(function (c) {
      var obras = Object.keys(tree[c]).sort().map(function (b) {
        var tags = tree[c][b].sort(function (a, z) { return a - z; }).map(function (kid) {
          return '<span class="pm-tag">' + esc(kindNome[kid] || ('Tipo ' + kid))
            + '<button title="Remover" data-c="' + esc(c) + '" data-b="' + esc(b) + '" data-k="' + kid + '">&times;</button></span>';
        }).join('');
        return '<div class="pm-obra"><div class="pm-obra-name">' + esc(obraNome[c + '/' + b] || b) + ' <span style="color:var(--muted)">(' + esc(b) + ')</span></div>' + tags + '</div>';
      }).join('');
      return '<div class="pm-list-grp"><div class="pm-emp-title">' + esc(empNome[c] || c) + ' <span style="color:var(--muted);font-weight:400">(' + esc(c) + ')</span></div>' + obras + '</div>';
    }).join('');
    host.querySelectorAll('.pm-tag button').forEach(function (b) {
      b.addEventListener('click', async function () {
        b.disabled = true;
        try {
          await window.API.post('/admin/permissions/delete', { group: Number(g), company: b.getAttribute('data-c'), building: b.getAttribute('data-b'), kind: Number(b.getAttribute('data-k')) });
          toast('Permissão removida.', true); loadList();
        } catch (e) { b.disabled = false; toast('Erro: ' + e.message); }
      });
    });
  }
  $('pm-group').addEventListener('change', loadList);

  $('pm-add').addEventListener('click', async function () {
    var g = $('pm-group').value, emp = $('pm-empresa').value;
    var obras = checked('pm-obra-ck'), tipos = checked('pm-tipo');
    var msg = $('pm-msg');
    if (!g) return toast('Escolha um grupo.');
    if (!emp || !obras.length || !tipos.length) return toast('Escolha empresa, ao menos 1 obra e 1 tipo.');
    var combos = [];
    obras.forEach(function (b) { tipos.forEach(function (k) { combos.push({ group: Number(g), company: emp, building: b, kind: Number(k) }); }); });
    $('pm-add').disabled = true; msg.textContent = 'Adicionando ' + combos.length + '…'; msg.style.color = 'var(--muted)';
    var ok = 0, err = 0;
    for (var i = 0; i < combos.length; i++) {
      try { await window.API.post('/admin/permissions', combos[i]); ok++; } catch (e) { err++; }
    }
    $('pm-add').disabled = false;
    msg.textContent = ok + ' adicionada(s)' + (err ? ' · ' + err + ' erro(s)' : ''); msg.style.color = err ? '#9f1239' : '#166534';
    loadList();
  });
}
