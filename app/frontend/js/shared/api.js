(function () {

  async function call(method, path, body, full) {
    var options = { method: method, credentials: 'include', headers: {} };
    if (body != null) { options.headers['Content-Type'] = 'application/json'; options.body = JSON.stringify(body); }
    var response = await fetch(window.CONFIG.API_BASE + path, options);
    var json = null;
    try { json = await response.json(); } catch (error) { }
    if (response.status === 401) {

      if (window.Auth && window.Auth.expireLocal) window.Auth.expireLocal();
      var error = new Error('Sua sessão expirou. Entre novamente para continuar.'); error.code = 401; throw error;
    }
    if (!response.ok || (json && json.success === false)) {
      throw new Error((json && json.error && json.error.message) || ('HTTP ' + response.status));
    }
    if (full) return json || {};
    return json ? json.data : null;
  }
  window.API = {
    get: function (path) { return call('GET', path); },
    post: function (path, body) { return call('POST', path, body); },
    postFull: function (path, body) { return call('POST', path, body, true); },
  };

  window.viewError = function (element, error) {
    if (!element) return;
    var message = (error && error.message) || 'Algo deu errado.';
    if (error && error.code === 401) {
      element.innerHTML = '<div class="view-notice">'
        + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>'
        + '<div class="vn-title">Sessão expirada</div>'
        + '<div class="vn-sub">' + message.replace(/[<>&]/g, '') + '</div>'
        + '<button class="btn btn-primary vn-act">Entrar novamente</button></div>';
      var actionButton = element.querySelector('.vn-act');
      if (actionButton) actionButton.addEventListener('click', function () { window.location.hash = window.CONFIG.HASH(window.CONFIG.ROUTES.LOGIN); });
    } else {
      element.innerHTML = '<div class="view-error">' + message.replace(/[<>&]/g, '') + '</div>';
    }
  };
})();
