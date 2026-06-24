// Modal "Detalhes do Processo" — reaproveitável. window.openProcessDetail(proc)
// Dados gerais + anexos (boleto/NF) + aba Histórico (Store.get('history', uuid)).
(function () {
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function money(v) { return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  function fmtDate(d) { return d ? String(d).split('T')[0].split('-').reverse().join('/') : '—'; }
  function fmtDT(d) { if (!d) return ''; var s = String(d).replace('T', ' '); var dt = s.slice(0, 10).split('-').reverse().join('/'); return dt + ' ' + s.slice(11, 16); }
  function field(label, val) { return '<div class="fld"><label>' + esc(label) + '</label><div class="val">' + esc(val || '—') + '</div></div>'; }

  window.openProcessDetail = async function (proc) {
    var o = document.createElement('div'); o.className = 'modal-overlay';
    var steps = (window.CONFIG.STEPS || {}), kinds = (window.CONFIG.PROCESS_KINDS || {});
    o.innerHTML =
      '<div class="modal-box lg"><button class="modal-x" aria-label="Fechar">×</button>'
      + '<div class="tabs"><button class="tab active" data-t="dados">Detalhes</button><button class="tab" data-t="hist">Histórico</button></div>'
      + '<div data-pane="dados" class="pane"><h3>Dados Gerais</h3>'
      + field('Empresa', proc.empresa_nome || proc.company_prc)
      + field('Obra', proc.obra_nome || proc.building_prc)
      + field('Fornecedor', proc.fornecedor_nome || proc.person_prc)
      + field('Composição', proc.composicao_nome || ((proc.composition_prc || '') + (proc.supply_prc ? ' / ' + proc.supply_prc : '')))
      + field('Tipo de Processo', proc.tipo_nome || kinds[proc.kind_prc] || proc.kind_prc)
      + field('Tipo de Documento', proc.documento_nome)
      + field('Emissão', fmtDate(proc.issue_date_prc))
      + field('Valor', money(proc.value_prc)) + field('Vencimento', fmtDate(proc.due_date_prc))
      + field('Status', proc.status_nome || steps[proc.status_step_prc] || proc.status_step_prc)
      + '<div class="docs">'
      + (proc.attachment_url_prc ? '<a class="btn btn-ghost" target="_blank" href="' + esc(proc.attachment_url_prc) + '">Boleto</a>' : '')
      + (proc.attachment_url2_prc ? '<a class="btn btn-ghost" target="_blank" href="' + esc(proc.attachment_url2_prc) + '">Nota Fiscal</a>' : '')
      + '</div></div>'
      + '<div data-pane="hist" class="pane" hidden><div class="col-body">…</div></div></div>';
    o.addEventListener('click', function (e) { if (e.target === o || e.target.classList.contains('modal-x')) o.remove(); });
    o.querySelectorAll('.tab').forEach(function (t) {
      t.addEventListener('click', function () {
        o.querySelectorAll('.tab').forEach(function (x) { x.classList.remove('active') }); t.classList.add('active');
        o.querySelectorAll('.pane').forEach(function (p) { p.hidden = (p.getAttribute('data-pane') !== t.getAttribute('data-t')); });
      });
    });
    document.body.appendChild(o);
    // registra a VISUALIZAÇÃO e recarrega a timeline (mais recente em cima).
    try { await window.API.post('/processes/' + proc.uuid_prc + '/log', { action: 'Visualizado' }); window.Store.invalidate('history'); } catch (e) { }
    try {
      var h = await window.Store.get('history', proc.uuid_prc); // já vem ordenado desc
      o.querySelector('[data-pane="hist"] .col-body').innerHTML = h.length
        ? '<ul class="timeline">' + h.map(function (x) {
          return '<li><span class="tl-dot"></span><div class="tl-card"><div class="tl-act">' + esc(x.action_hst) + '</div>'
            + '<div class="tl-meta">' + esc(x.user_nome || 'Sistema') + ' · ' + esc(fmtDT(x.created_at_hst)) + '</div></div></li>';
        }).join('') + '</ul>'
        : '<div class="empty">Sem histórico.</div>';
    } catch (e) { }
  };
})();
