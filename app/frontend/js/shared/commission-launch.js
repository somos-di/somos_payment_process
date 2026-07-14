// Módulo de LANÇAMENTO MANUAL de comissão (mini app). Isolado do fluxo de pagamento
// (SRP): o Novo Processo apenas o monta quando o tipo escolhido é "Comissão".
// Empreendimento (cadastro) resolve empresa+obra+trilha; sem parcelas/aprovação.
(function () {
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function parseVal(raw) { if (!raw) return NaN; var s = String(raw).replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.'); var n = parseFloat(s); return isNaN(n) ? NaN : n; }
  function fmtBR(n) { return (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function toast(msg, ok) {
    var t = document.createElement('div'); t.textContent = msg;
    t.style.cssText = 'position:fixed;top:16px;right:16px;z-index:10000;padding:10px 14px;border-radius:8px;font-size:14px;box-shadow:var(--shadow-md);'
      + (ok ? 'background:var(--ok-weak);color:#166534' : 'background:var(--danger-weak);color:#9f1239');
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
    + '<div class="cl-sub">Selecione o empreendimento (define a trilha SOMOS/PARTINI). Sem parcelas e sem aprovação — segue direto para validação da trilha.</div>'
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

  // opts: { onDone?: () => void }
  async function mount(host, opts) {
    opts = opts || {};
    host.innerHTML = TEMPLATE;
    var $ = function (id) { return host.querySelector('#' + id); };

    // empreendimentos ATIVOS (o RPC ainda valida a trilha do usuário no banco)
    var byId = {};
    try {
      var rows = (await window.Store.get('comm_empreendimentos') || []).filter(function (e) { return e.active_cem; });
      $('cl-emp').innerHTML = '<option value="">Selecione o empreendimento</option>' + rows.map(function (e) {
        byId[e.id_cem] = e;
        return '<option value="' + esc(e.id_cem) + '">' + esc(e.name_cem) + ' — ' + esc(e.trilha) + '</option>';
      }).join('');
    } catch (e) { $('cl-emp').innerHTML = '<option value="">Erro ao carregar</option>'; toast('Falha ao carregar empreendimentos: ' + e.message); }

    $('cl-value').addEventListener('blur', function () { var n = parseVal(this.value); if (!isNaN(n) && n > 0) this.value = 'R$ ' + fmtBR(n); });

    // Vendedor/corretor/imobiliária e cliente são PESSOAS: mesma busca do fornecedor
    // (v_fornecedores). Ao selecionar preenche o nome (e, no vendedor, o código = id da
    // pessoa); ambos aceitam texto livre para quem ainda não está cadastrado.
    function attachPersonSearch(input, results, onPick) {
      var tmr = null;
      async function search(term) {
        results.innerHTML = '<div class="it">Buscando…</div>'; results.classList.add('show');
        try {
          var rows = await window.Store.get('fornecedores', term || '');
          results.innerHTML = rows.length
            ? rows.map(function (r) { return '<div class="it" data-id="' + r.id + '" data-nome="' + esc(r.nome) + '">' + esc(r.nome) + '<small>' + esc(r.cpf_cnpj || '') + '</small></div>'; }).join('')
            : '<div class="it">Nada encontrado</div>';
          results.querySelectorAll('.it[data-id]').forEach(function (it) {
            it.addEventListener('click', function () {
              input.value = it.getAttribute('data-nome');
              onPick(it.getAttribute('data-id'));
              results.classList.remove('show');
            });
          });
        } catch (e) { results.innerHTML = '<div class="it">' + esc(e.message) + '</div>'; }
      }
      input.addEventListener('focus', function () { search(input.value.trim()); });
      input.addEventListener('input', function () {
        var term = input.value.trim(); onPick('');
        clearTimeout(tmr); tmr = setTimeout(function () { search(term); }, 300);
      });
      document.addEventListener('click', function (e) { if (!input.contains(e.target) && !results.contains(e.target)) results.classList.remove('show'); });
    }
    attachPersonSearch($('cl-seller'), $('cl-seller-results'), function (id) { $('cl-sellerid').value = id; });
    attachPersonSearch($('cl-client'), $('cl-client-results'), function () { /* cliente não tem código */ });

    $('cl-save').addEventListener('click', async function () {
      var emp = byId[$('cl-emp').value];
      var value = parseVal($('cl-value').value);
      var sellerName = $('cl-seller').value.trim();
      var clientName = $('cl-client').value.trim();
      if (!emp) { toast('Selecione o empreendimento.'); return; }
      if (!sellerName) { toast('Informe o vendedor.'); return; }
      if (!clientName) { toast('Informe o cliente.'); return; }
      if (isNaN(value) || value <= 0) { toast('Informe um valor válido.'); return; }

      var sellerId = parseInt(($('cl-sellerid').value || '').replace(/\D/g, ''), 10);
      var payload = {
        company: emp.company_cem, building: emp.building_cem, value: value,
        sellerName: sellerName, clientName: clientName,
        unit: $('cl-unit').value.trim() || undefined,
        saleNum: $('cl-sale').value.trim() || undefined,
        saleDate: $('cl-saledt').value || undefined,
        releaseDate: $('cl-reldt').value || undefined,
        sellerId: isNaN(sellerId) ? undefined : sellerId,
        sellerEmail: $('cl-selleremail').value.trim() || undefined,
        sellerPhone: $('cl-sellerphone').value.trim() || undefined,
        note: $('cl-note').value.trim() || undefined,
      };
      var btn = this; btn.disabled = true; $('cl-status').textContent = 'Lançando…';
      try {
        await window.API.post('/commissions/create', payload);
        window.Store.invalidate('commissions');
        toast('Comissão lançada com sucesso!', true);
        if (typeof opts.onDone === 'function') opts.onDone();
      } catch (e) { $('cl-status').textContent = ''; btn.disabled = false; toast('Erro ao lançar: ' + e.message); }
    });
  }

  window.CommissionLaunch = { mount: mount };
})();
