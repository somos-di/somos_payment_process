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
      + '.pf-ms-pop .pf-ms-empty{padding:6px;color:var(--muted);font-size:12.5px}';
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

  window.ProcessFilters = {
    mount: async function (container, options) {
      options = options || {};
      ensureStyle();
      var storageKey = 'filters:' + (options.storageKey || 'global');
      var saved = {};
      try { saved = JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch (error) { saved = {}; }

      var statusMulti = !!options.multiStatus;
      var companyMS = makeMultiSelect('Empresa', { allLabel: 'Todas', onChange: onCompanyChange });
      var buildingMS = makeMultiSelect('Obra', { allLabel: 'Todas', onChange: emit });
      var statusMS = statusMulti ? makeMultiSelect('Status', { allLabel: 'Todos', onChange: emit }) : null;

      var dates = document.createElement('span'); dates.style.display = 'contents';
      dates.innerHTML =
        '<label class="pf-field">De<input type="date" data-pf="from"></label>'
        + '<label class="pf-field">Até<input type="date" data-pf="to"></label>';
      var statusSingle = document.createElement('span'); statusSingle.style.display = 'contents';
      if (!statusMulti) statusSingle.innerHTML = '<label class="pf-field">Status<select data-pf="status"><option value="">Todos</option></select></label>';
      var urgentWrap = document.createElement('span'); urgentWrap.style.display = 'contents';
      urgentWrap.innerHTML = '<label class="pf-field">Urgente<select data-pf="urgent">'
        + '<option value="">Todos</option><option value="1">Sim</option><option value="0">Não</option></select></label>';

      container.innerHTML = '';
      container.appendChild(companyMS.el);
      container.appendChild(buildingMS.el);
      container.appendChild(dates);
      if (statusMulti) container.appendChild(statusMS.el); else container.appendChild(statusSingle);
      container.appendChild(urgentWrap);

      var element = {};
      container.querySelectorAll('[data-pf]').forEach(function (item) { element[item.getAttribute('data-pf')] = item; });

      var companies = [];
      try { companies = await window.Store.get('empresas'); } catch (error) { companies = []; }
      companyMS.setOptions((companies || []).map(function (item) { return { value: String(item.codigo), label: item.nome }; }));

      var steps = (window.CONFIG && window.CONFIG.STEPS) || {};
      var statusOpts = Object.keys(steps).map(function (item) { return { value: String(item), label: steps[item] }; });
      if (statusMulti) statusMS.setOptions(statusOpts);
      else element.status.innerHTML = '<option value="">Todos</option>' + statusOpts.map(function (statusOpt) {
        return '<option value="' + escapeHtml(statusOpt.value) + '">' + escapeHtml(statusOpt.label) + '</option>';
      }).join('');

      async function refreshBuildings(keepValues) {
        var comps = companyMS.getValues();
        buildingMS.setDisabled(!comps.length);
        var seen = {}, options = [];
        for (var index = 0; index < comps.length; index++) {
          var rows = await loadBuildings(comps[index]);
          rows.forEach(function (row) {
            var value = String(row.codigo);
            if (seen[value]) return; seen[value] = 1;
            options.push({ value: value, label: row.nome });
          });
        }
        buildingMS.setOptions(options);
        if (keepValues) buildingMS.setValues(keepValues);
      }

      async function onCompanyChange() { await refreshBuildings(null); emit(); }

      function getValues() {
        return {
          company: companyMS.getValues(), building: buildingMS.getValues(),
          from: element.from.value, to: element.to.value,
          status: statusMulti ? statusMS.getValues() : element.status.value,
          urgent: element.urgent.value,
        };
      }
      function persist() { try { localStorage.setItem(storageKey, JSON.stringify(getValues())); } catch (error) { } }
      function emit() { persist(); if (options.onChange) options.onChange(getValues()); }

      companyMS.setValues(asArray(saved.company));
      await refreshBuildings(asArray(saved.building));
      element.from.value = saved.from || '';
      element.to.value = saved.to || '';
      if (statusMulti) statusMS.setValues(asArray(saved.status)); else element.status.value = saved.status || '';
      element.urgent.value = saved.urgent || '';

      (statusMulti ? ['from', 'to', 'urgent'] : ['from', 'to', 'status', 'urgent'])
        .forEach(function (item) { element[item].addEventListener('change', emit); });

      return {
        getValues: getValues,
        clear: function () {
          companyMS.clear(); buildingMS.clear(); buildingMS.setDisabled(true);
          element.from.value = ''; element.to.value = ''; element.urgent.value = '';
          if (statusMulti) statusMS.clear(); else element.status.value = '';
          try { localStorage.removeItem(storageKey); } catch (error) { }
          if (options.onChange) options.onChange(getValues());
        },
      };
    },
  };
})();
