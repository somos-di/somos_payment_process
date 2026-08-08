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
    if (!value) return '—';
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
    reason.placeholder = 'Motivo da reprovação (obrigatório — fica no histórico)…';
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
        + actionField('Empresa', action.empresa || '—')
        + actionField('Obra', action.obra || '—')
        + actionField('Valor', money(action.valor))
        + actionField('Vencimento', fmtDate(action.vencimento))
        + actionField('Descrição', action.descricao || '—')
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
