// process-filters.js — barra de filtros compartilhada (Empresa / Obra / Data / Status),
// PERSISTENTE por tela (localStorage). Opções SEMPRE do banco, nada chumbado:
//   empresa -> v_empresas (Store 'empresas', espelho UAU)
//   obra    -> v_obras (dependente da empresa selecionada)
//   status  -> CONFIG.STEPS (payment.status_kind, carregado no boot via /catalog/status)
// window.ProcessFilters.mount(container, { storageKey, onChange }) -> { getValues, clear }
(function () {
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  var buildingsCache = {}; // empresa -> linhas de v_obras (evita re-consultar ao alternar)

  async function loadBuildings(company) {
    if (!company) return [];
    if (buildingsCache[company]) return buildingsCache[company];
    var rows = await window.SB.select('v_obras', function (q) { return q.eq('empresa', company).order('nome'); });
    buildingsCache[company] = rows || [];
    return buildingsCache[company];
  }

  window.ProcessFilters = {
    mount: async function (container, opts) {
      opts = opts || {};
      var storageKey = 'filters:' + (opts.storageKey || 'global');
      var saved = {};
      try { saved = JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch (e) { saved = {}; }

      container.innerHTML =
        '<label class="pf-field">Empresa<select data-pf="company"><option value="">Todas</option></select></label>'
        + '<label class="pf-field">Obra<select data-pf="building" disabled><option value="">Todas</option></select></label>'
        + '<label class="pf-field">De<input type="date" data-pf="from"></label>'
        + '<label class="pf-field">Até<input type="date" data-pf="to"></label>'
        + '<label class="pf-field">Status<select data-pf="status"><option value="">Todos</option></select></label>'
        + '<label class="pf-field">Urgente<select data-pf="urgent">'
        + '<option value="">Todos</option><option value="1">Sim</option><option value="0">Não</option></select></label>';

      var el = {};
      container.querySelectorAll('[data-pf]').forEach(function (c) { el[c.getAttribute('data-pf')] = c; });

      // opções: empresas do espelho + status do catálogo (ambos vindos do banco)
      var companies = [];
      try { companies = await window.Store.get('empresas'); } catch (e) { companies = []; }
      el.company.innerHTML = '<option value="">Todas</option>' + (companies || []).map(function (c) {
        return '<option value="' + esc(c.codigo) + '">' + esc(c.nome) + '</option>';
      }).join('');
      var steps = (window.CONFIG && window.CONFIG.STEPS) || {};
      el.status.innerHTML = '<option value="">Todos</option>' + Object.keys(steps).map(function (id) {
        return '<option value="' + esc(id) + '">' + esc(steps[id]) + '</option>';
      }).join('');

      async function refreshBuildings(keepValue) {
        var company = el.company.value;
        el.building.disabled = !company;
        var rows = company ? await loadBuildings(company) : [];
        el.building.innerHTML = '<option value="">Todas</option>' + rows.map(function (o) {
          return '<option value="' + esc(o.codigo) + '">' + esc(o.nome) + '</option>';
        }).join('');
        el.building.value = keepValue || ''; // se a obra salva não existir mais, cai em "Todas"
      }

      function getValues() {
        return {
          company: el.company.value, building: el.building.value,
          from: el.from.value, to: el.to.value, status: el.status.value,
          urgent: el.urgent.value, // '' = todos · '1' = urgentes · '0' = não urgentes
        };
      }
      function persist() { try { localStorage.setItem(storageKey, JSON.stringify(getValues())); } catch (e) { /* storage cheio/indisponível */ } }
      function emit() { persist(); if (opts.onChange) opts.onChange(getValues()); }

      // restaura os filtros salvos ANTES de ligar os listeners (não dispara onChange;
      // o chamador lê getValues() para a carga inicial)
      el.company.value = saved.company || '';
      await refreshBuildings(saved.building || '');
      el.from.value = saved.from || '';
      el.to.value = saved.to || '';
      el.status.value = saved.status || '';
      el.urgent.value = saved.urgent || '';

      el.company.addEventListener('change', async function () { await refreshBuildings(''); emit(); });
      ['building', 'from', 'to', 'status', 'urgent'].forEach(function (k) { el[k].addEventListener('change', emit); });

      return {
        getValues: getValues,
        clear: function () {
          el.company.value = ''; el.building.value = ''; el.building.disabled = true;
          el.building.innerHTML = '<option value="">Todas</option>';
          el.from.value = ''; el.to.value = ''; el.status.value = ''; el.urgent.value = '';
          try { localStorage.removeItem(storageKey); } catch (e) { /* ignore */ }
          if (opts.onChange) opts.onChange(getValues());
        },
      };
    },
  };
})();
