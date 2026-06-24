// api.js — único canal do front: fala SÓ com o backend Fastify.
// Sessão vai em cookie httpOnly (credentials:'include'); nada de token/chave no JS.
(function () {
  // full=true devolve o envelope inteiro ({ success, data, count, ... });
  // por padrão devolve só json.data (interface antiga).
  async function call(method, path, body, full) {
    var opts = { method: method, credentials: 'include', headers: {} };
    if (body != null) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    var resp = await fetch(window.CONFIG.API_BASE + path, opts);
    var json = null;
    try { json = await resp.json(); } catch (e) { }
    if (resp.status === 401) { var e = new Error('NAO_AUTENTICADO'); e.code = 401; throw e; }
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
})();
