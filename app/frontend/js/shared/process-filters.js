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
