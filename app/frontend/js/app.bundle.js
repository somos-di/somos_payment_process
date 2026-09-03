/* ==== js/shared/config.js ==== */
(function () {
    window.CONFIG = {

        API_BASE: (window.__API_BASE__ || '/api/v1'),
        ROUTES: { DEFAULT: 'inicio', LOGIN: 'login' },
        AUTH: { REFRESH_LEEWAY_SECONDS: 30 },

        PARAMS: {},
        PROCESS_KINDS: {},
        MESSAGE_KINDS: {},
        STEPS: {},
        STATUS: {},
        STATUS_COLORS: { 0: 'red', 1: 'blue', 2: 'violet', 3: 'red', 4: 'blue', 6: 'warn', 7: 'ok', 8: 'red', 9: 'ok' },
        VIEW_TEMPLATE: function (folder, route) { return 'html/views/' + folder + '/' + route + '.html'; },
        HASH: function (route) { return '#/' + route; },
    }
})()

;

/* ==== js/shared/api.js ==== */
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

;

/* ==== js/shared/backend-client.js ==== */
(function () {

  function Spec() { this.__ops = []; }
  ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'is'].forEach(function (item) {
    Spec.prototype[item] = function (column, value) { this.__ops.push([item, column, value]); return this; };
  });
  Spec.prototype.in = function (column, items) { this.__ops.push(['in', column, items]); return this; };
  Spec.prototype.or = function (filter) { this.__ops.push(['or', filter]); return this; };
  Spec.prototype.order = function (column, orderOptions) { this.__ops.push(['order', column, orderOptions || {}]); return this; };
  Spec.prototype.limit = function (count) { this.__ops.push(['limit', count]); return this; };
  Spec.prototype.range = function (fromIndex, toIndex) { this.__ops.push(['range', fromIndex, toIndex]); return this; };

  var _userId = null;

  window.SB = {
    setUserId: function (id) { _userId = id || null; },
    userId: async function () {
      if (_userId) return _userId;
      try { var currentUser = await window.API.get('/auth/me'); _userId = currentUser ? currentUser.id : null; } catch (error) { _userId = null; }
      return _userId;
    },

    select: async function (resource, build) {
      var spec = new Spec();
      if (build) build(spec);
      return window.API.post('/data/' + resource, { operations: spec.__ops });
    },

    count: async function (resource, build) {
      var spec = new Spec();
      if (build) build(spec);
      var response = await window.API.postFull('/data/' + resource, { operations: spec.__ops, count: true, head: true });
      return (response && response.count != null) ? response.count : 0;
    },

    page: async function (resource, build, countMode) {
      var spec = new Spec();
      if (build) build(spec);
      var body = { operations: spec.__ops };
      if (countMode) body.count = countMode;
      var response = await window.API.postFull('/data/' + resource, body);
      return {
        data: (response && response.data) || [],
        count: (response && response.count != null) ? response.count : null,
      };
    },
    rpc: function (fn, args) { return window.API.post('/rpc/' + fn, { rpcArguments: args || {} }); },

    upload: function (file, endpoint) {
      return new Promise(function (resolve, reject) {
        var MAX_FILE_BYTES = 20 * 1024 * 1024;
        if (file && file.size > MAX_FILE_BYTES) {
          reject(new Error('Arquivo excede o limite de 14 MB.')); return;
        }
        var fileReader = new FileReader();
        fileReader.onload = function () {
          var base64 = String(fileReader.result).split(',')[1] || '';
          window.API.post(endpoint || '/storage/upload', { filename: file.name, contentBase64: base64, contentType: file.type })
            .then(resolve, reject);
        };
        fileReader.onerror = function () { reject(new Error('Falha ao ler o arquivo')); };
        fileReader.readAsDataURL(file);
      });
    },
  };
})();

;

/* ==== js/shared/store.js ==== */
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

;

/* ==== js/shared/data.js ==== */
(function () {
  var S = window.Store, SB = window.SB;

  S.register('processes', function (kind) {
    return SB.select('v_processes', function (query) {
      if (kind) query = query.eq('kind_prc', Number(kind));
      return query.order('id_prc', { ascending: false });
    });
  });
  S.register('financeiro', function () {
    return SB.select('v_financeiro', function (query) { return query.order('due_date_prc', { ascending: true }); });
  });
  S.register('financeiro_integrados', function () {
    return SB.select('v_financeiro_integrados', function (query) { return query.order('id_prc', { ascending: false }); });
  });
  S.register('pending_approvals', function () { return SB.rpc('my_pending_approvals'); });
  S.register('my_approvals', function () { return SB.select('v_my_approvals', function (query) { return query.order('approved_at_app', { ascending: false }); }); });
  S.register('no_approver', function () { return SB.select('v_processes_no_approver'); });
  S.register('processes_admin', function () {
    return SB.select('v_processes_admin', function (query) { return query.order('id_prc', { ascending: false }); });
  });
  S.register('commissions', function () {
    return SB.select('v_commissions', function (query) { return query.order('id_com', { ascending: false }); });
  });
  S.register('comm_status', function () {
    return SB.select('comm_status_kind', function (query) { return query.order('id_csk'); });
  });
  S.register('comm_empreendimentos', function () {
    return SB.select('v_comm_empreendimentos', function (query) { return query.order('name_cem'); });
  });
  S.register('comm_history', function (uuid) {
    return SB.select('v_comm_history', function (query) { return query.eq('commission_chs', uuid).order('created_at_chs', { ascending: false }); });
  });

  S.register('installments', function (uuid) {
    return SB.select('installments', function (query) { return query.eq('process_ins', uuid).order('number_ins'); });
  });
  
  S.register('history', function (uuid) {
    return SB.select('v_process_history', function (query) { return query.eq('process_hst', uuid).order('created_at_hst', { ascending: false }).order('id_hst', { ascending: false }); });
  });
  S.register('approvers', function (uuid) { return SB.rpc('completed_approvals', { p_uuid: uuid }); });
  S.register('eligible_approvers', function (uuid) { return SB.rpc('eligible_approvers', { p_uuid: uuid }); });
  S.register('next_levels', function (uuid) { return SB.rpc('next_levels', { p_uuid: uuid }); });

  S.register('uau_tables', function () { return SB.select('uau_tables', function (query) { return query.order('id_uat'); }); });
  S.register('companies', function () { return SB.select('companies'); });
  S.register('cost_centers', function () { return SB.select('cost_centers'); });
  S.register('persons', function () { return SB.select('persons'); });
  S.register('process_kinds', function () { return SB.select('process_kinds', function (query) { return query.order('name_pkn'); }); });
  
  S.register('launchable_kinds', function () { return SB.rpc('my_launchable_kinds'); });
  S.register('document_kinds', function () { return SB.select('document_kinds', function (query) { return query.order('name_dck'); }); });

  
  S.register('empresas', function () { return SB.select('v_empresas', function (query) { return query.order('nome'); }); });
  S.register('obras', function (empresa) { return SB.select('v_obras', function (query) { return query.eq('empresa', empresa).order('nome'); }); });
  S.register('compositions_lk', function (key) {
    var parts = String(key).split('|'); 
    return SB.select('compositions', function (query) { return query.eq('empresa_cins', Number(parts[0])).ilike('obra_cins', parts[1]).limit(2000); });
  });
  S.register('fornecedores', function (term) {
    return SB.select('v_fornecedores', function (query) {
      if (term) query = query.or('nome.ilike.%' + term + '%,cpf_cnpj.ilike.%' + term + '%');
      return query.order('nome').limit(100);
    });
  });
})();

;

/* ==== js/shared/auth.js ==== */
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

;

/* ==== js/shared/sidebar-user.js ==== */
(function () {
    function reflectAdmin(user) {
        const show = (user && user.is_admin) ? '' : 'none'
        document.querySelectorAll('.menu-group[data-group="admin"], .menu-group[data-group="integracao"]')
            .forEach(function (item) { item.style.display = show })
        const finShow = (user && (user.is_financeiro || user.is_admin)) ? '' : 'none'
        document.querySelectorAll('[data-fin-only]').forEach(function (item) { item.style.display = finShow })
        const commShow = (user && (user.is_commission || user.is_financeiro || user.is_admin)) ? '' : 'none'
        document.querySelectorAll('.menu-group[data-group="comissoes"]').forEach(function (item) { item.style.display = commShow })
        const medShow = (user && (user.is_medicao || user.is_admin)) ? '' : 'none'
        document.querySelectorAll('.menu-group[data-group="medicao"]').forEach(function (item) { item.style.display = medShow })
        const admOnly = (user && user.is_admin) ? '' : 'none'
        document.querySelectorAll('[data-admin-only]').forEach(function (item) { item.style.display = admOnly })
    }

    function reflectUser(user) {
        reflectAdmin(user)
        const nameEl = document.getElementById('user-name')
        const emailEl = document.getElementById('user-email')
        const avatarEl = document.getElementById('user-avatar')
        if (user) {
            const handle = (user.name || (user.email || '').split('@')[0]) || '-'
            if (nameEl) nameEl.textContent = handle
            if (emailEl) emailEl.textContent = user.email || ''
            if (avatarEl) avatarEl.textContent = (handle[0] || '·').toUpperCase()
        } else {
            if (nameEl) nameEl.textContent = '-'
            if (emailEl) emailEl.textContent = ''
            if (avatarEl) avatarEl.textContent = '·'
        }
    }

    function setupLogout() {
        const button = document.getElementById('logout-btn')
        if (button) {
            button.addEventListener('click', function () {
                if (window.Auth) window.Auth.signOut()
            })
        }
    }

    document.addEventListener('DOMContentLoaded', function () {
        setupLogout()
        if (!window.Auth) return
        reflectUser(window.Auth.getUser())
        window.Auth.onChange(reflectUser)
    })
})()

;

/* ==== js/shared/consulta-tabs.js ==== */
(function () {
  function build() {
    var body = document.getElementById('consulta-tabs');
    if (!body) return;
    body.innerHTML = '<a class="menu-item" href="#/consulta" data-route="consulta">'
      + '<span class="mi-dot"></span><span class="label">Processos</span></a>';
  }
  window.buildConsultaTabs = build;
  document.addEventListener('DOMContentLoaded', build);
})();

;

