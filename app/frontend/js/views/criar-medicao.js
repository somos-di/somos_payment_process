async function initView_criar_medicao() {
  var host = document.getElementById('med-host');
  window.MED_BASE = '/api/v1/medicao';

  wireInlineHandlers(host);

  try {
    var res = await fetch(window.MED_BASE + '/', { credentials: 'same-origin', headers: { Accept: 'text/html' } });
    var text = await res.text();
    if (!res.ok) {
      var msg = res.status === 403
        ? 'Você não tem acesso à Medição. Peça para ser adicionado ao grupo Medição.'
        : 'Falha ao carregar a Medição (HTTP ' + res.status + ').';
      host.innerHTML = '<div class="view-error">' + msg + '</div>';
      return;
    }
    injectDocument(host, text);
  } catch (error) {
    host.innerHTML = '<div class="view-error">Não consegui carregar a Medição: ' + ((error && error.message) || error) + '</div>';
  }

  function wireInlineHandlers(root) {
    function run(el, attr) {
      var code = el.getAttribute(attr);
      var match = code && code.match(/^\s*([A-Za-z_$][\w$]*)\s*\((.*)\)\s*;?\s*$/);
      if (!match) return;
      var fn = window[match[1]];
      if (typeof fn !== 'function') return;
      var argsText = match[2].trim();
      var args = [];
      if (argsText) {
        try { args = JSON.parse('[' + argsText.replace(/'/g, '"') + ']'); } catch (error) { return; }
      }
      fn.apply(null, args);
    }
    root.addEventListener('click', function (event) {
      var el = event.target && event.target.closest && event.target.closest('[onclick]');
      if (el && root.contains(el)) { event.preventDefault(); run(el, 'onclick'); }
    });
    root.addEventListener('change', function (event) {
      var el = event.target && event.target.closest && event.target.closest('[onchange]');
      if (el && root.contains(el)) run(el, 'onchange');
    });
  }

  function injectDocument(target, htmlText) {
    var doc = new DOMParser().parseFromString(htmlText, 'text/html');
    target.innerHTML = '';
    doc.head.querySelectorAll('style, link[rel="stylesheet"]').forEach(function (styleNode) {
      target.appendChild(document.importNode(styleNode, true));
    });
    Array.prototype.slice.call(doc.body.childNodes).forEach(function (node) {
      if (node.nodeType === 1 && node.tagName === 'SCRIPT') return;
      target.appendChild(document.importNode(node, true));
    });
    doc.querySelectorAll('script').forEach(function (old) {
      var script = document.createElement('script');
      script.async = false;
      if (old.src) {
        script.src = old.src;
      } else {
        var blob = new Blob([old.textContent], { type: 'text/javascript' });
        var blobUrl = URL.createObjectURL(blob);
        script.src = blobUrl;
        script.onload = function () { URL.revokeObjectURL(blobUrl); };
      }
      target.appendChild(script);
    });
  }
}
