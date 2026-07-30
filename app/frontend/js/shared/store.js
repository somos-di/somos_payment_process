(function () {

  var DEPENDENTS = {
    processes: ['no_approver', 'pending_approvals'],
    supply_rules: ['eligible_approvers', 'no_approver'],
    company_rules: ['eligible_approvers', 'no_approver'],
    building_permission: ['eligible_approvers', 'no_approver'],
    process_kind_rules: ['eligible_approvers', 'no_approver'],
    users_group: ['eligible_approvers', 'no_approver'],
  };

  var _state = new Map();
  var _fetchers = new Map();
  var _subs = new Map();
  var _warm = new Map();

  var keyOf = function (entityName, param) { return (param === undefined || param === null || param === '' ? entityName : entityName + '::' + param); };

  function _notify(entity) {
    var subs = _subs.get(entity);
    if (subs) subs.forEach(function (item) { try { item(); } catch (error) { console.error('[store]', entity, error); } });
  }

  var Store = {
    register: function (entity, fetcher) { _fetchers.set(entity, fetcher); return this; },

    subscribe: function (entity, callback) {
      if (!_subs.has(entity)) _subs.set(entity, new Set());
      _subs.get(entity).add(callback);
      return function () { var s = _subs.get(entity); if (s) s.delete(callback); };
    },

    get: async function (entity, param) {
      var key = keyOf(entity, param);
      var current = _state.get(key);
      if (current && current.data !== undefined) return current.data;
      if (current && current.promise) return current.promise;
      var fetcher = _fetchers.get(entity);
      if (!fetcher) throw new Error('[store] sem fetcher para "' + entity + '"');
      var promise = Promise.resolve(fetcher(param)).then(function (data) {
        _state.set(key, { data: data, ts: Date.now(), promise: null });
        return data;
      }).catch(function (error) { _state.delete(key); throw error; });
      _state.set(key, { data: undefined, ts: 0, promise: promise });
      return promise;
    },

    peek: function (entity, param) { var c = _state.get(keyOf(entity, param)); return c ? c.data : undefined; },

    warm: function (entity, param) {
      _warm.set(entity, (param === undefined ? null : param));
      return this.get(entity, param).catch(function () { });
    },

    invalidate: function (entity, _seen) {
      _seen = _seen || new Set();
      if (_seen.has(entity)) return;
      _seen.add(entity);
      var self = this;
      Array.from(_state.keys()).forEach(function (item) {
        if (item === entity || item.indexOf(entity + '::') === 0) _state.delete(item);
      });
      _notify(entity);
      (DEPENDENTS[entity] || []).forEach(function (item) { self.invalidate(item, _seen); });

      if (_warm.has(entity)) {
        var p = _warm.get(entity);
        Promise.resolve().then(function () { self.get(entity, p).catch(function () { }); });
      }
    },

    invalidateKey: function (entity, param) {
      _state.delete(keyOf(entity, param));
      _notify(entity);
    },

    patch: function (entity, idField, idValue, changes) {
      Array.from(_state.entries()).forEach(function (pair) {
        var key = pair[0], c = pair[1];
        if (!(key === entity || key.indexOf(entity + '::') === 0)) return;
        if (!c || !Array.isArray(c.data)) return;
        c.data = c.data.map(function (entry) {
          return (entry && entry[idField] === idValue) ? Object.assign({}, entry, changes) : entry;
        });
      });
      _notify(entity);
    },

    remove: function (entity, idField, idValue) {
      Array.from(_state.entries()).forEach(function (pair) {
        var key = pair[0], c = pair[1];
        if (!(key === entity || key.indexOf(entity + '::') === 0)) return;
        if (!c || !Array.isArray(c.data)) return;
        c.data = c.data.filter(function (entry) { return !(entry && entry[idField] === idValue); });
      });
      _notify(entity);
    },

    mutate: async function (entity, action) {
      var result = await action();
      var list = Array.isArray(entity) ? entity : [entity];
      var seen = new Set();
      var self = this;
      list.forEach(function (listItem) { self.invalidate(listItem, seen); });
      return result;
    },

    commit: async function (loader, apply) {
      var touched = apply ? (apply() || []) : [];
      try { return await loader(); }
      catch (error) { var self = this; (touched || []).forEach(function (item) { self.invalidate(item); }); throw error; }
    },

    clear: function () { _state.clear(); },
    DEPENDENTS: DEPENDENTS,
  };

  window.Store = Store;
})();
