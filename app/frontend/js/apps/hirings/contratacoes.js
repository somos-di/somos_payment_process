async function initView_contratacoes() {
  var STATUS = {
    0: { t: 'Cancelado', c: '#888888' }, 1: { t: 'Aguardando aprovação', c: '#d08700' },
    2: { t: 'Aguardando recebedor', c: '#2563eb' }, 3: { t: 'Finalizado', c: '#16a34a' }, 4: { t: 'Em correção', c: '#dc2626' }
  };
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function money(v) { if (v == null || v === '') return '—'; try { return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); } catch (e) { return String(v); } }
  function fmtDate(d) { if (!d) return '—'; try { return new Date(d).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch (e) { return String(d); } }

  var rowsEl = document.getElementById('hir-rows');
  var filterEl = document.getElementById('hir-filter-status');
  var overlay = document.getElementById('hir-overlay');
  var modal = document.getElementById('hir-modal');

  Object.keys(STATUS).forEach(function (k) { filterEl.insertAdjacentHTML('beforeend', '<option value="' + k + '">' + STATUS[k].t + '</option>'); });

  var me = (window.Auth && window.Auth.getUser()) || {};
  var departments = [];
  try { departments = (await window.API.get('/hirings/departments')) || []; } catch (e) { }
  var formDepts = me.is_admin ? departments : departments.filter(function (d) { return (d.gestores || []).some(function (g) { return g.id === me.id; }); });

  var all = [];
  async function load() {
    rowsEl.innerHTML = '<tr><td colspan="8" class="empty">Carregando…</td></tr>';
    try { all = (await window.API.get('/hirings')) || []; }
    catch (e) { rowsEl.innerHTML = '<tr><td colspan="8" class="view-error">' + esc(e.message) + '</td></tr>'; return; }
    render();
  }
  function render() {
    var f = filterEl.value;
    var rows = all.filter(function (r) { return !f || String(r.status_step_hir) === f; });
    if (!rows.length) { rowsEl.innerHTML = '<tr><td colspan="8" class="empty">Nenhuma contratação.</td></tr>'; return; }
    rowsEl.innerHTML = rows.map(function (r) {
      var st = STATUS[r.status_step_hir] || { t: r.status_nome, c: '#888888' };
      return '<tr data-uuid="' + r.uuid_hir + '" style="cursor:pointer">'
        + '<td>' + r.id_hir + '</td>'
        + '<td>' + esc(r.name_hir) + (r.age_hir ? ' · ' + r.age_hir + ' anos' : '') + '</td>'
        + '<td>' + esc(r.departamento || '—') + '</td>'
        + '<td>' + esc(r.contract_type_hir) + '</td>'
        + '<td>' + money(r.salary_hir) + '</td>'
        + '<td><span class="badge" style="background:' + st.c + '22;color:' + st.c + '">' + esc(st.t) + '</span></td>'
        + '<td title="Gestor / Diretoria">' + (r.aprov_gestor ? '✓G' : '·G') + ' ' + (r.aprov_diretoria ? '✓D' : '·D') + '</td>'
        + '<td>' + esc(r.author_nome || '—') + '</td></tr>';
    }).join('');
    rowsEl.querySelectorAll('tr[data-uuid]').forEach(function (tr) { tr.addEventListener('click', function () { openDetail(tr.getAttribute('data-uuid')); }); });
  }

  filterEl.addEventListener('change', render);
  document.getElementById('hir-refresh').addEventListener('click', load);
  var newBtn = document.getElementById('hir-new');
  if (!formDepts.length) newBtn.style.display = 'none';
  newBtn.addEventListener('click', function () { openForm(null); });

  function closeModal() { overlay.style.display = 'none'; modal.innerHTML = ''; }
  function showModal(html) {
    overlay.style.cssText = 'display:flex;position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:1000;align-items:flex-start;justify-content:center;padding:40px 16px;overflow:auto';
    modal.style.cssText = 'background:var(--card,#1b1b1b);color:inherit;border-radius:14px;max-width:640px;width:100%;padding:22px;box-shadow:0 20px 60px rgba(0,0,0,.5)';
    modal.innerHTML = html;
  }
  overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(); });

  var inputStyle = 'width:100%;padding:9px 11px;border-radius:9px;border:1px solid var(--border,#333);background:var(--bg,#121212);color:inherit;margin-top:4px;box-sizing:border-box';
  var lblStyle = 'font-size:12px;opacity:.7;display:block;margin-top:12px';
  var TYPES = ['', 'CLT', 'PJ', 'Estágio', 'Temporário', 'Freelancer', 'Aprendiz'];
  var CARGOS = ['Programador', 'Analista', 'Desenvolvedor', 'Designer', 'Gerente', 'Coordenador', 'Assistente', 'Vendedor', 'Analista de Marketing', 'Engenheiro', 'Estagiário', 'Recepcionista'];
  var LEVELS = ['Estágio', 'Júnior', 'Pleno', 'Sênior', 'Especialista', 'Coordenação', 'Gerência', 'Diretoria'];
  var REASONS = ['', 'Aumento de quadro', 'Substituição', 'Para vendas', 'Para ligação', 'Projeto novo', 'Outro'];

  function deptOptions(selected) {
    return formDepts.map(function (d) {
      return '<option value="' + d.id_dep + '"' + (String(selected) === String(d.id_dep) ? ' selected' : '') + '>' + esc(d.name_dep) + '</option>';
    }).join('');
  }

  function dataList(id, opts) { return '<datalist id="' + id + '">' + opts.map(function (o) { return '<option value="' + esc(o) + '">'; }).join('') + '</datalist>'; }
  function openForm(existing) {
    var e = existing || {};
    showModal(
      '<div class="section-title">' + (existing ? 'Editar candidato' : 'Novo candidato') + '</div>'
      + '<label style="' + lblStyle + '">Departamento *</label><select id="f-dep" style="' + inputStyle + '" ' + (existing ? 'disabled' : '') + '><option value="">Selecione</option>' + deptOptions(e.department_hir) + '</select>'
      + '<label style="' + lblStyle + '">Nome do candidato *</label><input id="f-name" style="' + inputStyle + '" value="' + esc(e.name_hir || '') + '">'
      + '<div style="display:flex;gap:12px"><div style="flex:1"><label style="' + lblStyle + '">Idade</label><input id="f-age" type="number" min="0" max="120" style="' + inputStyle + '" value="' + (e.age_hir != null ? e.age_hir : '') + '"></div>'
      + '<div style="flex:1"><label style="' + lblStyle + '">Tipo de contratação *</label><select id="f-type" style="' + inputStyle + '">' + TYPES.map(function (t) { return '<option' + (e.contract_type_hir === t ? ' selected' : '') + '>' + t + '</option>'; }).join('') + '</select></div></div>'
      + '<div style="display:flex;gap:12px"><div style="flex:1"><label style="' + lblStyle + '">Cargo</label><input id="f-cargo" list="dl-cargo" style="' + inputStyle + '" placeholder="Programador, Analista…" value="' + esc(e.cargo_hir || '') + '">' + dataList('dl-cargo', CARGOS) + '</div>'
      + '<div style="flex:1"><label style="' + lblStyle + '">Nível</label><input id="f-level" list="dl-level" style="' + inputStyle + '" placeholder="Júnior, Sênior…" value="' + esc(e.level_hir || '') + '">' + dataList('dl-level', LEVELS) + '</div></div>'
      + '<div style="display:flex;gap:12px"><div style="flex:1"><label style="' + lblStyle + '">Justificativa da contratação</label><select id="f-reason" style="' + inputStyle + '">' + REASONS.map(function (r) { return '<option' + (e.reason_hir === r ? ' selected' : '') + '>' + r + '</option>'; }).join('') + '</select></div>'
      + '<div style="flex:1"><label style="' + lblStyle + '">Salário (opcional)</label><input id="f-salary" type="number" min="0" step="0.01" style="' + inputStyle + '" value="' + (e.salary_hir != null ? e.salary_hir : '') + '"></div></div>'
      + '<label style="' + lblStyle + '">Período (opcional)</label><input id="f-period" style="' + inputStyle + '" value="' + esc(e.period_hir || '') + '">'
      + '<label style="' + lblStyle + '">Redes sociais (LinkedIn, Instagram…)</label><input id="f-social" style="' + inputStyle + '" placeholder="links separados por vírgula" value="' + esc(e.social_hir || '') + '">'
      + '<label style="' + lblStyle + '">Currículo (anexo)</label><input id="f-resume" type="file" accept=".pdf,.doc,.docx,image/*" style="' + inputStyle + '">'
      + (e.resume_url_hir ? '<div style="font-size:12px;margin-top:4px;opacity:.8"><a href="' + esc(e.resume_url_hir) + '" target="_blank" rel="noopener">currículo atual</a> — envie outro para substituir</div>' : '')
      + '<div id="f-msg" style="color:#dc2626;font-size:13px;margin-top:10px"></div>'
      + '<div style="display:flex;justify-content:flex-end;gap:10px;margin-top:18px"><button class="btn btn-light" id="f-cancel">Cancelar</button><button class="btn btn-primary" id="f-save">' + (existing ? 'Salvar' : 'Lançar') + '</button></div>'
    );
    document.getElementById('f-cancel').addEventListener('click', closeModal);
    document.getElementById('f-save').addEventListener('click', async function () {
      var btn = this; btn.disabled = true; var msg = document.getElementById('f-msg'); msg.style.color = '#dc2626'; msg.textContent = '';
      try {
        var resumeUrl = null;
        var fileEl = document.getElementById('f-resume');
        if (fileEl.files && fileEl.files[0]) {
          msg.style.color = '#888'; msg.textContent = 'Enviando currículo…';
          var up = await window.SB.upload(fileEl.files[0]);
          resumeUrl = up ? up.url : null;
          msg.style.color = '#dc2626'; msg.textContent = '';
        }
        var body = {
          department: Number(document.getElementById('f-dep').value) || null,
          name: document.getElementById('f-name').value, contract_type: document.getElementById('f-type').value,
          age: document.getElementById('f-age').value || null, salary: document.getElementById('f-salary').value || null,
          period: document.getElementById('f-period').value || null,
          cargo: document.getElementById('f-cargo').value || null, level: document.getElementById('f-level').value || null,
          reason: document.getElementById('f-reason').value || null, social: document.getElementById('f-social').value || null,
          resume_url: resumeUrl
        };
        if (existing) await window.API.post('/hirings/' + e.uuid_hir + '/update', body);
        else await window.API.post('/hirings/create', body);
        closeModal(); await load();
      } catch (err) { msg.style.color = '#dc2626'; msg.textContent = err.message; btn.disabled = false; }
    });
  }

  async function openDetail(uuid) {
    showModal('<div class="empty">Carregando…</div>');
    var h, hist;
    try { h = await window.API.get('/hirings/' + uuid); hist = await window.API.get('/hirings/' + uuid + '/history'); }
    catch (e) { showModal('<div class="view-error">' + esc(e.message) + '</div><div style="text-align:right;margin-top:12px"><button class="btn btn-light" onclick="document.getElementById(\'hir-overlay\').style.display=\'none\'">Fechar</button></div>'); return; }
    var st = STATUS[h.status_step_hir] || { t: h.status_nome, c: '#888888' };
    var s = h.status_step_hir, actions = [];
    if (s === 1) { actions = [['approve', 'Aprovar', 'btn-primary'], ['reject', 'Devolver p/ correção', 'btn-light'], ['edit', 'Editar', 'btn-light'], ['cancel', 'Cancelar', 'btn-light']]; }
    else if (s === 2) { actions = [['finalize', 'Finalizar', 'btn-primary'], ['reject', 'Devolver p/ correção', 'btn-light']]; }
    else if (s === 4) { actions = [['edit', 'Editar', 'btn-primary'], ['resubmit', 'Reenviar', 'btn-light'], ['cancel', 'Cancelar', 'btn-light']]; }
    var histHtml = (hist || []).map(function (x) {
      return '<div style="display:flex;gap:8px;padding:6px 0;border-top:1px solid var(--border,#2a2a2a)"><span style="opacity:.6;font-size:12px;min-width:104px">' + fmtDate(x.created_at_hhs) + '</span><span style="font-size:13px">' + esc(x.action_hhs) + (x.user_nome ? ' — ' + esc(x.user_nome) : '') + '</span></div>';
    }).join('') || '<div class="empty">Sem histórico.</div>';
    showModal(
      '<div style="display:flex;justify-content:space-between;align-items:start;gap:10px"><div class="section-title">Contratação #' + h.id_hir + '</div><span class="badge" style="background:' + st.c + '22;color:' + st.c + '">' + esc(st.t) + '</span></div>'
      + '<div style="margin-top:10px;display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:14px">'
      + '<div><b>Candidato:</b> ' + esc(h.name_hir) + '</div><div><b>Idade:</b> ' + (h.age_hir != null ? h.age_hir : '—') + '</div>'
      + '<div><b>Departamento:</b> ' + esc(h.departamento || '—') + '</div><div><b>Tipo:</b> ' + esc(h.contract_type_hir) + '</div>'
      + '<div><b>Cargo:</b> ' + esc(h.cargo_hir || '—') + '</div><div><b>Nível:</b> ' + esc(h.level_hir || '—') + '</div>'
      + '<div><b>Justificativa:</b> ' + esc(h.reason_hir || '—') + '</div><div><b>Salário:</b> ' + money(h.salary_hir) + '</div>'
      + '<div><b>Período:</b> ' + esc(h.period_hir || '—') + '</div><div><b>Lançado por:</b> ' + esc(h.author_nome || '—') + '</div>'
      + '<div style="grid-column:1/3"><b>Redes:</b> ' + (h.social_hir ? esc(h.social_hir) : '—') + '</div>'
      + '<div style="grid-column:1/3"><b>Aprovações:</b> ' + esc(h.aprovadores || '—') + '</div>'
      + '</div>'
      + (h.resume_url_hir ? '<div style="margin-top:10px"><a href="' + esc(h.resume_url_hir) + '" target="_blank" rel="noopener" class="btn btn-light">Abrir currículo</a></div>' : '')
      + (h.note_hir ? '<div style="margin-top:8px;font-size:13px;opacity:.85"><b>Obs.:</b> ' + esc(h.note_hir) + '</div>' : '')
      + '<div class="section-sub" style="margin-top:16px">Histórico</div><div style="max-height:200px;overflow:auto;margin-top:4px">' + histHtml + '</div>'
      + '<div id="d-msg" style="color:#dc2626;font-size:13px;margin-top:10px"></div>'
      + '<div style="display:flex;justify-content:flex-end;gap:10px;margin-top:16px;flex-wrap:wrap"><button class="btn btn-light" id="d-close">Fechar</button>'
      + actions.map(function (a) { return '<button class="btn ' + a[2] + '" data-act="' + a[0] + '">' + a[1] + '</button>'; }).join('') + '</div>'
    );
    document.getElementById('d-close').addEventListener('click', closeModal);
    modal.querySelectorAll('button[data-act]').forEach(function (b) { b.addEventListener('click', function () { doAction(b.getAttribute('data-act'), h); }); });
  }

  async function doAction(act, h) {
    if (act === 'edit') { openForm(h); return; }
    var reason = null;
    if (act === 'reject' || act === 'cancel') {
      reason = window.prompt(act === 'reject' ? 'Motivo da correção:' : 'Motivo do cancelamento:');
      if (reason == null || !reason.trim()) return;
    }
    try {
      await window.API.post('/hirings/' + h.uuid_hir + '/' + act, reason != null ? { reason: reason } : undefined);
      closeModal(); await load();
    } catch (err) { var m = document.getElementById('d-msg'); if (m) { m.textContent = err.message; } else { window.alert(err.message); } }
  }

  await load();
}
