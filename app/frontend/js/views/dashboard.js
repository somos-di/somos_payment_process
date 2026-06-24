// Dashboard — KPIs + barras por status. Lê do Store ('dashboard').
async function initView_dashboard() {
  function money(v) { return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  var d;
  try { d = await window.Store.get('dashboard'); }
  catch (e) { document.getElementById('app-content').innerHTML = '<div class="view-error">' + e.message + '</div>'; return; }
  var set = function (id, v) { var el = document.getElementById(id); if (el) el.textContent = v; };
  set('kpi-pend', d.pendentes); set('kpi-aguard', d.aguardando); set('kpi-total', d.total);
  set('kpi-valor', money(d.rows.reduce(function (s, p) { return s + (Number(p.value_prc) || 0); }, 0)));

  var STEPS = window.CONFIG.STEPS || {}, byStep = {};
  d.rows.forEach(function (p) { byStep[p.status_step_prc] = (byStep[p.status_step_prc] || 0) + 1; });
  var vals = Object.values(byStep); var max = Math.max.apply(null, [1].concat(vals));
  var html = Object.keys(byStep).map(function (k) {
    var w = Math.round((byStep[k] / max) * 100);
    return '<div style="margin:8px 0"><div style="display:flex;justify-content:space-between;font-size:13px;color:var(--muted)">'
      + '<span>' + (STEPS[k] || ('Status ' + k)) + '</span><b style="color:var(--text)">' + byStep[k] + '</b></div>'
      + '<div style="height:8px;background:var(--surface-2);border-radius:6px;overflow:hidden"><div style="width:' + w + '%;height:100%;background:var(--accent)"></div></div></div>';
  }).join('');
  var bars = document.getElementById('status-bars'); if (bars) bars.innerHTML = html || '<div class="empty">Sem processos.</div>';
}
