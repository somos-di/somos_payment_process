(function () {
  var user = null;
  var listeners = new Set();
  function emit() { listeners.forEach(function (listener) { try { listener(user); } catch (error) { console.error('auth listener', error); } }); }

  window.Auth = {
    init: async function () {
      try {
        user = await window.API.get('/auth/me');
        if (user && window.SB) window.SB.setUserId(user.id);
      } catch (error) { user = null; }
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
      try { await window.API.post('/auth/logout'); } catch (error) { }
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
    onChange: function (callback) { listeners.add(callback); return function () { listeners.delete(callback); }; },
  };
})();
