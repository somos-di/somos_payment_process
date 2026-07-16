(function () {
  var user = null;
  var listeners = new Set();
  function emit() { listeners.forEach(function (cb) { try { cb(user); } catch (e) { console.error('auth listener', e); } }); }

  window.Auth = {
    init: async function () {
      try {
        user = await window.API.get('/auth/me');
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


    expireLocal: function () {
      if (user === null) return;
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
