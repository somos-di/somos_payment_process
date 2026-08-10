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
