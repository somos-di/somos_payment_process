(function () {
  var ENDPOINT = '/agent/chat';
  var ROBOT = '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="4.5" y="8" width="15" height="11" rx="2.5"/><path d="M12 8V5"/><circle cx="12" cy="3.4" r="1.2"/><path d="M2.5 12v3M21.5 12v3"/><circle cx="9" cy="13" r="1.3"/><circle cx="15" cy="13" r="1.3"/><path d="M9.5 16.5h5"/></svg>';
  var TYPING = '<span class="agw-typing"><span></span><span></span><span></span></span>';
  var state = { open: false, busy: false, conversationId: null };
  var els = {};

  function newId() {
    if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    return 'c-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
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

  function renderMd(text) {
    var lines = mdEscape(text).split('\n');
    var out = '';
    var list = null;
    function close() { if (list) { out += '</' + list + '>'; list = null; } }
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var h = line.match(/^\s*#{1,6}\s+(.*)$/);
      var ul = line.match(/^\s*[-*]\s+(.*)$/);
      var ol = line.match(/^\s*\d+\.\s+(.*)$/);
      if (h) { close(); out += '<div class="agw-h">' + mdInline(h[1]) + '</div>'; }
      else if (ul) { if (list !== 'ul') { close(); out += '<ul>'; list = 'ul'; } out += '<li>' + mdInline(ul[1]) + '</li>'; }
      else if (ol) { if (list !== 'ol') { close(); out += '<ol>'; list = 'ol'; } out += '<li>' + mdInline(ol[1]) + '</li>'; }
      else if (line.trim() === '') { close(); }
      else { close(); out += '<div>' + mdInline(line) + '</div>'; }
    }
    close();
    return out;
  }

  function injectStyles() {
    if (document.getElementById('agw-style')) return;
    var s = document.createElement('style');
    s.id = 'agw-style';
    s.textContent = [
      '.agw-root{position:fixed;right:20px;bottom:20px;z-index:9998;display:none}',
      '.agw-bubble{width:56px;height:56px;border-radius:50%;border:none;cursor:pointer;background:var(--accent,#2563eb);color:#fff;box-shadow:0 6px 20px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center}',
      '.agw-panel{position:absolute;right:0;bottom:68px;width:360px;max-width:calc(100vw - 40px);height:480px;max-height:calc(100vh - 120px);background:var(--surface,#fff);color:var(--text,#1f2937);border:1px solid var(--border,#e5e7eb);border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.2);display:none;flex-direction:column;overflow:hidden}',
      '.agw-open .agw-panel{display:flex}',
      '.agw-header{padding:12px 14px;font-weight:600;border-bottom:1px solid var(--border,#e5e7eb);display:flex;align-items:center;gap:8px}',
      '.agw-header svg{width:20px;height:20px}',
      '.agw-body{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px}',
      '.agw-msg{padding:8px 12px;border-radius:12px;max-width:85%;word-wrap:break-word;font-size:14px;line-height:1.45}',
      '.agw-user{align-self:flex-end;background:var(--accent,#2563eb);color:#fff;white-space:pre-wrap}',
      '.agw-assistant{align-self:flex-start;background:var(--surface-3,#f1f2f4);color:var(--text,#1f2937);border:1px solid var(--border,#e5e7eb)}',
      '.agw-assistant>div{margin:3px 0}',
      '.agw-assistant .agw-h{font-weight:600;margin:8px 0 3px}',
      '.agw-assistant ul,.agw-assistant ol{margin:4px 0;padding-left:20px}',
      '.agw-assistant li{margin:2px 0}',
      '.agw-assistant strong{font-weight:600}',
      '.agw-assistant code{background:rgba(0,0,0,.08);padding:1px 5px;border-radius:5px;font-size:12px}',
      '.agw-typing{display:inline-flex;gap:4px;align-items:center;padding:2px 0}',
      '.agw-typing span{width:6px;height:6px;border-radius:50%;background:var(--muted,#6b7280);display:inline-block;animation:agw-bounce 1.2s infinite ease-in-out}',
      '.agw-typing span:nth-child(2){animation-delay:.2s}',
      '.agw-typing span:nth-child(3){animation-delay:.4s}',
      '@keyframes agw-bounce{0%,80%,100%{transform:translateY(0);opacity:.4}40%{transform:translateY(-4px);opacity:1}}',
      '.agw-form{display:flex;gap:8px;padding:10px;border-top:1px solid var(--border,#e5e7eb)}',
      '.agw-input{flex:1;padding:9px 12px;border:1px solid var(--border,#e5e7eb);border-radius:10px;font-size:14px;outline:none;background:var(--surface,#fff);color:var(--text,#1f2937)}',
      '.agw-send{border:none;background:var(--accent,#2563eb);color:#fff;border-radius:10px;padding:0 14px;cursor:pointer;font-size:16px}',
      '.agw-send:disabled{opacity:.5;cursor:default}'
    ].join('');
    document.head.appendChild(s);
  }

  function build() {
    injectStyles();
    var root = el('div', 'agw-root');
    var bubble = el('button', 'agw-bubble', ROBOT);
    var panel = el('div', 'agw-panel');
    panel.appendChild(el('div', 'agw-header', ROBOT + '<span>Assistente</span>'));
    var body = el('div', 'agw-body');
    var form = el('form', 'agw-form');
    var input = el('input', 'agw-input');
    input.type = 'text';
    input.placeholder = 'Como posso ajudar?';
    var send = el('button', 'agw-send', '&#10148;');
    send.type = 'submit';
    form.appendChild(input);
    form.appendChild(send);
    panel.appendChild(body);
    panel.appendChild(form);
    root.appendChild(panel);
    root.appendChild(bubble);
    document.body.appendChild(root);

    els = { root: root, bubble: bubble, body: body, form: form, input: input, send: send };
    state.conversationId = newId();
    bubble.addEventListener('click', toggle);
    form.addEventListener('submit', onSubmit);
  }

  function toggle() {
    state.open = !state.open;
    els.root.classList.toggle('agw-open', state.open);
    if (state.open) els.input.focus();
  }

  function addUser(text) {
    var m = el('div', 'agw-msg agw-user');
    m.textContent = text;
    els.body.appendChild(m);
    scrollBottom();
    return m;
  }

  function addAssistant() {
    var m = el('div', 'agw-msg agw-assistant');
    els.body.appendChild(m);
    scrollBottom();
    return m;
  }

  function scrollBottom() {
    els.body.scrollTop = els.body.scrollHeight;
  }

  async function onSubmit(e) {
    e.preventDefault();
    var text = els.input.value.trim();
    if (!text || state.busy) return;
    els.input.value = '';
    addUser(text);
    state.busy = true;
    els.send.disabled = true;

    var target = addAssistant();
    target.innerHTML = TYPING;
    var acc = '';
    var streaming = false;

    function stopTyping() {
      if (!streaming) {
        streaming = true;
        target.innerHTML = '';
      }
    }

    try {
      var resp = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: text, conversation_id: state.conversationId })
      });
      if (resp.status === 401) { stopTyping(); target.textContent = 'Sessão expirada. Faça login novamente.'; return; }
      if (!resp.ok || !resp.body) { stopTyping(); target.textContent = 'Falha ao falar com o assistente.'; return; }

      var reader = resp.body.getReader();
      var decoder = new TextDecoder();
      var buffer = '';
      while (true) {
        var read = await reader.read();
        if (read.done) break;
        buffer += decoder.decode(read.value, { stream: true });
        var frames = buffer.split('\n\n');
        buffer = frames.pop();
        for (var i = 0; i < frames.length; i++) {
          var dataLine = frames[i].split('\n').filter(function (l) { return l.indexOf('data:') === 0; })[0];
          if (!dataLine) continue;
          var payload = dataLine.slice(5).trim();
          if (!payload) continue;
          var data;
          try { data = JSON.parse(payload); } catch (err) { continue; }
          stopTyping();
          if (data.error) acc += '\n[erro] ' + data.error;
          else if (data.delta) acc += data.delta;
          target.innerHTML = renderMd(acc);
          scrollBottom();
        }
      }
      stopTyping();
      if (!acc) target.textContent = 'Sem resposta.';
    } catch (err) {
      stopTyping();
      target.textContent = 'Erro: ' + (err && err.message ? err.message : String(err));
    } finally {
      state.busy = false;
      els.send.disabled = false;
      els.input.focus();
    }
  }

  function reflect(user) {
    if (!els.root) return;
    els.root.style.display = user ? 'block' : 'none';
    if (!user) {
      state.open = false;
      state.conversationId = newId();
      els.root.classList.remove('agw-open');
      els.body.innerHTML = '';
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    build();
    var user = (window.Auth && window.Auth.getUser) ? window.Auth.getUser() : null;
    reflect(user);
    if (window.Auth && window.Auth.onChange) window.Auth.onChange(reflect);
  });
})();
