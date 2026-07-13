(function () {
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function asArray(v) { return Array.isArray(v) ? v.slice() : (v === '' || v == null ? [] : [v]); }  // migra saved antigo (string) -> array

  var buildingsCache = {};
  async function loadBuildings(company) {
    if (!company) return [];
    if (buildingsCache[company]) return buildingsCache[company];
    var rows = await window.SB.select('v_obras', function (q) { return q.eq('empresa', company).order('nome'); });
    buildingsCache[company] = rows || [];
    return buildingsCache[company];
  }

  // injeta o CSS do multiselect uma única vez
  var STYLE_ID = 'pf-ms-style';
  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var st = document.createElement('style'); st.id = STYLE_ID;
    st.textContent =
      '.pf-ms{position:relative}'
      + '.pf-ms-btn{display:flex;align-items:center;gap:6px;justify-content:space-between;min-width:180px;max-width:280px;'
      + 'padding:7px 10px;border:1px solid var(--border);border-radius:8px;background:var(--surface);cursor:pointer;'
      + 'font-size:14px;color:var(--text);text-align:left;white-space:nowrap;overflow:hidden}'
      + '.pf-ms-btn .pf-ms-txt{overflow:hidden;text-overflow:ellipsis}'
      + '.pf-ms-btn[disabled]{opacity:.5;cursor:not-allowed}'
      + '.pf-ms-pop{position:absolute;z-index:60;top:calc(100% + 4px);left:0;min-width:260px;max-width:360px;'
      + 'background:var(--surface);border:1px solid var(--border);border-radius:10px;box-shadow:var(--shadow-md);padding:8px;display:none}'
      + '.pf-ms-pop.open{display:block}'
      + '.pf-ms-search{width:100%;margin-bottom:6px;padding:6px 8px;border:1px solid var(--border);border-radius:6px;font-size:13px}'
      + '.pf-ms-list{max-height:260px;overflow:auto;display:flex;flex-direction:column;gap:1px}'
      + '.pf-ms-opt{display:flex;gap:8px;align-items:center;padding:6px 8px;border-radius:6px;cursor:pointer;font-size:14px}'
      + '.pf-ms-opt:hover{background:var(--surface-2)}'
      + '.pf-ms-opt input{flex:none}'
      + '.pf-ms-empty{padding:8px;color:var(--muted);font-size:13px}';
    document.head.appendChild(st);
  }

  // Multiselect com checkboxes + busca. onChange(selectedArray). Fecha ao clicar fora.
  function makeMultiSelect(caption, opts) {
    var field = document.createElement('div'); field.className = 'pf-field pf-ms';  // div (não label): evita label aninhado com as opções
    field.innerHTML = caption
      + '<button type="button" class="pf-ms-btn"><span class="pf-ms-txt">Todas</span><span>▾</span></button>'
      + '<div class="pf-ms-pop"><input class="pf-ms-search" placeholder="Buscar…">'
      + '<div class="pf-ms-list"></div></div>';
    var btn = field.querySelector('.pf-ms-btn');
    var txt = field.querySelector('.pf-ms-txt');
    var pop = field.querySelector('.pf-ms-pop');
    var search = field.querySelector('.pf-ms-search');
    var list = field.querySelector('.pf-ms-list');

    var items = [];          // [{value, label}]
    var selected = {};       // value -> true
    var labelByValue = {};

    function selectedArray() { return Object.keys(selected); }
    function updateButton() {
      var n = selectedArray().length;
      txt.textContent = n === 0 ? (opts.allLabel || 'Todas')
        : (n === 1 ? (labelByValue[selectedArray()[0]] || '1 selecionada') : (n + ' selecionadas'));
    }
    function renderList() {
      var term = (search.value || '').toLowerCase().trim();
      var shown = items.filter(function (it) { return !term || String(it.label).toLowerCase().indexOf(term) >= 0; });
      if (!shown.length) { list.innerHTML = '<div class="pf-ms-empty">Nada encontrado</div>'; return; }
      list.innerHTML = shown.map(function (it) {
        return '<label class="pf-ms-opt"><input type="checkbox" value="' + esc(it.value) + '"'
          + (selected[it.value] ? ' checked' : '') + '>' + esc(it.label) + '</label>';
      }).join('');
      list.querySelectorAll('input[type=checkbox]').forEach(function (cb) {
        cb.addEventListener('change', function () {
          if (cb.checked) selected[cb.value] = true; else delete selected[cb.value];
          updateButton();
          if (opts.onChange) opts.onChange(selectedArray());
        });
      });
    }
    function openPop() { pop.classList.add('open'); search.value = ''; renderList(); search.focus(); }
    function closePop() { pop.classList.remove('open'); }

    btn.addEventListener('click', function (e) {
      e.preventDefault();
      if (btn.disabled) return;
      if (pop.classList.contains('open')) closePop(); else openPop();
    });
    search.addEventListener('input', renderList);
    document.addEventListener('click', function (e) { if (!field.contains(e.target)) closePop(); });

    return {
      el: field,
      getValues: selectedArray,
      setOptions: function (optItems) {
        items = optItems || []; labelByValue = {};
        items.forEach(function (it) { labelByValue[it.value] = it.label; });
        // descarta seleções que não existem mais nas opções
        Object.keys(selected).forEach(function (v) { if (!(v in labelByValue)) delete selected[v]; });
        updateButton(); if (pop.classList.contains('open')) renderList();
      },
      setValues: function (arr) {
        selected = {}; (arr || []).forEach(function (v) { selected[String(v)] = true; });
        updateButton();
      },
      setDisabled: function (d) { btn.disabled = !!d; if (d) closePop(); },
      clear: function () { selected = {}; search.value = ''; updateButton(); },
    };
  }

  window.ProcessFilters = {
    mount: async function (container, opts) {
      opts = opts || {};
      ensureStyle();
      var storageKey = 'filters:' + (opts.storageKey || 'global');
      var saved = {};
      try { saved = JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch (e) { saved = {}; }

      var companyMS = makeMultiSelect('Empresa', { allLabel: 'Todas', onChange: onCompanyChange });
      var buildingMS = makeMultiSelect('Obra', { allLabel: 'Todas', onChange: emit });

      // demais campos continuam simples (data/status/urgente)
      var rest = document.createElement('span'); rest.style.display = 'contents';
      rest.innerHTML =
        '<label class="pf-field">De<input type="date" data-pf="from"></label>'
        + '<label class="pf-field">Até<input type="date" data-pf="to"></label>'
        + '<label class="pf-field">Status<select data-pf="status"><option value="">Todos</option></select></label>'
        + '<label class="pf-field">Urgente<select data-pf="urgent">'
        + '<option value="">Todos</option><option value="1">Sim</option><option value="0">Não</option></select></label>';

      container.innerHTML = '';
      container.appendChild(companyMS.el);
      container.appendChild(buildingMS.el);
      container.appendChild(rest);

      var el = {};
      container.querySelectorAll('[data-pf]').forEach(function (c) { el[c.getAttribute('data-pf')] = c; });

      var companies = [];
      try { companies = await window.Store.get('empresas'); } catch (e) { companies = []; }
      companyMS.setOptions((companies || []).map(function (c) { return { value: String(c.codigo), label: c.nome }; }));

      var steps = (window.CONFIG && window.CONFIG.STEPS) || {};
      el.status.innerHTML = '<option value="">Todos</option>' + Object.keys(steps).map(function (id) {
        return '<option value="' + esc(id) + '">' + esc(steps[id]) + '</option>';
      }).join('');

      // Obra = união das obras das empresas selecionadas (dedup por código).
      async function refreshBuildings(keepValues) {
        var comps = companyMS.getValues();
        buildingMS.setDisabled(!comps.length);
        var seen = {}, options = [];
        for (var i = 0; i < comps.length; i++) {
          var rows = await loadBuildings(comps[i]);
          rows.forEach(function (o) {
            var v = String(o.codigo);
            if (seen[v]) return; seen[v] = 1;
            options.push({ value: v, label: o.nome });
          });
        }
        buildingMS.setOptions(options);
        if (keepValues) buildingMS.setValues(keepValues);
      }

      async function onCompanyChange() { await refreshBuildings(null); emit(); }

      function getValues() {
        return {
          company: companyMS.getValues(), building: buildingMS.getValues(),
          from: el.from.value, to: el.to.value, status: el.status.value, urgent: el.urgent.value,
        };
      }
      function persist() { try { localStorage.setItem(storageKey, JSON.stringify(getValues())); } catch (e) {  } }
      function emit() { persist(); if (opts.onChange) opts.onChange(getValues()); }

      companyMS.setValues(asArray(saved.company));
      await refreshBuildings(asArray(saved.building));
      el.from.value = saved.from || '';
      el.to.value = saved.to || '';
      el.status.value = saved.status || '';
      el.urgent.value = saved.urgent || '';

      ['from', 'to', 'status', 'urgent'].forEach(function (k) { el[k].addEventListener('change', emit); });

      return {
        getValues: getValues,
        clear: function () {
          companyMS.clear(); buildingMS.clear(); buildingMS.setDisabled(true);
          el.from.value = ''; el.to.value = ''; el.status.value = ''; el.urgent.value = '';
          try { localStorage.removeItem(storageKey); } catch (e) {  }
          if (opts.onChange) opts.onChange(getValues());
        },
      };
    },
  };
})();