/* ==== js/shared/process-detail-modal.js ==== */
(function () {
  function escapeHtml(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function money(value) { return (Number(value) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  function formatDate(d) { return d ? String(d).split('T')[0].split('-').reverse().join('/') : '-'; }
  function fmtDT(d) {
    if (!d) return '';
    var date = new Date(d);
    if (isNaN(date)) { var s = String(d).replace('T', ' '); return s.slice(0, 10).split('-').reverse().join('/') + ' ' + s.slice(11, 16); }
    return date.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  function fieldBox(label, value) {
    var displayValue = (value === null || value === undefined || value === '') ? '-' : value;
    return '<div class="pd-field"><label>' + escapeHtml(label) + '</label><div class="pd-field-box">' + escapeHtml(displayValue) + '</div></div>';
  }

  window.openProcessDetail = async function (process) {
    var o = document.createElement('div'); o.className = 'modal-overlay';
    var steps = (window.CONFIG.STEPS || {}), kinds = (window.CONFIG.PROCESS_KINDS || {});
    var fiscalDocUrl = process.attachment_url2_prc, boletoUrl = process.attachment_url_prc;
    var firstUrl = fiscalDocUrl || boletoUrl;

    var docHtml = '';
    if (firstUrl) {
      docHtml = '<div class="pd-doc">'
        + '<div class="pd-doc-head">'
        + '<div class="pd-doc-tabs">'
        + (fiscalDocUrl ? '<button class="pd-doc-tab active" data-url="' + escapeHtml(fiscalDocUrl) + '">Nota Fiscal</button>' : '')
        + (boletoUrl ? '<button class="pd-doc-tab' + (fiscalDocUrl ? '' : ' active') + '" data-url="' + escapeHtml(boletoUrl) + '">Boleto</button>' : '')
        + '</div>'
        + '<a class="pd-doc-open" href="' + escapeHtml(firstUrl) + '" target="_blank" rel="noopener">Abrir ↗</a>'
        + '</div>'
        + '<iframe class="pd-doc-frame" src="' + escapeHtml(firstUrl) + '" title="Documento"></iframe>'
        + '</div>';
    }

    o.innerHTML =
      '<div class="modal-box xl' + (firstUrl ? '' : ' no-doc') + '"><button class="modal-x" aria-label="Fechar">×</button>'
      + '<div class="pd-detail">'
      + '<div class="pd-fields"><h3>Dados Gerais <span style="color:var(--muted);font-weight:600">#' + escapeHtml(process.id_prc) + '</span></h3>'
      + fieldBox('Descrição', process.description_prc)
      + fieldBox('Empresa', process.empresa_nome || process.company_prc)
      + fieldBox('Obra', process.obra_nome || process.building_prc)
      + fieldBox('Fornecedor', process.fornecedor_nome || process.person_prc)
      + fieldBox('Apropriação (Composição)', process.composicao_nome || ((process.composition_prc || '') + (process.supply_prc ? ' / ' + process.supply_prc : '')))
      + fieldBox('Tipo de Processo', process.tipo_nome || kinds[process.kind_prc] || process.kind_prc)
      + fieldBox('Tipo de Documento', process.documento_nome)
      + fieldBox('Nº Documento Fiscal', process.fiscal_doc_prc)
      + fieldBox('Status', process.status_nome || steps[process.status_step_prc] || process.status_step_prc)
      + fieldBox('Valor', money(process.value_prc))
      + fieldBox('Emissão', formatDate(process.issue_date_prc))
      + fieldBox('Vencimento', formatDate(process.due_date_prc))
      + '</div>'
      + docHtml
      + '<div class="pd-hist">'
      + '<div class="pd-hist-head"><h3>Histórico</h3>'
      + '<button type="button" class="pd-hist-toggle" aria-label="Recolher histórico">›</button></div>'
      + '<div class="pd-hist-body col-body">…</div>'
      + '<div class="pd-hist-comment">'
      + '<textarea class="pd-comment-input" rows="3" maxlength="2000" placeholder="Escreva um comentário… (Ctrl+Enter para enviar)"></textarea>'
      + '<button type="button" class="btn btn-primary pd-comment-send">Comentar</button>'
      + '</div>'
      + '</div>'
      + '</div></div>';

    o.addEventListener('click', function (event) { if (event.target === o || event.target.classList.contains('modal-x')) o.remove(); });
    var modalBox = o.querySelector('.modal-box');
    var histToggle = o.querySelector('.pd-hist-toggle');
    if (histToggle) histToggle.addEventListener('click', function () {
      var collapsed = modalBox.classList.toggle('hist-collapsed');
      histToggle.textContent = collapsed ? '‹' : '›';
      histToggle.setAttribute('aria-label', collapsed ? 'Expandir histórico' : 'Recolher histórico');
    });

    var frame = o.querySelector('.pd-doc-frame');
    var openLink = o.querySelector('.pd-doc-open');
    o.querySelectorAll('.pd-doc-tab').forEach(function (documentTab) {
      documentTab.addEventListener('click', function () {
        o.querySelectorAll('.pd-doc-tab').forEach(function (otherDocumentTab) { otherDocumentTab.classList.remove('active'); });
        documentTab.classList.add('active');
        var url = documentTab.getAttribute('data-url');
        if (frame) frame.src = url;
        if (openLink) openLink.setAttribute('href', url);
      });
    });

    document.body.appendChild(o);

    async function renderHistory() {
      try {
        var historyEntries = await window.Store.get('history', process.uuid_prc);
        o.querySelector('.pd-hist-body').innerHTML = historyEntries.length
          ? '<ul class="timeline">' + historyEntries.map(function (historyEntry) {
            var kindColor = /^#[0-9a-fA-F]{3,8}$/.test(historyEntry.kind_color || '') ? historyEntry.kind_color : '';
            var kindStyle = kindColor ? ' style="--kind:' + kindColor + '"' : '';
            return '<li' + kindStyle + '><span class="tl-dot"></span><div class="tl-card"><div class="tl-act">' + escapeHtml(historyEntry.action_hst) + '</div>'
              + '<div class="tl-meta">' + escapeHtml(historyEntry.user_nome || 'Sistema') + ' · ' + escapeHtml(fmtDT(historyEntry.created_at_hst)) + '</div></div></li>';
          }).join('') + '</ul>'
          : '<div class="empty">Sem histórico.</div>';
      } catch (error) { }
    }

    var commentInput = o.querySelector('.pd-comment-input');
    var commentSend = o.querySelector('.pd-comment-send');
    async function submitComment() {
      var text = (commentInput.value || '').trim();
      if (!text) return;
      commentSend.disabled = true; commentInput.disabled = true;
      try {
        await window.API.post('/processes/' + process.uuid_prc + '/comment', { text: text });
        commentInput.value = '';
        window.Store.invalidate('history');
        await renderHistory();
        var body = o.querySelector('.pd-hist-body'); if (body) body.scrollTop = 0;
      } catch (error) {
        commentInput.title = (error && error.message) || 'Erro ao comentar';
        commentInput.style.borderColor = 'var(--danger, #ef4444)';
      } finally {
        commentSend.disabled = false; commentInput.disabled = false; commentInput.focus();
      }
    }
    if (commentSend) commentSend.addEventListener('click', submitComment);
    if (commentInput) {
      commentInput.addEventListener('input', function () { commentInput.style.borderColor = ''; });
      commentInput.addEventListener('keydown', function (event) {
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); submitComment(); }
      });
    }

    try { window.Store.invalidate('history'); } catch (error) { }
    await renderHistory();
  };
})();

;

/* ==== js/shared/column-tools.js ==== */
(function () {
  function escapeHtml(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

  var STYLE_ID = 'coltools-style';
  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var st = document.createElement('style'); st.id = STYLE_ID;
    st.textContent =
      '@media (min-width:821px){.ct-fixed{table-layout:fixed}'
      + '.table-scroll table.ct-fixed{min-width:0}'
      + '.ct-fixed th,.ct-fixed td{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
      + '.ct-fixed th,.ct-fixed td:not(.ct-keep){text-align:center}'
      + '.ct-fixed th.ct-keep,.ct-fixed td.ct-keep{overflow:visible}}'
      + '.ct-fixed th{position:relative}'
      + '.ct-resizer{position:absolute;top:0;right:-4px;width:9px;height:100%;cursor:col-resize;user-select:none;z-index:2}'
      + '.ct-resizer.edge-left{left:0;right:auto}'
      + '.ct-resizer::before{content:"";position:absolute;left:3px;top:0;bottom:0;width:1px;background:var(--border)}'
      + '.ct-resizer:hover::before,.ct-resizer.dragging::before{width:2px;background:var(--accent)}'
      + '.ct-cols{position:relative}'
      + '.ct-cols-menu{position:absolute;z-index:60;top:calc(100% + 4px);right:0;min-width:190px;background:var(--surface);border:1px solid var(--border);border-radius:8px;box-shadow:var(--shadow-md);padding:6px;display:none;max-height:320px;overflow:auto}'
      + '.ct-cols-menu.open{display:block}'
      + '.ct-cols-opt{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;font-size:13px;cursor:pointer;white-space:nowrap}'
      + '.ct-cols-opt:hover{background:var(--surface-2)}'
      + '.ct-cols-opt input{width:15px;height:15px;flex:none}';
    document.head.appendChild(st);
  }

  window.ColumnTools = {
    // opts: { storageKey, columns:[{col,label,width,type,render}], onChange }
    create: function (opts) {
      ensureStyle();
      var columns = opts.columns || [];
      var storageKey = 'cols:' + (opts.storageKey || 'view');
      var state = { hidden: {}, widths: {} };
      try { var saved = JSON.parse(localStorage.getItem(storageKey) || 'null'); if (saved) { state.hidden = saved.hidden || {}; state.widths = saved.widths || {}; } } catch (error) { }
      function save() { try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch (error) { } }
      function visible() { return columns.filter(function (c) { return !state.hidden[c.col]; }); }
      function widthOf(c) { return state.widths[c.col] || c.width || 120; }

      return {
        visible: visible,
        typeOf: function (col) { for (var i = 0; i < columns.length; i++) if (columns[i].col === col) return columns[i].type || 'text'; return 'text'; },

        tableWidth: function (leadCols, trailCols) {
          var sum = visible().reduce(function (a, c) { return a + widthOf(c); }, 0);
          (leadCols || []).forEach(function (w) { sum += w; });
          (trailCols || []).forEach(function (w) { sum += w; });
          return sum;
        },
        colgroup: function (leadCols, trailCols) {
          return (leadCols || []).map(function (w) { return '<col style="width:' + w + 'px">'; }).join('')
            + visible().map(function (c) { return '<col style="width:' + widthOf(c) + 'px">'; }).join('')
            + (trailCols || []).map(function (w) { return '<col style="width:' + w + 'px">'; }).join('');
        },
        head: function (sortIndicator) {
          return visible().map(function (c, i) {
            var ind = sortIndicator ? (' ' + sortIndicator(c.col)) : '';
            return '<th data-col="' + escapeHtml(c.col) + '">'
              + (i === 0 ? '<span class="ct-resizer edge-left" data-col="' + escapeHtml(c.col) + '" data-edge="left"></span>' : '')
              + escapeHtml(c.label) + ind
              + '<span class="ct-resizer" data-col="' + escapeHtml(c.col) + '"></span></th>';
          }).join('');
        },
        cells: function (entry) {
          return visible().map(function (c) {
            var raw = entry[c.col];
            var value = c.render ? c.render(entry) : ((raw == null || raw === '') ? '<span style="color:var(--muted)">-</span>' : escapeHtml(raw));
            var title = c.render ? '' : ' title="' + escapeHtml(raw == null ? '' : raw) + '"';
            return '<td data-label="' + escapeHtml(c.label) + '"' + title + '>' + value + '</td>';
          }).join('');
        },

        wireResize: function (tableEl, leadCount) {
          if (!tableEl) return;
          var vcols = visible();
          leadCount = leadCount || 0;
          function colElAt(vi) { return tableEl.querySelectorAll('colgroup col')[leadCount + vi]; }
          function applyColWidth(colEl, colName, newW) {
            var oldW = parseInt(colEl.style.width, 10) || 120;
            var tW = parseInt(tableEl.style.width, 10) || Math.round(tableEl.getBoundingClientRect().width);
            colEl.style.width = newW + 'px';
            tableEl.style.width = (tW + (newW - oldW)) + 'px';
            state.widths[colName] = newW; save();
          }
          tableEl.querySelectorAll('.ct-resizer').forEach(function (rz) {
            var colName = rz.getAttribute('data-col'), vi = -1;
            for (var k = 0; k < vcols.length; k++) { if (vcols[k].col === colName) { vi = k; break; } }
            if (vi < 0) return;

            rz.addEventListener('mousedown', function (event) {
              event.preventDefault(); event.stopPropagation();
              var colEl = colElAt(vi); if (!colEl) return;
              var edge = rz.getAttribute('data-edge');
              var nextCol = (edge !== 'left') ? (vcols[vi + 1] || null) : null;
              var nextColEl = nextCol ? colElAt(vi + 1) : null;
              var nextName = nextCol ? nextCol.col : null;
              var startX = event.clientX;
              var startW = parseInt(colEl.style.width, 10) || 120;
              var startNextW = nextColEl ? (parseInt(nextColEl.style.width, 10) || 120) : 0;
              var startTableW = parseInt(tableEl.style.width, 10) || Math.round(tableEl.getBoundingClientRect().width);
              rz.classList.add('dragging');
              document.body.style.userSelect = 'none';
              document.body.style.cursor = 'col-resize';
              function onMove(e) {
                var delta = e.clientX - startX;
                if (edge === 'left') {
                  var lw = Math.max(56, startW - delta);
                  colEl.style.width = lw + 'px';
                  tableEl.style.width = (startTableW + (lw - startW)) + 'px';
                } else if (nextColEl) {
                  if (delta < 56 - startW) delta = 56 - startW;
                  if (delta > startNextW - 56) delta = startNextW - 56;
                  colEl.style.width = (startW + delta) + 'px';
                  nextColEl.style.width = (startNextW - delta) + 'px';
                } else {
                  var newW = Math.max(56, startW + delta);
                  colEl.style.width = newW + 'px';
                  tableEl.style.width = (startTableW + (newW - startW)) + 'px';
                }
              }
              function onUp() {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                rz.classList.remove('dragging');
                document.body.style.userSelect = '';
                document.body.style.cursor = '';
                state.widths[colName] = parseInt(colEl.style.width, 10) || startW;
                if (nextColEl && nextName) state.widths[nextName] = parseInt(nextColEl.style.width, 10) || startNextW;
                save();
              }
              document.addEventListener('mousemove', onMove);
              document.addEventListener('mouseup', onUp);
            });

            rz.addEventListener('dblclick', function (event) {
              event.preventDefault(); event.stopPropagation();
              var colEl = colElAt(vi); if (!colEl) return;
              var cellIndex = leadCount + vi;
              var sampleTd = tableEl.querySelector('tbody tr td:nth-child(' + (cellIndex + 1) + ')');
              var meas = document.createElement('span');
              meas.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;top:-9999px;left:-9999px';
              if (sampleTd) { var cs = getComputedStyle(sampleTd); meas.style.font = cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily; }
              document.body.appendChild(meas);
              var maxW = 40, th = tableEl.querySelectorAll('thead th')[cellIndex];
              if (th) { meas.textContent = th.textContent || ''; maxW = Math.max(maxW, meas.offsetWidth + 22); }
              tableEl.querySelectorAll('tbody tr').forEach(function (tr) {
                var td = tr.children[cellIndex];
                if (td) { meas.textContent = td.textContent || ''; if (meas.offsetWidth > maxW) maxW = meas.offsetWidth; }
              });
              meas.remove();
              applyColWidth(colEl, colName, Math.max(56, Math.min(680, maxW + 28)));
            });
          });
        },

        autofitTrail: function (tableEl, cellSelector) {
          if (!tableEl) return;
          var maxW = 0;
          tableEl.querySelectorAll(cellSelector).forEach(function (cell) {
            var w = 0;
            for (var i = 0; i < cell.children.length; i++) {
              var cs = getComputedStyle(cell.children[i]);
              w += cell.children[i].offsetWidth + (parseInt(cs.marginLeft, 10) || 0) + (parseInt(cs.marginRight, 10) || 0);
            }
            if (w > maxW) maxW = w;
          });
          if (!maxW) return;
          var cols = tableEl.querySelectorAll('colgroup col');
          var col = cols[cols.length - 1]; if (!col) return;
          var cur = parseInt(col.style.width, 10) || 0;
          var want = maxW + 24;
          if (want > cur) {
            col.style.width = want + 'px';
            var tW = parseInt(tableEl.style.width, 10) || Math.round(tableEl.getBoundingClientRect().width);
            tableEl.style.width = (tW + (want - cur)) + 'px';
          }
        },

        menuButton: function () {
          return '<div class="ct-cols"><button type="button" class="btn btn-light" data-cols-btn title="Mostrar, ocultar e redimensionar colunas">Colunas</button><div class="ct-cols-menu" data-cols-menu></div></div>';
        },
        wireMenu: function (rootEl) {
          var wrap = rootEl.querySelector('.ct-cols');
          var btn = rootEl.querySelector('[data-cols-btn]'), menu = rootEl.querySelector('[data-cols-menu]');
          if (!btn || !menu) return;
          function build() {
            menu.innerHTML = columns.map(function (c) {
              return '<label class="ct-cols-opt"><input type="checkbox" data-c="' + escapeHtml(c.col) + '"' + (state.hidden[c.col] ? '' : ' checked') + '> ' + escapeHtml(c.label) + '</label>';
            }).join('');
            menu.querySelectorAll('input[data-c]').forEach(function (cb) {
              cb.addEventListener('change', function () {
                var col = cb.getAttribute('data-c');
                if (!cb.checked && visible().length <= 1) { cb.checked = true; return; }
                if (cb.checked) delete state.hidden[col]; else state.hidden[col] = true;
                save(); if (opts.onChange) opts.onChange();
              });
            });
          }
          btn.addEventListener('click', function (event) { event.stopPropagation(); build(); menu.classList.toggle('open'); });
          document.addEventListener('click', function (event) { if (wrap && !wrap.contains(event.target)) menu.classList.remove('open'); });
        },
      };
    },
  };
})();

;

/* ==== js/shared/client-pager.js ==== */
(function () {
  window.ClientPager = function (total, page, pageSize) {
    pageSize = pageSize || 50;
    total = total || 0;
    var pages = Math.max(1, Math.ceil(total / pageSize));
    page = Math.min(Math.max(0, page || 0), pages - 1);
    var from = total ? page * pageSize + 1 : 0;
    var to = Math.min(total, (page + 1) * pageSize);
    return {
      page: page,
      pages: pages,
      slice: function (arr) { return (arr || []).slice(page * pageSize, page * pageSize + pageSize); },
      html: function () {
        if (total <= pageSize) return '';
        return '<div class="cp-pager" style="display:flex;align-items:center;gap:10px;justify-content:flex-end;padding:12px 8px;flex-wrap:wrap">'
          + '<span style="color:var(--muted);font-size:13px">' + from + '–' + to + ' de ' + total + '</span>'
          + '<button type="button" class="btn btn-light" data-cp="prev"' + (page <= 0 ? ' disabled' : '') + '>‹ Anterior</button>'
          + '<button type="button" class="btn btn-light" data-cp="next"' + (page >= pages - 1 ? ' disabled' : '') + '>Próxima ›</button>'
          + '</div>';
      },
      wire: function (root, onGo) {
        if (!root) return;
        var prev = root.querySelector('[data-cp="prev"]'), next = root.querySelector('[data-cp="next"]');
        if (prev) prev.addEventListener('click', function () { onGo(page - 1); });
        if (next) next.addEventListener('click', function () { onGo(page + 1); });
      }
    };
  };
})();

;

/* ==== js/shared/process-approvers-modal.js ==== */
(function () {
  function escapeHtml(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function money(value) { return (Number(value) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

  var SVG_SEARCH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>';
  var SVG_EMPTY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"/></svg>';
  var SVG_DOC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>';
  var SVG_WAIT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 22h14M5 2h14M17 22v-4.17a2 2 0 0 0-.59-1.42L12 12l-4.41 4.41A2 2 0 0 0 7 17.83V22M7 2v4.17a2 2 0 0 0 .59 1.42L12 12l4.41-4.41A2 2 0 0 0 17 6.17V2"/></svg>';

  function personRow(approver) {
    var name = approver.name || approver.email || '-';
    var subject = (approver.name && approver.email && approver.name !== approver.email) ? approver.email : '';
    var tag = approver.group_name || ('Nível ' + approver.level);
    return '<div class="u-card">'
      + '<div class="u-id"><b>' + escapeHtml(name) + '</b>'
      + (subject ? '<span class="u-sub">' + escapeHtml(subject) + '</span>' : '') + '</div>'
      + '<span class="badge blue u-tag">' + escapeHtml(tag) + '</span></div>';
  }

  function emptyState() {
    return '<div class="apv-empty"><span class="apv-empty-ic">' + SVG_EMPTY + '</span>'
      + '<div class="apv-empty-t">Nenhum dado encontrado</div>'
      + '<div class="apv-empty-s">A sua consulta não retornou resultados.</div></div>';
  }

  function matches(a, term) {
    if (!term) return true;
    return [a.name, a.email, a.group_name].join(' ').toLowerCase().indexOf(term) >= 0;
  }

  window.openProcessApprovers = async function (process) {
    var uuid = process.uuid_prc;
    var steps = (window.CONFIG.STEPS || {});
    var statusTxt = process.status_nome || steps[process.status_step_prc] || ('Status ' + process.status_step_prc);

    var o = document.createElement('div'); o.className = 'modal-overlay';
    function column(key, title, subject) {
      return '<section class="apv-col">'
        + '<h3>' + title + '</h3><p class="apv-sub">' + subject + '</p>'
        + '<div class="apv-search">' + SVG_SEARCH + '<input data-search="' + key + '" placeholder="Buscar…"></div>'
        + '<div class="apv-body" data-col="' + key + '"><div class="apv-empty"><span class="apv-empty-ic">' + SVG_EMPTY + '</span><div class="apv-empty-t">Carregando…</div></div></div>'
        + '</section>';
    }
    o.innerHTML =
      '<div class="modal-box approvers"><button class="modal-x" aria-label="Fechar">×</button>'
      + '<h2>Aprovadores do Processo #' + escapeHtml(process.id_prc) + '</h2>'
      + '<div class="apv-proc"><span class="apv-proc-icon">' + SVG_DOC + '</span>'
      + '<div><div class="apv-proc-label">Processo #' + escapeHtml(process.id_prc) + '</div>'
      + '<div class="apv-proc-value">' + money(process.value_prc) + '</div>'
      + '<div class="apv-proc-status">' + escapeHtml(statusTxt) + '</div></div></div>'
      + '<div class="apv-cols">'
      + column('done', 'Aprovações Concluídas', 'Quem já aprovou este processo.')
      + column('elig', 'Aprovadores Elegíveis (Etapa Atual)', 'Quem pode aprovar o processo agora.')
      + column('next', 'Próximas Etapas Necessárias', 'Aprovações futuras para este processo.')
      + '</div></div>';
    o.addEventListener('click', function (event) { if (event.target === o || event.target.classList.contains('modal-x')) o.remove(); });
    document.body.appendChild(o);

    var data = { done: [], elig: [] };
    var isPending = process.status_step_prc === window.CONFIG.STATUS.aguardando;

    function renderCol(key) {
      var body = o.querySelector('[data-col="' + key + '"]'); if (!body) return;
      var input = o.querySelector('[data-search="' + key + '"]');
      var term = (input && input.value || '').toLowerCase().trim();
      if (key === 'next') {
        body.innerHTML = isPending
          ? '<div class="apv-next"><span class="apv-next-ic">' + SVG_WAIT + '</span>'
          + '<div><b>Aguardando aprovação</b><span>Todos os aprovadores</span></div></div>'
          : emptyState();
        return;
      }
      var list = (data[key] || []).filter(function (item) { return matches(item, term); });
      body.innerHTML = list.length ? list.map(personRow).join('') : emptyState();
    }

    o.querySelectorAll('[data-search]').forEach(function (item) {
      item.addEventListener('input', function () { renderCol(item.getAttribute('data-search')); });
    });
    renderCol('next');

    try {
      window.Store.invalidateKey('approvers', uuid);
      window.Store.invalidateKey('eligible_approvers', uuid);
      data.done = await window.Store.get('approvers', uuid);
      renderCol('done');
      data.elig = await window.Store.get('eligible_approvers', uuid);
      renderCol('elig');
    } catch (error) {
      console.error(error);
      ['done', 'elig'].forEach(function (item) { var columnButton = o.querySelector('[data-col="' + item + '"]'); if (columnButton) columnButton.innerHTML = '<div class="view-error">' + escapeHtml(error.message) + '</div>'; });
    }
  };
})();

;

/* ==== js/shared/process-installments-modal.js ==== */
(function () {
  function escapeHtml(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function money(value) { return (Number(value) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  function toast(message, isSuccess) {
    var t = document.createElement('div'); t.textContent = message;
    t.style.cssText = 'position:fixed;top:16px;right:16px;z-index:9999;padding:10px 14px;border-radius:8px;font-size:14px;box-shadow:var(--shadow-md);'
      + (isSuccess ? 'background:var(--ok-weak);color:#166534' : 'background:var(--danger-weak);color:#9f1239');
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, 3500);
  }

  window.openInstallments = async function (process, onSaved) {
    var uuid = process.uuid_prc, total = Number(process.value_prc) || 0;
    var rows = [];
    try { rows = await window.Store.get('installments', uuid); } catch (error) { rows = []; }
    var installments = (rows || []).map(function (item) { return { vencimento: (item.due_date_ins || '').split('T')[0], valor: Number(item.value_ins) || 0 }; });

    var o = document.createElement('div'); o.className = 'modal-overlay';
    o.innerHTML =
      '<div class="modal-box lg"><button class="modal-x" aria-label="Fechar">×</button>'
      + '<div class="modal-title">Parcelas - Processo #' + escapeHtml(process.id_prc) + '</div>'
      + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px">'
      + '<button class="btn btn-light" id="pm-add">+ Adicionar parcela</button>'
      + '<div id="pm-soma" class="section-sub" style="margin:0"></div></div>'
      + '<div id="pm-rows"></div>'
      + '<div class="modal-actions"><button class="btn btn-light" id="pm-cancel">Cancelar</button>'
      + '<button class="btn btn-primary" id="pm-save">Salvar parcelas</button></div></div>';
    document.body.appendChild(o);
    o.addEventListener('click', function (event) { if (event.target === o || event.target.classList.contains('modal-x')) o.remove(); });
    o.querySelector('#pm-cancel').addEventListener('click', function () { o.remove(); });

    function sumInstallments() { return installments.reduce(function (accumulated, installment) { return accumulated + (Number(installment.valor) || 0); }, 0); }
    function renderSum() {
      var s = sumInstallments(), diff = Math.round((s - total) * 100) / 100;
      var cssClass = Math.abs(diff) < 0.01 ? 'ok' : 'red';
      o.querySelector('#pm-soma').innerHTML = 'Soma: <b>' + money(s) + '</b> · Processo: <b>' + money(total) + '</b> '
        + '<span class="badge ' + cssClass + '">' + (Math.abs(diff) < 0.01 ? 'OK' : (diff > 0 ? 'acima ' : 'abaixo ') + money(Math.abs(diff))) + '</span>';
    }
    function render() {
      var box = o.querySelector('#pm-rows');
      if (!installments.length) { box.innerHTML = '<div class="empty">Sem parcelas. Adicione uma.</div>'; renderSum(); return; }
      box.innerHTML = '<table><thead><tr><th>#</th><th>Vencimento</th><th>Valor</th><th></th></tr></thead><tbody>'
        + installments.map(function (installment, index) {
          return '<tr><td>' + (index + 1) + '</td>'
            + '<td><input type="date" data-i="' + index + '" data-f="vencimento" value="' + escapeHtml(installment.vencimento) + '"></td>'
            + '<td><input type="number" step="0.01" data-i="' + index + '" data-f="valor" value="' + escapeHtml(installment.valor) + '" style="width:140px"></td>'
            + '<td style="text-align:right"><button class="btn btn-danger" data-del="' + index + '">Remover</button></td></tr>';
        }).join('') + '</tbody></table>';
      box.querySelectorAll('input').forEach(function (item) {
        item.addEventListener('input', function () { installments[+item.getAttribute('data-i')][item.getAttribute('data-f')] = item.value; renderSum(); });
      });
      box.querySelectorAll('[data-del]').forEach(function (item) {
        item.addEventListener('click', function () { installments.splice(+item.getAttribute('data-del'), 1); render(); });
      });
      renderSum();
    }
    o.querySelector('#pm-add').addEventListener('click', function () {
      var last = installments[installments.length - 1];
      var nextDueDate = ''; if (last && last.vencimento) { var d = new Date(last.vencimento + 'T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() + 1); nextDueDate = d.toISOString().split('T')[0]; }
      installments.push({ vencimento: nextDueDate, valor: 0 }); render();
    });
    o.querySelector('#pm-save').addEventListener('click', async function () {
      var button = this; button.disabled = true; button.textContent = 'Salvando…';
      try {
        var payload = installments.filter(function (installment) { return installment.vencimento; }).map(function (installment) { return { due_date_ins: installment.vencimento, value_ins: Number(installment.valor) || 0 }; });
        var payloadSum = payload.reduce(function (accumulated, installment) { return accumulated + (installment.value_ins || 0); }, 0);
        var outOfOrder = false; for (var index = 1; index < payload.length; index++) { if (payload[index].due_date_ins < payload[index - 1].due_date_ins) { outOfOrder = true; break; } }
        await window.Store.commit(
          function () { return window.API.post('/processes/' + uuid + '/installments', { installments: payload }); },
          function () {
            window.Store.invalidateKey('installments', uuid);
            window.Store.patch('financeiro', 'uuid_prc', uuid, { soma_parcelas: payloadSum, qtd_parcelas: payload.length, parcelas_fora_ordem: outOfOrder });
            return ['installments'];
          });
        toast('Parcelas salvas.', true); o.remove(); if (typeof onSaved === 'function') onSaved();
      } catch (error) { button.disabled = false; button.textContent = 'Salvar parcelas'; toast('Erro: ' + error.message); }
    });
    render();
  };
})();

;

/* ==== js/shared/process-filters.js ==== */
(function () {
  function escapeHtml(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function asArray(value) { return Array.isArray(value) ? value.slice() : (value === '' || value == null ? [] : [value]); }

  var buildingsCache = {};
  async function loadBuildings(company) {
    if (!company) return [];
    if (buildingsCache[company]) return buildingsCache[company];
    var rows = await window.SB.select('v_obras', function (query) { return query.eq('empresa', company).order('nome'); });
    buildingsCache[company] = rows || [];
    return buildingsCache[company];
  }
  async function loadAllBuildings() {
    if (buildingsCache.__all__) return buildingsCache.__all__;
    var rows = await window.SB.select('v_obras', function (query) { return query.order('nome'); });
    buildingsCache.__all__ = rows || [];
    return buildingsCache.__all__;
  }

  var STYLE_ID = 'pf-ms-style';
  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var styleElement = document.createElement('style'); styleElement.id = STYLE_ID;
    styleElement.textContent =
      '.pf-ms{position:relative}'
      + '.pf-ms-btn{display:flex;align-items:center;gap:6px;justify-content:space-between;min-width:150px;max-width:230px;'
      + 'padding:6px 9px;border:1px solid var(--border);border-radius:8px;background:var(--surface);cursor:pointer;'
      + 'font-size:13px;color:var(--text);text-align:left;white-space:nowrap;overflow:hidden}'
      + '.pf-ms-btn .pf-ms-txt{overflow:hidden;text-overflow:ellipsis}'
      + '.pf-ms-btn[disabled]{opacity:.5;cursor:not-allowed}'
      + '.pf-ms-pop{position:absolute;z-index:60;top:calc(100% + 4px);left:0;width:230px;text-transform:none;'
      + 'background:var(--surface);border:1px solid var(--border);border-radius:8px;box-shadow:var(--shadow-md);padding:6px;display:none}'
      + '.pf-ms-pop.open{display:block}'
      + '.pf-ms-pop .pf-ms-search{width:100%;margin-bottom:4px;padding:5px 8px;border:1px solid var(--border);border-radius:6px;font-size:12.5px;box-sizing:border-box}'
      + '.pf-ms-pop .pf-ms-list{max-height:200px;overflow-y:auto;overflow-x:hidden;display:flex;flex-direction:column}'
      + '.pf-ms-pop .pf-ms-opt{display:flex;justify-content:flex-start;gap:8px;align-items:center;width:auto;margin:0;'
      + 'padding:5px 6px;border-radius:5px;cursor:pointer;font-size:13px;line-height:1.2;text-transform:none;text-align:left;font-weight:400;letter-spacing:normal}'
      + '.pf-ms-pop .pf-ms-opt:hover{background:var(--surface-2)}'
      + '.pf-ms-pop .pf-ms-opt input{flex:none;margin:0;width:15px;height:15px;pointer-events:none}'
      + '.pf-ms-pop .pf-ms-opt span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
      + '.pf-ms-pop .pf-ms-empty{padding:6px;color:var(--muted);font-size:12.5px}'
      + '.pf-active{display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end}'
      + '.pf-chip{display:inline-flex;align-items:flex-end;gap:4px}'
      + '.pf-daterange{display:inline-flex;gap:6px}'
      + '.pf-chip .pf-txt{padding:6px 8px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text);font-size:12.5px;min-width:160px}'
      + '.pf-chip-x{border:1px solid var(--border);background:var(--surface);color:var(--muted);border-radius:6px;width:24px;height:30px;cursor:pointer;font-size:15px;line-height:1;flex:none}'
      + '.pf-chip-x:hover{color:var(--danger);border-color:var(--danger)}'
      + '.pf-add{position:relative}'
      + '.pf-add-btn{border:1px dashed var(--border);background:var(--surface);color:var(--text-2);border-radius:8px;padding:7px 12px;cursor:pointer;font-size:13px;font-weight:600;white-space:nowrap}'
      + '.pf-add-btn:hover{border-color:var(--accent);color:var(--accent)}'
      + '.pf-add-menu{position:absolute;z-index:60;top:calc(100% + 4px);left:0;min-width:180px;background:var(--surface);border:1px solid var(--border);border-radius:8px;box-shadow:var(--shadow-md);padding:6px;display:none}'
      + '.pf-add-menu.open{display:block}'
      + '.pf-add-opt{display:block;width:100%;text-align:left;border:0;background:none;padding:7px 10px;border-radius:6px;cursor:pointer;font-size:13px;color:var(--text)}'
      + '.pf-add-opt:hover{background:var(--surface-2)}'
      + '.pf-add-empty{padding:8px 10px;color:var(--muted);font-size:12.5px}';
    document.head.appendChild(styleElement);
  }

  function makeMultiSelect(caption, options) {
    var field = document.createElement('div'); field.className = 'pf-field pf-ms';
    field.innerHTML = caption
      + '<button type="button" class="pf-ms-btn"><span class="pf-ms-txt">Todas</span><span>▾</span></button>'
      + '<div class="pf-ms-pop"><input class="pf-ms-search" placeholder="Buscar…">'
      + '<div class="pf-ms-list"></div></div>';
    var button = field.querySelector('.pf-ms-btn');
    var textElement = field.querySelector('.pf-ms-txt');
    var popupElement = field.querySelector('.pf-ms-pop');
    var search = field.querySelector('.pf-ms-search');
    var list = field.querySelector('.pf-ms-list');

    var items = [];
    var selected = {};
    var labelByValue = {};

    function selectedArray() { return Object.keys(selected); }
    function updateButton() {
      var n = selectedArray().length;
      textElement.textContent = n === 0 ? (options.allLabel || 'Todas')
        : (n === 1 ? (labelByValue[selectedArray()[0]] || '1 selecionada') : (n + ' selecionadas'));
    }
    function renderList() {
      var term = (search.value || '').toLowerCase().trim();
      var shown = items.filter(function (item) { return !term || String(item.label).toLowerCase().indexOf(term) >= 0; });
      if (!shown.length) { list.innerHTML = '<div class="pf-ms-empty">Nada encontrado</div>'; return; }
      list.innerHTML = shown.map(function (shownItem) {
        return '<div class="pf-ms-opt" data-v="' + escapeHtml(shownItem.value) + '" title="' + escapeHtml(shownItem.label) + '">'
          + '<input type="checkbox" tabindex="-1"' + (selected[shownItem.value] ? ' checked' : '') + '>'
          + '<span>' + escapeHtml(shownItem.label) + '</span></div>';
      }).join('');
      list.querySelectorAll('.pf-ms-opt').forEach(function (item) {
        item.addEventListener('click', function () {
          var value = item.getAttribute('data-v'), on = !selected[value];
          if (on) selected[value] = true; else delete selected[value];
          var callback = item.querySelector('input'); if (callback) callback.checked = on;
          updateButton();
          if (options.onChange) options.onChange(selectedArray());
        });
      });
    }
    function openPop() { popupElement.classList.add('open'); search.value = ''; renderList(); search.focus(); }
    function closePop() { popupElement.classList.remove('open'); }

    button.addEventListener('click', function (event) {
      event.preventDefault();
      if (button.disabled) return;
      if (popupElement.classList.contains('open')) closePop(); else openPop();
    });
    search.addEventListener('input', renderList);
    document.addEventListener('click', function (event) { if (!field.contains(event.target)) closePop(); });

    return {
      el: field,
      getValues: selectedArray,
      setOptions: function (optItems) {
        items = optItems || []; labelByValue = {};
        items.forEach(function (item) { labelByValue[item.value] = item.label; });
        Object.keys(selected).forEach(function (item) { if (!(item in labelByValue)) delete selected[item]; });
        updateButton(); if (popupElement.classList.contains('open')) renderList();
      },
      setValues: function (items) {
        selected = {}; (items || []).forEach(function (item) { selected[String(item)] = true; });
        updateButton();
      },
      setDisabled: function (d) { button.disabled = !!d; if (d) closePop(); },
      clear: function () { selected = {}; search.value = ''; updateButton(); },
    };
  }

  var FIELDS = [
    { key: 'company', label: 'Empresa' },
    { key: 'building', label: 'Obra' },
    { key: 'kind', label: 'Tipo' },
    { key: 'fornecedor', label: 'Fornecedor' },
    { key: 'descricao', label: 'Descrição' },
    { key: 'uau', label: 'Nº UAU' },
    { key: 'date', label: 'Vencimento (de–até)' },
    { key: 'status', label: 'Status' },
    { key: 'urgent', label: 'Urgente' },
  ];

  window.ProcessFilters = {
    mount: async function (container, options) {
      options = options || {};
      ensureStyle();
      var storageKey = 'pfbuilder:' + (options.storageKey || 'global');
      var saved = {};
      try { saved = JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch (error) { saved = {}; }
      var savedVals = (saved && saved.values) || {};
      var savedAdded = (saved && saved.added) || {};

      var companyMS = makeMultiSelect('Empresa', { allLabel: 'Todas', onChange: onCompanyChange });
      var buildingMS = makeMultiSelect('Obra', { allLabel: 'Todas', onChange: emit });
      var statusMS = makeMultiSelect('Status', { allLabel: 'Todos', onChange: emit });
      var kindMS = makeMultiSelect('Tipo', { allLabel: 'Todos', onChange: emit });

      function textField(label, placeholder) {
        var f = document.createElement('label'); f.className = 'pf-field'; f.textContent = label;
        var inp = document.createElement('input'); inp.type = 'text'; inp.className = 'pf-txt'; inp.placeholder = placeholder || '';
        var timer = null;
        inp.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(emit, 350); });
        f.appendChild(inp);
        return { el: f, input: inp };
      }
      var fornecedorField = textField('Fornecedor', 'Nome do fornecedor…');
      var descricaoField = textField('Descrição', 'Texto da descrição…');
      var uauField = textField('Nº UAU', 'Número do UAU…');

      var urgentField = document.createElement('label'); urgentField.className = 'pf-field'; urgentField.textContent = 'Urgente';
      var urgentSel = document.createElement('select');
      urgentSel.innerHTML = '<option value="">Todos</option><option value="1">Sim</option><option value="0">Não</option>';
      urgentField.appendChild(urgentSel);
      urgentSel.addEventListener('change', emit);

      var dateField = document.createElement('span'); dateField.className = 'pf-daterange';
      dateField.innerHTML = '<label class="pf-field">De<input type="date" data-d="from"></label><label class="pf-field">Até<input type="date" data-d="to"></label>';
      var dateFrom = dateField.querySelector('[data-d="from"]');
      var dateTo = dateField.querySelector('[data-d="to"]');
      dateFrom.addEventListener('change', emit); dateTo.addEventListener('change', emit);

      var CTRL = {
        company: { el: companyMS.el, setSaved: function () { companyMS.setValues(asArray(savedVals.company)); }, clear: function () { companyMS.clear(); } },
        building: { el: buildingMS.el, setSaved: function () { }, clear: function () { buildingMS.clear(); } },
        status: { el: statusMS.el, setSaved: function () { statusMS.setValues(asArray(savedVals.status)); }, clear: function () { statusMS.clear(); } },
        kind: { el: kindMS.el, setSaved: function () { kindMS.setValues(asArray(savedVals.kind)); }, clear: function () { kindMS.clear(); } },
        urgent: { el: urgentField, setSaved: function () { urgentSel.value = savedVals.urgent || ''; }, clear: function () { urgentSel.value = ''; } },
        fornecedor: { el: fornecedorField.el, setSaved: function () { fornecedorField.input.value = savedVals.fornecedor || ''; }, clear: function () { fornecedorField.input.value = ''; } },
        descricao: { el: descricaoField.el, setSaved: function () { descricaoField.input.value = savedVals.descricao || ''; }, clear: function () { descricaoField.input.value = ''; } },
        uau: { el: uauField.el, setSaved: function () { uauField.input.value = savedVals.uau || ''; }, clear: function () { uauField.input.value = ''; } },
        date: { el: dateField, setSaved: function () { dateFrom.value = savedVals.from || ''; dateTo.value = savedVals.to || ''; }, clear: function () { dateFrom.value = ''; dateTo.value = ''; } },
      };

      container.innerHTML = '';
      var active = document.createElement('div'); active.className = 'pf-active';
      var addWrap = document.createElement('div'); addWrap.className = 'pf-add';
      addWrap.innerHTML = '<button type="button" class="pf-add-btn">+ Filtro</button><div class="pf-add-menu"></div>';
      container.appendChild(active);
      container.appendChild(addWrap);
      var addBtn = addWrap.querySelector('.pf-add-btn');
      var addMenu = addWrap.querySelector('.pf-add-menu');

      var added = {};

      function renderAddMenu() {
        var avail = FIELDS.filter(function (f) { return !added[f.key]; });
        if (!avail.length) { addMenu.innerHTML = '<div class="pf-add-empty">Todos os filtros adicionados</div>'; return; }
        addMenu.innerHTML = avail.map(function (f) { return '<button type="button" class="pf-add-opt" data-k="' + f.key + '">' + escapeHtml(f.label) + '</button>'; }).join('');
        addMenu.querySelectorAll('.pf-add-opt').forEach(function (b) {
          b.addEventListener('click', function () { addMenu.classList.remove('open'); addField(b.getAttribute('data-k')); });
        });
      }
      addBtn.addEventListener('click', function () { renderAddMenu(); addMenu.classList.toggle('open'); });
      document.addEventListener('click', function (event) { if (!addWrap.contains(event.target)) addMenu.classList.remove('open'); });

      function addField(key, restoring) {
        if (added[key]) return;
        var chip = document.createElement('div'); chip.className = 'pf-chip'; chip.setAttribute('data-field', key);
        chip.appendChild(CTRL[key].el);
        var x = document.createElement('button'); x.type = 'button'; x.className = 'pf-chip-x'; x.title = 'Remover filtro'; x.textContent = '×';
        x.addEventListener('click', function () { removeField(key); });
        chip.appendChild(x);
        active.appendChild(chip);
        added[key] = chip;
        if (!restoring) {
          if (key === 'building' || key === 'company') refreshBuildings(null);
          emit();
        }
      }

      function removeField(key) {
        var chip = added[key]; if (!chip) return;
        CTRL[key].clear();
        chip.remove(); delete added[key];
        emit();
      }

      async function refreshBuildings(keepValues) {
        if (!added.building) return;
        var comps = added.company ? companyMS.getValues() : [];
        var seen = {}, opts = [];
        var source = comps.length ? [] : await loadAllBuildings();
        for (var index = 0; index < comps.length; index++) source = source.concat(await loadBuildings(comps[index]));
        source.forEach(function (row) {
          var value = String(row.codigo);
          if (seen[value]) return; seen[value] = 1;
          opts.push({ value: value, label: row.nome });
        });
        buildingMS.setOptions(opts);
        if (keepValues) buildingMS.setValues(keepValues);
      }

      async function onCompanyChange() { await refreshBuildings(buildingMS.getValues()); emit(); }

      function getValues() {
        return {
          company: added.company ? companyMS.getValues() : [],
          building: added.building ? buildingMS.getValues() : [],
          status: added.status ? statusMS.getValues() : [],
          kind: added.kind ? kindMS.getValues() : [],
          urgent: added.urgent ? urgentSel.value : '',
          fornecedor: added.fornecedor ? fornecedorField.input.value.trim() : '',
          descricao: added.descricao ? descricaoField.input.value.trim() : '',
          uau: added.uau ? uauField.input.value.trim() : '',
          from: added.date ? dateFrom.value : '',
          to: added.date ? dateTo.value : '',
        };
      }
      function persist() {
        var addedKeys = {}; Object.keys(added).forEach(function (k) { addedKeys[k] = true; });
        try { localStorage.setItem(storageKey, JSON.stringify({ added: addedKeys, values: getValues() })); } catch (error) { }
      }
      function emit() { persist(); if (options.onChange) options.onChange(getValues()); }

      var companies = [];
      try { companies = await window.Store.get('empresas'); } catch (error) { companies = []; }
      companyMS.setOptions((companies || []).map(function (item) { return { value: String(item.codigo), label: item.nome }; }));

      var steps = (window.CONFIG && window.CONFIG.STEPS) || {};
      statusMS.setOptions(Object.keys(steps).map(function (item) { return { value: String(item), label: steps[item] }; }));

      var kinds = (window.CONFIG && window.CONFIG.PROCESS_KINDS) || {};
      kindMS.setOptions(Object.keys(kinds)
        .filter(function (item) { return String(kinds[item] || '').trim().toLowerCase() !== 'comissão'; })
        .map(function (item) { return { value: String(item), label: kinds[item] }; }));

      Object.keys(CTRL).forEach(function (key) { CTRL[key].setSaved(); });
      FIELDS.forEach(function (f) { if (savedAdded[f.key]) addField(f.key, true); });
      if (added.building) await refreshBuildings(asArray(savedVals.building));

      return {
        getValues: getValues,
        clear: function () {
          Object.keys(added).slice().forEach(function (key) { CTRL[key].clear(); added[key].remove(); delete added[key]; });
          try { localStorage.removeItem(storageKey); } catch (error) { }
          if (options.onChange) options.onChange(getValues());
        },
      };
    },
  };
})();

;

/* ==== js/shared/process-list.js ==== */
(function () {
  function escapeHtml(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function money(value) { return (Number(value) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  function fmtDate(d) { return d ? String(d).split('T')[0].split('-').reverse().join('/') : '-'; }
  function clip(text, maxPx) {
    if (text == null || text === '') return '<span style="color:var(--muted)">-</span>';
    var safe = escapeHtml(text);
    return '<span class="clip" style="max-width:' + maxPx + 'px" title="' + safe + '">' + safe + '</span>';
  }
  function statusBadge(step, name) {
    var steps = (window.CONFIG && window.CONFIG.STEPS) || {};

    var label = (name && name !== String(step)) ? name : (steps[step] || name || ('Status ' + step));

    var cssClass = ((window.CONFIG && window.CONFIG.STATUS_COLORS) || {})[step] || '';
    return '<span class="badge ' + cssClass + '">' + escapeHtml(label) + '</span>';
  }
  function button(label, cssClass, fn) { var buttonElement = document.createElement('button'); buttonElement.className = 'btn ' + cssClass; buttonElement.style.marginLeft = '6px'; buttonElement.textContent = label; buttonElement.addEventListener('click', fn); return buttonElement; }

  var ICONS = {
    aprovadores: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    Aprovar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/></svg>',
    Corrigir: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    Cancelar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M4.9 4.9l14.2 14.2"/></svg>',
  };
  var SVG_SEARCH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>';

  var TBL_STYLE_ID = 'pl-tbl-style';
  function ensureTableStyle() {
    if (document.getElementById(TBL_STYLE_ID)) return;
    var st = document.createElement('style'); st.id = TBL_STYLE_ID;
    st.textContent =
      '@media (min-width:821px){.pl-fixed{table-layout:fixed}'
      + '.table-scroll table.pl-fixed{min-width:0}'
      + '.pl-fixed th,.pl-fixed td{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
      + '.pl-fixed th,.pl-fixed td:not(.pl-keep){text-align:center}'
      + '.pl-fixed th.pl-keep,.pl-fixed td.pl-keep{overflow:visible}}'
      + '.pl-fixed th{position:relative}'
      + '.pl-resizer{position:absolute;top:0;right:-4px;width:9px;height:100%;cursor:col-resize;user-select:none;z-index:2}'
      + '.pl-resizer.edge-left{left:0;right:auto}'
      + '.pl-resizer::before{content:"";position:absolute;left:3px;top:0;bottom:0;width:1px;background:var(--border)}'
      + '.pl-resizer:hover::before,.pl-resizer.dragging::before{width:2px;background:var(--accent)}'
      + '.pl-cols{position:relative}'
      + '.pl-cols-menu{position:absolute;z-index:60;top:calc(100% + 4px);right:0;min-width:190px;background:var(--surface);border:1px solid var(--border);border-radius:8px;box-shadow:var(--shadow-md);padding:6px;display:none;max-height:320px;overflow:auto}'
      + '.pl-cols-menu.open{display:block}'
      + '.pl-cols-opt{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;font-size:13px;cursor:pointer;white-space:nowrap}'
      + '.pl-cols-opt:hover{background:var(--surface-2)}'
      + '.pl-cols-opt input{width:15px;height:15px;flex:none}';
    document.head.appendChild(st);
  }

  function iconBtn(svg, cssClass, title, fn) {
    var b = document.createElement('button');
    b.className = 'btn btn-icon ' + cssClass; b.style.marginLeft = '6px';
    b.title = title; b.setAttribute('aria-label', title);
    b.innerHTML = svg; b.addEventListener('click', fn); return b;
  }

  function uiConfirm(message, danger) {
    return new Promise(function (resolve) {
      var o = document.createElement('div'); o.className = 'modal-overlay';
      o.innerHTML = '<div class="modal-box" style="width:440px"><div class="modal-title">Confirmação</div>'
        + '<div style="font-size:14px;color:var(--text-2);line-height:1.5">' + escapeHtml(message) + '</div>'
        + '<div class="modal-actions"><button class="btn btn-light" data-x>Cancelar</button>'
        + '<button class="btn ' + (danger ? 'btn-danger' : 'btn-primary') + '" data-ok>Confirmar</button></div></div>';
      function close(value) { o.remove(); resolve(value); }
      o.addEventListener('click', function (event) { if (event.target === o) close(false); });
      o.querySelector('[data-x]').addEventListener('click', function () { close(false); });
      o.querySelector('[data-ok]').addEventListener('click', function () { close(true); });
      document.body.appendChild(o); o.querySelector('[data-ok]').focus();
    });
  }
  function toast(message, isSuccess) {
    var t = document.createElement('div'); t.textContent = message;
    t.style.cssText = 'position:fixed;top:16px;right:16px;z-index:9999;padding:10px 14px;border-radius:8px;font-size:14px;box-shadow:var(--shadow-md);'
      + (isSuccess ? 'background:var(--ok-weak);color:#166534' : 'background:var(--danger-weak);color:#9f1239');
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, 4000);
  }

  function uiAlert(message, title) {
    return new Promise(function (resolve) {
      var o = document.createElement('div'); o.className = 'modal-overlay';
      o.innerHTML = '<div class="modal-box" style="width:460px"><div class="modal-title">' + escapeHtml(title || 'Não foi possível concluir') + '</div>'
        + '<div style="font-size:14px;color:var(--text-2);line-height:1.5">' + escapeHtml(message) + '</div>'
        + '<div class="modal-actions"><button class="btn btn-primary" data-ok>OK</button></div></div>';
      function close() { o.remove(); resolve(); }
      o.addEventListener('click', function (event) { if (event.target === o) close(); });
      o.querySelector('[data-ok]').addEventListener('click', close);
      document.body.appendChild(o); o.querySelector('[data-ok]').focus();
    });
  }
  window.uiAlert = uiAlert;

  function uiPrompt(message, danger) {
    return new Promise(function (resolve) {
      var o = document.createElement('div'); o.className = 'modal-overlay';
      o.innerHTML = '<div class="modal-box" style="width:480px"><div class="modal-title">Confirmação</div>'
        + '<div style="font-size:14px;color:var(--text-2);line-height:1.5">' + escapeHtml(message) + '</div>'
        + '<textarea data-reason rows="3" maxlength="500" style="margin-top:12px" '
        + 'placeholder="Explique o motivo (obrigatório - ficará registrado no histórico do processo)…"></textarea>'
        + '<div class="modal-actions"><button class="btn btn-light" data-x>Cancelar</button>'
        + '<button class="btn ' + (danger ? 'btn-danger' : 'btn-primary') + '" data-ok disabled>Confirmar</button></div></div>';
      var reasonTextarea = o.querySelector('[data-reason]'), isSuccess = o.querySelector('[data-ok]');
      reasonTextarea.addEventListener('input', function () { isSuccess.disabled = !reasonTextarea.value.trim(); });
      function close(value) { o.remove(); resolve(value); }
      o.addEventListener('click', function (event) { if (event.target === o) close(null); });
      o.querySelector('[data-x]').addEventListener('click', function () { close(null); });
      isSuccess.addEventListener('click', function () { close(reasonTextarea.value.trim()); });
      document.body.appendChild(o); reasonTextarea.focus();
    });
  }
  window.uiPrompt = uiPrompt;

  window.TableSort = {
    cycle: function (sort, column) {
      if (sort.col !== column) return { col: column, asc: true };
      if (sort.asc) return { col: column, asc: false };
      return { col: '', asc: true };
    },
    indicator: function (sort, column) {
      var active = sort.col === column;
      return '<span class="sort-ind' + (active ? ' on' : '') + '">' + (active ? (sort.asc ? '▲' : '▼') : '↕') + '</span>';
    },
    sortRows: function (rows, sort, types) {
      if (!sort.col) return rows;
      var type = types[sort.col] || 'text', direction = sort.asc ? 1 : -1;
      return rows.slice().sort(function (item, index) {
        var leftValue = item[sort.col], rightValue = index[sort.col];
        var leftIsEmpty = leftValue == null || leftValue === '', rightIsEmpty = rightValue == null || rightValue === '';
        if (leftIsEmpty && rightIsEmpty) return 0; if (leftIsEmpty) return 1; if (rightIsEmpty) return -1;
        if (type === 'num') return (Number(leftValue) - Number(rightValue)) * direction;
        if (type === 'date') return String(leftValue).localeCompare(String(rightValue)) * direction;
        return String(leftValue).localeCompare(String(rightValue), 'pt-BR', { sensitivity: 'base' }) * direction;
      });
    },
    load: function (key) {
      try { var s = JSON.parse(localStorage.getItem(key) || 'null'); if (s && typeof s.col === 'string') return s; } catch (error) { }
      return { col: '', asc: true };
    },
    save: function (key, sort) {
      try { if (sort.col) localStorage.setItem(key, JSON.stringify(sort)); else localStorage.removeItem(key); } catch (error) { }
    },
  };

  window.ProcessList = {
    mount: async function (host, options) {
      ensureTableStyle();
      var paged = typeof options.fetchPage === 'function';
      var pageSize = options.pageSize || 50;
      var dateField = options.dateField || 'due_date_prc';
      var showApprovers = !!options.showApprovers;

      host.innerHTML = '<div class="card" style="padding:0">'
        + '<div class="pl-toolbar">'
        + '<div class="pl-search">' + SVG_SEARCH + '<input id="pl-search" placeholder="Buscar…"></div>'
        + '<div class="pl-filters" id="pl-filters"></div>'
        + '<div class="pl-filters" id="pl-extra"></div>'
        + '<div class="pl-toolbar-actions">'
        + (options.batchAction ? '<button class="btn btn-primary" id="pl-batch" disabled>' + escapeHtml(options.batchAction.label || 'Aprovar selecionados') + '</button>' : '')
        + '<div class="pl-cols"><button class="btn btn-light" id="pl-cols-btn" title="Mostrar, ocultar e redimensionar colunas">Colunas</button><div class="pl-cols-menu" id="pl-cols-menu"></div></div>'
        + '<button class="btn btn-light" id="pl-refresh" title="Recarregar os dados desta tela">'
        + '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>Atualizar</button>'
        + '<button class="btn btn-ghost" id="pl-clear">Limpar filtros</button></div>'
        + '</div>'
        + '<div id="pl-body" style="padding:6px 0"><div class="empty">Carregando…</div></div>'
        + (paged ? '<div class="pl-pager" id="pl-pager"></div>' : '')
        + '</div>';

      var bodyEl = host.querySelector('#pl-body');
      var search = host.querySelector('#pl-search');
      var pagerEl = host.querySelector('#pl-pager');

      var rows = [];
      var page = 0;
      var total = null;
      var hasMore = false;
      var term = '';
      var filters = { company: '', building: '', from: '', to: '', status: '', urgent: '' };
      var extraFilters = options.extraFilters || (options.extraFilter ? [options.extraFilter] : []);
      var extraValues = extraFilters.map(function () { return ''; });
      var batch = options.batchAction || null;
      var selected = {};
      var approversByUuid = {};

      var SORT_COLS = [
        { label: '#', col: 'id_prc', type: 'num', width: 66, render: function (e) { return '<span class="id-cell">' + escapeHtml(e.id_prc) + (e.is_urgent_prc ? '<span class="urgent-dot" title="Urgente" aria-label="Urgente"></span>' : '') + '</span>'; } },
        { label: 'Empresa', col: 'empresa_nome', type: 'text', width: 160 },
        { label: 'Obra', col: 'obra_nome', type: 'text', width: 110 },
        { label: 'Fornecedor', col: 'fornecedor_nome', type: 'text', width: 140 },
        { label: 'Descrição', col: 'description_prc', type: 'text', width: 240 },
        { label: 'Tipo', col: 'tipo_nome', type: 'text', width: 120 },
        { label: 'Valor', col: 'value_prc', type: 'num', width: 110, render: function (e) { return money(e.value_prc); } },
        { label: 'Vencimento', col: 'due_date_prc', type: 'date', width: 110, render: function (e) { return fmtDate(e.due_date_prc); } },
        { label: 'Status', col: 'status_nome', type: 'text', width: 130, render: function (e) { return statusBadge(e.status_step_prc, e.status_nome); } },
      ].concat((options.extraColumns || []).map(function (ec) { return { label: ec.label, col: ec.col, type: ec.type || 'text', width: ec.width || 130, render: ec.render }; }));
      var SORT_TYPES = {}; SORT_COLS.forEach(function (SORT_COLSItem) { SORT_TYPES[SORT_COLSItem.col] = SORT_COLSItem.type || 'text'; });
      var sortKey = 'sort:' + (options.storageKey || (window.location.hash || 'view'));
      var sort = window.TableSort.load(sortKey);

      var colStateKey = 'cols:' + (options.storageKey || (window.location.hash || 'view'));
      var colState = { hidden: {}, widths: {} };
      try { var savedCols = JSON.parse(localStorage.getItem(colStateKey) || 'null'); if (savedCols) { colState.hidden = savedCols.hidden || {}; colState.widths = savedCols.widths || {}; } } catch (error) { }
      function saveColState() { try { localStorage.setItem(colStateKey, JSON.stringify(colState)); } catch (error) { } }
      function visibleColumns() { return SORT_COLS.filter(function (c) { return !colState.hidden[c.col]; }); }

      async function loadApprovers() {
        approversByUuid = {};
        var uuids = rows.map(function (row) { return row.uuid_prc; }).filter(Boolean);
        if (!uuids.length) return;
        try {
          var list = await window.SB.select('v_process_approvers', function (query) {
            return query.in('process_app', uuids).order('approved_at_app');
          });
          (list || []).forEach(function (item) {
            (approversByUuid[item.process_app] = approversByUuid[item.process_app] || []).push(item.approver_name || '-');
          });
        } catch (error) { }
      }

      function approversCell(process) {
        var names = approversByUuid[process.uuid_prc] || [];
        if (!names.length) return '<span style="color:var(--muted)">-</span>';
        var joined = names.join(', ');
        return '<span class="badge ok" title="' + escapeHtml(joined) + '">' + names.length + '</span> '
          + '<span class="pl-approvers" title="' + escapeHtml(joined) + '">' + escapeHtml(joined) + '</span>';
      }

      function isoDay(value) { return value ? String(value).split('T')[0] : ''; }

      function filtered() {
        if (paged) return rows;
        var output = rows;
        var t = (search.value || '').toLowerCase().trim();
        if (t) {
          output = output.filter(function (outItem) {
            return [outItem.empresa_nome, outItem.obra_nome, outItem.description_prc, outItem.fornecedor_nome, outItem.tipo_nome, outItem.uau_number_prc, outItem.id_prc].join(' ').toLowerCase().indexOf(t) >= 0;
          });
        }
        output = output.filter(function (outItem) {
          if (filters.company && filters.company.length && filters.company.map(String).indexOf(String(outItem.company_prc)) < 0) return false;
          if (filters.building && filters.building.length
            && filters.building.map(function (buildingItem) { return String(buildingItem).toUpperCase(); }).indexOf(String(outItem.building_prc || '').toUpperCase()) < 0) return false;
          if (filters.status && filters.status.length && filters.status.map(Number).indexOf(Number(outItem.status_step_prc)) < 0) return false;
          if (filters.kind && filters.kind.length && filters.kind.map(Number).indexOf(Number(outItem.kind_prc)) < 0) return false;
          if (filters.urgent !== '' && !!outItem.is_urgent_prc !== (filters.urgent === '1')) return false;
          if (filters.fornecedor && String(outItem.fornecedor_nome || '').toLowerCase().indexOf(String(filters.fornecedor).toLowerCase()) < 0) return false;
          if (filters.descricao && String(outItem.description_prc || '').toLowerCase().indexOf(String(filters.descricao).toLowerCase()) < 0) return false;
          if (filters.uau && String(outItem.uau_number_prc || '').toLowerCase().indexOf(String(filters.uau).toLowerCase()) < 0) return false;
          if (filters.from || filters.to) {
            var d = isoDay(outItem[dateField]);
            if (!d) return false;
            if (filters.from && d < filters.from) return false;
            if (filters.to && d > filters.to) return false;
          }
          return true;
        });
        extraFilters.forEach(function (extraFilter, index) { if (extraValues[index]) output = extraFilter.apply(output, extraValues[index]); });
        return output;
      }

      function updateBatchBtn() {
        if (!batch) return;
        var b = host.querySelector('#pl-batch'); if (!b) return;
        var n = Object.keys(selected).length;
        b.disabled = n === 0;
        b.textContent = (batch.label || 'Aprovar selecionados') + (n ? ' (' + n + ')' : '');
      }

      function render() {

        var data = window.TableSort.sortRows(filtered(), sort, SORT_TYPES);
        if (!data.length) {
          bodyEl.innerHTML = '<div class="empty">' + escapeHtml(page > 0 ? 'Nada nesta página.' : (options.emptyText || 'Nenhum processo.')) + '</div>';
        } else {
          var vcols = visibleColumns();
          var vwidths = vcols.map(function (c) { return (colState.widths[c.col] || c.width || 120); });
          var totalW = (batch ? 38 : 0) + vwidths.reduce(function (a, b) { return a + b; }, 0) + (showApprovers ? 170 : 0) + 150;
          var colgroup = (batch ? '<col style="width:38px">' : '')
            + vwidths.map(function (w) { return '<col style="width:' + w + 'px">'; }).join('')
            + (showApprovers ? '<col style="width:170px">' : '')
            + '<col style="width:150px">';
          var head = vcols.map(function (c, i) {
            return '<th data-col="' + c.col + '">'
              + (i === 0 ? '<span class="pl-resizer edge-left" data-col="' + c.col + '" data-edge="left"></span>' : '')
              + escapeHtml(c.label) + ' ' + window.TableSort.indicator(sort, c.col)
              + '<span class="pl-resizer" data-col="' + c.col + '"></span></th>';
          }).join('');
          var checkTh = batch ? '<th class="pl-keep" style="text-align:center"><input type="checkbox" data-check-all title="Selecionar todos"></th>' : '';
          var html = '<div class="table-scroll"><table class="pl-fixed" style="width:' + totalW + 'px"><colgroup>' + colgroup + '</colgroup><thead><tr>' + checkTh + head
            + (showApprovers ? '<th class="pl-keep">Aprovações</th>' : '') + '<th class="pl-keep"></th></tr></thead><tbody>';
          data.forEach(function (entry, index) {
            html += '<tr data-i="' + index + '" style="cursor:pointer">'
              + (batch ? '<td class="pl-check pl-keep" data-label="Selecionar" style="text-align:center"><input type="checkbox" data-check="' + escapeHtml(entry.uuid_prc) + '"' + (selected[entry.uuid_prc] ? ' checked' : '') + '></td>' : '')
              + vcols.map(function (c) {
                var raw = entry[c.col];
                var value = c.render ? c.render(entry) : ((raw == null || raw === '') ? '<span style="color:var(--muted)">-</span>' : escapeHtml(raw));
                var title = c.render ? '' : ' title="' + escapeHtml(raw == null ? '' : raw) + '"';
                return '<td data-label="' + escapeHtml(c.label) + '"' + title + '>' + value + '</td>';
              }).join('')
              + (showApprovers ? '<td class="pl-keep" data-label="Aprovações" style="white-space:nowrap">' + approversCell(entry) + '</td>' : '')
              + '<td class="pl-actions-cell pl-keep" style="white-space:nowrap;text-align:right"></td></tr>';
          });
          html += '</tbody></table></div>';
          bodyEl.innerHTML = html;

          bodyEl.querySelectorAll('th[data-col]').forEach(function (item) {
            item.addEventListener('click', function (event) {
              if (event.target.classList.contains('pl-resizer')) return;
              sort = window.TableSort.cycle(sort, item.getAttribute('data-col'));
              window.TableSort.save(sortKey, sort);
              render();
            });
          });

          var tableEl = bodyEl.querySelector('table.pl-fixed');
          function colElAt(vi) { return bodyEl.querySelectorAll('colgroup col')[(batch ? 1 : 0) + vi]; }
          function applyColWidth(colEl, colName, newW) {
            var oldW = parseInt(colEl.style.width, 10) || 120;
            var tW = parseInt(tableEl.style.width, 10) || Math.round(tableEl.getBoundingClientRect().width);
            colEl.style.width = newW + 'px';
            tableEl.style.width = (tW + (newW - oldW)) + 'px';
            colState.widths[colName] = newW; saveColState();
          }
          bodyEl.querySelectorAll('.pl-resizer').forEach(function (rz) {
            var colName = rz.getAttribute('data-col'), vi = -1;
            for (var k = 0; k < vcols.length; k++) { if (vcols[k].col === colName) { vi = k; break; } }
            if (vi < 0 || !tableEl) return;

            rz.addEventListener('mousedown', function (event) {
              event.preventDefault(); event.stopPropagation();
              var colEl = colElAt(vi); if (!colEl) return;
              var edge = rz.getAttribute('data-edge');
              var nextCol = (edge !== 'left') ? (vcols[vi + 1] || null) : null;
              var nextColEl = nextCol ? colElAt(vi + 1) : null;
              var nextName = nextCol ? nextCol.col : null;
              var startX = event.clientX;
              var startW = parseInt(colEl.style.width, 10) || 120;
              var startNextW = nextColEl ? (parseInt(nextColEl.style.width, 10) || 120) : 0;
              var startTableW = parseInt(tableEl.style.width, 10) || Math.round(tableEl.getBoundingClientRect().width);
              rz.classList.add('dragging');
              document.body.style.userSelect = 'none';
              document.body.style.cursor = 'col-resize';
              function onMove(e) {
                var delta = e.clientX - startX;
                if (edge === 'left') {
                  var lw = Math.max(56, startW - delta);
                  colEl.style.width = lw + 'px';
                  tableEl.style.width = (startTableW + (lw - startW)) + 'px';
                } else if (nextColEl) {
                  if (delta < 56 - startW) delta = 56 - startW;
                  if (delta > startNextW - 56) delta = startNextW - 56;
                  colEl.style.width = (startW + delta) + 'px';
                  nextColEl.style.width = (startNextW - delta) + 'px';
                } else {
                  var newW = Math.max(56, startW + delta);
                  colEl.style.width = newW + 'px';
                  tableEl.style.width = (startTableW + (newW - startW)) + 'px';
                }
              }
              function onUp() {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                rz.classList.remove('dragging');
                document.body.style.userSelect = '';
                document.body.style.cursor = '';
                colState.widths[colName] = parseInt(colEl.style.width, 10) || startW;
                if (nextColEl && nextName) colState.widths[nextName] = parseInt(nextColEl.style.width, 10) || startNextW;
                saveColState();
              }
              document.addEventListener('mousemove', onMove);
              document.addEventListener('mouseup', onUp);
            });

            rz.addEventListener('dblclick', function (event) {
              event.preventDefault(); event.stopPropagation();
              var colEl = colElAt(vi); if (!colEl) return;
              var cellIndex = (batch ? 1 : 0) + vi;
              var sampleTd = tableEl.querySelector('tbody tr td:nth-child(' + (cellIndex + 1) + ')');
              var meas = document.createElement('span');
              meas.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;top:-9999px;left:-9999px';
              if (sampleTd) { var cs = getComputedStyle(sampleTd); meas.style.font = cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily; }
              document.body.appendChild(meas);
              var maxW = 40, th = tableEl.querySelectorAll('thead th')[cellIndex];
              if (th) { meas.textContent = th.textContent || ''; maxW = Math.max(maxW, meas.offsetWidth + 22); }
              tableEl.querySelectorAll('tbody tr').forEach(function (tr) {
                var td = tr.children[cellIndex];
                if (td) { meas.textContent = td.textContent || ''; if (meas.offsetWidth > maxW) maxW = meas.offsetWidth; }
              });
              meas.remove();
              applyColWidth(colEl, colName, Math.max(56, Math.min(680, maxW + 28)));
            });
          });

          if (batch) {
            bodyEl.querySelectorAll('[data-check]').forEach(function (item) {
              item.addEventListener('click', function (event) { event.stopPropagation(); });
              item.addEventListener('change', function () {
                var id = item.getAttribute('data-check');
                if (item.checked) selected[id] = true; else delete selected[id];
                updateBatchBtn();
              });
            });
            var allBox = bodyEl.querySelector('[data-check-all]');
            if (allBox) allBox.addEventListener('change', function () {
              data.forEach(function (entry) { if (allBox.checked) selected[entry.uuid_prc] = true; else delete selected[entry.uuid_prc]; });
              bodyEl.querySelectorAll('[data-check]').forEach(function (item) { item.checked = allBox.checked; });
              updateBatchBtn();
            });
          }
          bodyEl.querySelectorAll('tr[data-i]').forEach(function (row) {
            var process = data[+row.getAttribute('data-i')], cell = row.lastElementChild;
            var approversBtn = iconBtn(ICONS.aprovadores, 'btn-light', 'Aprovadores', function (event) { event.stopPropagation(); window.openProcessApprovers(process); });

            var visibleActions = (options.actions || []).filter(function (action) { return typeof action.show !== 'function' || action.show(process); });
            var approversAt = Math.min(options.approversPosition != null ? options.approversPosition : 0, visibleActions.length);
            visibleActions.forEach(function (visibleAction, index) {
              if (index === approversAt) cell.appendChild(approversBtn);
              var handler = async function (event) {
                event.stopPropagation();
                var danger = (visibleAction.cls || '').indexOf('danger') >= 0;
                var reason;
                if (visibleAction.prompt) {
                  reason = await uiPrompt(visibleAction.prompt, danger);
                  if (reason == null) return;
                } else if (visibleAction.confirm && !(await uiConfirm(visibleAction.confirm, danger))) return;
                try {
                  await visibleAction.run(process, reason);
                  if (visibleAction.effect === 'none') return;
                  toast('Feito.', true);
                  await applyRowEffect(visibleAction, process.uuid_prc);
                }
                catch (error) {

                  await uiAlert(error.message);
                  await reload();
                }
              };
              var svg = visibleAction.icon || ICONS[visibleAction.label];
              cell.appendChild(svg
                ? iconBtn(svg, visibleAction.cls || 'btn-primary', visibleAction.label, handler)
                : button(visibleAction.label, visibleAction.cls || 'btn-primary', handler));
            });
            if (approversAt >= visibleActions.length) cell.appendChild(approversBtn);
            row.addEventListener('click', function () { window.openProcessDetail(process); });
          });
        }
        updatePager();
      }

      function pageSequence(current, totalPages) {
        var delta = 2, range = [], output = [], last;
        for (var index = 1; index <= totalPages; index++) {
          if (index === 1 || index === totalPages || (index >= current - delta && index <= current + delta)) range.push(index);
        }
        range.forEach(function (rangeItem) {
          if (last) {
            if (rangeItem - last === 2) output.push(last + 1);
            else if (rangeItem - last !== 1) output.push('…');
          }
          output.push(rangeItem); last = rangeItem;
        });
        return output;
      }

      function goto(p) { if (p !== page && p >= 0) { page = p; reload(); } }

      function updatePager() {
        if (!paged) return;
        var from = rows.length ? page * pageSize + 1 : 0;
        var lastRowNumber = page * pageSize + rows.length;
        var totalPages = total != null ? Math.max(1, Math.ceil(total / pageSize)) : null;

        var info = total != null
          ? 'Mostrando ' + from + '–' + lastRowNumber + ' de ' + total
          : 'Página ' + (page + 1);

        var paginationHtml = '<span style="font-size:13px;color:var(--muted)">' + info + '</span>'
          + '<span style="flex:1"></span>';

        paginationHtml += '<button class="btn btn-light" data-pg="' + (page - 1) + '"' + (page === 0 ? ' disabled' : '') + '>‹</button>';

        if (totalPages != null) {
          pageSequence(page + 1, totalPages).forEach(function (item) {
            if (item === '…') { paginationHtml += '<span style="padding:0 4px;color:var(--muted-2)">…</span>'; return; }
            var active = (item === page + 1);
            paginationHtml += '<button class="btn ' + (active ? 'btn-primary' : 'btn-light') + '" data-pg="' + (item - 1) + '"'
              + (active ? ' disabled' : '') + ' style="min-width:38px">' + item + '</button>';
          });
        }

        var noNext = totalPages != null ? (page + 1 >= totalPages) : !hasMore;
        paginationHtml += '<button class="btn btn-light" data-pg="' + (page + 1) + '"' + (noNext ? ' disabled' : '') + '>›</button>';

        pagerEl.innerHTML = paginationHtml;
        pagerEl.querySelectorAll('button[data-pg]').forEach(function (item) {
          item.addEventListener('click', function () { goto(+item.getAttribute('data-pg')); });
        });
      }

      async function reload() {
        bodyEl.innerHTML = '<div class="empty">Carregando…</div>';
        if (paged) pagerEl.querySelectorAll('button').forEach(function (item) { item.disabled = true; });
        try {
          if (paged) {

            var pageResult = await options.fetchPage({ page: page, pageSize: pageSize, term: term, filters: filters, needCount: total === null });
            if (Array.isArray(pageResult)) {
              rows = pageResult;
              if (options.fetchCount && total === null) total = await options.fetchCount({ term: term, filters: filters });
            } else {
              rows = (pageResult && pageResult.rows) || [];
              if (pageResult && pageResult.total != null) total = pageResult.total;
            }
            hasMore = total != null ? (page + 1) * pageSize < total : rows.length === pageSize;
          } else {
            rows = await options.load();
          }
          if (showApprovers) await loadApprovers();
          render();
        } catch (error) {
          window.viewError(bodyEl, error);
          updatePager();
        }
      }

      function indexOfUuid(uuid) {
        for (var index = 0; index < rows.length; index++) if (rows[index].uuid_prc === uuid) return index;
        return -1;
      }
      function removeRow(uuid) {
        var index = indexOfUuid(uuid);
        if (index < 0) return;
        rows.splice(index, 1);
        if (paged && total != null) total = Math.max(0, total - 1);
        render();
      }
      async function refreshRow(uuid) {
        var fetchRow = options.reloadRow || function (id) {
          return window.SB.select('v_processes', function (query) { return query.eq('uuid_prc', id).limit(1); })
            .then(function (rowsFound) { return (rowsFound && rowsFound[0]) || null; });
        };
        var fresh = await fetchRow(uuid);
        var index = indexOfUuid(uuid);
        if (index < 0) return;
        if (fresh) rows[index] = fresh; else rows.splice(index, 1);
        if (showApprovers) await loadApprovers();
        render();
      }
      async function applyRowEffect(a, uuid) {
        if (a.effect === 'remove') removeRow(uuid);
        else if (a.effect === 'update') await refreshRow(uuid);
        else await reload();
      }

      var debTimer = null;
      search.addEventListener('input', function () {
        if (!paged) { render(); return; }
        clearTimeout(debTimer);
        debTimer = setTimeout(function () { term = (search.value || '').trim(); page = 0; total = null; reload(); }, 350);
      });

      var processFilters = await window.ProcessFilters.mount(host.querySelector('#pl-filters'), {
        storageKey: options.storageKey || (window.location.hash || 'view'),
        multiStatus: true,
        onChange: function (values) {
          filters = values;
          if (paged) { page = 0; total = null; reload(); } else render();
        },
      });
      filters = processFilters.getValues();

      var extraEls = [], extraStorageKeys = [];
      async function populateExtraFilter(index) {
        var element = extraEls[index]; if (!element) return;
        var previous = extraValues[index] || '';
        var options = [];
        try { options = await extraFilters[index].load(); } catch (error) { options = []; }
        element.innerHTML = '<option value="">Todos</option>' + (options || []).map(function (item) {
          return '<option value="' + escapeHtml(item.value) + '">' + escapeHtml(item.label) + '</option>';
        }).join('');
        element.value = previous;
        if (element.value !== previous) extraValues[index] = '';
      }
      async function reloadExtraFilters() {
        for (var index = 0; index < extraFilters.length; index++) await populateExtraFilter(index);
      }
      if (extraFilters.length) {
        var extraHost = host.querySelector('#pl-extra');
        extraHost.innerHTML = extraFilters.map(function (extraFilter, index) {
          return '<label class="pf-field">' + escapeHtml(extraFilter.label || 'Filtro')
            + '<select data-extra="' + index + '"><option value="">Todos</option></select></label>';
        }).join('');
        for (var extraFilterIndex = 0; extraFilterIndex < extraFilters.length; extraFilterIndex++) {
          var key = 'filters-extra:' + extraFilterIndex + ':' + (options.storageKey || (window.location.hash || 'view'));
          extraStorageKeys[extraFilterIndex] = key;
          extraEls[extraFilterIndex] = extraHost.querySelector('[data-extra="' + extraFilterIndex + '"]');
          try { extraValues[extraFilterIndex] = localStorage.getItem(key) || ''; } catch (error) { extraValues[extraFilterIndex] = ''; }
          await populateExtraFilter(extraFilterIndex);
          (function (index, filterElement, key) {
            filterElement.addEventListener('change', function () {
              extraValues[index] = filterElement.value;
              try { localStorage.setItem(key, extraValues[index]); } catch (error) { }
              render();
            });
          })(extraFilterIndex, extraEls[extraFilterIndex], key);
        }
      }

      function removeRowLocal(uuid) {
        var index = indexOfUuid(uuid);
        if (index >= 0) { rows.splice(index, 1); if (paged && total != null) total = Math.max(0, total - 1); }
        delete selected[uuid];
      }

      function openProgress(title, count) {
        var o = document.createElement('div'); o.className = 'modal-overlay';
        o.innerHTML = '<div class="modal-box" style="width:420px"><div class="modal-title">' + escapeHtml(title) + '</div>'
          + '<div style="margin-top:10px;font-size:13px;color:var(--muted)" data-lbl>0 de ' + count + '</div>'
          + '<div style="height:10px;border-radius:6px;background:var(--surface-2);overflow:hidden;margin-top:8px">'
          + '<div data-bar style="height:100%;width:0;background:var(--accent);transition:width .2s"></div></div></div>';
        document.body.appendChild(o);
        return {
          update: function (done) {
            o.querySelector('[data-lbl]').textContent = done + ' de ' + count;
            o.querySelector('[data-bar]').style.width = Math.round((done / count) * 100) + '%';
          },
          close: function () { o.remove(); },
        };
      }

      if (batch) {
        var batchBtn = host.querySelector('#pl-batch');
        batchBtn.addEventListener('click', async function () {
          var picked = rows.filter(function (row) { return selected[row.uuid_prc]; });
          if (!picked.length) return;
          var message = (batch.confirm || 'Aprovar os {n} processos selecionados?').replace('{n}', picked.length);
          if (!(await uiConfirm(message, false))) return;
          batchBtn.disabled = true;
          var successCount = 0, failureCount = 0, firstError = '';

          if (typeof batch.runBatch === 'function') {
            var chunkSize = batch.chunkSize || 20;
            var prog = openProgress(batch.progressTitle || 'Aprovando processos…', picked.length);
            try {
              for (var innerIndex = 0; innerIndex < picked.length; innerIndex += chunkSize) {
                var chunk = picked.slice(innerIndex, innerIndex + chunkSize);
                var response = await batch.runBatch(chunk);
                (response || []).forEach(function (item) {
                  if (item.ok) { successCount++; removeRowLocal(item.uuid); }
                  else { failureCount++; if (!firstError) firstError = item.error || 'erro'; delete selected[item.uuid]; }
                });
                prog.update(Math.min(picked.length, innerIndex + chunkSize));
              }
            } catch (error) { failureCount += 1; if (!firstError) firstError = error.message; }
            finally {
              prog.close();
              if (typeof batch.afterAll === 'function') batch.afterAll();
              updateBatchBtn(); render();
            }
          } else {
            for (var index = 0; index < picked.length; index++) {
              try { await batch.run(picked[index]); successCount++; removeRowLocal(picked[index].uuid_prc); }
              catch (error) { failureCount++; if (!firstError) firstError = error.message; }
            }
            updateBatchBtn(); render();
          }

          toast(successCount + ' aprovado(s)' + (failureCount ? ' · ' + failureCount + ' com erro' : ''), failureCount === 0);
          if (failureCount) await uiAlert('Alguns processos não foram aprovados. Primeiro erro: ' + firstError);
        });
      }

      var refreshBtn = host.querySelector('#pl-refresh');
      if (refreshBtn) refreshBtn.addEventListener('click', async function () {
        refreshBtn.disabled = true;
        try {
          (options.refreshKeys || []).forEach(function (item) { window.Store.invalidate(item); });
          if (paged) { total = null; }
          await reloadExtraFilters();
          await reload();
        } finally { refreshBtn.disabled = false; }
      });

      host.querySelector('#pl-clear').addEventListener('click', function () {
        search.value = ''; term = '';
        if (paged) { page = 0; total = null; }
        extraEls.forEach(function (extraEl, index) {
          extraValues[index] = ''; if (extraEl) extraEl.value = '';
          try { localStorage.removeItem(extraStorageKeys[index]); } catch (error) { }
        });
        selected = {}; updateBatchBtn();
        processFilters.clear();
      });

      var colsBtn = host.querySelector('#pl-cols-btn');
      var colsMenu = host.querySelector('#pl-cols-menu');
      function buildColsMenu() {
        colsMenu.innerHTML = SORT_COLS.map(function (c) {
          return '<label class="pl-cols-opt"><input type="checkbox" data-c="' + escapeHtml(c.col) + '"' + (colState.hidden[c.col] ? '' : ' checked') + '> ' + escapeHtml(c.label) + '</label>';
        }).join('');
        colsMenu.querySelectorAll('input[data-c]').forEach(function (cb) {
          cb.addEventListener('change', function () {
            var col = cb.getAttribute('data-c');
            if (!cb.checked && visibleColumns().length <= 1) { cb.checked = true; return; }
            if (cb.checked) delete colState.hidden[col]; else colState.hidden[col] = true;
            saveColState(); render();
          });
        });
      }
      if (colsBtn && colsMenu) {
        colsBtn.addEventListener('click', function (event) { event.stopPropagation(); buildColsMenu(); colsMenu.classList.toggle('open'); });
        document.addEventListener('click', function (event) { var wrap = host.querySelector('.pl-cols'); if (wrap && !wrap.contains(event.target)) colsMenu.classList.remove('open'); });
      }

      await reload();
      return { reload: reload };
    }
  };

  function applyProcessFilters(s, kind, term, filters, reembolso) {
    if (reembolso) {
      var pkinds = (window.CONFIG && window.CONFIG.PROCESS_KINDS) || {};
      var reembolsoIds = Object.keys(pkinds).filter(function (id) { return /reembolso/i.test(pkinds[id] || ''); }).map(Number);
      s = reembolsoIds.length ? s.in('kind_prc', reembolsoIds) : s.ilike('tipo_nome', '%reembolso%');
    } else if (kind) s = s.eq('kind_prc', Number(kind));
    var activeFilters = filters || {};
    var comps = Array.isArray(activeFilters.company) ? activeFilters.company : (activeFilters.company ? [activeFilters.company] : []);
    var builds = Array.isArray(activeFilters.building) ? activeFilters.building : (activeFilters.building ? [activeFilters.building] : []);
    if (comps.length) s = s.in('company_prc', comps);
    if (builds.length) s = s.in('building_prc', builds);
    var statuses = Array.isArray(activeFilters.status) ? activeFilters.status : (activeFilters.status !== '' && activeFilters.status != null ? [activeFilters.status] : []);
    if (statuses.length) s = s.in('status_step_prc', statuses.map(Number));
    var kindSel = Array.isArray(activeFilters.kind) ? activeFilters.kind : (activeFilters.kind ? [activeFilters.kind] : []);
    if (kindSel.length) s = s.in('kind_prc', kindSel.map(Number));
    if (activeFilters.urgent === '1' || activeFilters.urgent === '0') s = s.eq('is_urgent_prc', activeFilters.urgent === '1');
    if (activeFilters.from) s = s.gte('due_date_prc', activeFilters.from);
    if (activeFilters.to) s = s.lte('due_date_prc', activeFilters.to);
    var fornecedor = (activeFilters.fornecedor || '').replace(/[,()*%]/g, ' ').trim();
    if (fornecedor) s = s.ilike('fornecedor_nome', '%' + fornecedor + '%');
    var descricao = (activeFilters.descricao || '').replace(/[,()*%]/g, ' ').trim();
    if (descricao) s = s.ilike('description_prc', '%' + descricao + '%');
    var uau = (activeFilters.uau || '').replace(/[,()*%]/g, ' ').trim();
    if (uau) s = s.ilike('uau_number_prc', '%' + uau + '%');
    term = (term || '').trim();
    if (term) {
      var safe = term.replace(/[,()*%]/g, ' ').trim();
      if (safe) {
        var orConditions = ['empresa_nome.ilike.%' + safe + '%', 'obra_nome.ilike.%' + safe + '%',
        'description_prc.ilike.%' + safe + '%', 'fornecedor_nome.ilike.%' + safe + '%', 'tipo_nome.ilike.%' + safe + '%',
        'uau_number_prc.ilike.%' + safe + '%'];
        if (/^\d+$/.test(safe)) orConditions.push('id_prc.eq.' + safe);
        s = s.or(orConditions.join(','));
      }
    }
    return s;
  }

  window.fetchProcessesPage = function (kind, reembolso, resource) {
    return function (args) {
      var page = args.page, pageSize = args.pageSize;
      return window.SB.page(resource || 'v_processes', function (s) {
        s = applyProcessFilters(s, kind, args.term, args.filters, reembolso);
        return s.order('id_prc', { ascending: false }).range(page * pageSize, page * pageSize + pageSize - 1);
      }, args.needCount ? 'exact' : null).then(function (res) {
        return { rows: res.data, total: res.count };
      });
    };
  };

  function invalidateFlowCaches() {
    ['my_approvals', 'financeiro', 'financeiro_integrados', 'history', 'no_approver'].forEach(function (item) { window.Store.invalidate(item); });
  }
  window.invalidateFlowCaches = invalidateFlowCaches;

  window.mountPendingApprovals = async function (host) {

    var groupsByUuid = {};
    var approvedByUuid = {};
    function approveOne(p) {
      return window.Store.commit(
        function () {
          return window.API.post('/processes/' + p.uuid_prc + '/approve')
            .then(function (actionResult) { invalidateFlowCaches(); return actionResult; });
        },
        function () { window.Store.remove('pending_approvals', 'uuid_prc', p.uuid_prc); return ['pending_approvals']; });
    }
    return window.ProcessList.mount(host, {
      emptyText: 'Você não tem aprovações pendentes.',
      showApprovers: true,
      approversPosition: 1,
      refreshKeys: ['pending_approvals'],
      batchAction: {
        label: 'Aprovar selecionados',
        confirm: 'Aprovar os {n} processos selecionados? A aprovação segue as mesmas regras (nível/elegibilidade) de cada processo.',
        progressTitle: 'Aprovando processos…',
        chunkSize: 20,
        runBatch: function (chunk) {
          return window.API.post('/processes/approve-batch', { uuids: chunk.map(function (chunkItem) { return chunkItem.uuid_prc; }) });
        },
        afterAll: function () { invalidateFlowCaches(); window.Store.invalidate('pending_approvals'); },
        run: approveOne,
      },
      extraFilters: [
        {
          label: 'Aprovar como',
          load: async function () {
            var rows = await window.SB.rpc('my_pending_approval_groups', {});
            groupsByUuid = {};
            var names = {}, levels = {};
            (rows || []).forEach(function (item) {
              (groupsByUuid[item.uuid_prc] = groupsByUuid[item.uuid_prc] || []).push(item.group_id);
              names[item.group_id] = item.group_name; levels[item.group_id] = item.level;
            });

            var levelOf = function (id) { return levels[id] == null ? Infinity : levels[id]; };
            return Object.keys(names)
              .sort(function (item, index) { return (levelOf(index) - levelOf(item)) || String(names[item]).localeCompare(names[index]); })
              .map(function (item) {
                return { value: item, label: names[item] + (levels[item] != null ? ' (nível ' + levels[item] + ')' : ' (urgência)') };
              });
          },
          apply: function (rows, groupId) {
            return rows.filter(function (row) {
              return (groupsByUuid[row.uuid_prc] || []).indexOf(Number(groupId)) >= 0;
            });
          },
        },
        {
          label: 'Já aprovado por',
          load: async function () {
            var pend = await window.Store.get('pending_approvals');
            var uuids = (pend || []).map(function (item) { return item.uuid_prc; });
            approvedByUuid = {};
            var names = {};
            if (uuids.length) {
              var appr = await window.SB.select('v_process_approvers', function (query) { return query.in('process_app', uuids); });
              (appr || []).forEach(function (item) {
                (approvedByUuid[item.process_app] = approvedByUuid[item.process_app] || {})[item.approver_app] = true;
                names[item.approver_app] = item.approver_name || String(item.approver_app);
              });
            }
            return Object.keys(names)
              .sort(function (item, index) { return String(names[item]).localeCompare(names[index], 'pt-BR'); })
              .map(function (item) { return { value: item, label: names[item] }; });
          },
          apply: function (rows, approverId) {
            return rows.filter(function (row) {
              return approvedByUuid[row.uuid_prc] && approvedByUuid[row.uuid_prc][approverId];
            });
          },
        },
      ],
      load: async function () {
        var pend = await window.Store.get('pending_approvals');
        if (!pend.length) return [];
        var uuids = pend.map(function (pendItem) { return pendItem.uuid_prc; });
        var named = await window.SB.select('v_processes', function (query) { return query.in('uuid_prc', uuids); });
        var byUuid = {}; named.forEach(function (namedItem) { byUuid[namedItem.uuid_prc] = namedItem; });
        return pend.map(function (pendItem) { return byUuid[pendItem.uuid_prc] || pendItem; });
      },
      actions: [
        {
          label: 'Aprovar', cls: 'btn-primary', confirm: 'Confirmar aprovação deste processo?',
          effect: 'remove',
          run: approveOne,
        },
        {
          label: 'Corrigir', cls: 'btn-danger',
          prompt: 'Devolver o processo para correção?',
          effect: 'remove',
          run: function (p, reason) {
            return window.Store.commit(
              function () {
                return window.API.post('/processes/' + p.uuid_prc + '/reject', { reason: reason })
                  .then(function (actionResult) { invalidateFlowCaches(); return actionResult; });
              },
              function () { window.Store.remove('pending_approvals', 'uuid_prc', p.uuid_prc); return ['pending_approvals']; });
          }
        },
      ],
    });
  };
})();

;

/* ==== js/apps/commissions/commission-launch.js ==== */
(function () {
  function escapeHtml(text) { return String(text == null ? '' : text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function parseVal(raw) { if (!raw) return NaN; var normalized = String(raw).replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.'); var n = parseFloat(normalized); return isNaN(n) ? NaN : n; }
  function formatBrazilianNumber(amount) { return (Number(amount) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function toast(message, isSuccess) {
    var t = document.createElement('div'); t.textContent = message;
    t.style.cssText = 'position:fixed;top:16px;right:16px;z-index:10000;padding:10px 14px;border-radius:8px;font-size:14px;box-shadow:var(--shadow-md);'
      + (isSuccess ? 'background:var(--ok-weak);color:#166534' : 'background:var(--danger-weak);color:#9f1239');
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, 4500);
  }

  var TEMPLATE = ''
    + '<style>'
    + '.cl-wrap{padding:4px 0}'
    + '.cl-head{font-weight:700;font-size:14px;margin:0 0 4px}'
    + '.cl-sub{color:var(--muted);font-size:13px;margin:0 0 16px}'
    + '.cl-foot{display:flex;gap:10px;align-items:center;margin-top:18px;border-top:1px solid var(--border);padding-top:16px}'
    + '.cl-search-wrap{position:relative}'
    + '.cl-results{position:absolute;z-index:30;left:0;right:0;top:calc(100% + 4px);background:var(--surface);border:1px solid var(--border);border-radius:10px;box-shadow:var(--shadow-md);max-height:260px;overflow:auto;display:none}'
    + '.cl-results.show{display:block}'
    + '.cl-results .it{padding:9px 12px;cursor:pointer;font-size:14px}'
    + '.cl-results .it:hover{background:var(--surface-2)}'
    + '.cl-results .it small{display:block;color:var(--muted);font-size:12px}'
    + '</style>'
    + '<div class="cl-wrap">'
    + '<div class="cl-head">Dados da comissão</div>'
    + '<div class="cl-sub">Selecione o empreendimento (define a trilha SOMOS/PARTINI). Sem parcelas e sem aprovação - segue direto para validação da trilha.</div>'
    + '<div class="form-grid cols-2">'
    + '<div class="field full"><label>Empreendimento</label><select id="cl-emp"><option value="">Carregando…</option></select></div>'
    + '<div class="field"><label>Unidade</label><input id="cl-unit" placeholder="Ex.: Apto 101 / Torre A" maxlength="100"></div>'
    + '<div class="field"><label>Nº da Venda</label><input id="cl-sale" maxlength="100"></div>'
    + '<div class="field"><label>Data da Venda</label><input type="date" id="cl-saledt"></div>'
    + '<div class="field"><label>Data de Liberação</label><input type="date" id="cl-reldt"></div>'
    + '<div class="field full cl-search-wrap"><label>Cliente</label>'
    + '<input id="cl-client" placeholder="Busque por nome ou CNPJ/CPF" autocomplete="off" maxlength="200">'
    + '<div class="cl-results" id="cl-client-results"></div></div>'
    + '<div class="field cl-search-wrap"><label>Vendedor / Corretor</label>'
    + '<input id="cl-seller" placeholder="Busque por nome ou CNPJ/CPF" autocomplete="off" maxlength="200">'
    + '<div class="cl-results" id="cl-seller-results"></div></div>'
    + '<div class="field"><label>Código do Vendedor</label><input id="cl-sellerid" inputmode="numeric" placeholder="Preenchido ao selecionar" maxlength="20"></div>'
    + '<div class="field"><label>E-mail do Vendedor</label><input id="cl-selleremail" placeholder="Opcional" maxlength="200"></div>'
    + '<div class="field"><label>Celular do Vendedor</label><input id="cl-sellerphone" placeholder="Opcional" maxlength="50"></div>'
    + '<div class="field"><label>Valor da Comissão</label><input id="cl-value" placeholder="R$ 0,00" inputmode="decimal" maxlength="20"></div>'
    + '<div class="field full"><label>Observação</label><input id="cl-note" placeholder="Opcional" maxlength="500"></div>'
    + '</div>'
    + '<div class="cl-foot">'
    + '<button class="btn btn-primary" id="cl-save">Lançar Comissão</button>'
    + '<span id="cl-status" style="font-size:13px;color:var(--muted)"></span>'
    + '</div>'
    + '</div>';

  async function mount(host, options) {
    options = options || {};
    host.innerHTML = TEMPLATE;
    var selectElement = function (id) { return host.querySelector('#' + id); };

    var byId = {};
    try {
      var rows = (await window.Store.get('comm_empreendimentos') || []).filter(function (item) { return item.active_cem; });
      selectElement('cl-emp').innerHTML = '<option value="">Selecione o empreendimento</option>' + rows.map(function (row) {
        byId[row.id_cem] = row;
        return '<option value="' + escapeHtml(row.id_cem) + '">' + escapeHtml(row.name_cem) + ' - ' + escapeHtml(row.trilha) + '</option>';
      }).join('');
    } catch (error) { selectElement('cl-emp').innerHTML = '<option value="">Erro ao carregar</option>'; toast('Falha ao carregar empreendimentos: ' + error.message); }

    selectElement('cl-value').addEventListener('blur', function () { var amount = parseVal(this.value); if (!isNaN(amount) && amount > 0) this.value = 'R$ ' + formatBrazilianNumber(amount); });

    function attachPersonSearch(input, results, onPick) {
      var debounceTimer = null;
      async function search(term) {
        results.innerHTML = '<div class="it">Buscando…</div>'; results.classList.add('show');
        try {
          var rows = await window.Store.get('fornecedores', term || '');
          results.innerHTML = rows.length
            ? rows.map(function (row) { return '<div class="it" data-id="' + row.id + '" data-nome="' + escapeHtml(row.nome) + '">' + escapeHtml(row.nome) + '<small>' + escapeHtml(row.cpf_cnpj || '') + '</small></div>'; }).join('')
            : '<div class="it">Nada encontrado</div>';
          results.querySelectorAll('.it[data-id]').forEach(function (item) {
            item.addEventListener('click', function () {
              input.value = item.getAttribute('data-nome');
              onPick(item.getAttribute('data-id'));
              results.classList.remove('show');
            });
          });
        } catch (error) { results.innerHTML = '<div class="it">' + escapeHtml(error.message) + '</div>'; }
      }
      input.addEventListener('focus', function () { search(input.value.trim()); });
      input.addEventListener('input', function () {
        var term = input.value.trim(); onPick('');
        clearTimeout(debounceTimer); debounceTimer = setTimeout(function () { search(term); }, 300);
      });
      document.addEventListener('click', function (event) { if (!input.contains(event.target) && !results.contains(event.target)) results.classList.remove('show'); });
    }
    attachPersonSearch(selectElement('cl-seller'), selectElement('cl-seller-results'), function (id) { selectElement('cl-sellerid').value = id; });
    attachPersonSearch(selectElement('cl-client'), selectElement('cl-client-results'), function () { });

    selectElement('cl-save').addEventListener('click', async function () {
      var emp = byId[selectElement('cl-emp').value];
      var value = parseVal(selectElement('cl-value').value);
      var sellerName = selectElement('cl-seller').value.trim();
      var clientName = selectElement('cl-client').value.trim();
      if (!emp) { toast('Selecione o empreendimento.'); return; }
      if (!sellerName) { toast('Informe o vendedor.'); return; }
      if (!clientName) { toast('Informe o cliente.'); return; }
      if (isNaN(value) || value <= 0) { toast('Informe um valor válido.'); return; }

      var sellerId = parseInt((selectElement('cl-sellerid').value || '').replace(/\D/g, ''), 10);
      var payload = {
        company: emp.company_cem, building: emp.building_cem, value: value,
        sellerName: sellerName, clientName: clientName,
        unit: selectElement('cl-unit').value.trim() || undefined,
        saleNum: selectElement('cl-sale').value.trim() || undefined,
        saleDate: selectElement('cl-saledt').value || undefined,
        releaseDate: selectElement('cl-reldt').value || undefined,
        sellerId: isNaN(sellerId) ? undefined : sellerId,
        sellerEmail: selectElement('cl-selleremail').value.trim() || undefined,
        sellerPhone: selectElement('cl-sellerphone').value.trim() || undefined,
        note: selectElement('cl-note').value.trim() || undefined,
      };
      var button = this; button.disabled = true; selectElement('cl-status').textContent = 'Lançando…';
      try {
        await window.API.post('/commissions/create', payload);
        window.Store.invalidate('commissions');
        toast('Comissão lançada com sucesso!', true);
        if (typeof options.onDone === 'function') options.onDone();
      } catch (error) { selectElement('cl-status').textContent = ''; button.disabled = false; toast('Erro ao lançar: ' + error.message); }
    });
  }

  window.CommissionLaunch = { mount: mount };
})();

;

/* ==== js/shared/shell.js ==== */
(function () {
    var collapsed = false;
    var activeFlyout = null;
    var activeFlyoutHeader = null;

    function selectElement(selector, root) { return (root || document).querySelector(selector); }
    function $all(selector, root) { return Array.prototype.slice.call((root || document).querySelectorAll(selector)); }

    function currentRoute() {
        var h = (window.location.hash || '').replace(/^#\/?/, '');
        return (h.split('?')[0] || (window.CONFIG && window.CONFIG.ROUTES.DEFAULT) || 'consulta');
    }

    function routeOfHref(href) {
        if (!href) return '';
        return href.replace(/^#\/?/, '').split('?')[0];
    }

    function openGroup(group, exclusive) {
        if (!group) return;
        if (exclusive) {
            $all('.menu-group.open').forEach(function (item) { if (item !== group) item.classList.remove('open'); });
        }
        group.classList.add('open');
    }

    function toggleGroup(group) {
        if (!group) return;
        var isOpen = group.classList.contains('open');
        $all('.menu-group.open').forEach(function (item) { item.classList.remove('open'); });
        if (!isOpen) group.classList.add('open');
    }

    function syncActiveGroup() {
        var route = currentRoute();
        $all('.menu-group').forEach(function (item) { item.classList.remove('has-active-child'); });

        var match = null;
        $all('.menu-group').some(function (menuGroup) {
            var matchedItem = $all('.menu-item', menuGroup).some(function (menuItem) {
                return routeOfHref(menuItem.getAttribute('href')) === route;
            });
            if (matchedItem) { match = menuGroup; return true; }
            return false;
        });

        if (match) {
            match.classList.add('has-active-child');
            if (!collapsed) openGroup(match, true);
        }
    }

    function closeFlyout() {
        if (activeFlyout) { activeFlyout.remove(); activeFlyout = null; }
        if (activeFlyoutHeader) { activeFlyoutHeader.classList.remove('flyout-open'); activeFlyoutHeader = null; }
    }

    function showFlyout(header) {
        closeFlyout();
        var group = header.closest('.menu-group');
        if (!group) return;
        var groupName = header.getAttribute('data-group-name') || '';
        var items = $all('.menu-item', group);
        if (!items.length) return;

        activeFlyoutHeader = header;
        header.classList.add('flyout-open');

        var route = currentRoute();
        var flyout = document.createElement('div');
        flyout.className = 'flyout-menu';
        var html = '<div class="flyout-title">' + escapeText(groupName) + '</div>';
        items.forEach(function (item) {
            var href = item.getAttribute('href') || '#';
            var label = (item.querySelector('.label') || {}).textContent || item.textContent;
            var isActive = routeOfHref(href) === route ? ' active' : '';
            html += '<a class="flyout-item' + isActive + '" href="' + href + '">' + escapeText(label.trim()) + '</a>';
        });
        flyout.innerHTML = html;
        document.body.appendChild(flyout);

        var rect = header.getBoundingClientRect();
        flyout.style.left = (rect.right + 10) + 'px';
        flyout.style.top = rect.top + 'px';

        requestAnimationFrame(function () {
            flyout.classList.add('visible');
            var fr = flyout.getBoundingClientRect();
            if (fr.bottom > window.innerHeight - 8) {
                flyout.style.top = (rect.top - (fr.bottom - window.innerHeight + 8)) + 'px';
            }
        });

        activeFlyout = flyout;

        flyout.addEventListener('click', function (event) {
            var item = event.target.closest('.flyout-item');
            if (!item) return;
            event.preventDefault();
            var href = item.getAttribute('href');
            if (href) window.location.hash = href;
            closeFlyout();
        });
    }

    function escapeText(s) {
        if (s === null || s === undefined) return '';
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function setCollapsed(next) {
        collapsed = next;
        var sidebar = selectElement('#sidebar');
        if (sidebar) sidebar.classList.toggle('collapsed', collapsed);
        closeFlyout();
        closeUserPopup();
        if (!collapsed) syncActiveGroup();
    }

    function closeUserPopup() {
        var p = selectElement('#user-menu-popup');
        if (p) p.classList.remove('visible');
    }

    function setupMobile() {
        var menuBtn = selectElement('#mobile-menu-btn');
        var sidebar = selectElement('#sidebar');
        var backdrop = selectElement('#sidebar-backdrop');
        if (!menuBtn || !sidebar || !backdrop) return;
        menuBtn.addEventListener('click', function () {
            sidebar.classList.add('show');
            backdrop.classList.add('show');
        });
        backdrop.addEventListener('click', function () {
            sidebar.classList.remove('show');
            backdrop.classList.remove('show');
        });
    }

    window.setupShell = function () {
        var sidebar = selectElement('#sidebar');
        var navigationElement = selectElement('#nav');
        if (!sidebar || !navigationElement) return;

        var collapseBtn = selectElement('#collapse-btn');
        if (collapseBtn) collapseBtn.addEventListener('click', function () { setCollapsed(!collapsed); });

        navigationElement.addEventListener('click', function (event) {
            var header = event.target.closest('.accordion-header');
            if (header) {
                event.preventDefault();
                if (collapsed) {
                    if (activeFlyout && activeFlyoutHeader === header) closeFlyout();
                    else showFlyout(header);
                } else {
                    toggleGroup(header.closest('.menu-group'));
                }
                return;
            }

            if (event.target.closest('a')) {
                sidebar.classList.remove('show');
                var backdropElement = selectElement('#sidebar-backdrop');
                if (backdropElement) backdropElement.classList.remove('show');
            }
        });

        var trigger = selectElement('#user-profile-trigger');
        var popup = selectElement('#user-menu-popup');
        if (trigger && popup) {
            trigger.addEventListener('click', function (event) {
                event.stopPropagation();
                popup.classList.toggle('visible');
            });
        }

        document.addEventListener('click', function (event) {
            if (trigger && popup && !trigger.contains(event.target) && !popup.contains(event.target)) {
                popup.classList.remove('visible');
            }
            if (collapsed && activeFlyout && !activeFlyout.contains(event.target) && !event.target.closest('.accordion-header')) {
                closeFlyout();
            }
        });
        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape') { closeUserPopup(); closeFlyout(); }
        });

        window.addEventListener('resize', closeFlyout);

        setupMobile();
        syncActiveGroup();
        window.addEventListener('hashchange', syncActiveGroup);
    };
})();

;

/* ==== js/shared/router.js ==== */
const DEFAULT_ROUTE = window.CONFIG.ROUTES.DEFAULT
const LOGIN_ROUTE = window.CONFIG.ROUTES.LOGIN

const ROUTES = {
    'login': { title: 'Entrar', folder: 'auth', public: true },
    'inicio': { title: 'Início', folder: 'inicio' },
    'solicitar': { title: 'Novo Processo', folder: 'solicitar', parentLabel: 'Solicitar' },
    'solicitar-massa': { title: 'Solicitar em Massa', folder: 'solicitar', parentLabel: 'Solicitar' },
    'meus-lancamentos': { title: 'Meus Lançamentos', folder: 'solicitar', parentLabel: 'Solicitar' },
    'correcao': { title: 'Correções', folder: 'correcao', parentLabel: 'Correção' },
    'editar-processo': { title: 'Editar Processo', folder: 'correcao', parentLabel: 'Correção' },
    'consulta': { title: 'Processos', folder: 'consulta', parentLabel: 'Consulta' },
    'aprovacoes': { title: 'Aprovações Pendentes', folder: 'aprovar', parentLabel: 'Aprovar' },
    'minhas-aprovacoes': { title: 'Minhas Aprovações', folder: 'aprovar', parentLabel: 'Aprovar' },
    'financeiro': { title: 'Financeiro', folder: 'departamento', parentLabel: 'Departamento', financeiro: true },
    'financeiro-integrados': { title: 'Processos Integrados', folder: 'departamento', parentLabel: 'Departamento', financeiro: true },
    'sync': { title: 'Sincronização UAU', folder: 'sync', parentLabel: 'Integração', admin: true },
    'admin-grupos': { title: 'Grupos & Usuários', folder: 'admin', parentLabel: 'Administração', admin: true },
    'sem-aprovador': { title: 'Processos sem Aprovador', folder: 'admin', parentLabel: 'Administração', admin: true },
    'gestao-processos': { title: 'Gestão de Processos', folder: 'admin', parentLabel: 'Administração', admin: true },
    'reaprovals': { title: 'Reaprovações', appDir: 'reapprovals', parentLabel: 'Administração', admin: true },
    'comissoes': { title: 'Pagamento de Comissões', appDir: 'commissions', parentLabel: 'Comissões', commission: true },
    'comissoes-empreendimentos': { title: 'Empreendimentos (Comissões)', appDir: 'commissions', parentLabel: 'Comissões', admin: true },
    'criar-medicao': { title: 'Criação de Medição', folder: 'medicao', parentLabel: 'Medição', medicao: true },
}

const loadedScripts = new Set()

const ASSET_V = (function () {
    try {
        const self = document.querySelector('script[src*="app.bundle.js"], script[src*="shared/router.js"]')
        const match = self && self.src.match(/[?&]v=([^&]+)/)
        return match ? match[1] : ''
    } catch (error) { return '' }
})()

function withVersion(url) {
    if (!ASSET_V) return url
    return url + (url.indexOf('?') === -1 ? '?' : '&') + 'v=' + ASSET_V
}

function setupSidebar() {

    if (typeof window.setupShell === 'function') window.setupShell()
}

function populateSolicitationLaunchers() {
    const body = document.getElementById('sol-folder-body')
    const countEl = document.getElementById('sol-folder-count')
    if (!body || typeof window.getSolicitationGroups !== 'function') return

    const groups = window.getSolicitationGroups()
    let totalItems = 0
    let html = ''
    groups.forEach(function (group, gIdx) {
        const subId = 'sub-sol-' + gIdx
        const groupItemCount = group.subgroups.reduce(function (sum, subgroup) { return sum + subgroup.items.length }, 0)
        totalItems += groupItemCount

        const subgroupsHtml = group.subgroups.map(function (subgroup, sgIdx) {
            const itemsHtml = subgroup.items.map(function (item) {
                const globalIdx = window.SOLICITATION_LAUNCHERS.indexOf(item)
                return '<a class="nav-item sol-launcher" href="javascript:void(0)" data-launcher-idx="'
                    + globalIdx + '">' + escapeText(item.menuLabel) + '</a>'
            }).join('')
            const labelHtml = subgroup.subgroup
                ? '<div class="sol-subgroup-label">'
                + '<span class="sg-dot" style="background:' + colorForGroup(sgIdx) + '"></span>'
                + '<span class="sg-label">' + escapeText(subgroup.subgroup) + '</span>'
                + '<span class="sg-count">' + subgroup.items.length + '</span>'
                + '</div>'
                : ''
            return labelHtml + itemsHtml
        }).join('')

        html += ''
            + '<div class="subfolder open" id="' + subId + '">'
            + '<div class="subfolder-head">'
            + '<span class="gdot" style="background:' + colorForGroup(gIdx) + '"></span>'
            + '<span class="gl">' + escapeText(group.group) + '</span>'
            + '<span class="gc">' + groupItemCount + '</span>'
            + '<svg class="gchev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg>'
            + '</div>'
            + '<div class="subfolder-body">' + subgroupsHtml + '</div>'
            + '</div>'
    })

    html += '<a class="nav-item nav-item-flat" href="' + window.CONFIG.HASH('solicitations')
        + '" data-route="solicitations" style="margin-top:8px">Todas as Solicitações</a>'

    body.innerHTML = html
    if (countEl) countEl.textContent = String(totalItems)

    body.querySelectorAll('.subfolder-head').forEach(function (item) {
        item.addEventListener('click', function () { item.parentElement.classList.toggle('open') })
    })
    body.querySelectorAll('.sol-launcher').forEach(function (item) {
        item.addEventListener('click', function () {
            const index = Number(item.getAttribute('data-launcher-idx'))
            const config = window.SOLICITATION_LAUNCHERS[index]
            if (!config || typeof window.openSolicitationModal !== 'function') return
            window.openSolicitationModal(config).catch(function (error) {
                if (error && error.message === 'cancelled') return
                console.warn('solicitation-modal: falha', error)
            })
        })
    })
}

function colorForGroup(index) {
    const palette = ['var(--accent)', 'var(--warn)', 'var(--ok)', 'var(--violet)']
    return palette[index % palette.length]
}

function escapeText(s) {
    if (s === null || s === undefined) return ''
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function updateActiveLink(route) {
    document.querySelectorAll('.menu-item, .home-link').forEach(function (link) {
        const r = link.getAttribute('data-route')
        link.classList.toggle('active', r === route)
    })
}

function updateBreadcrumb(meta) {
    const crumb = document.getElementById('crumb')
    if (!crumb) return
    let html = '<span>FLUXO</span><span class="sep">/</span>'
    if (meta.parentLabel) {
        html += '<span class="tag">' + escapeText(meta.parentLabel) + '</span><span class="sep">/</span>'
    }
    html += '<b>' + escapeText(meta.title) + '</b>'
    crumb.innerHTML = html
}

function parseHash() {
    const hash = window.location.hash || window.CONFIG.HASH(DEFAULT_ROUTE)
    const cleaned = hash.replace(/^#\/?/, '') || DEFAULT_ROUTE
    const [route, queryString] = cleaned.split('?')
    return {
        route: route || DEFAULT_ROUTE,
        params: new URLSearchParams(queryString || ''),
    }
}

async function loadScriptOnce(scriptUrl) {
    if (loadedScripts.has(scriptUrl)) return
    return new Promise(function (resolve, reject) {
        const s = document.createElement('script')
        s.src = scriptUrl
        s.onload = function () { loadedScripts.add(scriptUrl); resolve() }
        s.onerror = function () { reject(new Error('Falha ao carregar ' + scriptUrl)) }
        document.head.appendChild(s)
    })
}

async function loadView(route, params) {
    const meta = ROUTES[route]
    const content = document.getElementById('app-content')


    const navId = window.__currentNavId
    const stale = function () { return navId !== window.__currentNavId }

    if (!meta) {
        window.location.hash = window.CONFIG.HASH(DEFAULT_ROUTE)
        return
    }

    const authed = window.Auth && window.Auth.isAuthenticated()
    if (!meta.public && !authed) {
        window.location.hash = window.CONFIG.HASH(LOGIN_ROUTE)
        return
    }
    if (route === LOGIN_ROUTE && authed) {
        window.location.hash = window.CONFIG.HASH(DEFAULT_ROUTE)
        return
    }

    if (meta.admin) {
        const user = window.Auth && window.Auth.getUser()
        if (!user || !user.is_admin) {
            window.location.hash = window.CONFIG.HASH(DEFAULT_ROUTE)
            return
        }
    }
    if (meta.financeiro) {
        const u = window.Auth && window.Auth.getUser()
        if (!u || (!u.is_financeiro && !u.is_admin)) {
            window.location.hash = window.CONFIG.HASH(DEFAULT_ROUTE)
            return
        }
    }
    if (meta.commission) {
        const u = window.Auth && window.Auth.getUser()
        if (!u || (!u.is_commission && !u.is_financeiro && !u.is_admin)) {
            window.location.hash = window.CONFIG.HASH(DEFAULT_ROUTE)
            return
        }
    }
    if (meta.medicao) {
        const u = window.Auth && window.Auth.getUser()
        if (!u || (!u.is_medicao && !u.is_admin)) {
            window.location.hash = window.CONFIG.HASH(DEFAULT_ROUTE)
            return
        }
    }
    document.body.classList.toggle('auth-mode', route === LOGIN_ROUTE)
    document.body.classList.remove('booting')

    updateBreadcrumb(meta)
    content.innerHTML = '<div class="view-loading">Carregando ' + escapeText(meta.title) + '…</div>'
    window.routeParams = params

    try {
        const htmlUrl = withVersion(meta.appDir ? ('html/apps/' + meta.appDir + '/' + route + '.html') : window.CONFIG.VIEW_TEMPLATE(meta.folder, route))
        const jsUrl = withVersion(meta.appDir ? ('js/apps/' + meta.appDir + '/' + route + '.js') : ('js/views/' + route + '.js'))
        const html = await fetch(htmlUrl).then(function (r) {
            if (!r.ok) throw new Error('HTTP ' + r.status)
            return r.text()
        })
        if (stale()) return
        const parsed = new DOMParser().parseFromString(html, 'text/html')
        const partial = parsed.querySelector('main')
        if (!partial) throw new Error('A página legada não tem <main>')
        content.innerHTML = partial.innerHTML

        await loadScriptOnce(jsUrl)
        if (stale()) return

        const initFnName = 'initView_' + route.replace(/-/g, '_')
        const initFn = window[initFnName]
        if (typeof initFn !== 'function') {
            throw new Error('JS desta view não expõe ' + initFnName + '().')
        }
        await initFn()
    } catch (error) {
        if (stale()) return
        content.innerHTML = '<div class="view-error">Falha ao carregar a view: ' + escapeText(error.message) + '</div>'
    }
    hideBootLoader()
}

function hideBootLoader() {
    const loader = document.getElementById('boot-loader')
    if (!loader) return
    loader.classList.add('done')
    setTimeout(function () { loader.remove() }, 600)
}

async function handleRoute() {
    window.__currentNavId = (window.__currentNavId || 0) + 1
    const parsed = parseHash()
    updateActiveLink(parsed.route)
    await loadView(parsed.route, parsed.params)
}




function warmState() {
    if (!window.Store || !window.Auth || !window.Auth.isAuthenticated()) return
    window.Store.warm('pending_approvals')
}





async function loadCatalogs() {
    if (!window.Auth || !window.Auth.isAuthenticated()) return
    try {
        const b = await window.API.get('/catalog/bootstrap')
        if (b) {
            if (b.steps) window.CONFIG.STEPS = b.steps
            if (b.status) window.CONFIG.STATUS = b.status
            if (b.processKinds) window.CONFIG.PROCESS_KINDS = b.processKinds
            if (b.messageKinds) window.CONFIG.MESSAGE_KINDS = b.messageKinds
        }
    } catch (error) { }
    if (typeof window.buildConsultaTabs === 'function') window.buildConsultaTabs()
}

async function bootstrapAuth() {
    if (!window.Auth) return
    await window.Auth.init()
    await loadCatalogs()
    warmState()
    window.Auth.onChange(function (session) {
        if (!session && (window.location.hash || '').indexOf(LOGIN_ROUTE) === -1) {
            window.location.hash = window.CONFIG.HASH(LOGIN_ROUTE)
        }
        if (session) { loadCatalogs(); warmState() }
    })
}

window.addEventListener('hashchange', handleRoute)
window.addEventListener('DOMContentLoaded', async function () {
    await bootstrapAuth()
    setupSidebar()
    if (!window.location.hash) {
        window.location.hash = window.CONFIG.HASH(DEFAULT_ROUTE)
        return
    }
    handleRoute()
})

;

/* ==== js/shared/agent-widget.js ==== */
(function () {
  var ENDPOINT = '/agent/chat';
  var ROBOT = '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="4.5" y="8" width="15" height="11" rx="2.5"/><path d="M12 8V5"/><circle cx="12" cy="3.4" r="1.2"/><path d="M2.5 12v3M21.5 12v3"/><circle cx="9" cy="13" r="1.3"/><circle cx="15" cy="13" r="1.3"/><path d="M9.5 16.5h5"/></svg>';
  var TYPING = '<span class="agw-typing"><span></span><span></span><span></span></span>';
  var state = { open: false, busy: false, conversationId: null };
  var elements = {};

  function newId() {
    if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    return 'c-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  function element(tag, cssClass, html) {
    var createdElement = document.createElement(tag);
    if (cssClass) createdElement.className = cssClass;
    if (html != null) createdElement.innerHTML = html;
    return createdElement;
  }

  function mdEscape(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function mdInline(s) {
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(/(^|[^*])\*(?!\s)([^*]+?)\*/g, '$1<em>$2</em>');
    return s;
  }

  function mdTableSep(line) {
    var t = line.trim();
    return t.indexOf('|') >= 0 && t.indexOf('-') >= 0 && /^[\s|:\-]+$/.test(t);
  }

  function mdCells(line) {
    var t = line.trim();
    if (t.charAt(0) === '|') t = t.slice(1);
    if (t.charAt(t.length - 1) === '|') t = t.slice(0, -1);
    return t.split('|').map(function (cell) { return cell.trim(); });
  }

  function renderMd(text) {
    var lines = mdEscape(text).split('\n');
    var output = '';
    var list = null;
    function close() { if (list) { output += '</' + list + '>'; list = null; } }
    for (var index = 0; index < lines.length; index++) {
      var line = lines[index];
      if (line.indexOf('|') >= 0 && index + 1 < lines.length && mdTableSep(lines[index + 1])) {
        close();
        var header = mdCells(line);
        var bodyRows = [];
        var next = index + 2;
        while (next < lines.length && lines[next].indexOf('|') >= 0 && lines[next].trim() !== '') {
          bodyRows.push(mdCells(lines[next]));
          next++;
        }
        output += '<div class="agw-tablewrap"><table class="agw-table"><thead><tr>'
          + header.map(function (headerCell) { return '<th>' + mdInline(headerCell) + '</th>'; }).join('')
          + '</tr></thead><tbody>'
          + bodyRows.map(function (row) {
            return '<tr>' + row.map(function (cell) { return '<td>' + mdInline(cell) + '</td>'; }).join('') + '</tr>';
          }).join('')
          + '</tbody></table></div>';
        index = next - 1;
        continue;
      }
      var headingMatch = line.match(/^\s*#{1,6}\s+(.*)$/);
      var bulletMatch = line.match(/^\s*[-*]\s+(.*)$/);
      var numberedMatch = line.match(/^\s*\d+\.\s+(.*)$/);
      if (headingMatch) { close(); output += '<div class="agw-h">' + mdInline(headingMatch[1]) + '</div>'; }
      else if (bulletMatch) { if (list !== 'ul') { close(); output += '<ul>'; list = 'ul'; } output += '<li>' + mdInline(bulletMatch[1]) + '</li>'; }
      else if (numberedMatch) { if (list !== 'ol') { close(); output += '<ol>'; list = 'ol'; } output += '<li>' + mdInline(numberedMatch[1]) + '</li>'; }
      else if (line.trim() === '') { close(); }
      else { close(); output += '<div>' + mdInline(line) + '</div>'; }
    }
    close();
    return output;
  }

  function injectStyles() {
    if (document.getElementById('agw-style')) return;
    var s = document.createElement('style');
    s.id = 'agw-style';
    s.textContent = [
      '.agw-root{position:fixed;right:20px;bottom:20px;z-index:9998;display:none}',
      '.agw-bubble{width:56px;height:56px;border-radius:50%;border:none;cursor:pointer;background:var(--accent,#2563eb);color:#fff;box-shadow:0 6px 20px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center}',
      '.agw-panel{position:absolute;right:0;bottom:68px;width:640px;max-width:calc(100vw - 40px);height:760px;max-height:calc(100vh - 120px);background:var(--surface,#fff);color:var(--text,#1f2937);border:1px solid var(--border,#e5e7eb);border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.2);display:none;flex-direction:column;overflow:hidden}',
      '.agw-open .agw-panel{display:flex}',
      '.agw-header{padding:12px 14px;font-weight:600;border-bottom:1px solid var(--border,#e5e7eb);display:flex;align-items:center;gap:8px}',
      '.agw-header svg{width:20px;height:20px}',
      '.agw-body{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px}',
      '.agw-msg{padding:8px 12px;border-radius:12px;max-width:100%;word-wrap:break-word;font-size:14px;line-height:1.45}',
      '.agw-user{align-self:flex-end;background:var(--accent,#2563eb);color:#fff;white-space:pre-wrap}',
      '.agw-assistant{align-self:stretch;max-width:100%;background:var(--surface-3,#f1f2f4);color:var(--text,#1f2937);border:1px solid var(--border,#e5e7eb)}',
      '.agw-assistant>div{margin:3px 0}',
      '.agw-assistant .agw-h{font-weight:600;margin:8px 0 3px}',
      '.agw-assistant ul,.agw-assistant ol{margin:4px 0;padding-left:20px}',
      '.agw-assistant li{margin:2px 0}',
      '.agw-assistant strong{font-weight:600}',
      '.agw-assistant code{background:rgba(0,0,0,.08);padding:1px 5px;border-radius:5px;font-size:12px}',
      '.agw-tablewrap{overflow-x:auto;margin:6px 0;max-width:100%}',
      '.agw-table{border-collapse:collapse;font-size:12.5px}',
      '.agw-table th,.agw-table td{border:1px solid var(--border,#e5e7eb);padding:5px 8px;text-align:left;white-space:nowrap;vertical-align:top}',
      '.agw-table th{background:var(--surface-2,#f7f8fa);font-weight:600}',
      '.agw-typing{display:inline-flex;gap:4px;align-items:center;padding:2px 0}',
      '.agw-typing span{width:6px;height:6px;border-radius:50%;background:var(--muted,#6b7280);display:inline-block;animation:agw-bounce 1.2s infinite ease-in-out}',
      '.agw-typing span:nth-child(2){animation-delay:.2s}',
      '.agw-typing span:nth-child(3){animation-delay:.4s}',
      '@keyframes agw-bounce{0%,80%,100%{transform:translateY(0);opacity:.4}40%{transform:translateY(-4px);opacity:1}}',
      '.agw-form{display:flex;gap:8px;padding:10px;border-top:1px solid var(--border,#e5e7eb)}',
      '.agw-input{flex:1;padding:9px 12px;border:1px solid var(--border,#e5e7eb);border-radius:10px;font-size:14px;outline:none;background:var(--surface,#fff);color:var(--text,#1f2937)}',
      '.agw-send{border:none;background:var(--accent,#2563eb);color:#fff;border-radius:10px;padding:0 14px;cursor:pointer;font-size:16px}',
      '.agw-send:disabled{opacity:.5;cursor:default}',
      '.agw-resize{position:absolute;top:0;left:0;width:16px;height:16px;cursor:nwse-resize;z-index:3}',
      '.agw-resize::before{content:"";position:absolute;top:6px;left:6px;width:6px;height:6px;border-top:2px solid var(--muted,#9ca3af);border-left:2px solid var(--muted,#9ca3af);border-top-left-radius:3px;opacity:.6}',
      '.agw-actions{display:flex;flex-direction:column;gap:8px}',
      '.agw-act-head{font-size:12px;font-weight:600;color:var(--muted,#6b7280);text-transform:uppercase;letter-spacing:.03em}',
      '.agw-actcard{border:1px solid var(--border,#e5e7eb);border-radius:12px;background:var(--surface-2,#f7f8fa);padding:10px 12px;display:flex;flex-direction:column;gap:10px}',
      '.agw-act-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px 14px}',
      '.agw-act-f{display:flex;flex-direction:column;gap:1px;min-width:0}',
      '.agw-act-f span{font-size:11px;color:var(--muted,#6b7280)}',
      '.agw-act-f b{font-size:13px;font-weight:600;word-break:break-word}',
      '.agw-act-f:last-child{grid-column:1 / -1}',
      '.agw-act-foot{display:flex;flex-wrap:wrap;gap:8px;align-items:center}',
      '.agw-act-btn{border:none;border-radius:9px;padding:7px 14px;font-size:13px;font-weight:600;cursor:pointer}',
      '.agw-act-btn:disabled{opacity:.5;cursor:default}',
      '.agw-act-yes{background:#22c55e;color:#fff}',
      '.agw-act-no{background:#ef4444;color:#fff}',
      '.agw-act-cancel{background:var(--surface-3,#e5e7eb);color:var(--text,#1f2937)}',
      '.agw-act-q{font-size:13px;flex:1 1 100%}',
      '.agw-act-reason{flex:1 1 100%;resize:vertical;border:1px solid var(--border,#e5e7eb);border-radius:9px;padding:8px;font-size:13px;font-family:inherit;background:var(--surface,#fff);color:var(--text,#1f2937);outline:none}',
      '.agw-act-done{font-size:13px;font-weight:600}',
      '.agw-act-done.ok{color:#16a34a}',
      '.agw-act-done.warn{color:#d97706}',
      '.agw-act-done.err{color:#dc2626}'
    ].join('');
    document.head.appendChild(s);
  }

  function applySavedSize(panel) {
    var saved = null;
    try { saved = JSON.parse(localStorage.getItem('agw-size') || 'null'); } catch (error) { saved = null; }
    if (saved && saved.w && saved.h) {
      panel.style.width = saved.w + 'px';
      panel.style.height = saved.h + 'px';
    }
  }

  function setupResize(panel, grip) {
    var startX, startY, startW, startH, dragging = false;
    function onMove(event) {
      if (!dragging) return;
      var maxW = window.innerWidth - 40;
      var maxH = window.innerHeight - 90;
      panel.style.width = Math.max(320, Math.min(maxW, startW + (startX - event.clientX))) + 'px';
      panel.style.height = Math.max(360, Math.min(maxH, startH + (startY - event.clientY))) + 'px';
    }
    function onUp() {
      if (!dragging) return;
      dragging = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.userSelect = '';
      try { localStorage.setItem('agw-size', JSON.stringify({ w: panel.offsetWidth, h: panel.offsetHeight })); } catch (error) { }
    }
    grip.addEventListener('mousedown', function (event) {
      event.preventDefault();
      dragging = true;
      startX = event.clientX; startY = event.clientY;
      startW = panel.offsetWidth; startH = panel.offsetHeight;
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  }

  function build() {
    injectStyles();
    var root = element('div', 'agw-root');
    var bubble = element('button', 'agw-bubble', ROBOT);
    var panel = element('div', 'agw-panel');
    panel.appendChild(element('div', 'agw-header', '<span>Tulipa</span>'));
    var body = element('div', 'agw-body');
    var form = element('form', 'agw-form');
    var input = element('input', 'agw-input');
    input.type = 'text';
    input.placeholder = 'Como posso ajudar?';
    var send = element('button', 'agw-send', '&#10148;');
    send.type = 'submit';
    form.appendChild(input);
    form.appendChild(send);
    panel.appendChild(body);
    panel.appendChild(form);
    var grip = element('div', 'agw-resize');
    grip.title = 'Arraste para redimensionar';
    panel.appendChild(grip);
    applySavedSize(panel);
    setupResize(panel, grip);
    root.appendChild(panel);
    root.appendChild(bubble);
    document.body.appendChild(root);

    elements = { root: root, bubble: bubble, body: body, form: form, input: input, send: send };
    state.conversationId = newId();
    bubble.addEventListener('click', toggle);
    form.addEventListener('submit', onSubmit);
    document.addEventListener('mousedown', function (event) {
      if (state.open && !elements.root.contains(event.target)) {
        state.open = false;
        elements.root.classList.remove('agw-open');
      }
    });
  }

  function toggle() {
    state.open = !state.open;
    elements.root.classList.toggle('agw-open', state.open);
    if (state.open) elements.input.focus();
  }

  function addUser(text) {
    var messageElement = element('div', 'agw-msg agw-user');
    messageElement.textContent = text;
    elements.body.appendChild(messageElement);
    scrollBottom();
    return messageElement;
  }

  function addAssistant() {
    var messageElement = element('div', 'agw-msg agw-assistant');
    elements.body.appendChild(messageElement);
    scrollBottom();
    return messageElement;
  }

  function scrollBottom() {
    elements.body.scrollTop = elements.body.scrollHeight;
  }

  function money(value) {
    return (Number(value) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function fmtDate(value) {
    if (!value) return '-';
    var parts = String(value).slice(0, 10).split('-');
    return parts.length === 3 ? parts[2] + '/' + parts[1] + '/' + parts[0] : String(value);
  }

  function invalidateApprovalCaches() {
    if (!window.Store) return;
    ['my_approvals', 'financeiro', 'financeiro_integrados', 'history', 'no_approver'].forEach(function (key) {
      window.Store.invalidate(key);
    });
  }

  function actionField(label, value) {
    return '<div class="agw-act-f"><span>' + mdEscape(label) + '</span><b>' + mdEscape(value) + '</b></div>';
  }

  function settle(card, message, css) {
    var foot = card.querySelector('.agw-act-foot');
    foot.className = 'agw-act-foot agw-act-done ' + css;
    foot.textContent = message;
  }

  function approveFlow(card, action, foot) {
    foot.innerHTML = '';
    var question = element('span', 'agw-act-q', 'Confirmar a aprovação do processo #' + mdEscape(String(action.id)) + '?');
    var confirm = element('button', 'agw-act-btn agw-act-yes', 'Confirmar');
    var cancel = element('button', 'agw-act-btn agw-act-cancel', 'Cancelar');
    foot.appendChild(question);
    foot.appendChild(confirm);
    foot.appendChild(cancel);
    cancel.addEventListener('click', function () { renderFoot(card, action, foot); });
    confirm.addEventListener('click', function () {
      confirm.disabled = true;
      cancel.disabled = true;
      window.API.post('/processes/' + action.uuid + '/approve')
        .then(function () { invalidateApprovalCaches(); settle(card, 'Processo #' + action.id + ' aprovado.', 'ok'); })
        .catch(function (error) { settle(card, 'Falha ao aprovar: ' + (error && error.message ? error.message : error), 'err'); });
    });
  }

  function rejectFlow(card, action, foot) {
    foot.innerHTML = '';
    var reason = element('textarea', 'agw-act-reason');
    reason.rows = 2;
    reason.maxLength = 500;
    reason.placeholder = 'Motivo da reprovação (obrigatório - fica no histórico)…';
    var confirm = element('button', 'agw-act-btn agw-act-no', 'Confirmar reprovação');
    confirm.disabled = true;
    var cancel = element('button', 'agw-act-btn agw-act-cancel', 'Cancelar');
    foot.appendChild(reason);
    foot.appendChild(confirm);
    foot.appendChild(cancel);
    reason.focus();
    reason.addEventListener('input', function () { confirm.disabled = !reason.value.trim(); });
    cancel.addEventListener('click', function () { renderFoot(card, action, foot); });
    confirm.addEventListener('click', function () {
      var text = reason.value.trim();
      if (!text) return;
      confirm.disabled = true;
      cancel.disabled = true;
      window.API.post('/processes/' + action.uuid + '/reject', { reason: text })
        .then(function () { invalidateApprovalCaches(); settle(card, 'Processo #' + action.id + ' reprovado.', 'warn'); })
        .catch(function (error) { settle(card, 'Falha ao reprovar: ' + (error && error.message ? error.message : error), 'err'); });
    });
  }

  function renderFoot(card, action, foot) {
    foot.innerHTML = '';
    var approve = element('button', 'agw-act-btn agw-act-yes', 'Aprovar');
    var reject = element('button', 'agw-act-btn agw-act-no', 'Reprovar');
    foot.appendChild(approve);
    foot.appendChild(reject);
    approve.addEventListener('click', function () { approveFlow(card, action, foot); });
    reject.addEventListener('click', function () { rejectFlow(card, action, foot); });
  }

  function renderActions(list) {
    if (!window.API) return;
    var block = element('div', 'agw-actions');
    block.appendChild(element('div', 'agw-act-head', 'Aprovar ou reprovar'));
    list.forEach(function (action) {
      var card = element('div', 'agw-actcard');
      card.innerHTML = '<div class="agw-act-grid">'
        + actionField('Processo', '#' + action.id)
        + actionField('Empresa', action.empresa || '-')
        + actionField('Obra', action.obra || '-')
        + actionField('Valor', money(action.valor))
        + actionField('Vencimento', fmtDate(action.vencimento))
        + actionField('Descrição', action.descricao || '-')
        + '</div>';
      var foot = element('div', 'agw-act-foot');
      card.appendChild(foot);
      renderFoot(card, action, foot);
      block.appendChild(card);
    });
    elements.body.appendChild(block);
    scrollBottom();
  }

  async function onSubmit(event) {
    event.preventDefault();
    var text = elements.input.value.trim();
    if (!text || state.busy) return;
    elements.input.value = '';
    addUser(text);
    state.busy = true;
    elements.send.disabled = true;

    var target = addAssistant();
    target.innerHTML = TYPING;
    var accumulator = '';
    var streaming = false;
    var actions = [];

    function stopTyping() {
      if (!streaming) {
        streaming = true;
        target.innerHTML = '';
      }
    }

    try {
      var response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: text, conversation_id: state.conversationId })
      });
      if (response.status === 401) { stopTyping(); target.textContent = 'Sessão expirada. Faça login novamente.'; return; }
      if (!response.ok || !response.body) { stopTyping(); target.textContent = 'Falha ao falar com o assistente.'; return; }

      var reader = response.body.getReader();
      var decoder = new TextDecoder();
      var buffer = '';
      while (true) {
        var read = await reader.read();
        if (read.done) break;
        buffer += decoder.decode(read.value, { stream: true });
        var frames = buffer.split('\n\n');
        buffer = frames.pop();
        for (var index = 0; index < frames.length; index++) {
          var dataLine = frames[index].split('\n').filter(function (item) { return item.indexOf('data:') === 0; })[0];
          if (!dataLine) continue;
          var payload = dataLine.slice(5).trim();
          if (!payload) continue;
          var data;
          try { data = JSON.parse(payload); } catch (error) { continue; }
          stopTyping();
          if (data.error) accumulator += '\n[erro] ' + data.error;
          else if (data.actions) actions = data.actions;
          else if (data.delta) accumulator += data.delta;
          if (!data.actions) { target.innerHTML = renderMd(accumulator); scrollBottom(); }
        }
      }
      stopTyping();
      if (!accumulator) target.textContent = 'Sem resposta.';
      if (actions.length) renderActions(actions);
    } catch (error) {
      stopTyping();
      target.textContent = 'Erro: ' + (error && error.message ? error.message : String(error));
    } finally {
      state.busy = false;
      elements.send.disabled = false;
      elements.input.focus();
    }
  }

  function reflect(user) {
    if (!elements.root) return;
    elements.root.style.display = user ? 'block' : 'none';
    if (!user) {
      state.open = false;
      state.conversationId = newId();
      elements.root.classList.remove('agw-open');
      elements.body.innerHTML = '';
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    build();
    var user = (window.Auth && window.Auth.getUser) ? window.Auth.getUser() : null;
    reflect(user);
    if (window.Auth && window.Auth.onChange) window.Auth.onChange(reflect);
  });
})();

;
