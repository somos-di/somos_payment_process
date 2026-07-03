// auth.js — autenticação 100% via backend. A sessão vive em cookie httpOnly
// (o JS nunca vê o token). Mantém a interface window.Auth usada pelo router/sidebar.
(function () {
  var user = null;
  var listeners = new Set();
  function emit() { listeners.forEach(function (cb) { try { cb(user); } catch (e) { console.error('auth listener', e); } }); }

  window.Auth = {
    init: async function () {
      try {
        user = await window.API.get('/auth/me'); // cookie enviado automaticamente
        if (user && window.SB) window.SB.setUserId(user.id);
      } catch (e) { user = null; }
      emit();
    },
    signIn: async function (email, password) {
      var data = await window.API.post('/auth/login', { email: email, password: password });
      user = data && data.user ? data.user : null;
      if (user && window.SB) window.SB.setUserId(user.id);
      emit();
      return user;
    },
    signOut: async function () {
      try { await window.API.post('/auth/logout'); } catch (e) { }
      user = null;
      if (window.SB) window.SB.setUserId(null);
      if (window.Store) window.Store.clear();
      emit();
      window.location.hash = window.CONFIG.HASH(window.CONFIG.ROUTES.LOGIN);
    },
    // Sessão morreu no SERVIDOR (401): derruba só o estado LOCAL (sem chamar
    // /auth/logout). O onChange do router redireciona pro login e o guard
    // "login + autenticado -> dashboard" deixa de quicar de volta.
    expireLocal: function () {
      if (user === null) return; // já expirado localmente — não re-emite
      user = null;
      if (window.SB) window.SB.setUserId(null);
      if (window.Store) window.Store.clear();
      emit();
    },
    getUser: function () { return user; },
    isAuthenticated: function () { return user !== null; },
    onChange: function (cb) { listeners.add(cb); return function () { listeners.delete(cb); }; },
  };
})();
