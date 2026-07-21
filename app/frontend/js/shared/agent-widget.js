(function () {
  var ENDPOINT = '/agent/chat';
  var state = { open: false, busy: false, history: [] };
  var els = {};

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  function injectStyles() {
    if (document.getElementById('agw-style')) return;
    var s = document.createElement('style');
    s.id = 'agw-style';
    s.textContent = [
      '.agw-root{position:fixed;right:20px;bottom:20px;z-index:9998;display:none}',
      '.agw-bubble{width:56px;height:56px;border-radius:50%;border:none;cursor:pointer;background:var(--accent,#2563eb);color:#fff;font-size:22px;box-shadow:0 6px 20px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center}',
      '.agw-panel{position:absolute;right:0;bottom:68px;width:360px;max-width:calc(100vw - 40px);height:480px;max-height:calc(100vh - 120px);background:var(--surface,#fff);color:var(--text,#111);border:1px solid var(--border,#e5e7eb);border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.2);display:none;flex-direction:column;overflow:hidden}',
      '.agw-open .agw-panel{display:flex}',
      '.agw-header{padding:12px 14px;font-weight:600;border-bottom:1px solid var(--border,#e5e7eb)}',
      '.agw-body{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px}',
      '.agw-msg{padding:8px 12px;border-radius:12px;max-width:85%;white-space:pre-wrap;word-wrap:break-word;font-size:14px;line-height:1.4}',
      '.agw-user{align-self:flex-end;background:var(--accent,#2563eb);color:#fff}',
      '.agw-assistant{align-self:flex-start;background:var(--surface-3,#f1f2f4);color:var(--text,#1f2937);border:1px solid var(--border,#e5e7eb)}',
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
    var bubble = el('button', 'agw-bubble', '&#128172;');
    var panel = el('div', 'agw-panel');
    panel.appendChild(el('div', 'agw-header', '<span>Assistente</span>'));
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
    bubble.addEventListener('click', toggle);
    form.addEventListener('submit', onSubmit);
  }

  function toggle() {
    state.open = !state.open;
    els.root.classList.toggle('agw-open', state.open);
    if (state.open) els.input.focus();
  }

  function addMessage(role, text) {
    var m = el('div', 'agw-msg agw-' + role);
    m.textContent = text;
    els.body.appendChild(m);
    els.body.scrollTop = els.body.scrollHeight;
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
    addMessage('user', text);
    var priorHistory = state.history.slice();
    state.history.push({ role: 'user', content: text });
    state.busy = true;
    els.send.disabled = true;

    var target = addMessage('assistant', '');
    var acc = '';
    try {
      var resp = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: text, history: priorHistory })
      });
      if (resp.status === 401) { target.textContent = 'Sessão expirada. Faça login novamente.'; return; }
      if (!resp.ok || !resp.body) { target.textContent = 'Falha ao falar com o assistente.'; return; }

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
          if (data.error) acc += '\n[erro] ' + data.error;
          else if (data.delta) acc += data.delta;
          target.textContent = acc;
          scrollBottom();
        }
      }
      state.history.push({ role: 'assistant', content: acc });
    } catch (err) {
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
      state.history = [];
      els.root.classList.remove('agw-open');
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    build();
    var user = (window.Auth && window.Auth.getUser) ? window.Auth.getUser() : null;
    reflect(user);
    if (window.Auth && window.Auth.onChange) window.Auth.onChange(reflect);
  });
})();
