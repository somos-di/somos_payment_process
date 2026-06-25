// Modal "Aprovadores do Processo" — reaproveitável. window.openProcessApprovers(proc)
// 3 colunas: Concluídas / Elegíveis (etapa atual) / Próximas etapas. Lê do Store por uuid.
(function () {
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function money(v) { return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

  // cartão de pessoa: nome (ou email) em destaque, email secundário, grupo×nível em badge
  function personRow(a) {
    var name = a.name || a.email || '—';
    var sub = (a.name && a.email && a.name !== a.email) ? a.email : '';
    var tag = a.group_name || ('Nível ' + a.level);
    return '<div class="u-card">'
      + '<div class="u-id"><b>' + esc(name) + '</b>'
      + (sub ? '<span class="u-sub">' + esc(sub) + '</span>' : '') + '</div>'
      + '<span class="badge blue u-tag">' + esc(tag) + '</span></div>';
  }

  function shell(proc) {
    var o = document.createElement('div'); o.className = 'modal-overlay';
    o.innerHTML =
      '<div class="modal-box lg"><button class="modal-x" aria-label="Fechar">×</button>'
      + '<h2>Aprovadores do Processo #' + esc(proc.id_prc) + '</h2>'
      + '<div class="proc-head"><b>' + money(proc.value_prc) + '</b> · '
      + esc((window.CONFIG.STEPS || {})[proc.status_step_prc] || '') + '</div>'
      + '<div class="cols-3">'
      + '<section><h3>Aprovações Concluídas</h3><div data-col="done" class="col-body">…</div></section>'
      + '<section><h3>Elegíveis (etapa atual)</h3><div data-col="elig" class="col-body">…</div></section>'
      + '<section><h3>Próximas Etapas</h3><div data-col="next" class="col-body">…</div></section>'
      + '</div></div>';
    o.addEventListener('click', function (e) { if (e.target === o || e.target.classList.contains('modal-x')) o.remove(); });
    document.body.appendChild(o); return o;
  }

  window.openProcessApprovers = async function (proc) {
    var uuid = proc.uuid_prc, o = shell(proc);
    var $ = function (k) { return o.querySelector('[data-col="' + k + '"]'); };
    try {
      var done = await window.Store.get('approvers', uuid);
      $('done').innerHTML = done.length ? done.map(personRow).join('') : '<div class="empty">Ninguém aprovou ainda.</div>';
      var elig = await window.Store.get('eligible_approvers', uuid);
      $('elig').innerHTML = elig.length ? elig.map(personRow).join('') : '<div class="empty">Nenhum aprovador elegível.</div>';
      var next = await window.Store.get('next_levels', uuid);
      $('next').innerHTML = next.length ? next.map(function (n) { return '<div class="row-u">Aguardando nível ' + esc(n.level) + '</div>'; }).join('') : '<div class="empty">Sem etapas futuras.</div>';
    } catch (e) { console.error(e); o.querySelector('.cols-3').innerHTML = '<div class="view-error">' + esc(e.message) + '</div>'; }
  };
})();
