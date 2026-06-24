// ============================================================================
// store.js — Estado da aplicação EM MEMÓRIA (sem localStorage, sem serialização).
// Expõe window.Store. Script clássico (sem build).
//
// Regra central: toda mutação (update/post/delete) chama Store.mutate(entidade,...)
// que SEMPRE invalida a entidade alterada E suas dependentes. O que foi invalidado
// é refeito sob demanda (lazy) e os componentes inscritos são notificados.
// ============================================================================
(function () {
  // Cascata só para mudanças ESTRUTURAIS (criar processo, mexer em regra). Ações
  // de fluxo (aprovar/devolver/financeiro/parcelas) NÃO entram aqui — são tratadas
  // cirurgicamente (patch/remove) p/ não rebaixar tudo. Lookups (empresas, obras,
  // compositions, fornecedores, tipos, status) NUNCA são invalidados por processo:
  // só por ação destrutiva explícita (ex.: sync UAU -> Store.clear()).
  var DEPENDENTS = {
    processes: ['dashboard', 'no_approver', 'pending_approvals'],  // criar/reenviar: pode virar pendente de aprovação
    supply_rules: ['eligible_approvers', 'no_approver'],
    company_rules: ['eligible_approvers', 'no_approver'],
    building_permission: ['eligible_approvers', 'no_approver'],
    process_kind_rules: ['eligible_approvers', 'no_approver'],
    users_group: ['eligible_approvers', 'no_approver'],
  };

  var _state = new Map();    // chave -> { data, ts, promise }
  var _fetchers = new Map(); // entidade -> async (param) => data
  var _subs = new Map();     // entidade -> Set<cb>
  var _warm = new Map();     // entidade -> param  (mantida quente: refaz em background ao invalidar)

  var keyOf = function (e, p) { return (p === undefined || p === null || p === '' ? e : e + '::' + p); };

  function _notify(entity) {
    var subs = _subs.get(entity);
    if (subs) subs.forEach(function (cb) { try { cb(); } catch (e) { console.error('[store]', entity, e); } });
  }

  var Store = {
    register: function (entity, fetcher) { _fetchers.set(entity, fetcher); return this; },

    subscribe: function (entity, cb) {
      if (!_subs.has(entity)) _subs.set(entity, new Set());
      _subs.get(entity).add(cb);
      return function () { var s = _subs.get(entity); if (s) s.delete(cb); };
    },

    get: async function (entity, param) {
      var key = keyOf(entity, param);
      var cur = _state.get(key);
      if (cur && cur.data !== undefined) return cur.data;
      if (cur && cur.promise) return cur.promise;
      var fetcher = _fetchers.get(entity);
      if (!fetcher) throw new Error('[store] sem fetcher para "' + entity + '"');
      var promise = Promise.resolve(fetcher(param)).then(function (data) {
        _state.set(key, { data: data, ts: Date.now(), promise: null });
        return data;
      }).catch(function (err) { _state.delete(key); throw err; });
      _state.set(key, { data: undefined, ts: 0, promise: promise });
      return promise;
    },

    peek: function (entity, param) { var c = _state.get(keyOf(entity, param)); return c ? c.data : undefined; },

    // marca a entidade como "quente": pré-busca AGORA e refaz sozinha em background
    // sempre que for invalidada (ex.: my_pending_approvals, que é cara — fica pronta
    // no estado pra abrir "Aprovações" instantâneo, e se mantém fresca após ações).
    warm: function (entity, param) {
      _warm.set(entity, (param === undefined ? null : param));
      return this.get(entity, param).catch(function () {});
    },

    invalidate: function (entity, _seen) {
      _seen = _seen || new Set();
      if (_seen.has(entity)) return;
      _seen.add(entity);
      var self = this;
      Array.from(_state.keys()).forEach(function (k) {
        if (k === entity || k.indexOf(entity + '::') === 0) _state.delete(k);
      });
      _notify(entity);
      (DEPENDENTS[entity] || []).forEach(function (dep) { self.invalidate(dep, _seen); });
      // entidade quente: re-busca em background (não bloqueia) p/ ficar pronta de novo
      if (_warm.has(entity)) {
        var p = _warm.get(entity);
        Promise.resolve().then(function () { self.get(entity, p).catch(function () {}); });
      }
    },

    // invalida UMA chave específica (entidade::param), sem cascata. Para o caso
    // "essa parcela mudou" sem rebaixar nada além dela.
    invalidateKey: function (entity, param) {
      _state.delete(keyOf(entity, param));
      _notify(entity);
    },

    // PATCH cirúrgico: aplica `changes` no item idField===idValue em TODAS as
    // coleções cacheadas da entidade (sem rede) e notifica. (SRP: atualizar 1 item.)
    patch: function (entity, idField, idValue, changes) {
      Array.from(_state.entries()).forEach(function (pair) {
        var k = pair[0], c = pair[1];
        if (!(k === entity || k.indexOf(entity + '::') === 0)) return;
        if (!c || !Array.isArray(c.data)) return;
        c.data = c.data.map(function (it) {
          return (it && it[idField] === idValue) ? Object.assign({}, it, changes) : it;
        });
      });
      _notify(entity);
    },

    // REMOVE cirúrgico: tira o item de TODAS as coleções cacheadas da entidade
    // (sem rede) e notifica. (SRP: remover 1 item — "some da tela".)
    remove: function (entity, idField, idValue) {
      Array.from(_state.entries()).forEach(function (pair) {
        var k = pair[0], c = pair[1];
        if (!(k === entity || k.indexOf(entity + '::') === 0)) return;
        if (!c || !Array.isArray(c.data)) return;
        c.data = c.data.filter(function (it) { return !(it && it[idField] === idValue); });
      });
      _notify(entity);
    },

    // mutação ESTRUTURAL: roda a ação e invalida a entidade + dependentes (cascata).
    // Use para CRIAR processo (a lista precisa refletir o novo registro).
    mutate: async function (entity, action) {
      var result = await action();
      var list = Array.isArray(entity) ? entity : [entity];
      var seen = new Set();
      var self = this;
      list.forEach(function (e) { self.invalidate(e, seen); });
      return result;
    },

    // COMMIT otimista (SRP: orquestrar). `apply()` faz a mudança LOCAL na hora
    // (patch/remove) e devolve as entidades tocadas; `run()` persiste async no
    // backend. Se o backend falhar, invalida as tocadas (refaz a verdade) e relança.
    commit: async function (run, apply) {
      var touched = apply ? (apply() || []) : [];
      try { return await run(); }
      catch (e) { var self = this; (touched || []).forEach(function (en) { self.invalidate(en); }); throw e; }
    },

    clear: function () { _state.clear(); },
    DEPENDENTS: DEPENDENTS,
  };

  window.Store = Store;
})();
