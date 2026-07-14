// COMISSÕES (mini app): lista o fluxo de comissões e permite avançar as etapas
// (validar → aguardando NF → anexar NF → lançar no UAU), pendência e cancelar.
// Sem aprovação/parcelas. Empreendimento exibido pelo NOME (a view já resolve o id).
// Visibilidade por trilha vem da RLS; a rota é gated a is_commission/admin no router.
async function initView_comissoes() {
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function money(v) { return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  function fmtDate(d) { return d ? String(d).split('T')[0].split('-').reverse().join('/') : '—'; }
  function fmtDateTime(d) {
    if (!d) return '—';
    try { return new Date(d).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
    catch (e) { return String(d); }
  }
  function toast(msg, ok) {
    var t = document.createElement('div'); t.textContent = msg;
    t.style.cssText = 'position:fixed;top:16px;right:16px;z-index:10000;padding:10px 14px;border-radius:8px;font-size:14px;box-shadow:var(--shadow-md);'
      + (ok ? 'background:var(--ok-weak);color:#166534' : 'background:var(--danger-weak);color:#9f1239');
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, 4000);
  }
  function overlay(html, width) {
    var o = document.createElement('div'); o.className = 'modal-overlay';
    o.innerHTML = '<div class="modal-box" style="width:' + (width || 440) + 'px;max-width:94vw">' + html + '</div>';
    document.body.appendChild(o);
    o.addEventListener('click', function (e) { if (e.target === o) o.remove(); });
    return o;
  }

  var STATUS_CLS = { 0: 'red', 1: 'blue', 2: 'violet', 3: 'warn', 4: 'ok', 5: 'red' };
  var STEPS = {};
  try { (await window.Store.get('comm_status') || []).forEach(function (s) { STEPS[s.id_csk] = s.descr_csk; }); } catch (e) { }

  // popular filtro de status
  var stSel = $('com-status');
  stSel.innerHTML = '<option value="">Todos</option>' + Object.keys(STEPS).map(function (id) {
    return '<option value="' + esc(id) + '">' + esc(STEPS[id]) + '</option>';
  }).join('');

  var rows = [];
  async function reload() {
    $('com-body').innerHTML = '<div class="empty">Carregando…</div>';
    try { rows = await window.Store.get('commissions'); render(); }
    catch (e) { window.viewError($('com-body'), e); }
  }

  function filtered() {
    var t = ($('com-search').value || '').toLowerCase().trim();
    var trilha = $('com-trilha').value, status = $('com-status').value;
    return rows.filter(function (c) {
      if (trilha && c.trilha !== trilha) return false;
      if (status !== '' && Number(c.status_step_com) !== Number(status)) return false;
      if (t && [c.empreendimento_nome, c.seller_name_com, c.client_name_com, c.unit_com, c.id_com].join(' ').toLowerCase().indexOf(t) < 0) return false;
      return true;
    });
  }

  // papel do usuário (do /auth/me): trilha (is_commission) faz 1-2; financeiro (is_financeiro) finaliza; admin tudo.
  var me = (window.Auth && window.Auth.getUser && window.Auth.getUser()) || {};
  var isAdmin = !!me.is_admin, isTrack = !!(me.is_commission || me.is_admin), isFin = !!(me.is_financeiro || me.is_admin);

  // ações disponíveis por status (espelha a máquina de estados da RPC) FILTRADAS pelo papel
  function actionsFor(c) {
    var s = Number(c.status_step_com), a = [], part = isTrack || isFin;
    if (s === 1 && isTrack) a.push('validate');
    if ((s === 2 || s === 5) && isTrack) a.push('set-nf');       // 5 = Pendência: reanexar NF e reenviar (correção)
    if (s === 3 && isFin) a.push('finalize');
    if ([1, 2, 3].indexOf(s) >= 0 && part) a.push('pendency');   // pendenciar só no fluxo ativo
    if (s !== 0 && s !== 4 && part) a.push('cancel');            // cancelar em qualquer etapa aberta
    return a;
  }
  var LABEL = { validate: 'Validar', 'set-nf': 'Anexar NF', finalize: 'Finalizar (Financeiro)', resolve: 'Resolver', pendency: 'Pendência', cancel: 'Cancelar' };
  var CLS = { validate: 'btn-primary', 'set-nf': 'btn-primary', finalize: 'btn-primary', resolve: 'btn-primary', pendency: 'btn-light', cancel: 'btn-danger' };

  function render() {
    var data = filtered();
    if (!data.length) { $('com-body').innerHTML = '<div class="empty">Nenhuma comissão.</div>'; return; }
    var html = '<div class="table-scroll"><table><thead><tr>'
      + '<th>#</th><th>Empreendimento</th><th>Trilha</th><th>Unidade</th><th>Vendedor</th><th>Cliente</th>'
      + '<th>Valor</th><th>Status</th><th></th></tr></thead><tbody>';
    data.forEach(function (c, i) {
      html += '<tr data-i="' + i + '">'
        + '<td>' + esc(c.id_com) + '</td>'
        + '<td>' + esc(c.empreendimento_nome || '—') + '</td>'
        + '<td>' + esc(c.trilha) + '</td>'
        + '<td>' + esc(c.unit_com || '—') + '</td>'
        + '<td>' + esc(c.seller_name_com || '—') + '</td>'
        + '<td>' + esc(c.client_name_com || '—') + '</td>'
        + '<td>' + money(c.value_com) + '</td>'
        + '<td><span class="badge ' + (STATUS_CLS[c.status_step_com] || '') + '">' + esc(c.status_nome) + '</span></td>'
        + '<td class="fin-acts" style="white-space:nowrap;text-align:right"></td></tr>';
    });
    html += '</tbody></table></div>';
    $('com-body').innerHTML = html;

    $('com-body').querySelectorAll('tr[data-i]').forEach(function (tr) {
      var c = data[+tr.getAttribute('data-i')], cell = tr.lastElementChild;
      tr.style.cursor = 'pointer';
      tr.addEventListener('click', function () { openDetail(c); });
      actionsFor(c).forEach(function (act) {
        var b = document.createElement('button');
        b.className = 'btn ' + (CLS[act] || 'btn-light'); b.style.marginLeft = '6px';
        b.textContent = (act === 'set-nf' && Number(c.status_step_com) === 5) ? 'Anexar NF e reenviar' : LABEL[act];
        b.addEventListener('click', function (e) { e.stopPropagation(); runAction(c, act); });
        cell.appendChild(b);
      });
    });
  }

  function post(uuid, action, body) { return window.API.post('/commissions/' + uuid + '/' + action, body || {}); }
  async function done() { window.Store.invalidate('commissions'); window.Store.invalidate('comm_history'); await reload(); }

  function runAction(c, act) {
    if (act === 'validate') return confirmThen('Validar esta comissão e solicitar a Nota Fiscal?', function () { return post(c.uuid_com, 'validate'); });
    if (act === 'resolve') return confirmThen('Resolver a pendência e voltar para "A validar"?', function () { return post(c.uuid_com, 'resolve'); });
    if (act === 'set-nf') return openNfModal(c);
    if (act === 'finalize') return confirmThen('Validar e FINALIZAR esta comissão? (encerra o processo — sem integração)', function () { return post(c.uuid_com, 'finalize'); });
    if (act === 'pendency') return promptThen('Registrar pendência nesta comissão?', function (note) { return post(c.uuid_com, 'pendency', { note: note }); });
    if (act === 'cancel') return promptThen('Cancelar esta comissão? Esta ação é irreversível.', function (note) { return post(c.uuid_com, 'cancel', { note: note }); }, true);
  }

  async function confirmThen(msg, fn) {
    var o = overlay('<div class="modal-title">Confirmação</div><div style="font-size:14px;color:var(--text-2);line-height:1.5">' + esc(msg) + '</div>'
      + '<div class="modal-actions"><button class="btn btn-light" data-x>Cancelar</button><button class="btn btn-primary" data-ok>Confirmar</button></div>');
    o.querySelector('[data-x]').addEventListener('click', function () { o.remove(); });
    o.querySelector('[data-ok]').addEventListener('click', async function () {
      o.remove();
      try { await fn(); toast('Feito.', true); await done(); } catch (e) { toast('Erro: ' + e.message); }
    });
  }
  async function promptThen(msg, fn, danger) {
    var o = overlay('<div class="modal-title">' + esc(msg) + '</div>'
      + '<textarea data-note rows="3" maxlength="500" placeholder="Motivo (opcional)…" style="margin-top:10px"></textarea>'
      + '<div class="modal-actions"><button class="btn btn-light" data-x>Cancelar</button><button class="btn ' + (danger ? 'btn-danger' : 'btn-primary') + '" data-ok>Confirmar</button></div>');
    o.querySelector('[data-x]').addEventListener('click', function () { o.remove(); });
    o.querySelector('[data-ok]').addEventListener('click', async function () {
      var note = o.querySelector('[data-note]').value.trim(); o.remove();
      try { await fn(note); toast('Feito.', true); await done(); } catch (e) { toast('Erro: ' + e.message); }
    });
  }

  function openNfModal(c) {
    var nfUrl = c.nf_url_com || null, boletoUrl = c.boleto_url_com || null;
    var o = overlay('<div class="modal-title">Anexar Nota Fiscal</div>'
      + '<div class="com-modal-grid" style="margin-top:8px">'
      + '<div><b style="font-size:13px">Nota Fiscal (obrigatória)</b>'
      + '<label class="com-dz" for="com-nf"><b>Clique para enviar</b><small>PDF/imagem</small></label>'
      + '<input id="com-nf" type="file" hidden><div class="com-file" id="com-nf-name">' + (nfUrl ? 'NF já anexada' : '') + '</div></div>'
      + '<div><b style="font-size:13px">Boleto (opcional)</b>'
      + '<label class="com-dz" for="com-bol"><b>Clique para enviar</b><small>PDF/imagem</small></label>'
      + '<input id="com-bol" type="file" hidden><div class="com-file" id="com-bol-name">' + (boletoUrl ? 'Boleto já anexado' : '') + '</div></div>'
      + '</div>'
      + '<div class="modal-actions"><button class="btn btn-light" data-x>Cancelar</button><button class="btn btn-primary" data-ok>Salvar e avançar</button></div>', 520);
    function up(inputId, nameId, set) {
      o.querySelector('#' + inputId).addEventListener('change', async function () {
        if (!this.files[0]) return;
        o.querySelector('#' + nameId).textContent = 'Enviando…';
        try { var r = await window.SB.upload(this.files[0]); set(r ? r.url : null); o.querySelector('#' + nameId).textContent = this.files[0].name; }
        catch (e) { o.querySelector('#' + nameId).textContent = ''; toast('Falha no anexo: ' + (e.message || 'storage')); }
      });
    }
    up('com-nf', 'com-nf-name', function (u) { nfUrl = u; });
    up('com-bol', 'com-bol-name', function (u) { boletoUrl = u; });
    o.querySelector('[data-x]').addEventListener('click', function () { o.remove(); });
    o.querySelector('[data-ok]').addEventListener('click', async function () {
      if (!nfUrl) { toast('Anexe a Nota Fiscal para avançar.'); return; }
      o.remove();
      try { await post(c.uuid_com, 'set-nf', { nf_url: nfUrl, boleto_url: boletoUrl }); toast('NF anexada.', true); await done(); }
      catch (e) { toast('Erro: ' + e.message); }
    });
  }

  // Detalhe da comissão: dados + anexos + timeline (v_comm_history). Abre ao clicar na linha.
  async function openDetail(c) {
    function vr(k, v) { return (v == null || v === '') ? '' : '<div class="vr"><div class="vk">' + esc(k) + '</div><div class="vv">' + v + '</div></div>'; }
    function link(url, label) { return url ? '<a href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(label) + '</a>' : ''; }
    var dados = ''
      + vr('Empresa', esc(c.empresa_nome) + ' <span style="color:var(--muted)">(' + esc(c.company_com) + ')</span>')
      + vr('Obra', esc(c.building_com))
      + vr('Unidade', esc(c.unit_com))
      + vr('Nº da Venda', esc(c.sale_num_com))
      + vr('Data da Venda', c.sale_date_com ? fmtDate(c.sale_date_com) : '')
      + vr('Data de Liberação', c.release_date_com ? fmtDate(c.release_date_com) : '')
      + vr('Cliente', esc(c.client_name_com))
      + vr('Vendedor', esc(c.seller_name_com))
      + vr('Código do Vendedor', c.seller_id_com != null ? esc(c.seller_id_com) : '')
      + vr('E-mail', esc(c.seller_email_com))
      + vr('Celular', esc(c.seller_phone_com))
      + vr('Valor', money(c.value_com))
      + vr('Observação', esc(c.note_com))
      + vr('Nota Fiscal', link(c.nf_url_com, 'Abrir NF'))
      + vr('Boleto', link(c.boleto_url_com, 'Abrir boleto'));

    var o = overlay('<div class="modal-title">Comissão #' + esc(c.id_com) + ' — ' + esc(c.empreendimento_nome || '—')
      + ' <span class="badge ' + (STATUS_CLS[c.status_step_com] || '') + '" style="margin-left:8px">' + esc(c.status_nome) + '</span></div>'
      + '<div class="validate-table" style="margin-top:8px">' + dados + '</div>'
      + '<div style="font-weight:700;font-size:13px;margin:16px 0 6px">Histórico</div>'
      + '<div id="com-hist"><div class="empty">Carregando…</div></div>'
      + '<div class="modal-actions"><button class="btn btn-light" data-x>Fechar</button></div>', 600);
    o.querySelector('[data-x]').addEventListener('click', function () { o.remove(); });
    try {
      var hist = await window.Store.get('comm_history', c.uuid_com);
      o.querySelector('#com-hist').innerHTML = (hist && hist.length)
        ? '<ul style="list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px">' + hist.map(function (h) {
            return '<li style="border-left:2px solid var(--border);padding:2px 0 2px 12px">'
              + '<div style="font-size:13.5px">' + esc(h.action_chs) + '</div>'
              + '<div style="font-size:12px;color:var(--muted)">' + esc(h.user_nome || 'sistema') + ' · ' + esc(fmtDateTime(h.created_at_chs)) + '</div></li>';
          }).join('') + '</ul>'
        : '<div class="empty">Sem histórico.</div>';
    } catch (e) { o.querySelector('#com-hist').innerHTML = '<div class="empty">Falha ao carregar histórico.</div>'; }
  }

  ['com-search', 'com-trilha', 'com-status'].forEach(function (id) { $(id).addEventListener('input', render); $(id).addEventListener('change', render); });
  $('com-refresh').addEventListener('click', done);
  $('com-clear').addEventListener('click', function () { $('com-search').value = ''; $('com-trilha').value = ''; $('com-status').value = ''; render(); });

  await reload();
}
