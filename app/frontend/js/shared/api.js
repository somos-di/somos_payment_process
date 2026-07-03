(function () {

  async function call(method, path, body, full) {
    var opts = { method: method, credentials: 'include', headers: {} };
    if (body != null) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    var resp = await fetch(window.CONFIG.API_BASE + path, opts);
    var json = null;
    try { json = await resp.json(); } catch (e) { }
    if (resp.status === 401) {

      if (window.Auth && window.Auth.expireLocal) window.Auth.expireLocal();
      var e = new Error('Sua sessão expirou. Entre novamente para continuar.'); e.code = 401; throw e;
    }
    if (!resp.ok || (json && json.success === false)) {
      throw new Error((json && json.error && json.error.message) || ('HTTP ' + resp.status));
    }
    if (full) return json || {};
    return json ? json.data : null;
  }
  window.API = {
    get: function (path) { return call('GET', path); },
    post: function (path, body) { return call('POST', path, body); },
    postFull: function (path, body) { return call('POST', path, body, true); },
  };

  window.viewError = function (el, err) {
    if (!el) return;
    var msg = (err && err.message) || 'Algo deu errado.';
    if (err && err.code === 401) {
      el.innerHTML = '<div class="view-notice">'
        + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>'
        + '<div class="vn-title">Sessão expirada</div>'
        + '<div class="vn-sub">' + msg.replace(/[<>&]/g, '') + '</div>'
        + '<button class="btn btn-primary vn-act">Entrar novamente</button></div>';
      var b = el.querySelector('.vn-act');
      if (b) b.addEventListener('click', function () { window.location.hash = window.CONFIG.HASH(window.CONFIG.ROUTES.LOGIN); });
    } else {
      el.innerHTML = '<div class="view-error">' + msg.replace(/[<>&]/g, '') + '</div>';
    }
  };
})();
